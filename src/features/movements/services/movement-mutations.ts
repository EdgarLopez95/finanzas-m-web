import {
  doc,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  PURGE_WINDOW_MILLIS,
  isTodayOrPastInBogota,
  normalizeOccurredAtMillis,
} from "@/lib/mplus/bogota-date";
import {
  millisToTimestamp,
  movementToFirestore,
  personalAccountFromFirestore,
  type FirestoreData,
} from "@/lib/mplus/converters";
import type { MovementType } from "@/lib/mplus/enums";
import { newMutationId } from "@/lib/mplus/ids";
import type { MplusMovement, MplusPersonalAccount } from "@/lib/mplus/models";
import {
  runMplusMutation,
  type MplusMutationOutcome,
  type MplusRunnerDeps,
} from "@/lib/mplus/mutation-runner";
import { MPLUS_PATHS } from "@/lib/mplus/paths";
import { mplusValidators } from "@/lib/mplus/schemas";
/**
 * Mutaciones de `movements` del contrato v1.
 *
 * Todas pasan por `runMplusMutation`, asi que todas comparten:
 * OCC por `revision`, mismo resultado de conflicto que Android, reintento
 * idempotente por `lastMutationId` y cero exito antes del commit remoto.
 *
 * El contador de la cuenta (`referenceCount` / `lastReferenceMovementId`,
 * contrato §7.3) se mueve SIEMPRE dentro de la misma transaccion que el
 * movimiento: las Rules lo verifican con `getAfter()` y rechazan la escritura
 * si los dos documentos no cuadran. Reglas del contador:
 *
 *   crear con cuenta          -> +1 en la cuenta
 *   cambiar de cuenta         -> -1 en la anterior, +1 en la nueva
 *   enviar a Papelera         -> sin cambio (§7.3)
 *   restaurar                 -> sin cambio
 *   eliminacion fisica (purga)-> -1
 *
 * `updatedAt`/`createdAt` viajan como hora de cliente, igual que Android
 * (`toFirestoreTimestamp`), para que las dos plataformas escriban la misma
 * forma. Las Rules solo exigen que sean timestamps y que
 * `occurredAt <= request.time`.
 */

export type MovementDraft = Readonly<{
  type: MovementType;
  title: string;
  amount: number;
  categoryId: string;
  /** Cuenta opcional: en M+ la cuenta es una etiqueta, no un saldo. */
  accountId: string | null;
  note: string;
  occurredAtMillis: number;
  /** Hogar con el que se comparte, o null. Lo resuelve quien llama desde el perfil. */
  householdId: string | null;
  /** Categoria en el Hogar (solo gastos compartidos). Null para ingresos o 'Por clasificar'. */
  householdCategoryId?: string | null;
  /**
   * @deprecated No-op. En Finanzas M+, compartir desde Personal NUNCA aprende ni escribe categoryMappings
   * (§ 15.3, § 15.5, paridad Android b7a39d8). El aprendizaje ocurre exclusivamente al clasificar en Hogar (§ 15.5).
   * Se conserva sólo por compatibilidad de tipos con código legacy.
   */
  learnMapping?: boolean;
}>;

import {
  verifyHouseholdSharePreflight,
  type HouseholdSharePreflightDeps,
} from "@/features/movements/services/verify-household-share-preflight";

export type MovementMutationResult = MplusMutationOutcome<MplusMovement>;

/**
 * `deps` existe solo para pruebas: inyecta el `runTransaction` del SDK. Ningun
 * llamador de produccion lo pasa.
 */
export type MovementMutationOptions = Readonly<{
  nowMillis?: number;
  db?: Firestore;
  deps?: MplusRunnerDeps;
  preflightDeps?: HouseholdSharePreflightDeps;
}>;


/** Error de precondicion local: se detecta ANTES de abrir la transaccion. */
export class MovementPreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MovementPreconditionError";
  }
}

const movementRefFor = (db: Firestore, movementId: string): DocumentReference =>
  doc(db, MPLUS_PATHS.movements, movementId);

const accountRefFor = (db: Firestore, ownerId: string, accountId: string): DocumentReference =>
  doc(db, MPLUS_PATHS.users, ownerId, MPLUS_PATHS.accounts, accountId);

/** Delta pendiente sobre el contador de una cuenta. */
type CounterPlan = Readonly<{ accountId: string; delta: 1 | -1 }>;

