import assert from "node:assert/strict";

import {
  executeMplusAccountReset,
  resumeAccountResetIfNeeded,
  HOUSEHOLD_SUBCOLLECTIONS,
  MAX_RESET_BATCH_DOCS,
} from "../../src/features/settings/services/mplus-account-reset-service";
import { completeResetSessionExit } from "../../src/features/auth/session-exit";
import { useAuthStore } from "../../src/stores/auth-store";
import type {
  MplusResetGateway,
  ResetDoc,
  ResetOp,
} from "../../src/features/settings/services/mplus-reset-gateway";
import { PERSONAL_SEED } from "../../src/lib/mplus/seeds";

/**
 * Reinicio Profundo de cuenta (DEC-080, especificación §20, contrato §17).
 *
 * El servicio antes llamaba al SDK de Firestore directo, así que ninguna prueba
 * podía ver QUÉ borraba. Aquí se ejecuta el flujo real contra un almacén en
 * memoria que además HACE CUMPLIR las reglas desplegadas en
 * `android/firestore.rules`. Sin esa parte, la prueba solo comprobaría que el
 * código hace lo que el código hace; con ella, comprueba que lo que hace es
 * aceptable para el servidor.
 *
 * Reglas modeladas (las que el reinicio puede violar):
 *
 * - `users/{uid}`: `allow get/update: if ownsPath(uid)` — nadie lee ni escribe
 *   el perfil de otro usuario.
 * - `movements/{id}` `allow delete`: exige `status == 'resetting'` del dueño y
 *   `deleteAccountCounterIsValid(movementId)`.
 * - `accountReferenceDecreaseIsBacked`: el contador baja de UNO en UNO y
 *   `lastReferenceMovementId` debe apuntar al movimiento borrado en esa misma
 *   escritura.
 * - `users/{uid}/accounts/{id}` `allow delete`: exige `referenceCount == 0`.
 * - Lote de Firestore: como mucho 500 operaciones; el contrato §19.4 aprieta a
 *   200.
 * - **`allow list` de `movements`**: una consulta solo es valida si TODOS los
 *   documentos que devuelve pasan la regla. Un documento ajeno solo se puede
 *   listar si esta `active`, asi que consultar por `householdId` sin filtrar el
 *   ciclo de vida devuelve tambien los de Papelera de la pareja y el servidor
 *   rechaza la consulta entera. Este caso NO estaba modelado y por eso la
 *   suite daba verde mientras la app real fallaba con
 *   `Missing or insufficient permissions`.
 * - **`allow list` de `householdInvites`**: solo con el perfil en `resetting`.
 * - **`allow delete` de `users/{uid}`**: solo con el perfil en `resetting`.
 *   Es lo que permite que la cuenta arranque de cero, igual que hace Android en
 *   `deleteAccountAndClear`.
 * - **`allow create` de `users/{uid}/categories`**: exige el perfil en
 *   `ready` (`validPersonalCategoryCreate`). Sembrar todavia en `resetting`
 *   se rechaza — era el ultimo paso y fallaba con todo ya borrado.
 * - **`allow get/read` del Hogar y sus subcolecciones**: exigen membresia
 *   ACTIVA. Al borrar `members` el propio usuario la pierde, asi que un
 *   reintento ya no puede LEER lo que quedo a medias — pero si debe poder
 *   terminar de borrar.
 */

console.log("Running unit tests for mplus-account-reset-flow.test.ts...");

const UID = "uid-a";
const PARTNER_UID = "uid-b";
const HOUSEHOLD_ID = "hh-1";

const key = (path: readonly string[]) => path.join("/");

class RulesViolation extends Error {
  constructor(message: string) {
    super("PERMISSION_DENIED: " + message);
    this.name = "RulesViolation";
  }
}

type Store = Map<string, Record<string, unknown>>;

