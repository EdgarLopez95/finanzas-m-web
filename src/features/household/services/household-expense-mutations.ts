import {
  doc,
  increment,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from "firebase/firestore";

import { useAuthStore } from "@/stores/auth-store";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  PURGE_WINDOW_MILLIS,
  isTodayOrPastInBogota,
  normalizeOccurredAtMillis,
} from "@/lib/mplus/bogota-date";
import {
  householdExpenseToFirestore,
  millisToTimestamp,
  millisToTimestampOrNull,
  movementFromFirestore,
  movementToFirestore,
  type FirestoreData,
} from "@/lib/mplus/converters";
import type { HouseholdExpenseDistributionMode } from "@/lib/mplus/enums";
import { newHouseholdExpenseId, newMutationId } from "@/lib/mplus/ids";
import type {
  MplusHousehold,
  MplusHouseholdExpense,
  MplusHouseholdMember,
  MplusMovement,
} from "@/lib/mplus/models";
import {
  runMplusMutation,
  type MplusMutationOutcome,
  type MplusRunnerDeps,
} from "@/lib/mplus/mutation-runner";
import {
  householdExpenseDocPath,
  householdExpenseParticipationMovementId,
  householdMemberDocPath,
  MPLUS_PATHS,
} from "@/lib/mplus/paths";
import { mplusValidators } from "@/lib/mplus/schemas";

export class HouseholdExpensePreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HouseholdExpensePreconditionError";
  }
}

export type HouseholdExpenseDraft = Readonly<{
  title: string;
  amount: number;
  note?: string;
  occurredAtMillis: number;
  householdCategoryId?: string | null;
  distributionMode: HouseholdExpenseDistributionMode;
  customDistribution?: {
    memberAAmount: number;
    memberBAmount: number;
  };
}>;

export type HouseholdExpenseMutationResult = MplusMutationOutcome<MplusHouseholdExpense>;

export type HouseholdExpenseMutationOptions = Readonly<{
  nowMillis?: number;
  db?: Firestore;
  deps?: MplusRunnerDeps;
  userId?: string;
  members?: readonly MplusHouseholdMember[];
}>;

export const calculateHouseholdExpenseDistribution = (
  amount: number,
  mode: HouseholdExpenseDistributionMode,
  custom?: { memberAAmount: number; memberBAmount: number },
): { memberAAmount: number; memberBAmount: number } => {
  if (mode === "equal") {
    const memberAAmount = Math.ceil(amount / 2);
    const memberBAmount = Math.floor(amount / 2);
    return { memberAAmount, memberBAmount };
  }
  if (!custom) {
    throw new HouseholdExpensePreconditionError("Se requiere customDistribution para el modo custom.");
  }
  const { memberAAmount, memberBAmount } = custom;
  if (!Number.isInteger(memberAAmount) || memberAAmount < 0) {
    throw new HouseholdExpensePreconditionError("El monto del integrante A debe ser un entero no negativo.");
  }
  if (!Number.isInteger(memberBAmount) || memberBAmount < 0) {
    throw new HouseholdExpensePreconditionError("El monto del integrante B debe ser un entero no negativo.");
  }
  if (memberAAmount + memberBAmount !== amount) {
    throw new HouseholdExpensePreconditionError(
      "La suma de participaciones (" + memberAAmount + " + " + memberBAmount + " = " + (memberAAmount + memberBAmount) + ") debe ser igual al total (" + amount + ").",
    );
  }
  return { memberAAmount, memberBAmount };
};

const assertDraftIsWritable = (draft: HouseholdExpenseDraft, nowMillis: number): void => {
  if (!draft.title.trim()) {
    throw new HouseholdExpensePreconditionError("El concepto del gasto no puede estar vacío.");
  }
  if (!Number.isInteger(draft.amount) || draft.amount <= 0) {
    throw new HouseholdExpensePreconditionError("El monto debe ser un número entero mayor a cero.");
  }
  if (!isTodayOrPastInBogota(draft.occurredAtMillis, nowMillis)) {
    throw new HouseholdExpensePreconditionError(
      "La fecha no puede ser futura: un gasto de Hogar admite hoy o un día pasado.",
    );
  }
};