/**
 * FASE 1 — lee de una sola vez todas las cuentas que van a cambiar de
 * contador.
 *
 * Existe separado de la escritura por una restriccion dura de Firestore: en
 * una transaccion, TODAS las lecturas deben ocurrir antes de la primera
 * escritura. Un cambio de cuenta toca dos documentos, asi que hacer
 * "lee-escribe, lee-escribe" reventaria la segunda lectura.
 */
const readAccountsForCounters = async (
  tx: Transaction,
  db: Firestore,
  ownerId: string,
  plans: readonly CounterPlan[],
): Promise<Map<string, MplusPersonalAccount>> => {
  const accounts = new Map<string, MplusPersonalAccount>();

  for (const plan of plans) {
    if (accounts.has(plan.accountId)) continue;
    const snapshot = await tx.get(accountRefFor(db, ownerId, plan.accountId));
    if (!snapshot.exists()) {
      // La cuenta desaparecio entre la lectura de la UI y el commit. No se
      // inventa: se aborta la transaccion completa.
      throw new MovementPreconditionError(
        "La cuenta referenciada ya no existe. Vuelve a cargar y reintenta.",
      );
    }
    accounts.set(
      plan.accountId,
      personalAccountFromFirestore(plan.accountId, (snapshot.data() ?? {}) as FirestoreData),
    );
  }

  return accounts;
};

/**
 * FASE 2 — escribe los deltas ya calculados.
 *
 * Solo toca las 5 claves que `validAccountUpdate` permite mover en una
 * actualizacion de contador; cualquier otra rompe `affectedKeys().hasOnly`.
 */
const writeAccountCounters = (
  tx: Transaction,
  db: Firestore,
  ownerId: string,
  plans: readonly CounterPlan[],
  accounts: ReadonlyMap<string, MplusPersonalAccount>,
  movementId: string,
  mutationId: string,
  nowMillis: number,
): void => {
  for (const plan of plans) {
    const account = accounts.get(plan.accountId);
    if (!account) continue;

    const nextCount = account.referenceCount + plan.delta;
    if (nextCount < 0) {
      throw new MovementPreconditionError(
        "El contador de referencias de la cuenta quedaria negativo.",
      );
    }

    tx.update(accountRefFor(db, ownerId, plan.accountId), {
      referenceCount: nextCount,
      lastReferenceMovementId: movementId,
      revision: account.revision + 1,
      lastMutationId: mutationId,
      updatedAt: millisToTimestamp(nowMillis),
    });
  }
};

/**
 * Precondiciones que se comprueban ANTES de abrir la transaccion, para no
 * gastar un viaje remoto en algo que las Rules van a rechazar seguro.
 */
const assertDraftIsWritable = (draft: MovementDraft, nowMillis: number): void => {
  if (!isTodayOrPastInBogota(draft.occurredAtMillis, nowMillis)) {
    throw new MovementPreconditionError(
      "La fecha no puede ser futura: un movimiento admite hoy o un dia pasado.",
    );
  }
};

/**
 * Crea un movimiento y, si trae cuenta, incrementa su contador en la MISMA
 * transaccion (contrato § 23). Si comparte con Hogar, persiste householdId y
 * householdCategoryId resueltos, pero NUNCA crea ni aprende equivalencias en
 * categoryMappings (el aprendizaje ocurre exclusivamente al clasificar en Hogar § 15.5).
 */
