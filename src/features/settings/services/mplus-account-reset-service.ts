import type { Firestore } from "firebase/firestore";

import {
  millisToTimestamp,
  personalCategoryToFirestore,
  userProfileFromFirestore,
  userProfileToFirestore,
} from "@/lib/mplus/converters";
import { newMutationId } from "@/lib/mplus/ids";
import type { MplusUserProfile } from "@/lib/mplus/models";
import {
  accountDocPath,
  categoryDocPath,
  householdDocPath,
  householdInviteDocPath,
  MPLUS_PATHS,
  userDocPath,
} from "@/lib/mplus/paths";
import { PERSONAL_SEED } from "@/lib/mplus/seeds";
import { buildSeedCategory } from "@/lib/mplus/user-bootstrap";

import {
  createFirestoreResetGateway,
  type MplusResetGateway,
  type ResetOp,
} from "./mplus-reset-gateway";

export class MplusAccountResetError extends Error {
  /** Paso del reinicio en el que ocurrio, si se conoce. */
  readonly step: string | null;

  constructor(message: string, step: string | null = null) {
    super(step ? "[" + step + "] " + message : message);
    this.name = "MplusAccountResetError";
    this.step = step;
  }
}

/**
 * Envuelve un paso para que un fallo diga QUE operacion lo produjo.
 *
 * Sin esto, el reinicio moria con un `Missing or insufficient permissions`
 * pelado: el mensaje no distinguia entre marcar `resetting`, listar
 * invitaciones, leer movimientos compartidos o borrar cuentas, y cada uno de
 * esos pasos tiene una regla distinta detras.
 */
/**
 * Igual que `step`, pero un fallo NO aborta: se anota y se sigue.
 *
 * Es lo que permite reanudar una limpieza interrumpida. Al borrar `members`,
 * el propio usuario deja de ser miembro activo y las Rules le quitan la lectura
 * del Hogar y de sus subcolecciones (`allow read: if currentUserIsActiveMember`).
 * Un segundo intento no puede LEER lo que quedó a medias — pero sí puede
 * seguir borrando el documento del Hogar (`allow delete` usa
 * `fixedHouseholdMember`, que lee por dentro de las Rules) y limpiar todo lo
 * personal. Si estas operaciones abortaran, la cuenta quedaría atrapada en
 * `resetting` para siempre.
 */
const bestEffort = async <T>(
  name: string,
  fallback: T,
  skipped: string[],
  run: () => Promise<T>,
): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    skipped.push(name + ": " + (error instanceof Error ? error.message : String(error)));
    return fallback;
  }
};

const step = async <T>(name: string, run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof MplusAccountResetError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new MplusAccountResetError(message, name);
  }
};

export type MplusAccountResetResult = {
  success: boolean;
  /** Movimientos propios borrados (activos y Papelera). */
  deletedOwnMovementsCount: number;
  /** Movimientos compartidos borrados que pertenecían al otro miembro. */
  deletedPartnerSharedMovementsCount: number;
  deletedAccountsCount: number;
  deletedCategoriesCount: number;
  deletedHouseholdId: string | null;
  /** Documentos borrados por subcolección del Hogar, para verificar residuos. */
  deletedHouseholdDocsBySubcollection: Record<string, number>;
  deletedInvitesCount: number;
  /** `true` si `users/{uid}` quedó eliminado y la cuenta arranca de cero. */
  deletedUserProfile: boolean;
  /** Solo > 0 en el camino de respaldo, cuando el perfil NO se pudo eliminar. */
  recreatedSeedCategoriesCount: number;
  /** Lo que NO se pudo limpiar y por que. Nunca se silencia. */
  skipped: string[];
};

/**
 * Contrato §19.4: las consultas de limpieza usan lotes máximos de 200
 * documentos. `writeBatch` además revienta a las 500 operaciones, así que un
 * lote sin acotar fallaba en cuanto QA acumulaba datos.
 */
export const MAX_RESET_BATCH_DOCS = 200;

/** Subcolecciones de `households/{id}` según el mapa de colecciones (contrato §5). */
export const HOUSEHOLD_SUBCOLLECTIONS = [
  MPLUS_PATHS.memberCategoryLabels,
  MPLUS_PATHS.memberAccountLabels,
  MPLUS_PATHS.categoryMappings,
  MPLUS_PATHS.expenseCategories,
  MPLUS_PATHS.closureApprovals,
  MPLUS_PATHS.members,
] as const;

