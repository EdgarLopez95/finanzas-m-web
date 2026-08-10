import { collection, doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { assertValidTransactionAmount } from "@/lib/finance/transaction-validation";
import {
  applyExpenseSourceDelta,
  assertExpenseSourceHasEnoughBalance,
  loadExpenseSourceState,
} from "@/lib/finance/expense-source";
import { assertSufficientOwnFunds } from "@/lib/finance/own-funds-gate";
import { readThirdPartyLocationSnapshot } from "./read-third-party-location-snapshot";
import { projectThirdPartyHeldAtLocation } from "@/lib/finance/third-party-location";

const buildSafeVisibleDescription = (description?: string): string => {
  const normalized = description?.replace(/\s+/g, " ").trim() ?? "";
  if (!normalized) {
    return "Gasto compartido";
  }
  if (normalized.length > 80 || /[\r\n\t]/.test(normalized)) {
    return "Gasto compartido";
  }
  return normalized;
};

export type CreatePersonalExpenseWithHouseholdProjectionInput = {
  // Personal Expense
  ownerId: string;
  amount: number;
  accountId: string;
  pocketId?: string | null;
  categoryId: string;
  date: Date;
  description?: string;
  consumesThirdPartyFunds?: boolean;
  thirdPartyConsumeAmount?: number;

  // Household projection
  householdId: string;
  householdCategoryId: string;
  memberShares: { memberUserId: string; responsibilityAmount: number }[];
};

export const createPersonalExpenseWithHouseholdProjection = async (
  payload: CreatePersonalExpenseWithHouseholdProjectionInput
): Promise<void> => {
  assertValidTransactionAmount(payload.amount);
  const db = getFirebaseDb();

  // Validar explícitamente que NO intente consumir dineros no propios
  if (payload.consumesThirdPartyFunds) {
    throw new Error("Los gastos no propios no pueden proyectarse al Hogar.");
  }

  // Pre-cargar snapshot para proteger los fondos no propios retenidos
  const snapshot = await readThirdPartyLocationSnapshot(payload.ownerId);
  const heldAtLocation = projectThirdPartyHeldAtLocation(
    { accountId: payload.accountId, pocketId: payload.pocketId ?? null },
    snapshot.entries,
    snapshot.moves,
    snapshot.consumptions,
  );

  await runTransaction(db, async (transaction) => {
    // ==========================================
    // FASE DE LECTURA
    // ==========================================
    const expenseSource = await loadExpenseSourceState({
      accountId: payload.accountId,
      db,
      ownerId: payload.ownerId,
      pocketId: payload.pocketId,
      transaction,
    });

    const categoryRef = doc(db, "categories", payload.categoryId);
    const categorySnap = await transaction.get(categoryRef);

    if (!categorySnap.exists()) {
      throw new Error("La categoría seleccionada no existe.");
    }

    const categoryData = categorySnap.data();
    if (categoryData.ownerId !== payload.ownerId) {
      throw new Error("No tienes permiso para usar esta categoría.");
    }

    const categoryKind = categoryData.kind ?? categoryData.type;
    if (categoryKind !== "expense") {
      throw new Error("La categoría debe ser de tipo gasto.");
    }

    const householdRef = doc(db, "households", payload.householdId);
    const householdSnap = await transaction.get(householdRef);
    if (!householdSnap.exists()) {
      throw new Error("El Hogar seleccionado no existe.");
    }
    const householdData = householdSnap.data();
    if (householdData.status === "dissolved") {
      throw new Error("El Hogar seleccionado está disuelto.");
    }
    const memberIds = (householdData.memberIds || []) as string[];
    if (!memberIds.includes(payload.ownerId)) {
      throw new Error("No tienes permiso en este Hogar.");
    }

    const householdCategoryRef = doc(db, "household_categories", payload.householdCategoryId);
    const householdCategorySnap = await transaction.get(householdCategoryRef);
    if (!householdCategorySnap.exists()) {
      throw new Error("La categoría del Hogar seleccionada no existe.");
    }
    const householdCategoryData = householdCategorySnap.data();
    if (householdCategoryData.householdId !== payload.householdId) {
      throw new Error("La categoría no pertenece a este Hogar.");
    }
    if (householdCategoryData.archived) {
      throw new Error("La categoría del Hogar seleccionada está archivada.");
    }

    // ==========================================
    // FASE DE VALIDACION Y CALCULO
    // ==========================================
    assertExpenseSourceHasEnoughBalance(expenseSource, payload.amount);

    // Validación estricta sin clamp: un gasto propio jamás consume dinero no propio
    assertSufficientOwnFunds({
      physicalBalance: expenseSource.availableBalance,
      thirdPartyHeld: heldAtLocation,
      amount: payload.amount,
    });

    const sharesSum = payload.memberShares.reduce((s, m) => s + m.responsibilityAmount, 0);
    if (Math.abs(sharesSum - payload.amount) > 1) {
      throw new Error(`La suma de responsabilidades (${sharesSum}) debe ser igual al monto total (${payload.amount}).`);
    }

    // ==========================================
    // FASE DE ESCRITURA
    // ==========================================
    const transactionRef = doc(collection(db, "transactions"));
    transaction.set(transactionRef, {
      ownerId: payload.ownerId,
      type: "expense",
      amount: payload.amount,
      accountId: payload.accountId,
      pocketId: payload.pocketId ?? null,
      categoryId: payload.categoryId,
      date: Timestamp.fromDate(payload.date),
      description: payload.description?.trim() ?? "",
      createdAt: serverTimestamp(),
      source: "manual",
      status: "confirmed",
      isHousehold: false,
      householdId: null,
      consumesThirdPartyFunds: false,
    });

    applyExpenseSourceDelta({
      amountDelta: -payload.amount,
      source: expenseSource,
      transaction,
    });

    const eventRef = doc(collection(db, "household_events"));
    const title = buildSafeVisibleDescription(payload.description);
    transaction.set(eventRef, {
      householdId: payload.householdId,
      createdByUserId: payload.ownerId,
      paidByUserId: payload.ownerId,
      settlementMode: "advancedByPayer",
      sourceTransactionId: transactionRef.id,
      householdCategoryId: payload.householdCategoryId,
      title,
      description: null,
      eventDate: Timestamp.fromDate(payload.date),
      totalAmount: payload.amount,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const payerShareRef = doc(collection(db, "household_event_shares"));
    transaction.set(payerShareRef, {
      eventId: eventRef.id,
      householdId: payload.householdId,
      memberUserId: payload.ownerId,
      responsibilityAmount: payload.amount,
      status: "completed",
      completedAt: serverTimestamp(),
      completedByTransactionId: transactionRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const share of payload.memberShares) {
      if (share.memberUserId !== payload.ownerId && share.responsibilityAmount > 0) {
        const debtRef = doc(collection(db, "household_debts"));
        transaction.set(debtRef, {
          householdId: payload.householdId,
          eventId: eventRef.id,
          fromUserId: share.memberUserId,
          toUserId: payload.ownerId,
          amount: share.responsibilityAmount,
          status: "pending",
          outgoingTransactionId: null,
          incomingTransactionId: null,
          paymentDeclaredAt: null,
          paidAt: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  });
};