export const createMovement = async (
  ownerId: string,
  movementId: string,
  draft: MovementDraft,
  options?: MovementMutationOptions,
): Promise<MovementMutationResult> => {
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();
  assertDraftIsWritable(draft, nowMillis);

  // Si se comparte con Hogar, verificar preflight remoto antes de iniciar transacción (cero writes si falla)
  if (draft.householdId !== null) {
    const preflight = await verifyHouseholdSharePreflight(
      {
        uid: ownerId,
        householdId: draft.householdId,
        householdCategoryId: draft.householdCategoryId ?? null,
      },
      {
        db,
        deps: options?.preflightDeps ?? (options?.deps as { preflightDeps?: HouseholdSharePreflightDeps })?.preflightDeps,
      },
    );
    if (!preflight.ok) {
      throw new MovementPreconditionError(preflight.reason);
    }
  }

  const mutationId = newMutationId();

  const effectiveHouseholdCategoryId =
    draft.householdId !== null && draft.type === "expense"
      ? (draft.householdCategoryId ?? null)
      : null;

  const movement = mplusValidators.movement({
    id: movementId,
    schemaVersion: 1,
    ownerId,
    type: draft.type,
    title: draft.title.trim(),
    amount: draft.amount,
    categoryId: draft.categoryId,
    accountId: draft.accountId,
    note: draft.note.trim(),
    occurredAtMillis: normalizeOccurredAtMillis(draft.occurredAtMillis),
    lifecycleState: "active",
    trashedAtMillis: null,
    purgeAfterMillis: null,
    householdId: draft.householdId,
    householdCategoryId: effectiveHouseholdCategoryId,
    revision: 1,
    lastMutationId: mutationId,
    createdAtMillis: nowMillis,
    updatedAtMillis: nowMillis,
  }) as MplusMovement;

  const movementRef = movementRefFor(db, movementId);
  return runMplusMutation<MplusMovement>(db, {
    mutationId,
    occ: [
      {
        resource: MPLUS_PATHS.movements,
        id: movementId,
        ref: movementRef,
        baseRevision: null,
      },
    ],
    work: async (tx) => {
      const plans: CounterPlan[] =
        movement.accountId !== null ? [{ accountId: movement.accountId, delta: 1 }] : [];

      // Fase 1: lecturas. Fase 2: escrituras. Nunca al reves.
      const accounts = await readAccountsForCounters(tx, db, ownerId, plans);

      writeAccountCounters(tx, db, ownerId, plans, accounts, movementId, mutationId, nowMillis);
      tx.set(movementRef, movementToFirestore(movement));

      return movement;
    },
  }, options?.deps);
};

export type MovementEdit = MovementDraft;

/**
 * Edición del dueño (contrato § 9.3): valida la revisión base, sube `revision`
 * exactamente en uno, conserva `ownerId`/`createdAt`/`schemaVersion` y ajusta
 * los contadores si cambia la cuenta. Si comparte con Hogar, persiste householdId y
 * householdCategoryId resueltos, pero NUNCA escribe categoryMappings (el aprendizaje
 * ocurre exclusivamente al clasificar en Hogar § 15.5, igual que en createMovement).
 */
export const updateMovement = async (
  current: MplusMovement,
  edit: MovementEdit,
  options?: MovementMutationOptions,
): Promise<MovementMutationResult> => {
  if (current.origin === "household_expense") {
    throw new MovementPreconditionError(
      "Los gastos originados en Hogar no pueden editarse como movimientos personales.",
    );
  }
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();
  assertDraftIsWritable(edit, nowMillis);

  if (current.lifecycleState !== "active") {
    throw new MovementPreconditionError(
      "Un movimiento en la Papelera no se edita: restauralo primero.",
    );
  }

  // Si se comparte o se mantiene compartido con Hogar, verificar preflight remoto antes de iniciar transacción
  if (edit.householdId !== null) {
    const preflight = await verifyHouseholdSharePreflight(
      {
        uid: current.ownerId,
        householdId: edit.householdId,
        householdCategoryId: edit.householdCategoryId ?? null,
      },
      {
        db,
        deps: options?.preflightDeps ?? (options?.deps as { preflightDeps?: HouseholdSharePreflightDeps })?.preflightDeps,
      },
    );
    if (!preflight.ok) {
      throw new MovementPreconditionError(preflight.reason);
    }
  }

  const mutationId = newMutationId();

  const effectiveHouseholdCategoryId =
    edit.householdId === null || edit.type === "income"
      ? null
      : edit.householdCategoryId !== undefined
        ? edit.householdCategoryId
        : current.householdCategoryId;

  const next = mplusValidators.movement({
    ...current,
    type: edit.type,
    title: edit.title.trim(),
    amount: edit.amount,
    categoryId: edit.categoryId,
    accountId: edit.accountId,
    note: edit.note.trim(),
    occurredAtMillis: normalizeOccurredAtMillis(edit.occurredAtMillis),
    householdId: edit.householdId,
    // Si deja de compartirse, la categoria de Hogar debe irse con el
    // householdId (contrato §9.1: no hay householdCategoryId sin householdId).
    householdCategoryId: effectiveHouseholdCategoryId,
    revision: current.revision + 1,
    lastMutationId: mutationId,
    updatedAtMillis: nowMillis,
  }) as MplusMovement;

  const movementRef = movementRefFor(db, current.id);
  const accountChanged = current.accountId !== next.accountId;
  return runMplusMutation<MplusMovement>(db, {
    mutationId,
    occ: [
      {
        resource: MPLUS_PATHS.movements,
        id: current.id,
        ref: movementRef,
        baseRevision: current.revision,
      },
    ],
    work: async (tx) => {
      // Orden fijo: primero la cuenta que pierde la referencia, despues la que
      // la gana. Las DOS lecturas ocurren antes de la primera escritura.
      const plans: CounterPlan[] = [];
      if (accountChanged) {
        if (current.accountId !== null) plans.push({ accountId: current.accountId, delta: -1 });
        if (next.accountId !== null) plans.push({ accountId: next.accountId, delta: 1 });
      }

      const accounts = await readAccountsForCounters(tx, db, current.ownerId, plans);

      writeAccountCounters(
        tx, db, current.ownerId, plans, accounts, current.id, mutationId, nowMillis,
      );
      tx.set(movementRef, movementToFirestore(next));

      return next;
    },
  }, options?.deps);
};