/** Aplica las operaciones en lotes acotados, en orden. */
const commitInChunks = async (
  gateway: MplusResetGateway,
  ops: readonly ResetOp[],
  chunkSize = MAX_RESET_BATCH_DOCS,
): Promise<void> => {
  for (let i = 0; i < ops.length; i += chunkSize) {
    await gateway.commit(ops.slice(i, i + chunkSize));
  }
};

/**
 * Borra una colección completa releyendo hasta que no quede nada, en vez de
 * confiar en una sola pasada. Devuelve cuántos documentos eliminó.
 */
const deleteCollectionDocs = async (
  gateway: MplusResetGateway,
  path: readonly string[],
): Promise<number> => {
  let deleted = 0;
  for (;;) {
    const docs = await gateway.listCollection(path);
    if (docs.length === 0) return deleted;

    await commitInChunks(
      gateway,
      docs.map((d) => ({ kind: "delete", path: d.path }) as ResetOp),
    );
    deleted += docs.length;

    if (docs.length < MAX_RESET_BATCH_DOCS) return deleted;
  }
};

/**
 * Servicio de Reinicio Profundo de Cuenta M+ (DEC-080, especificación §20,
 * contrato §17). Función de producto ubicada en Ajustes (zona peligrosa).
 *
 * Espejo del `runResumableSequence` de Android
 * (`MplusAccountResetRepository`), adaptado a que Web escribe SIEMPRE contra
 * Firestore y no tiene Room ni cola: cada paso se ejecuta directo y es
 * idempotente, así que reintentar tras una interrupción retoma donde quedó.
 *
 * Orden (el documento del Hogar se borra al final a propósito: mientras exista,
 * un reintento vuelve a entrar a limpiar sus residuos):
 *
 * 1. `users/{uid}.status = "resetting"` — es lo que habilita en Rules el
 *    borrado físico excepcional de movimientos y categorías propios.
 * 2. Si hay Hogar: invitaciones, movimientos compartidos de AMBOS miembros,
 *    subcolecciones (`members` la última) y, por último, el documento del
 *    Hogar. Los compartidos van ANTES que `members` porque `allow list` de
 *    `movements` exige membresía ACTIVA para ver un documento ajeno.
 * 3. Movimientos propios (activos y Papelera), decrementando el contador de la
 *    cuenta referenciada en la MISMA escritura.
 * 4. Cuentas propias, ya con `referenceCount = 0`.
 * 5. Categorías propias.
 * 6. **Eliminación de `users/{uid}`**, para que la cuenta arranque de cero.
 *    Las Rules lo permiten justo en este estado
 *    (`allow delete: if ownsPath(uid) && resource.data.status == 'resetting'`),
 *    y es lo mismo que hace Android en `deleteAccountAndClear`. No hay reseed:
 *    al volver a entrar, `ensureMplusUserBootstrap` crea el perfil y el
 *    catálogo base como si fuera un usuario nuevo.
 *
 * Camino de respaldo: si esa eliminación falla, el perfil se deja en `ready` y
 * se resiembra el catálogo. Es peor —conserva el historial de `revision`— pero
 * evita lo único inaceptable: dejar la cuenta atrapada en `resetting`, estado
 * en el que las Rules niegan toda escritura nueva.
 *
 * Lo que este servicio NO hace, y no es un olvido:
 *
 * - **No toca `users/{otherUid}`.** Rules solo permiten `get`/`update` del
 *   documento propio (`ownsPath(uid)`), así que leer el perfil del compañero
 *   devolvía `PERMISSION_DENIED` y abortaba el reinicio a media limpieza. La
 *   desvinculación del otro miembro la hace su propio cliente al abrir la app
 *   y no encontrar el Hogar (contrato §16.3,
 *   `reconcileOrphanHouseholdLink`).
 * - **No corrige el `referenceCount` de las cuentas del compañero.** Sus
 *   cuentas son suyas y Rules no permiten escribirlas.
 */