const isParticipantLeftLocally = (
  household: MplusHousehold,
  memberIds: readonly string[],
  members?: readonly MplusHouseholdMember[],
): boolean => {
  if (household.status === "waiting_return") return true;
  if (!members || members.length === 0) return false;
  return members.some((m) => memberIds.includes(m.userId) && m.state === "left");
};

const checkParticipantsLeftInTx = async (
  tx: Transaction,
  db: Firestore,
  household: MplusHousehold,
  options?: HouseholdExpenseMutationOptions,
): Promise<boolean> => {
  if (isParticipantLeftLocally(household, [household.memberAId, household.memberBId ?? ""], options?.members)) {
    return true;
  }
  if (!household.memberBId) return true;
  const memARef = doc(db, ...householdMemberDocPath(household.id, household.memberAId));
  const memBRef = doc(db, ...householdMemberDocPath(household.id, household.memberBId));
  const [snapA, snapB] = await Promise.all([tx.get(memARef), tx.get(memBRef)]);
  const stateA = snapA.exists() ? (snapA.data() as Record<string, unknown> | undefined)?.state : null;
  const stateB = snapB.exists() ? (snapB.data() as Record<string, unknown> | undefined)?.state : null;
  return stateA === "left" || stateB === "left";
};

const expenseRefFor = (db: Firestore, householdId: string, expenseId: string): DocumentReference =>
  doc(db, ...householdExpenseDocPath(householdId, expenseId));

const movementRefFor = (db: Firestore, movementId: string): DocumentReference =>
  doc(db, MPLUS_PATHS.movements, movementId);

/**
 * Crea un gasto originado directamente en Hogar y genera atómicamente sus
 * participaciones personales derivadas para cada integrante con monto > 0.
 */