/**
 * Envia a la Papelera (contrato §9.5). Fija `trashedAt` y
 * `purgeAfter = trashedAt + 30 dias`. NO toca el contador de la cuenta.
 */
export const trashMovement = async (
  current: MplusMovement,
  options?: MovementMutationOptions,
): Promise<MovementMutationResult> => {
  if (current.origin === "household_expense") {
    throw new MovementPreconditionError(
      "Los gastos originados en Hogar se administran y eliminan exclusivamente desde Hogar.",
    );
  }
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();

  if (current.lifecycleState !== "active") {
    throw new MovementPreconditionError("El movimiento ya esta en la Papelera.");
  }

  const mutationId = newMutationId();
  const next = mplusValidators.movement({
    ...current,
    lifecycleState: "trashed",
    trashedAtMillis: nowMillis,
    purgeAfterMillis: nowMillis + PURGE_WINDOW_MILLIS,
    revision: current.revision + 1,
    lastMutationId: mutationId,
    updatedAtMillis: nowMillis,
  }) as MplusMovement;

  const movementRef = movementRefFor(db, current.id);

  return runMplusMutation<MplusMovement>(db, {
    mutationId,
    occ: [
      {
        resource: MPLUS_PATHS.movements,
        id: current.id,
        ref: movementRef,
        baseRevision: current.revision,
      },
    ],
    work: (tx) => {
      tx.set(movementRef, movementToFirestore(next));
      return next;
    },
  }, options?.deps);
};

/**
 * Restaura desde la Papelera (contrato §9.5): vuelve a `active` y limpia las
 * fechas. Tampoco toca el contador, que nunca se decremento.
 */
export const restoreMovement = async (
  current: MplusMovement,
  options?: MovementMutationOptions,
): Promise<MovementMutationResult> => {
  if (current.origin === "household_expense") {
    throw new MovementPreconditionError(
      "Los gastos originados en Hogar se restauran exclusivamente desde Hogar.",
    );
  }
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();

  if (current.lifecycleState !== "trashed") {
    throw new MovementPreconditionError("El movimiento no esta en la Papelera.");
  }
  if (current.purgeAfterMillis !== null && current.purgeAfterMillis <= nowMillis) {
    throw new MovementPreconditionError(
      "Este movimiento ya vencio y no puede restaurarse.",
    );
  }

  const mutationId = newMutationId();
  const next = mplusValidators.movement({
    ...current,
    lifecycleState: "active",
    trashedAtMillis: null,
    purgeAfterMillis: null,
    revision: current.revision + 1,
    lastMutationId: mutationId,
    updatedAtMillis: nowMillis,
  }) as MplusMovement;

  const movementRef = movementRefFor(db, current.id);

  return runMplusMutation<MplusMovement>(db, {
    mutationId,
    occ: [
      {
        resource: MPLUS_PATHS.movements,
        id: current.id,
        ref: movementRef,
        baseRevision: current.revision,
      },
    ],
    work: (tx) => {
      tx.set(movementRef, movementToFirestore(next));
      return next;
    },
  }, options?.deps);
};

/**
 * Eliminacion fisica de un movimiento vencido (contrato §9.5). Solo se permite
 * con `lifecycleState = trashed` y `purgeAfter <= ahora`; decrementa el
 * contador de la cuenta en la misma transaccion.
 */
