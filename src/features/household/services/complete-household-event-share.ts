import { collection, doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  applyExpenseSourceDelta,
  assertExpenseSourceHasEnoughBalance,
  loadExpenseSourceState,
} from "@/lib/finance/expense-source";
import { assertSufficientOwnFunds } from "@/lib/finance/own-funds-gate";
import { projectThirdPartyHeldAtLocation } from "@/lib/finance/third-party-location";
import { readThirdPartyLocationSnapshot } from "@/features/transactions/services/read-third-party-location-snapshot";

export type CompleteHouseholdEventShareInput = {
  shareId: string;
  ownerId: string;
  accountId: string;
  pocketId: string | null;
  categoryId: string;
  date: Date;
  description?: string;
};

export type CompleteHouseholdEventShareTransactionLike = {
  get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  set: (ref: unknown, data: Record<string, unknown>) => void;
  update: (ref: unknown, data: Record<string, unknown>) => void;
};

export type CompleteHouseholdEventShareDeps = {
  getFirebaseDbFn?: () => unknown;
  runTransactionFn?: (
    db: unknown,
    updateFunction: (transaction: CompleteHouseholdEventShareTransactionLike) => Promise<void>,
  ) => Promise<void>;
  docFn?: (...args: unknown[]) => unknown;
  collectionFn?: (...args: unknown[]) => unknown;
  readThirdPartyLocationSnapshotFn?: typeof readThirdPartyLocationSnapshot;
  loadExpenseSourceStateFn?: typeof loadExpenseSourceState;
  applyExpenseSourceDeltaFn?: typeof applyExpenseSourceDelta;
};

/**
 * Completa la responsabilidad (share) de un evento del Hogar para el usuario actual.
 * Ejecuta en una sola transacción:
 * 1. Lee y valida el share y el evento correspondiente.
 * 2. Lee y valida la cuenta/bolsillo origen y la categoría personal del usuario.
 * 3. Exige fondos propios (físico − retenido de terceros), sin clamp.
 * 4. Crea la transacción de gasto personal privado.
 * 5. Descuenta el saldo de la cuenta/bolsillo.
 * 6. Actualiza el estado del share a "completed" con la referencia a la transacción personal.
 */