export const createHouseholdExpense = async (
  household: MplusHousehold,
  draft: HouseholdExpenseDraft,
  options?: HouseholdExpenseMutationOptions,
): Promise<HouseholdExpenseMutationResult> => {
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();
  assertDraftIsWritable(draft, nowMillis);

  if (household.status !== "active" || !household.memberBId) {
    throw new HouseholdExpensePreconditionError(
      "El Hogar debe estar activo y contar con dos integrantes para registrar gastos.",
    );
  }

  const userId = options?.userId ?? useAuthStore.getState().user?.uid;
  if (!userId || (userId !== household.memberAId && userId !== household.memberBId)) {
    throw new HouseholdExpensePreconditionError(
      "Solo un integrante activo del Hogar puede registrar gastos.",
    );
  }

  if (isParticipantLeftLocally(household, [household.memberAId, household.memberBId], options?.members)) {
    throw new HouseholdExpensePreconditionError(
      "No se pueden registrar gastos en el Hogar si un integrante está inactivo.",
    );
  }

  const { memberAAmount, memberBAmount } = calculateHouseholdExpenseDistribution(
    draft.amount,
    draft.distributionMode,
    draft.customDistribution,
  );

  const expenseId = newHouseholdExpenseId();
  const mutationId = newMutationId();
  const occurredAtMillis = normalizeOccurredAtMillis(draft.occurredAtMillis);

  const expense = mplusValidators.householdExpense({
    id: expenseId,
    schemaVersion: 1,
    householdId: household.id,
    type: "expense",
    title: draft.title.trim(),
    amount: draft.amount,
    note: (draft.note ?? "").trim(),
    occurredAtMillis,
    householdCategoryId: draft.householdCategoryId ?? null,
    distributionMode: draft.distributionMode,
    memberAId: household.memberAId,
    memberAAmount,
    memberBId: household.memberBId,
    memberBAmount,
    lifecycleState: "active",
    trashedAtMillis: null,
    purgeAfterMillis: null,
    createdBy: userId,
    updatedBy: userId,
    revision: 1,
    lastMutationId: mutationId,
    createdAtMillis: nowMillis,
    updatedAtMillis: nowMillis,
  }) as MplusHouseholdExpense;

  const expenseRef = expenseRefFor(db, household.id, expenseId);

  return runMplusMutation<MplusHouseholdExpense>(
    db,
    {
      mutationId,
      occ: [
        {
          resource: "household_expenses",
          id: expenseId,
          ref: expenseRef,
          baseRevision: null,
        },
      ],
      work: async (tx) => {
        // FASE 1: Todas las lecturas antes de escribir
        const isLeft = await checkParticipantsLeftInTx(tx, db, household, options);
        if (isLeft) {
          throw new HouseholdExpensePreconditionError(
            "No se pueden registrar gastos en el Hogar si un integrante está inactivo.",
          );
        }

        // FASE 2: Escrituras
        tx.set(expenseRef, householdExpenseToFirestore(expense));

        if (memberAAmount > 0) {
          const partAId = householdExpenseParticipationMovementId(expenseId, household.memberAId);
          const partARef = movementRefFor(db, partAId);
          const partA = mplusValidators.movement({
            id: partAId,
            schemaVersion: 1,
            ownerId: household.memberAId,
            type: "expense",
            title: expense.title,
            amount: memberAAmount,
            categoryId: null,
            accountId: null,
            note: expense.note,
            occurredAtMillis,
            lifecycleState: "active",
            trashedAtMillis: null,
            purgeAfterMillis: null,
            householdId: null,
            householdCategoryId: null,
            origin: "household_expense",
            householdExpenseId: expenseId,
            revision: 1,
            lastMutationId: mutationId,
            createdAtMillis: nowMillis,
            updatedAtMillis: nowMillis,
          }) as MplusMovement;
          tx.set(partARef, movementToFirestore(partA));
        }

        if (memberBAmount > 0 && household.memberBId) {
          const partBId = householdExpenseParticipationMovementId(expenseId, household.memberBId);
          const partBRef = movementRefFor(db, partBId);
          const partB = mplusValidators.movement({
            id: partBId,
            schemaVersion: 1,
            ownerId: household.memberBId,
            type: "expense",
            title: expense.title,
            amount: memberBAmount,
            categoryId: null,
            accountId: null,
            note: expense.note,
            occurredAtMillis,
            lifecycleState: "active",
            trashedAtMillis: null,
            purgeAfterMillis: null,
            householdId: null,
            householdCategoryId: null,
            origin: "household_expense",
            householdExpenseId: expenseId,
            revision: 1,
            lastMutationId: mutationId,
            createdAtMillis: nowMillis,
            updatedAtMillis: nowMillis,
          }) as MplusMovement;
          tx.set(partBRef, movementToFirestore(partB));
        }

        return expense;
      },
    },
    options?.deps,
  );
};

/**
 * Actualiza un gasto originado en Hogar.
 *
 * Invariantes del contrato:
 * - Con participante left y fuente active: SOLO se puede modificar householdCategoryId.
 * - Positivo -> 0 borra la derivada personal.
 * - 0 -> positivo recrea la derivada con categoryId = null.
 * - Positivo -> positivo preserva la categoría personal existente.
 */