export const purgeMovement = async (
  current: MplusMovement,
  options?: MovementMutationOptions,
): Promise<MplusMutationOutcome<string>> => {
  if (current.origin === "household_expense") {
    throw new MovementPreconditionError(
      "Los gastos originados en Hogar se purgan exclusivamente desde Hogar.",
    );
  }
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();

  if (current.lifecycleState !== "trashed") {
    throw new MovementPreconditionError("Solo se purga un movimiento en la Papelera.");
  }
  if (current.purgeAfterMillis === null || current.purgeAfterMillis > nowMillis) {
    throw new MovementPreconditionError("El movimiento todavia no ha vencido.");
  }

  const mutationId = newMutationId();
  const movementRef = movementRefFor(db, current.id);

  return runMplusMutation<string>(db, {
    mutationId,
    occ: [
      {
        resource: MPLUS_PATHS.movements,
        id: current.id,
        ref: movementRef,
        baseRevision: current.revision,
      },
    ],
    work: async (tx) => {
      const plans: CounterPlan[] =
        current.accountId !== null ? [{ accountId: current.accountId, delta: -1 }] : [];

      const accounts = await readAccountsForCounters(tx, db, current.ownerId, plans);
      writeAccountCounters(
        tx, db, current.ownerId, plans, accounts, current.id, mutationId, nowMillis,
      );
      tx.delete(movementRef);
      return current.id;
    },
  }, options?.deps);
};

/**
 * Eliminación física permanente de un movimiento en Papelera a petición del usuario
 * (§ Paridad Android MplusMovementRepository.deletePermanently / Dev Log 2026-09-02).
 *
 * Precondiciones:
 * - Debe pertenecer a la Papelera (`lifecycleState === "trashed"`).
 * - NO exige que `purgeAfterMillis` haya vencido (diferencia con `purgeMovement`).
 *
 * Efectos:
 * - Decrementa el contador `referenceCount` de la cuenta asociada si existe.
 * - Elimina físicamente el documento del movimiento mediante `tx.delete`.
 */
export const deleteMovementPermanently = async (
  current: MplusMovement,
  options?: MovementMutationOptions,
): Promise<MplusMutationOutcome<string>> => {
  if (current.origin === "household_expense") {
    throw new MovementPreconditionError(
      "Los gastos originados en Hogar se eliminan permanentemente exclusivamente desde Hogar.",
    );
  }
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();

  if (current.lifecycleState !== "trashed") {
    throw new MovementPreconditionError("Solo se pueden eliminar permanentemente movimientos en la Papelera.");
  }

  const mutationId = newMutationId();
  const movementRef = movementRefFor(db, current.id);

  return runMplusMutation<string>(db, {
    mutationId,
    occ: [
      {
        resource: MPLUS_PATHS.movements,
        id: current.id,
        ref: movementRef,
        baseRevision: current.revision,
      },
    ],
    work: async (tx) => {
      const plans: CounterPlan[] =
        current.accountId !== null ? [{ accountId: current.accountId, delta: -1 }] : [];

      const accounts = await readAccountsForCounters(tx, db, current.ownerId, plans);
      writeAccountCounters(
        tx, db, current.ownerId, plans, accounts, current.id, mutationId, nowMillis,
      );
      tx.delete(movementRef);
      return current.id;
    },
  }, options?.deps);
};


/**
 * Actualiza exclusivamente la categoría personal de una derivada originada en Hogar.
 * Hogar nunca consulta ni almacena categorías personales (privacidad total).
 */
export const updateMovementPersonalCategory = async (
  current: MplusMovement,
  categoryId: string | null,
  options?: MovementMutationOptions,
): Promise<MovementMutationResult> => {
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();

  if (current.origin !== "household_expense") {
    throw new MovementPreconditionError(
      "Esta función es exclusiva para derivaciones originadas en Hogar.",
    );
  }

  if (current.lifecycleState !== "active") {
    throw new MovementPreconditionError(
      "Un movimiento en la Papelera no se edita.",
    );
  }

  const mutationId = newMutationId();
  const next = mplusValidators.movement({
    ...current,
    categoryId,
    revision: current.revision + 1,
    lastMutationId: mutationId,
    updatedAtMillis: nowMillis,
  }) as MplusMovement;

  const movementRef = movementRefFor(db, current.id);
  return runMplusMutation<MplusMovement>(
    db,
    {
      mutationId,
      occ: [
        {
          resource: MPLUS_PATHS.movements,
          id: current.id,
          ref: movementRef,
          baseRevision: current.revision,
        },
      ],
      work: (tx) => {
        tx.set(movementRef, movementToFirestore(next));
        return next;
      },
    },
    options?.deps,
  );
};