/** Gateway en memoria que aplica las Rules relevantes. */
const createFakeGateway = (
  store: Store,
  authUid: string,
): MplusResetGateway & { commits: ResetOp[][] } => {
  const commits: ResetOp[][] = [];

  const assertOwnUserDoc = (path: readonly string[]) => {
    if (path[0] === "users" && path.length === 2 && path[1] !== authUid) {
      throw new RulesViolation(
        `users/${path[1]} no es accesible: Rules solo permiten el documento propio`,
      );
    }
  };

  const gateway: MplusResetGateway & { commits: ResetOp[][] } = {
    commits,

    readDoc: async (path) => {
      assertOwnUserDoc(path);
      // `households/{id}` `allow get`: doc inexistente, o miembro activo.
      if (path[0] === "households" && path.length === 2) {
        const exists = store.has(key(path));
        const isActiveMember = store.has(
          "households/" + path[1] + "/members/" + authUid,
        );
        if (exists && !isActiveMember) {
          throw new RulesViolation(
            "leer households/" + path[1] + " exige membresia activa",
          );
        }
      }
      return store.get(key(path)) ?? null;
    },

    listCollection: async (path) => {
      if (path[0] === "householdInvites") {
        throw new RulesViolation(
          "listar toda la coleccion householdInvites sin where esta prohibido por Rules",
        );
      }
      // Subcolecciones de Hogar: `allow read: if currentUserIsActiveMember`.
      if (path[0] === "households" && path.length === 3) {
        const isActiveMember = store.has(
          "households/" + path[1] + "/members/" + authUid,
        );
        if (!isActiveMember) {
          throw new RulesViolation(
            "listar " + path[2] + " del Hogar exige membresia activa",
          );
        }
      }
      const prefix = key(path) + "/";
      const out: ResetDoc[] = [];
      for (const [k, data] of store) {
        if (!k.startsWith(prefix)) continue;
        const rest = k.slice(prefix.length);
        if (rest.includes("/")) continue; // subcolecciones más profundas no
        out.push({ id: rest, path: [...path, rest], data });
      }
      return out;
    },

    queryByField: async (collectionName, field, value, extra) => {
      const userStatus = (store.get("users/" + authUid)?.status ?? null) as string | null;

      if (collectionName === "householdInvites") {
        if (userStatus !== "resetting") {
          throw new RulesViolation(
            "listar householdInvites exige el perfil propio en resetting",
          );
        }
        if (field !== "createdBy" && field !== "householdId") {
          throw new RulesViolation(
            "listar householdInvites solo permite where por createdBy o householdId",
          );
        }
      }

      const out: ResetDoc[] = [];
      for (const [k, data] of store) {
        const parts = k.split("/");
        if (parts.length !== 2 || parts[0] !== collectionName) continue;
        if (data[field] !== value) continue;
        if (extra && data[extra.field] !== extra.value) continue;
        out.push({ id: parts[1], path: parts, data });
      }

      // `allow list` se evalua contra CADA documento devuelto: basta que uno
      // falle para que la consulta entera sea rechazada.
      if (collectionName === "movements") {
        for (const doc of out) {
          const isOwn = doc.data.ownerId === authUid;
          const listableAsShared =
            doc.data.lifecycleState === "active" &&
            doc.data.householdId != null &&
            store.has("households/" + doc.data.householdId + "/members/" + authUid);
          if (!isOwn && !listableAsShared) {
            throw new RulesViolation(
              "la consulta devuelve " + doc.id +
                ", un movimiento ajeno que no esta active: allow list lo rechaza y con el la consulta entera",
            );
          }
        }
      }

      return out;
    },

    commit: async (ops) => {
      commits.push([...ops]);

      if (ops.length > 500) {
        throw new RulesViolation("un writeBatch no admite más de 500 operaciones");
      }
      if (ops.length > MAX_RESET_BATCH_DOCS) {
        throw new RulesViolation(
          `el contrato §19.4 limita los lotes de limpieza a ${MAX_RESET_BATCH_DOCS} documentos`,
        );
      }

      const userStatus = (store.get(`users/${authUid}`)?.status ?? null) as string | null;

      // Actualizaciones de cuenta presentes en ESTE lote, para validar el
      // contador de los movimientos que se borran junto a ellas.
      const accountUpdates = new Map<string, Record<string, unknown>>();
      for (const op of ops) {
        if (op.kind !== "update") continue;
        if (op.path[0] === "users" && op.path[2] === "accounts") {
          const accountKey = key(op.path);
          if (accountUpdates.has(accountKey)) {
            throw new RulesViolation(
              `la cuenta ${accountKey} se actualiza dos veces en el mismo lote`,
            );
          }
          accountUpdates.set(accountKey, op.data);
        }
      }

      // El estado del perfil DESPUES de este lote: un mismo batch puede
      // dejarlo en `ready` y crear categorias, y las Rules evaluan contra el
      // estado resultante.
      let statusAfter = userStatus;
      for (const op of ops) {
        if (op.kind === "set" && key(op.path) === "users/" + authUid) {
          statusAfter = (op.data.status ?? null) as string | null;
        }
      }

      for (const op of ops) {
        assertOwnUserDoc(op.path);

        // `allow create` de categorias propias: exige el perfil en `ready`.
        if (
          op.kind === "set" &&
          op.path[0] === "users" &&
          op.path[2] === "categories" &&
          op.path.length === 4 &&
          !store.has(key(op.path)) &&
          statusAfter !== "ready"
        ) {
          throw new RulesViolation(
            "crear " + key(op.path) + " exige el perfil en ready, no en " + String(statusAfter),
          );
        }

        if (op.kind !== "delete") continue;

        // --- movements/{id} ---
        if (op.path[0] === "movements" && op.path.length === 2) {
          const movement = store.get(key(op.path));
          if (!movement) continue;
          const ownerId = movement.ownerId as string;

          if (ownerId === authUid && userStatus !== "resetting") {
            throw new RulesViolation(
              "borrar un movimiento propio activo exige status = resetting",
            );
          }

          const accountId = movement.accountId as string | null | undefined;
          // `deleteAccountCounterIsValid`: solo aplica al dueño y si la cuenta existe.
          if (ownerId === authUid && typeof accountId === "string" && accountId) {
            const accountKey = `users/${ownerId}/accounts/${accountId}`;
            const account = store.get(accountKey);
            if (account) {
              const update = accountUpdates.get(accountKey);
              if (!update) {
                throw new RulesViolation(
                  `borrar ${key(op.path)} exige decrementar ${accountKey} en la misma escritura`,
                );
              }
              const before = account.referenceCount as number;
              if (update.referenceCount !== before - 1) {
                throw new RulesViolation(
                  `${accountKey}: el contador debe bajar exactamente 1 (era ${before}, se pidió ${String(update.referenceCount)})`,
                );
              }
              if (update.lastReferenceMovementId !== op.path[1]) {
                throw new RulesViolation(
                  `${accountKey}: lastReferenceMovementId debe apuntar al movimiento borrado`,
                );
              }
            }
          }
        }

        // --- users/{uid} ---
        if (op.path[0] === "users" && op.path.length === 2) {
          if (userStatus !== "resetting") {
            throw new RulesViolation(
              "borrar users/" + op.path[1] + " exige status = resetting",
            );
          }
        }

        // --- users/{uid}/accounts/{id} ---
        if (op.path[0] === "users" && op.path[2] === "accounts" && op.path.length === 4) {
          const account = store.get(key(op.path));
          if (account && (account.referenceCount as number) !== 0) {
            throw new RulesViolation(
              `${key(op.path)}: no se puede borrar una cuenta con referenceCount = ${String(account.referenceCount)}`,
            );
          }
        }

        // --- users/{uid}/categories/{id} ---
        if (
          op.path[0] === "users" &&
          op.path[2] === "categories" &&
          userStatus !== "resetting"
        ) {
          throw new RulesViolation("borrar categorías propias exige status = resetting");
        }
      }

      // Aplicar
      for (const op of ops) {
        const k = key(op.path);
        if (op.kind === "delete") store.delete(k);
        else if (op.kind === "set") store.set(k, { ...op.data });
        else store.set(k, { ...(store.get(k) ?? {}), ...op.data });
      }
    },
  };

  return gateway;
};