export const updateHouseholdExpense = async (
  current: MplusHouseholdExpense,
  household: MplusHousehold,
  draft: HouseholdExpenseDraft,
  options?: HouseholdExpenseMutationOptions,
): Promise<HouseholdExpenseMutationResult> => {
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();

  if (current.lifecycleState !== "active") {
    throw new HouseholdExpensePreconditionError(
      "Un gasto en la Papelera no se edita: restáuralo primero.",
    );
  }
  assertDraftIsWritable(draft, nowMillis);

  const userId = options?.userId ?? useAuthStore.getState().user?.uid;
  if (!userId || (userId !== current.memberAId && userId !== current.memberBId)) {
    throw new HouseholdExpensePreconditionError(
      "Solo un integrante del Hogar puede modificar este gasto.",
    );
  }

  const mutationId = newMutationId();
  const occurredAtMillis = normalizeOccurredAtMillis(draft.occurredAtMillis);

  const { memberAAmount: nextMemberAAmount, memberBAmount: nextMemberBAmount } =
    calculateHouseholdExpenseDistribution(
      draft.amount,
      draft.distributionMode,
      draft.customDistribution,
    );

  if (isParticipantLeftLocally(household, [current.memberAId, current.memberBId], options?.members)) {
    const titleChanged = draft.title.trim() !== current.title;
    const amountChanged = draft.amount !== current.amount;
    const noteChanged = (draft.note ?? "").trim() !== current.note;
    const dateChanged = occurredAtMillis !== current.occurredAtMillis;
    const distChanged =
      draft.distributionMode !== current.distributionMode ||
      nextMemberAAmount !== current.memberAAmount ||
      nextMemberBAmount !== current.memberBAmount;

    if (titleChanged || amountChanged || noteChanged || dateChanged || distChanged) {
      throw new HouseholdExpensePreconditionError(
        "Con un integrante inactivo solo se puede modificar la categoría del gasto en el Hogar.",
      );
    }
  }

  const partAId = householdExpenseParticipationMovementId(current.id, current.memberAId);
  const partBId = householdExpenseParticipationMovementId(current.id, current.memberBId);
  const partARef = movementRefFor(db, partAId);
  const partBRef = movementRefFor(db, partBId);
  const expenseRef = expenseRefFor(db, current.householdId, current.id);

  return runMplusMutation<MplusHouseholdExpense>(
    db,
    {
      mutationId,
      occ: [
        {
          resource: "household_expenses",
          id: current.id,
          ref: expenseRef,
          baseRevision: current.revision,
        },
      ],
      work: async (tx) => {
        const isActorB = userId === current.memberBId;
        const ownId = isActorB ? current.memberBId : current.memberAId;
        const partnerId = isActorB ? current.memberAId : current.memberBId;
        const ownRef = isActorB ? partBRef : partARef;
        const partnerRef = isActorB ? partARef : partBRef;
        const ownAmount = isActorB ? nextMemberBAmount : nextMemberAAmount;
        const newPartnerAmount = isActorB ? nextMemberAAmount : nextMemberBAmount;
        const prevPartnerAmount = isActorB ? current.memberAAmount : current.memberBAmount;

        // FASE 1: Lecturas obligatorias de Firestore
        const isLeft = await checkParticipantsLeftInTx(tx, db, household, options);
        // Privacidad canónica (paridad con Android MplusFirestoreMutationApplier):
        // Solo leemos la derivada del propio usuario. La del copartícipe nunca se lee con tx.get().
        const snapOwn = await tx.get(ownRef);

        if (isLeft) {
          // Regla: con participante left y fuente active, solo se puede modificar householdCategoryId
          const titleChanged = draft.title.trim() !== current.title;
          const amountChanged = draft.amount !== current.amount;
          const noteChanged = (draft.note ?? "").trim() !== current.note;
          const dateChanged = occurredAtMillis !== current.occurredAtMillis;
          const distChanged =
            draft.distributionMode !== current.distributionMode ||
            nextMemberAAmount !== current.memberAAmount ||
            nextMemberBAmount !== current.memberBAmount;

          if (titleChanged || amountChanged || noteChanged || dateChanged || distChanged) {
            throw new HouseholdExpensePreconditionError(
              "Con un integrante inactivo solo se puede modificar la categoría del gasto en el Hogar.",
            );
          }
        }

        const nextExpense = mplusValidators.householdExpense({
          ...current,
          title: draft.title.trim(),
          amount: draft.amount,
          note: (draft.note ?? "").trim(),
          occurredAtMillis,
          householdCategoryId: draft.householdCategoryId ?? null,
          distributionMode: draft.distributionMode,
          memberAAmount: nextMemberAAmount,
          memberBAmount: nextMemberBAmount,
          revision: current.revision + 1,
          lastMutationId: mutationId,
          updatedAtMillis: nowMillis,
          updatedBy: userId,
        }) as MplusHouseholdExpense;

        // FASE 2: Escrituras
        // 1. Gasto fuente
        tx.set(expenseRef, householdExpenseToFirestore(nextExpense));

        // 2. Derivada propia (lectura y actualización autorizada)
        if (ownAmount <= 0) {
          if (snapOwn.exists()) tx.delete(ownRef);
        } else if (!snapOwn.exists()) {
          // 0 -> positivo: nace con categoryId = null
          const newOwn = mplusValidators.movement({
            id: ownRef.id,
            schemaVersion: 1,
            ownerId: ownId,
            type: "expense",
            title: nextExpense.title,
            amount: ownAmount,
            categoryId: null,
            accountId: null,
            note: nextExpense.note,
            occurredAtMillis,
            lifecycleState: "active",
            trashedAtMillis: null,
            purgeAfterMillis: null,
            householdId: null,
            householdCategoryId: null,
            origin: "household_expense",
            householdExpenseId: current.id,
            revision: 1,
            lastMutationId: mutationId,
            createdAtMillis: nowMillis,
            updatedAtMillis: nowMillis,
          }) as MplusMovement;
          tx.set(ownRef, movementToFirestore(newOwn));
        } else {
          // positivo -> positivo: preserva categoría personal existente
          const existingData = movementFromFirestore(ownRef.id, snapOwn.data() as FirestoreData);
          const updatedOwn = mplusValidators.movement({
            id: ownRef.id,
            schemaVersion: 1,
            ownerId: ownId,
            type: "expense",
            title: nextExpense.title,
            amount: ownAmount,
            categoryId: existingData.categoryId ?? null,
            accountId: null,
            note: nextExpense.note,
            occurredAtMillis,
            lifecycleState: "active",
            trashedAtMillis: null,
            purgeAfterMillis: null,
            householdId: null,
            householdCategoryId: null,
            origin: "household_expense",
            householdExpenseId: current.id,
            revision: existingData.revision + 1,
            lastMutationId: mutationId,
            createdAtMillis: existingData.createdAtMillis,
            updatedAtMillis: nowMillis,
          }) as MplusMovement;
          tx.set(ownRef, movementToFirestore(updatedOwn));
        }

        // 3. Derivada del copartícipe (actualización a ciegas preservando su categoría privada sin leerla)
        if (newPartnerAmount <= 0) {
          if (prevPartnerAmount > 0) tx.delete(partnerRef);
        } else if (prevPartnerAmount <= 0) {
          // 0 -> positivo: nace con categoryId = null
          const newPartner = mplusValidators.movement({
            id: partnerRef.id,
            schemaVersion: 1,
            ownerId: partnerId,
            type: "expense",
            title: nextExpense.title,
            amount: newPartnerAmount,
            categoryId: null,
            accountId: null,
            note: nextExpense.note,
            occurredAtMillis,
            lifecycleState: "active",
            trashedAtMillis: null,
            purgeAfterMillis: null,
            householdId: null,
            householdCategoryId: null,
            origin: "household_expense",
            householdExpenseId: current.id,
            revision: 1,
            lastMutationId: mutationId,
            createdAtMillis: nowMillis,
            updatedAtMillis: nowMillis,
          }) as MplusMovement;
          tx.set(partnerRef, movementToFirestore(newPartner));
        } else {
          // positivo -> positivo: actualización a ciegas
          tx.update(partnerRef, {
            title: nextExpense.title,
            amount: newPartnerAmount,
            note: nextExpense.note,
            occurredAt: millisToTimestamp(occurredAtMillis),
            revision: increment(1),
            lastMutationId: mutationId,
            updatedAt: millisToTimestamp(nowMillis),
          });
        }

        return nextExpense;
      },
    },
    options?.deps,
  );
};