export async function executeMplusAccountReset(
  db: Firestore | null,
  uid: string,
  gatewayOverride?: MplusResetGateway,
): Promise<MplusAccountResetResult> {
  if (!uid) {
    throw new MplusAccountResetError("UID no válido para reinicio de cuenta.");
  }

  const gateway =
    gatewayOverride ??
    (db
      ? createFirestoreResetGateway(db)
      : (() => {
          throw new MplusAccountResetError("Sin acceso a Firestore para reiniciar.");
        })());

  const userPath = userDocPath(uid);
  const userData = await step("leer perfil propio", () => gateway.readDoc(userPath));
  if (!userData) {
    throw new MplusAccountResetError("El usuario a reiniciar no existe en Firestore.");
  }

  const userProfile = userProfileFromFirestore(uid, userData as never);
  const now = Date.now();

  // ── Paso 1: marcar `resetting` ──────────────────────────────────────────
  // Idempotente: si un intento anterior ya lo dejó así, no se vuelve a subir la
  // revisión (reintentar no debe chocar con la revisión ya avanzada).
  let currentProfile = userProfile;
  if (userProfile.status !== "resetting") {
    const resettingProfile: MplusUserProfile = {
      ...userProfile,
      status: "resetting",
      resetRequestedAtMillis: now,
      revision: userProfile.revision + 1,
      lastMutationId: newMutationId(),
      updatedAtMillis: now,
    };
    await step("marcar perfil como resetting", () =>
      gateway.commit([
        { kind: "set", path: userPath, data: userProfileToFirestore(resettingProfile) },
      ]),
    );
    currentProfile = resettingProfile;
  }

  let deletedOwnMovementsCount = 0;
  let deletedPartnerSharedMovementsCount = 0;
  let deletedInvitesCount = 0;
  let deletedHouseholdId: string | null = null;
  const deletedHouseholdDocsBySubcollection: Record<string, number> = {};
  const skipped: string[] = [];

  // ── Paso 2: destrucción del Hogar (DEC-080) ─────────────────────────────
  const householdId = userProfile.householdId;
  if (householdId) {
    deletedHouseholdId = householdId;
    const householdPath = householdDocPath(householdId);
    // Best-effort a propósito: en un reintento tras una corrida interrumpida
    // este documento ya no es legible (los `members` se borraron y con ellos
    // la membresía activa que exige `allow get`). Sin `activeInviteId` se
    // sigue: el resto del borrado no depende de él.
    const householdData = await bestEffort(
      "leer documento del Hogar",
      null as Record<string, unknown> | null,
      skipped,
      () => gateway.readDoc(householdPath),
    );

    // Las invitaciones se recogen de las TRES fuentes que usa Android: el
    // `activeInviteId` del Hogar, las que apuntan al Hogar y las que creó este
    // usuario (huérfanas de un Hogar anterior ya borrado). Buscar solo por
    // `householdId` dejaba residuos.
    const inviteIds = new Set<string>();

    const activeInviteId = householdData?.activeInviteId;
    if (typeof activeInviteId === "string" && activeInviteId.length > 0) {
      inviteIds.add(activeInviteId);
    }

    // Las dos consultas dependen de que el perfil ya este `resetting`
    // (`allow list` de `householdInvites`). Son best-effort a proposito: una
    // invitacion que no se pueda listar no puede bloquear el borrado de todo lo
    // demas, igual que en Android (`runCatching`). El `activeInviteId` del
    // Hogar, que es el caso normal, ya esta recogido arriba sin depender de
    // ninguna consulta.
    for (const [field, value] of [
      ["householdId", householdId],
      ["createdBy", uid],
    ] as const) {
      try {
        for (const invite of await gateway.queryByField(
          MPLUS_PATHS.householdInvites,
          field,
          value,
        )) {
          inviteIds.add(invite.id);
        }
      } catch (error) {
        skipped.push(
          "invitaciones por " + field + ": " +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    }

    const inviteIdList = [...inviteIds];
    await step("borrar invitaciones del Hogar", () =>
      commitInChunks(
        gateway,
        inviteIdList.map(
          (id) => ({ kind: "delete", path: householdInviteDocPath(id) }) as ResetOp,
        ),
      ),
    );
    deletedInvitesCount = inviteIdList.length;

    // Las subcolecciones se recorren completas AUNQUE el documento del Hogar ya
    // no exista: un intento interrumpido pudo borrarlo dejando residuos detrás.
    // Los movimientos compartidos van ANTES que las subcolecciones, y no es
    // un detalle de estilo: `allow list` de `movements` solo deja ver un
    // documento ajeno si quien consulta es miembro ACTIVO del Hogar. Borrar
    // `members` primero destruye la propia membresía que esta consulta
    // necesita, y los compartidos de la pareja quedaban sin borrar.
    // El filtro `lifecycleState == "active"` NO es opcional: las Rules solo
    // dejan LISTAR un movimiento ajeno si esta activo (§9.5: en Papelera el otro
    // miembro pierde la lectura de inmediato). Sin el, la consulta devolvia
    // tambien los de Papelera de la pareja y el servidor rechazaba la consulta
    // ENTERA con "Missing or insufficient permissions".
    //
    // Consecuencia asumida y reportada: los movimientos compartidos que la
    // pareja tenga en Papelera no son alcanzables desde aqui. DEC-080 pide
    // borrarlos; las Rules desplegadas no permiten ni verlos. Se anota en
    // `skipped` en vez de fingir que se limpiaron.
    const shared = await bestEffort(
      "leer movimientos compartidos",
      [] as Awaited<ReturnType<typeof gateway.queryByField>>,
      skipped,
      () =>
        gateway.queryByField(MPLUS_PATHS.movements, "householdId", householdId, {
          field: "lifecycleState",
          value: "active",
        }),
    );
    const partnerShared = shared.filter((d) => d.data.ownerId !== uid);
    await bestEffort(
      "borrar movimientos compartidos de la pareja",
      undefined,
      skipped,
      () =>
        commitInChunks(
          gateway,
          partnerShared.map((d) => ({ kind: "delete", path: d.path }) as ResetOp),
        ),
    );
    deletedPartnerSharedMovementsCount = partnerShared.length;

    // `members` va al final de la lista a propósito: borrarlo retira la
    // membresía activa del propio usuario y con ella el permiso de lectura
    // sobre las demás subcolecciones.
    for (const subName of HOUSEHOLD_SUBCOLLECTIONS) {
      deletedHouseholdDocsBySubcollection[subName] = await bestEffort(
        "limpiar " + subName + " del Hogar",
        0,
        skipped,
        () => deleteCollectionDocs(gateway, [...householdPath, subName]),
      );
    }

    // Movimientos compartidos de AMBOS miembros. Los del compañero se borran sin
    // tocar contadores: Rules solo exigen el decremento cuando quien borra es el
    // dueño del movimiento (`deleteAccountCounterIsValid`), y las cuentas ajenas
    // no son escribibles.
    skipped.push(
      "movimientos compartidos de la pareja en Papelera: las Rules no permiten listarlos (§9.5)",
    );

    // El documento del Hogar, al final.
    // Se intenta SIEMPRE, aunque la lectura de arriba haya fallado: `allow
    // delete` no exige membresía activa, solo `fixedHouseholdMember` (que las
    // Rules resuelven leyendo por dentro) más el perfil en `resetting`. Si el
    // documento ya no existe, el borrado es inocuo.
    await bestEffort("borrar documento del Hogar", undefined, skipped, () =>
      gateway.commit([{ kind: "delete", path: householdPath }]),
    );
  }

  // ── Paso 3: movimientos propios, con el contador de cuenta ──────────────
  // Rules (`deleteAccountCounterIsValid`) exigen que borrar un movimiento propio
  // con `accountId` venga acompañado, en la MISMA escritura, de un
  // `referenceCount - 1` en esa cuenta con `lastReferenceMovementId` apuntando
  // al movimiento borrado. Y `accountReferenceDecreaseIsBacked` solo admite un
  // decremento de exactamente uno por escritura, así que una misma cuenta no
  // puede aparecer dos veces en el mismo lote: de ahí las rondas.
  const ownMovements = await step("leer movimientos propios", () =>
    gateway.queryByField(MPLUS_PATHS.movements, "ownerId", uid),
  );

  const movementsWithoutAccount: ResetDocLike[] = [];
  const movementsByAccount = new Map<string, ResetDocLike[]>();

  for (const movement of ownMovements) {
    const accountId = movement.data.accountId;
    if (typeof accountId === "string" && accountId.length > 0) {
      const list = movementsByAccount.get(accountId) ?? [];
      list.push({ id: movement.id, path: movement.path });
      movementsByAccount.set(accountId, list);
    } else {
      movementsWithoutAccount.push({ id: movement.id, path: movement.path });
    }
  }

  await step("borrar movimientos propios sin cuenta", () =>
    commitInChunks(
      gateway,
      movementsWithoutAccount.map((m) => ({ kind: "delete", path: m.path }) as ResetOp),
    ),
  );
  deletedOwnMovementsCount += movementsWithoutAccount.length;

  // Estado local de cada cuenta afectada, para ir bajando su contador.
  const accountState = new Map<
    string,
    { referenceCount: number; revision: number; exists: boolean }
  >();
  for (const accountId of movementsByAccount.keys()) {
    const accountData = await step("leer cuenta referenciada", () =>
      gateway.readDoc(accountDocPath(uid, accountId)),
    );
    if (!accountData) {
      accountState.set(accountId, { referenceCount: 0, revision: 0, exists: false });
      continue;
    }
    // Se leen los dos números crudos en vez de pasar por el converter: durante
    // una limpieza destructiva, un documento con una forma vieja o incompleta no
    // puede abortar el reinicio entero. Solo hacen falta contador y revisión.
    const referenceCount = accountData.referenceCount;
    const revision = accountData.revision;
    accountState.set(accountId, {
      referenceCount: typeof referenceCount === "number" ? referenceCount : 0,
      revision: typeof revision === "number" ? revision : 0,
      exists: true,
    });
  }

  for (let round = 0; ; round += 1) {
    const ops: ResetOp[] = [];

    for (const [accountId, movements] of movementsByAccount) {
      const movement = movements[round];
      if (!movement) continue;

      const state = accountState.get(accountId);

      if (!state || !state.exists) {
        // Sin cuenta que actualizar, Rules no piden contador.
        ops.push({ kind: "delete", path: movement.path });
        deletedOwnMovementsCount += 1;
        continue;
      }

      // Contador ya en cero con movimientos que todavía lo referencian: los
      // datos están desincronizados. Las Rules exigen
      // `data.referenceCount == resource.data.referenceCount - 1`, así que aquí
      // NO hay decremento válido posible y tampoco se puede borrar el
      // movimiento (`deleteAccountCounterIsValid` lo bloquea).
      //
      // Antes esto se disfrazaba con `Math.max(0, …)`, que produce un
      // decremento inválido (0 == -1) y hacía que el servidor rechazara la
      // escritura y abortara TODO el reinicio. Se reporta y se sigue: el resto
      // de la limpieza vale más que este documento suelto.
      if (state.referenceCount <= 0) {
        skipped.push(
          "movimiento " + movement.id + ": la cuenta " + accountId +
            " ya tiene referenceCount 0 y las Rules no permiten bajarlo más",
        );
        continue;
      }

      const nextCount = state.referenceCount - 1;
      const nextRevision = state.revision + 1;

      ops.push({ kind: "delete", path: movement.path });
      ops.push({
        kind: "update",
        path: accountDocPath(uid, accountId),
        data: {
          referenceCount: nextCount,
          lastReferenceMovementId: movement.id,
          revision: nextRevision,
          lastMutationId: newMutationId(),
          updatedAt: millisToTimestamp(Date.now()),
        },
      });
      deletedOwnMovementsCount += 1;

      accountState.set(accountId, {
        referenceCount: nextCount,
        revision: nextRevision,
        exists: true,
      });
    }

    if (ops.length === 0) break;
    await step("borrar movimientos propios con cuenta", () =>
      commitInChunks(gateway, ops),
    );
  }

  // ── Paso 4: cuentas propias (ya sin referencias) ────────────────────────
  // Antes de borrar, se comprueba cuáles quedaron con referencias vivas.
  // `allow delete` de una cuenta exige `referenceCount == 0`, así que una
  // cuenta descuadrada es rechazada por el servidor con un
  // `Missing or insufficient permissions` que no dice NADA sobre la causa.
  // Reportar el contador convierte el siguiente intento en autodiagnóstico.
  const accountsPath = [...userDocPath(uid), MPLUS_PATHS.accounts];
  const remainingAccounts = await bestEffort(
    "revisar cuentas antes de borrarlas",
    [] as Awaited<ReturnType<typeof gateway.listCollection>>,
    skipped,
    () => gateway.listCollection(accountsPath),
  );

  for (const account of remainingAccounts) {
    const count = account.data.referenceCount;
    if (typeof count === "number" && count !== 0) {
      skipped.push(
        "cuenta " + account.id + ": referenceCount = " + count +
          " (las Rules solo permiten borrarla en 0); quedaron movimientos apuntándola o el contador está descuadrado",
      );
    }
  }

  // Best-effort: una cuenta con el contador desincronizado no puede impedir que
  // el perfil vuelva a `ready`, que es lo que desatasca la sesión.
  const deletedAccountsCount = await bestEffort(
    "borrar cuentas propias",
    0,
    skipped,
    () => deleteCollectionDocs(gateway, accountsPath),
  );

  // ── Paso 5: categorías propias ──────────────────────────────────────────
  const deletedCategoriesCount = await bestEffort(
    "borrar categorias propias",
    0,
    skipped,
    () => deleteCollectionDocs(gateway, [...userDocPath(uid), MPLUS_PATHS.categories]),
  );

  // ── Paso 6: eliminar el perfil para arrancar de cero ────────────────────
  let deletedUserProfile = false;
  let recreatedSeedCategoriesCount = 0;

  try {
    await gateway.commit([{ kind: "delete", path: userPath }]);
    deletedUserProfile = true;
  } catch (error) {
    // No se pudo borrar el perfil. Lo único inaceptable ahora sería dejarlo en
    // `resetting`: en ese estado las Rules niegan toda escritura y la cuenta
    // queda inservible. Se cae al camino anterior — `ready` + reseed — y se
    // reporta, en vez de fingir que el reinicio salió limpio.
    skipped.push(
      "eliminar el perfil users/{uid}: " +
        (error instanceof Error ? error.message : String(error)) +
        "; se deja la cuenta en ready con el catálogo base",
    );
    await restoreProfileToReady();
    recreatedSeedCategoriesCount = PERSONAL_SEED.length;
  }

  return {
    success: true,
    deletedOwnMovementsCount,
    deletedPartnerSharedMovementsCount,
    deletedAccountsCount,
    deletedCategoriesCount,
    deletedHouseholdId,
    deletedHouseholdDocsBySubcollection,
    deletedInvitesCount,
    deletedUserProfile,
    recreatedSeedCategoriesCount,
    skipped,
  };

  // ── Camino de respaldo ──────────────────────────────────────────────────
  //
  // Solo se usa si NO se pudo eliminar `users/{uid}`. Deja la cuenta usable
  // (`ready` + catálogo base) en vez de atrapada en `resetting`, aunque conserve
  // el historial de `revision` y por tanto no arranque del todo de cero.
  async function restoreProfileToReady(): Promise<void> {
    const readyProfile: MplusUserProfile = {
      ...currentProfile,
      status: "ready",
      householdId: null,
      householdMembershipState: "none",
      resetRequestedAtMillis: null,
      personalCatalogVersion: 1,
      revision: currentProfile.revision + 1,
      lastMutationId: newMutationId(),
      updatedAtMillis: Date.now(),
    };

    await step("dejar el perfil en ready", () =>
      gateway.commit([
        { kind: "set", path: userPath, data: userProfileToFirestore(readyProfile) },
      ]),
    );

    // El reseed va DESPUÉS de `ready`: `validPersonalCategoryCreate` exige
    // `status == 'ready'`. Best-effort — la cuenta ya está desatascada y un
    // fallo al sembrar lo completa el bootstrap del próximo login.
    const seedNow = Date.now();
    const seedMutationId = newMutationId();
    await bestEffort("resembrar catalogo Personal", undefined, skipped, () =>
      commitInChunks(
        gateway,
        PERSONAL_SEED.map((seed) => {
          const cat = buildSeedCategory(uid, seed, seedNow, seedMutationId);
          return {
            kind: "set",
            path: categoryDocPath(uid, cat.id),
            data: personalCategoryToFirestore(cat),
          } as ResetOp;
        }),
      ),
    );
  }
}

type ResetDocLike = Readonly<{ id: string; path: readonly string[] }>;