// ── Fixture: usuario con Hogar, pareja y residuos en todas las subcolecciones ──

const buildStore = (): Store => {
  const store: Store = new Map();

  store.set(`users/${UID}`, {
    schemaVersion: 1,
    status: "ready",
    householdId: HOUSEHOLD_ID,
    householdMembershipState: "active",
    personalCatalogVersion: 1,
    revision: 4,
    lastMutationId: "mut-user",
    createdAt: { seconds: 1, nanoseconds: 0 },
    updatedAt: { seconds: 1, nanoseconds: 0 },
    resetRequestedAt: null,
  });

  // El perfil de la pareja existe pero NO debe tocarse.
  store.set(`users/${PARTNER_UID}`, {
    schemaVersion: 1,
    status: "ready",
    householdId: HOUSEHOLD_ID,
    householdMembershipState: "active",
    personalCatalogVersion: 1,
    revision: 2,
    lastMutationId: "mut-b",
    createdAt: { seconds: 1, nanoseconds: 0 },
    updatedAt: { seconds: 1, nanoseconds: 0 },
    resetRequestedAt: null,
  });

  // Cuentas propias: una con 3 referencias, otra con 1, otra sin uso.
  const account = (id: string, referenceCount: number) => ({
    schemaVersion: 1,
    ownerId: UID,
    name: id,
    iconKey: "bank",
    colorHex: "#000000",
    state: "active",
    referenceCount,
    lastReferenceMovementId: null,
    revision: 1,
    lastMutationId: "mut-acc",
    createdAt: { seconds: 1, nanoseconds: 0 },
    updatedAt: { seconds: 1, nanoseconds: 0 },
  });
  store.set(`users/${UID}/accounts/acc-1`, account("acc-1", 3));
  store.set(`users/${UID}/accounts/acc-2`, account("acc-2", 1));
  store.set(`users/${UID}/accounts/acc-3`, account("acc-3", 0));

  // Categorías propias: seed + personalizadas.
  store.set(`users/${UID}/categories/seed_expense_food`, { ownerId: UID, state: "active" });
  store.set(`users/${UID}/categories/custom-1`, { ownerId: UID, state: "active" });
  store.set(`users/${UID}/categories/custom-2`, { ownerId: UID, state: "archived" });

  // Cuenta de la pareja: no se toca.
  store.set(`users/${PARTNER_UID}/accounts/acc-b1`, {
    ...account("acc-b1", 2),
    ownerId: PARTNER_UID,
  });

  const movement = (
    id: string,
    over: Record<string, unknown>,
  ): [string, Record<string, unknown>] => [
    `movements/${id}`,
    {
      schemaVersion: 1,
      ownerId: UID,
      type: "expense",
      amount: 1000,
      accountId: null,
      lifecycleState: "active",
      householdId: null,
      ...over,
    },
  ];

  // Propios con cuenta acc-1 (3), acc-2 (1); en Papelera y compartidos incluidos.
  store.set(...movement("mov-1", { accountId: "acc-1" }));
  store.set(...movement("mov-2", { accountId: "acc-1", householdId: HOUSEHOLD_ID }));
  store.set(...movement("mov-3", { accountId: "acc-1", lifecycleState: "trashed" }));
  store.set(...movement("mov-4", { accountId: "acc-2", householdId: HOUSEHOLD_ID }));
  // Propios sin cuenta.
  store.set(...movement("mov-5", {}));
  store.set(...movement("mov-6", { lifecycleState: "trashed" }));
  // Propio que apunta a una cuenta ya inexistente (residuo de un intento previo).
  store.set(...movement("mov-7", { accountId: "acc-borrada" }));

  // De la pareja: compartidos (se borran) y personal no compartido (se conserva).
  store.set(
    ...movement("mov-b1", { ownerId: PARTNER_UID, householdId: HOUSEHOLD_ID, accountId: "acc-b1" }),
  );
  store.set(...movement("mov-b2", { ownerId: PARTNER_UID, householdId: HOUSEHOLD_ID }));
  store.set(...movement("mov-b3", { ownerId: PARTNER_UID, householdId: null, accountId: "acc-b1" }));
  // Compartido de la pareja en Papelera: las Rules no dejan listarlo (§9.5).
  store.set(
    ...movement("mov-b4", {
      ownerId: PARTNER_UID,
      householdId: HOUSEHOLD_ID,
      lifecycleState: "trashed",
    }),
  );

  // Hogar y TODAS sus subcolecciones con al menos un residuo.
  store.set(`households/${HOUSEHOLD_ID}`, {
    schemaVersion: 1,
    status: "active",
    memberAId: UID,
    memberBId: PARTNER_UID,
    activeInviteId: "INV-ACTIVE",
    revision: 3,
  });
  store.set(`households/${HOUSEHOLD_ID}/members/${UID}`, { userId: UID, state: "active" });
  store.set(`households/${HOUSEHOLD_ID}/members/${PARTNER_UID}`, {
    userId: PARTNER_UID,
    state: "active",
  });
  store.set(`households/${HOUSEHOLD_ID}/expenseCategories/seed_hh_food`, { state: "active" });
  store.set(`households/${HOUSEHOLD_ID}/categoryMappings/${UID}__custom-1`, { ownerId: UID });
  store.set(`households/${HOUSEHOLD_ID}/memberCategoryLabels/${UID}__custom-1`, { ownerId: UID });
  store.set(`households/${HOUSEHOLD_ID}/memberAccountLabels/${UID}__acc-1`, { ownerId: UID });
  store.set(`households/${HOUSEHOLD_ID}/closureApprovals/${UID}`, { uid: UID });

  // Invitaciones desde las TRES fuentes que cubre Android.
  store.set("householdInvites/INV-ACTIVE", { householdId: HOUSEHOLD_ID, createdBy: UID });
  store.set("householdInvites/INV-BY-HOUSEHOLD", { householdId: HOUSEHOLD_ID, createdBy: PARTNER_UID });
  // Huérfana: creada por el usuario para un Hogar anterior ya borrado.
  store.set("householdInvites/INV-ORPHAN", { householdId: "hh-viejo", createdBy: UID });

  return store;
};