/**
 * Envía el gasto de Hogar a la Papelera.
 * Transiciona atómicamente la fuente y sincroniza el estado en sus derivadas.
 */
export const trashHouseholdExpense = async (
  current: MplusHouseholdExpense,
  household: MplusHousehold,
  options?: HouseholdExpenseMutationOptions,
): Promise<HouseholdExpenseMutationResult> => {
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();

  if (current.lifecycleState !== "active") {
    throw new HouseholdExpensePreconditionError("El gasto ya está en la Papelera.");
  }

  const userId = options?.userId ?? useAuthStore.getState().user?.uid;
  if (!userId || (userId !== current.memberAId && userId !== current.memberBId)) {
    throw new HouseholdExpensePreconditionError(
      "Solo un integrante del Hogar puede mover este gasto a la Papelera.",
    );
  }

  if (isParticipantLeftLocally(household, [current.memberAId, current.memberBId], options?.members)) {
    throw new HouseholdExpensePreconditionError(
      "No se puede enviar a la Papelera un gasto con un integrante inactivo.",
    );
  }

  const mutationId = newMutationId();
  const trashedAtMillis = nowMillis;
  const purgeAfterMillis = nowMillis + PURGE_WINDOW_MILLIS;

  const nextExpense = mplusValidators.householdExpense({
    ...current,
    lifecycleState: "trashed",
    trashedAtMillis,
    purgeAfterMillis,
    revision: current.revision + 1,
    lastMutationId: mutationId,
    updatedAtMillis: nowMillis,
    updatedBy: userId,
  }) as MplusHouseholdExpense;

  const partAId = householdExpenseParticipationMovementId(current.id, current.memberAId);
  const partBId = householdExpenseParticipationMovementId(current.id, current.memberBId);
  const partARef = movementRefFor(db, partAId);
  const partBRef = movementRefFor(db, partBId);
  const expenseRef = expenseRefFor(db, current.householdId, current.id);

  return runMplusMutation<MplusHouseholdExpense>(
    db,
    {
      mutationId,
      occ: [
        {
          resource: "household_expenses",
          id: current.id,
          ref: expenseRef,
          baseRevision: current.revision,
        },
      ],
      work: async (tx) => {
        const isActorB = userId === current.memberBId;
        const ownRef = isActorB ? partBRef : partARef;
        const partnerRef = isActorB ? partARef : partBRef;
        const prevPartnerAmount = isActorB ? current.memberAAmount : current.memberBAmount;

        // FASE 1: Lecturas
        const isLeft = await checkParticipantsLeftInTx(tx, db, household, options);
        if (isLeft) {
          throw new HouseholdExpensePreconditionError(
            "No se puede enviar a la Papelera un gasto con un integrante inactivo.",
          );
        }
        const snapOwn = await tx.get(ownRef);

        // FASE 2: Escrituras
        tx.set(expenseRef, householdExpenseToFirestore(nextExpense));

        if (snapOwn.exists()) {
          const dataOwn = movementFromFirestore(ownRef.id, snapOwn.data() as FirestoreData);
          tx.set(
            ownRef,
            movementToFirestore({
              ...dataOwn,
              lifecycleState: "trashed",
              trashedAtMillis,
              purgeAfterMillis,
              revision: dataOwn.revision + 1,
              lastMutationId: mutationId,
              updatedAtMillis: nowMillis,
            }),
          );
        }

        if (prevPartnerAmount > 0) {
          tx.update(partnerRef, {
            lifecycleState: "trashed",
            trashedAt: millisToTimestampOrNull(trashedAtMillis),
            purgeAfter: millisToTimestampOrNull(purgeAfterMillis),
            revision: increment(1),
            lastMutationId: mutationId,
            updatedAt: millisToTimestamp(nowMillis),
          });
        }

        return nextExpense;
      },
    },
    options?.deps,
  );
};