export const completeHouseholdEventShare = async (
  input: CompleteHouseholdEventShareInput,
  deps: CompleteHouseholdEventShareDeps = {},
): Promise<void> => {
  const { shareId, ownerId, accountId, pocketId, categoryId, date, description } = input;

  if (!shareId.trim()) {
    throw new Error("El ID de la responsabilidad es obligatorio.");
  }
  if (!ownerId.trim()) {
    throw new Error("El ID del usuario es obligatorio.");
  }
  if (!accountId.trim()) {
    throw new Error("La cuenta origen es obligatoria.");
  }
  if (!categoryId.trim()) {
    throw new Error("La categoría personal es obligatoria.");
  }

  const getDbImpl = deps.getFirebaseDbFn ?? getFirebaseDb;
  const docImpl = deps.docFn ?? ((...args: unknown[]) => (doc as unknown as (...a: unknown[]) => unknown)(...args));
  const collectionImpl =
    deps.collectionFn ?? ((...args: unknown[]) => (collection as unknown as (...a: unknown[]) => unknown)(...args));
  const runTransactionImpl =
    deps.runTransactionFn ??
    ((database: unknown, updateFunction: (transaction: CompleteHouseholdEventShareTransactionLike) => Promise<void>) =>
      runTransaction(
        database as ReturnType<typeof getFirebaseDb>,
        updateFunction as unknown as Parameters<typeof runTransaction>[1],
      ) as unknown as Promise<void>);
  const readSnapshot = deps.readThirdPartyLocationSnapshotFn ?? readThirdPartyLocationSnapshot;
  const loadSource = deps.loadExpenseSourceStateFn ?? loadExpenseSourceState;
  const applyDelta = deps.applyExpenseSourceDeltaFn ?? applyExpenseSourceDelta;

  const db = getDbImpl();
  const ownershipSnapshot = await readSnapshot(ownerId);

  await runTransactionImpl(db, async (transaction) => {
    const shareRef = docImpl(db, "household_event_shares", shareId);
    const shareSnap = await transaction.get(shareRef);
    if (!shareSnap.exists()) {
      throw new Error("La responsabilidad seleccionada no existe.");
    }
    const shareData = shareSnap.data();

    const eventId = shareData.eventId;
    if (!eventId || typeof eventId !== "string") {
      throw new Error("La responsabilidad no está vinculada a ningún evento válido.");
    }
    const eventRef = docImpl(db, "household_events", eventId);
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists()) {
      throw new Error("El evento del Hogar relacionado no existe.");
    }
    const eventData = eventSnap.data();

    const expenseSource = await loadSource({
      accountId,
      db: db as Parameters<typeof loadExpenseSourceState>[0]["db"],
      ownerId,
      pocketId: pocketId || null,
      transaction: transaction as unknown as Parameters<typeof loadExpenseSourceState>[0]["transaction"],
    });

    const categoryRef = docImpl(db, "categories", categoryId);
    const categorySnap = await transaction.get(categoryRef);
    if (!categorySnap.exists()) {
      throw new Error("La categoría personal seleccionada no existe.");
    }
    const categoryData = categorySnap.data();

    if (shareData.memberUserId !== ownerId) {
      throw new Error("No puedes completar una responsabilidad que pertenece a otro miembro.");
    }

    const shareStatus = String(shareData.status ?? "pending");
    if (shareStatus === "completed") {
      throw new Error("Esta responsabilidad ya está completada.");
    }
    if (shareStatus === "cancelled") {
      throw new Error("Esta responsabilidad ha sido cancelada y no se puede pagar.");
    }

    if (eventData.status !== "active") {
      throw new Error("El evento del Hogar no está activo.");
    }

    if (categoryData.ownerId !== ownerId) {
      throw new Error("No tienes permisos para usar esta categoría.");
    }
    const categoryKind = categoryData.kind ?? categoryData.type;
    if (categoryKind !== "expense") {
      throw new Error("La categoría seleccionada debe ser de tipo gasto.");
    }

    const responsibilityAmount = Number(shareData.responsibilityAmount ?? shareData.amount ?? 0);
    if (responsibilityAmount <= 0) {
      throw new Error("El monto de la responsabilidad debe ser mayor a cero.");
    }
    assertExpenseSourceHasEnoughBalance(expenseSource, responsibilityAmount);

    const heldAtLocation = projectThirdPartyHeldAtLocation(
      { accountId, pocketId: pocketId || null },
      ownershipSnapshot.entries,
      ownershipSnapshot.moves,
      ownershipSnapshot.consumptions,
    );
    assertSufficientOwnFunds({
      physicalBalance: expenseSource.availableBalance,
      thirdPartyHeld: heldAtLocation,
      amount: responsibilityAmount,
    });

    const transactionRef = docImpl(collectionImpl(db, "transactions"));
    transaction.set(transactionRef, {
      ownerId,
      type: "expense",
      amount: responsibilityAmount,
      accountId,
      pocketId: pocketId || null,
      categoryId,
      date: Timestamp.fromDate(date),
      description: description?.trim() || `Pago cuota Hogar: ${String(eventData.title || "Gasto del hogar")}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      source: "manual",
      status: "confirmed",
      isHousehold: false,
      householdId: eventData.householdId,
      relatedEventId: eventId,
      relatedDebtId: null,
    });

    applyDelta({
      amountDelta: -responsibilityAmount,
      source: expenseSource,
      transaction: transaction as unknown as Parameters<typeof applyExpenseSourceDelta>[0]["transaction"],
    });

    transaction.update(shareRef, {
      status: "completed",
      completedAt: serverTimestamp(),
      completedByTransactionId: (transactionRef as { id: string }).id,
      updatedAt: serverTimestamp(),
    });
  });
};