export const runMplusAccountResetFlowTests = async (): Promise<void> => {
  // ── 1. Reinicio completo con Hogar y pareja ────────────────────────────
  {
    const store = buildStore();
    const gateway = createFakeGateway(store, UID);

    const result = await executeMplusAccountReset(null, UID, gateway);

    assert.equal(result.success, true);

    // --- movimientos propios: activos, Papelera y compartidos ---
    for (const id of ["mov-1", "mov-2", "mov-3", "mov-4", "mov-5", "mov-6", "mov-7"]) {
      assert.equal(store.has(`movements/${id}`), false, `${id} debe borrarse`);
    }
    assert.equal(result.deletedOwnMovementsCount, 7);

    // --- movimientos compartidos de la pareja ---
    assert.equal(store.has("movements/mov-b1"), false, "compartido de la pareja borrado");
    assert.equal(store.has("movements/mov-b2"), false, "compartido de la pareja borrado");
    assert.equal(result.deletedPartnerSharedMovementsCount, 2);
    // El compartido de la pareja en Papelera NO se puede alcanzar, y eso se
    // reporta en vez de silenciarse.
    assert.equal(store.has("movements/mov-b4"), true);
    assert.ok(
      result.skipped.some((s) => s.includes("Papelera")),
      "lo que no se pudo limpiar debe quedar reportado",
    );

    // --- lo personal NO compartido de la pareja se conserva ---
    assert.equal(
      store.has("movements/mov-b3"),
      true,
      "la pareja conserva sus movimientos personales nunca compartidos",
    );
    assert.equal(
      store.has(`users/${PARTNER_UID}/accounts/acc-b1`),
      true,
      "la pareja conserva sus cuentas",
    );

    // --- cuentas propias ---
    for (const id of ["acc-1", "acc-2", "acc-3"]) {
      assert.equal(store.has(`users/${UID}/accounts/${id}`), false, `${id} debe borrarse`);
    }
    assert.equal(result.deletedAccountsCount, 3);

    // --- categorías: se borran y NO se resiembran ---
    assert.equal(result.deletedCategoriesCount, 3);
    assert.equal(
      [...store.keys()].filter((k) => k.startsWith(`users/${UID}/categories/`)).length,
      0,
      "no se resiembra: el perfil se elimina y el catálogo lo crea el próximo login",
    );
    assert.equal(result.recreatedSeedCategoriesCount, 0);

    // --- Hogar: documento, subcolecciones e invitaciones ---
    assert.equal(store.has(`households/${HOUSEHOLD_ID}`), false, "el Hogar se borra");
    assert.equal(result.deletedHouseholdId, HOUSEHOLD_ID);

    const householdResidue = [...store.keys()].filter((k) =>
      k.startsWith(`households/${HOUSEHOLD_ID}`),
    );
    assert.deepEqual(householdResidue, [], "no puede quedar ningún residuo del Hogar");

    for (const sub of HOUSEHOLD_SUBCOLLECTIONS) {
      assert.ok(
        (result.deletedHouseholdDocsBySubcollection[sub] ?? 0) >= 1,
        `la subcolección ${sub} debe haberse recorrido y vaciado`,
      );
    }
    assert.equal(
      result.deletedHouseholdDocsBySubcollection[HOUSEHOLD_SUBCOLLECTIONS[5]],
      2,
      "members debe borrar a los dos miembros",
    );

    // --- invitaciones desde las tres fuentes ---
    assert.equal(store.has("householdInvites/INV-ACTIVE"), false);
    assert.equal(store.has("householdInvites/INV-BY-HOUSEHOLD"), false);
    assert.equal(
      store.has("householdInvites/INV-ORPHAN"),
      false,
      "la invitación huérfana creada por el usuario también se borra (paridad Android)",
    );
    assert.equal(result.deletedInvitesCount, 3);

    // --- el perfil propio se elimina: la cuenta arranca de cero ---
    assert.equal(result.deletedUserProfile, true);
    assert.equal(
      store.has(`users/${UID}`),
      false,
      "users/{uid} debe quedar eliminado para que la cuenta empiece de cero",
    );
    // Y no queda NADA colgando del usuario.
    assert.deepEqual(
      [...store.keys()].filter((k) => k.startsWith(`users/${UID}`)),
      [],
      "no puede quedar ningún residuo bajo users/{uid}",
    );

    // --- el perfil de la pareja NO se tocó (Rules lo prohíben) ---
    const partner = store.get(`users/${PARTNER_UID}`)!;
    assert.equal(partner.revision, 2, "el perfil del compañero no se modifica");
    assert.equal(
      partner.householdId,
      HOUSEHOLD_ID,
      "queda colgado a propósito: lo limpia su propio cliente (contrato §16.3)",
    );

    // --- ningún lote superó el tope del contrato ---
    for (const batch of gateway.commits) {
      assert.ok(
        batch.length <= MAX_RESET_BATCH_DOCS,
        `un lote llevó ${batch.length} operaciones, por encima de ${MAX_RESET_BATCH_DOCS}`,
      );
    }
  }

  // ── 2. Usuario sin Hogar ──────────────────────────────────────────────
  {
    const store = buildStore();
    store.set(`users/${UID}`, {
      ...store.get(`users/${UID}`)!,
      householdId: null,
      householdMembershipState: "none",
    });
    const gateway = createFakeGateway(store, UID);

    const result = await executeMplusAccountReset(null, UID, gateway);

    assert.equal(result.deletedHouseholdId, null);
    assert.equal(result.deletedPartnerSharedMovementsCount, 0);
    assert.equal(result.deletedInvitesCount, 0);
    // El Hogar sigue en pie: sin vínculo, el reinicio no lo toca.
    assert.equal(store.has(`households/${HOUSEHOLD_ID}`), true);
    // Pero los movimientos propios sí se van, compartidos incluidos.
    assert.equal(result.deletedOwnMovementsCount, 7);
  }

  // ── 3. Reanudable: un segundo pase sobre un reinicio a medias ─────────
  {
    const store = buildStore();
    // Simula una corrida interrumpida: quedó en `resetting`, con el documento
    // del Hogar ya borrado pero residuos vivos en las subcolecciones.
    store.set(`users/${UID}`, { ...store.get(`users/${UID}`)!, status: "resetting" });
    store.delete(`households/${HOUSEHOLD_ID}`);

    const gateway = createFakeGateway(store, UID);
    const result = await executeMplusAccountReset(null, UID, gateway);

    const residue = [...store.keys()].filter((k) => k.startsWith(`households/${HOUSEHOLD_ID}`));
    assert.deepEqual(
      residue,
      [],
      "un reintento debe limpiar los residuos aunque el documento del Hogar ya no exista",
    );
    assert.equal(result.success, true);
    assert.equal(store.has(`users/${UID}`), false, "el perfil queda eliminado");
  }

  // ── 4. Idempotente: reiniciar dos veces seguidas no falla ─────────────
  {
    const store = buildStore();
    const gateway = createFakeGateway(store, UID);

    const first = await executeMplusAccountReset(null, UID, gateway);
    assert.equal(first.deletedUserProfile, true);

    // Con el perfil ya eliminado, un segundo intento no tiene nada que
    // reiniciar y lo dice claro, en vez de fallar de forma opaca.
    await assert.rejects(
      () => executeMplusAccountReset(null, UID, gateway),
      /no existe en Firestore/,
      "reiniciar una cuenta ya eliminada debe fallar con un mensaje explícito",
    );
  }

  // ── 5. Volumen: por encima del tope de lote ──────────────────────────
  {
    const store = buildStore();
    store.set(`users/${UID}`, {
      ...store.get(`users/${UID}`)!,
      householdId: null,
      householdMembershipState: "none",
    });
    // 640 movimientos propios sin cuenta: obliga a repartir en varios lotes.
    for (let i = 0; i < 640; i += 1) {
      store.set(`movements/bulk-${i}`, {
        ownerId: UID,
        type: "expense",
        amount: 100,
        accountId: null,
        lifecycleState: "active",
        householdId: null,
      });
    }
    const gateway = createFakeGateway(store, UID);

    const result = await executeMplusAccountReset(null, UID, gateway);

    assert.equal(result.deletedOwnMovementsCount, 7 + 640);
    assert.equal(result.deletedUserProfile, true);
    assert.equal(
      [...store.keys()].filter((k) => k.startsWith("movements/bulk-")).length,
      0,
      "no puede quedar ningún movimiento de volumen",
    );
    for (const batch of gateway.commits) {
      assert.ok(batch.length <= MAX_RESET_BATCH_DOCS, "ningún lote supera el tope");
    }
  }

  // ── 7. Reanudar una cuenta atascada tras un fallo a media limpieza ────
  //
  // Reproduce EXACTAMENTE el estado en el que quedo una cuenta real: el primer
  // intento marco `resetting`, borro invitaciones y subcolecciones (miembros
  // incluidos) y murio al leer los compartidos. Sin membresia activa, el Hogar
  // y sus subcolecciones ya no son legibles. El reinicio TIENE que poder
  // terminar igualmente: si abortara, la cuenta quedaria atrapada en
  // `resetting` para siempre.
  {
    const store = buildStore();
    store.set("users/" + UID, { ...store.get("users/" + UID)!, status: "resetting" });
    // El primer intento ya vacio las subcolecciones del Hogar.
    for (const k of [...store.keys()]) {
      if (k.startsWith("households/" + HOUSEHOLD_ID + "/")) store.delete(k);
    }

    const gateway = createFakeGateway(store, UID);
    const result = await executeMplusAccountReset(null, UID, gateway);

    assert.equal(result.success, true, "un reintento debe poder completarse");
    assert.equal(
      store.has("households/" + HOUSEHOLD_ID),
      false,
      "el documento del Hogar se borra aunque ya no se pueda leer",
    );
    assert.equal(
      store.has("users/" + UID),
      false,
      "la cuenta no puede quedar atrapada en resetting: su perfil se elimina",
    );
    // Lo personal se limpia por completo.
    assert.equal(
      [...store.keys()].filter((k) => k.startsWith("movements/") && store.get(k)!.ownerId === UID)
        .length,
      0,
      "no puede quedar ningun movimiento propio",
    );
    assert.equal(
      [...store.keys()].filter((k) => k.startsWith("users/" + UID + "/accounts/")).length,
      0,
      "no puede quedar ninguna cuenta propia",
    );
    // Y lo que no se pudo leer queda reportado, no silenciado.
    assert.ok(
      result.skipped.some((note) => note.includes("membresia activa")),
      "lo que las Rules impidieron leer debe quedar anotado",
    );
  }

  // ── 8. Contador de cuenta desincronizado ──────────────────────────────
  //
  // Una cuenta con `referenceCount` en 0 pero con movimientos que todavia la
  // referencian. Las Rules no admiten bajar el contador por debajo de 0
  // (`data.referenceCount == resource.data.referenceCount - 1`), asi que ese
  // movimiento NO se puede borrar. Antes se intentaba igual con
  // `Math.max(0, …)`, el servidor rechazaba la escritura y abortaba el
  // reinicio entero: la cuenta quedaba atrapada en `resetting`.
  {
    const store = buildStore();
    store.set("users/" + UID, {
      ...store.get("users/" + UID)!,
      householdId: null,
      householdMembershipState: "none",
    });
    // acc-2 dice 0 referencias, pero mov-4 sigue apuntando a ella.
    store.set("users/" + UID + "/accounts/acc-2", {
      ...store.get("users/" + UID + "/accounts/acc-2")!,
      referenceCount: 0,
    });

    const gateway = createFakeGateway(store, UID);
    const result = await executeMplusAccountReset(null, UID, gateway);

    // Lo importante: el reinicio TERMINA y la cuenta vuelve a ready.
    // Lo importante: el reinicio TERMINA y el perfil se elimina igual.
    assert.equal(store.has("users/" + UID), false, "el perfil se elimina igual");

    // El movimiento imposible de borrar queda reportado, no silenciado.
    assert.equal(store.has("movements/mov-4"), true);
    assert.ok(
      result.skipped.some((note) => note.includes("mov-4") && note.includes("acc-2")),
      "el movimiento que las Rules impiden borrar debe quedar anotado con su cuenta",
    );

    // El resto se limpia igual, incluida la propia cuenta descuadrada: ya
    // estaba en 0, asi que su borrado si es valido.
    assert.equal(store.has("users/" + UID + "/accounts/acc-1"), false);
    assert.equal(store.has("users/" + UID + "/accounts/acc-2"), false);
    assert.equal(store.has("movements/mov-1"), false);
    // Sin reseed: lo crea el proximo login.
    assert.equal(
      [...store.keys()].filter((k) => k.startsWith("users/" + UID + "/categories/")).length,
      0,
    );
  }

  // ── 6. La guarda de Rules del gateway falso no es decorativa ──────────
  {
    const store = buildStore();
    const gateway = createFakeGateway(store, UID);

    // 6a. Borrar un movimiento con cuenta sin decrementar el contador.
    await assert.rejects(
      () =>
        gateway.commit([
          { kind: "set", path: ["users", UID], data: { ...store.get(`users/${UID}`)!, status: "resetting" } },
        ]).then(() => gateway.commit([{ kind: "delete", path: ["movements", "mov-1"] }])),
      /exige decrementar/,
      "la guarda debe rechazar el borrado sin contador que hacía el servicio anterior",
    );

    // 6b. Leer el perfil del compañero.
    await assert.rejects(
      () => gateway.readDoc(["users", PARTNER_UID]),
      /solo permiten el documento propio/,
      "la guarda debe rechazar la lectura del perfil ajeno que hacía el servicio anterior",
    );

    // 6c. Borrar una cuenta con referencias vivas.
    await assert.rejects(
      () => gateway.commit([{ kind: "delete", path: ["users", UID, "accounts", "acc-1"] }]),
      /referenceCount/,
      "la guarda debe rechazar borrar una cuenta referenciada",
    );

    // 6c-bis. La consulta de compartidos SIN el filtro de ciclo de vida: es
    // exactamente la que hacia el servicio y la que el servidor real rechazo
    // con "Missing or insufficient permissions".
    await assert.rejects(
      () => gateway.queryByField("movements", "householdId", HOUSEHOLD_ID),
      /allow list lo rechaza/,
      "la guarda debe rechazar la consulta de compartidos sin filtrar el ciclo de vida",
    );
    // Con el filtro, la misma consulta es valida.
    const soloActivos = await gateway.queryByField("movements", "householdId", HOUSEHOLD_ID, {
      field: "lifecycleState",
      value: "active",
    });
    assert.ok(soloActivos.length > 0, "con el filtro correcto la consulta si devuelve datos");

    // 6c-ter. Sembrar una categoria con el perfil en `resetting`: es
    // exactamente lo que hacia el servicio y lo que el servidor real rechazo
    // con "[resembrar catalogo Personal] Missing or insufficient permissions".
    await assert.rejects(
      () =>
        gateway.commit([
          {
            kind: "set",
            path: ["users", UID, "categories", "seed_expense_nueva"],
            data: { ownerId: UID, state: "active" },
          },
        ]),
      /exige el perfil en ready/,
      "la guarda debe rechazar el reseed con el perfil todavia en resetting",
    );

    // 6d. Lote por encima del tope del contrato.
    await assert.rejects(
      () =>
        gateway.commit(
          Array.from({ length: MAX_RESET_BATCH_DOCS + 1 }, (_, i) => ({
            kind: "delete" as const,
            path: ["movements", `no-existe-${i}`],
          })),
        ),
      /lotes de limpieza/,
      "la guarda debe rechazar un lote sin acotar",
    );

    // 6e. Consultas de householdInvites protegidas por Rules.
    // Un get/list de toda la colección sin where está prohibido.
    await assert.rejects(
      () => gateway.listCollection(["householdInvites"]),
      /sin where esta prohibido/,
      "la guarda debe rechazar un listado de householdInvites sin where",
    );
    // Un where por un campo distinto a createdBy o householdId también está prohibido.
    await assert.rejects(
      () =>
        gateway.commit([
          { kind: "set", path: ["users", UID], data: { ...store.get(`users/${UID}`)!, status: "resetting" } },
        ]).then(() => gateway.queryByField("householdInvites", "state", "active")),
      /solo permite where por createdBy o householdId/,
      "la guarda debe rechazar consultas de householdInvites por campos no autorizados",
    );
    // Las 2 queries autorizadas pasan con el perfil en resetting.
    const invitesByCreator = await gateway.queryByField("householdInvites", "createdBy", UID);
    assert.ok(Array.isArray(invitesByCreator));
    const invitesByHousehold = await gateway.queryByField("householdInvites", "householdId", HOUSEHOLD_ID);
    assert.ok(Array.isArray(invitesByHousehold));
  }

  // ── 7. Reanudación automática (resumeAccountResetIfNeeded) y mutex en vuelo ──
  {
    // 7a. No-op si el perfil está en `ready`: no debe tocar nada ni hacer commits.
    const storeReady = buildStore();
    const gatewayReady = createFakeGateway(storeReady, UID);
    const resultReady = await resumeAccountResetIfNeeded(null, UID, gatewayReady);

    assert.equal(resultReady, null, "resumeAccountResetIfNeeded debe ser no-op si el perfil está en ready");
    assert.equal(gatewayReady.commits.length, 0, "No debe ejecutar ninguna mutación si status es ready");
    assert.ok(storeReady.has(`users/${UID}`), "El perfil se mantiene intacto");
    console.log("  ✓ resumeAccountResetIfNeeded es no-op cuando status === 'ready'");

    // 7b. Reanudación automática si el perfil está en `resetting`: converge y borra todo.
    const storeResetting = buildStore();
    // Simular que el usuario quedó en resetting por interrupción
    const userDoc = storeResetting.get(`users/${UID}`)!;
    storeResetting.set(`users/${UID}`, { ...userDoc, status: "resetting" });

    const gatewayResetting = createFakeGateway(storeResetting, UID);
    const resultResume = await resumeAccountResetIfNeeded(null, UID, gatewayResetting);

    assert.ok(resultResume !== null, "Debe ejecutar la reanudación");
    assert.equal(resultResume.success, true, "La reanudación debe tener éxito");
    assert.equal(resultResume.deletedUserProfile, true, "users/{uid} debe quedar eliminado");
    assert.equal(storeResetting.has(`users/${UID}`), false, "users/{uid} ya no existe en la base de datos");
    assert.equal(storeResetting.has(`households/${HOUSEHOLD_ID}`), false, "Hogar eliminado");
    console.log("  ✓ resumeAccountResetIfNeeded converge y elimina perfil en resetting");

    // 7c. Mutex / deduplicación de ejecuciones concurrentes en vuelo
    const storeConcurrent = buildStore();
    const userDocConc = storeConcurrent.get(`users/${UID}`)!;
    storeConcurrent.set(`users/${UID}`, { ...userDocConc, status: "resetting" });
    const gatewayConcurrent = createFakeGateway(storeConcurrent, UID);

    const [res1, res2] = await Promise.all([
      resumeAccountResetIfNeeded(null, UID, gatewayConcurrent),
      resumeAccountResetIfNeeded(null, UID, gatewayConcurrent),
    ]);

    assert.deepEqual(res1, res2, "Llamadas concurrentes deben compartir la misma promesa");
    assert.equal(res1?.success, true);
    console.log("  ✓ inFlightReset mutex previene ejecuciones duplicadas concurrentes");

    // 7d. Salida unificada de sesión tras deletedUserProfile === true
    let signOutCalled = false;
    let navigatedTo: string | null = null;

    useAuthStore.getState().setSession({
      uid: UID,
      email: "test@example.com",
      displayName: "Usuario Test",
      photoUrl: null,
    });
    assert.equal(useAuthStore.getState().isAuthenticated, true);

    await completeResetSessionExit({
      redirectHref: "/login",
      navigate: (href) => {
        navigatedTo = href;
      },
      signOutOverride: async () => {
        signOutCalled = true;
      },
    });

    assert.equal(signOutCalled, true, "completeResetSessionExit debe ejecutar signOutUser");
    assert.equal(useAuthStore.getState().isAuthenticated, false, "completeResetSessionExit debe limpiar auth store");
    assert.equal(navigatedTo, "/login", "completeResetSessionExit debe navegar a la ruta destino");
    console.log("  ✓ completeResetSessionExit unifica signOut, clearSession, reset stores y navegación");
  }

  console.log("mplus-account-reset-flow.test.ts: OK");
};