/**
 * Restaura el gasto de Hogar desde la Papelera.
 * Conserva intactas las categorías personales de cada integrante.
 */
export const restoreHouseholdExpense = async (
  current: MplusHouseholdExpense,
  household: MplusHousehold,
  options?: HouseholdExpenseMutationOptions,
): Promise<HouseholdExpenseMutationResult> => {
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();

  if (current.lifecycleState !== "trashed") {
    throw new HouseholdExpensePreconditionError("El gasto no está en la Papelera.");
  }
  if (current.purgeAfterMillis !== null && current.purgeAfterMillis <= nowMillis) {
    throw new HouseholdExpensePreconditionError("Este gasto ya venció y no puede restaurarse.");
  }

  const userId = options?.userId ?? useAuthStore.getState().user?.uid;
  if (!userId || (userId !== current.memberAId && userId !== current.memberBId)) {
    throw new HouseholdExpensePreconditionError(
      "Solo un integrante del Hogar puede restaurar este gasto.",
    );
  }

  if (isParticipantLeftLocally(household, [current.memberAId, current.memberBId], options?.members)) {
    throw new HouseholdExpensePreconditionError(
      "No se puede restaurar un gasto con un integrante inactivo.",
    );
  }

  const mutationId = newMutationId();

  const nextExpense = mplusValidators.householdExpense({
    ...current,
    lifecycleState: "active",
    trashedAtMillis: null,
    purgeAfterMillis: null,
    revision: current.revision + 1,
    lastMutationId: mutationId,
    updatedAtMillis: nowMillis,
    updatedBy: userId,
  }) as MplusHouseholdExpense;

  const partAId = householdExpenseParticipationMovementId(current.id, current.memberAId);
  const partBId = householdExpenseParticipationMovementId(current.id, current.memberBId);
  const partARef = movementRefFor(db, partAId);
  const partBRef = movementRefFor(db, partBId);
  const expenseRef = expenseRefFor(db, current.householdId, current.id);

  return runMplusMutation<MplusHouseholdExpense>(
    db,
    {
      mutationId,
      occ: [
        {
          resource: "household_expenses",
          id: current.id,
          ref: expenseRef,
          baseRevision: current.revision,
        },
      ],
      work: async (tx) => {
        const isActorB = userId === current.memberBId;
        const ownRef = isActorB ? partBRef : partARef;
        const partnerRef = isActorB ? partARef : partBRef;
        const prevPartnerAmount = isActorB ? current.memberAAmount : current.memberBAmount;

        // FASE 1: Lecturas
        const isLeft = await checkParticipantsLeftInTx(tx, db, household, options);
        if (isLeft) {
          throw new HouseholdExpensePreconditionError(
            "No se puede restaurar un gasto con un integrante inactivo.",
          );
        }
        const snapOwn = await tx.get(ownRef);

        // FASE 2: Escrituras
        tx.set(expenseRef, householdExpenseToFirestore(nextExpense));

        if (snapOwn.exists()) {
          const dataOwn = movementFromFirestore(ownRef.id, snapOwn.data() as FirestoreData);
          tx.set(
            ownRef,
            movementToFirestore({
              ...dataOwn,
              lifecycleState: "active",
              trashedAtMillis: null,
              purgeAfterMillis: null,
              revision: dataOwn.revision + 1,
              lastMutationId: mutationId,
              updatedAtMillis: nowMillis,
            }),
          );
        }

        if (prevPartnerAmount > 0) {
          tx.update(partnerRef, {
            lifecycleState: "active",
            trashedAt: null,
            purgeAfter: null,
            revision: increment(1),
            lastMutationId: mutationId,
            updatedAt: millisToTimestamp(nowMillis),
          });
        }

        return nextExpense;
      },
    },
    options?.deps,
  );
};

/**
 * Eliminación física permanente de un gasto en Papelera a petición del usuario.
 * Elimina fuente y derivadas atómicamente.
 */
export const deleteHouseholdExpensePermanently = async (
  current: MplusHouseholdExpense,
  household: MplusHousehold,
  options?: HouseholdExpenseMutationOptions,
): Promise<MplusMutationOutcome<string>> => {
  const db = options?.db ?? getFirebaseDb();

  if (current.lifecycleState !== "trashed") {
    throw new HouseholdExpensePreconditionError(
      "Solo se pueden eliminar permanentemente gastos en la Papelera.",
    );
  }

  const userId = options?.userId ?? useAuthStore.getState().user?.uid;
  if (!userId || (userId !== current.memberAId && userId !== current.memberBId)) {
    throw new HouseholdExpensePreconditionError(
      "Solo un integrante del Hogar puede eliminar permanentemente este gasto.",
    );
  }

  if (isParticipantLeftLocally(household, [current.memberAId, current.memberBId], options?.members)) {
    throw new HouseholdExpensePreconditionError(
      "No se puede eliminar permanentemente un gasto con un integrante inactivo.",
    );
  }

  const mutationId = newMutationId();
  const partAId = householdExpenseParticipationMovementId(current.id, current.memberAId);
  const partBId = householdExpenseParticipationMovementId(current.id, current.memberBId);
  const partARef = movementRefFor(db, partAId);
  const partBRef = movementRefFor(db, partBId);
  const expenseRef = expenseRefFor(db, current.householdId, current.id);

  return runMplusMutation<string>(
    db,
    {
      mutationId,
      occ: [
        {
          resource: "household_expenses",
          id: current.id,
          ref: expenseRef,
          baseRevision: current.revision,
        },
      ],
      work: async (tx) => {
        // FASE 1: Lecturas
        const isLeft = await checkParticipantsLeftInTx(tx, db, household, options);
        if (isLeft) {
          throw new HouseholdExpensePreconditionError(
            "No se puede eliminar permanentemente un gasto con un integrante inactivo.",
          );
        }

        // FASE 2: Escrituras
        tx.delete(expenseRef);
        tx.delete(partARef);
        tx.delete(partBRef);

        return current.id;
      },
    },
    options?.deps,
  );
};

/**
 * Eliminación física por vencimiento (purga a los 30 días).
 * Se permite aun cuando haya participantes left si now >= purgeAfterMillis.
 */
export const purgeHouseholdExpense = async (
  current: MplusHouseholdExpense,
  household: MplusHousehold,
  options?: HouseholdExpenseMutationOptions,
): Promise<MplusMutationOutcome<string>> => {
  const db = options?.db ?? getFirebaseDb();
  const nowMillis = options?.nowMillis ?? Date.now();

  if (current.lifecycleState !== "trashed") {
    throw new HouseholdExpensePreconditionError("Solo se purga un gasto en la Papelera.");
  }
  if (current.purgeAfterMillis === null || current.purgeAfterMillis > nowMillis) {
    throw new HouseholdExpensePreconditionError("El gasto todavía no ha vencido.");
  }

  const mutationId = newMutationId();
  const partAId = householdExpenseParticipationMovementId(current.id, current.memberAId);
  const partBId = householdExpenseParticipationMovementId(current.id, current.memberBId);
  const partARef = movementRefFor(db, partAId);
  const partBRef = movementRefFor(db, partBId);
  const expenseRef = expenseRefFor(db, current.householdId, current.id);

  return runMplusMutation<string>(
    db,
    {
      mutationId,
      occ: [
        {
          resource: "household_expenses",
          id: current.id,
          ref: expenseRef,
          baseRevision: current.revision,
        },
      ],
      work: async (tx) => {
        // FASE 2: Escrituras
        tx.delete(expenseRef);
        tx.delete(partARef);
        tx.delete(partBRef);

        return current.id;
      },
    },
    options?.deps,
  );
};