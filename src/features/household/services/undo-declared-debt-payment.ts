import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  applyExpenseSourceDelta,
  loadExpenseSourceState,
} from "@/lib/finance/expense-source";
import { assertCanUndoDeclaredDebtPayment } from "@/features/household/lib/household-debt-lifecycle";

export type UndoDeclaredDebtPaymentInput = {
  debtId: string;
  ownerId: string;
};

/**
 * Deshace la declaración de pago de una deuda del Hogar por parte del deudor (usuario actual),
 * paridad Android (HouseholdDebtRepository.kt:280-320, undoDeclaredPayment):
 * 1. Lee y valida la deuda (solo deudor, status payment_declared, acreedor sin confirmar aún).
 * 2. Lee la transacción de reembolso saliente que declaró el pago y revierte su efecto de saldo.
 * 3. Borra esa transacción personal.
 * 4. Regresa la deuda a "pending", limpiando outgoingTransactionId y paymentDeclaredAt.
 */
export const undoDeclaredDebtPayment = async (input: UndoDeclaredDebtPaymentInput): Promise<void> => {
  const { debtId, ownerId } = input;

  if (!debtId.trim()) {
    throw new Error("El ID de la deuda es obligatorio.");
  }
  if (!ownerId.trim()) {
    throw new Error("El ID del usuario es obligatorio.");
  }

  const db = getFirebaseDb();

  await runTransaction(db, async (transaction) => {
    // ==========================================
    // FASE DE LECTURA (Todos los gets al inicio)
    // ==========================================

    // 1. Obtener y validar la deuda
    const debtRef = doc(db, "household_debts", debtId);
    const debtSnap = await transaction.get(debtRef);
    if (!debtSnap.exists()) {
      throw new Error("La deuda seleccionada no existe.");
    }
    const debtData = debtSnap.data();

    assertCanUndoDeclaredDebtPayment({
      debt: {
        fromUserId: String(debtData.fromUserId ?? ""),
        status: String(debtData.status ?? "pending"),
        outgoingTransactionId: debtData.outgoingTransactionId ?? null,
        incomingTransactionId: debtData.incomingTransactionId ?? null,
      },
      ownerId,
    });

    const outgoingTransactionId = String(debtData.outgoingTransactionId);

    // 2. Obtener y validar la transacción de pago declarado
    const transactionRef = doc(db, "transactions", outgoingTransactionId);
    const transactionSnap = await transaction.get(transactionRef);
    if (!transactionSnap.exists()) {
      throw new Error("La transacción del pago declarado ya no existe.");
    }
    const transactionData = transactionSnap.data();
    if (transactionData.ownerId !== ownerId) {
      throw new Error("No tienes permiso sobre la transacción vinculada a esta deuda.");
    }

    const amount = Number(transactionData.amount ?? 0);
    const accountId = String(transactionData.accountId ?? "");
    const pocketId = transactionData.pocketId ? String(transactionData.pocketId) : null;
    if (!accountId) {
      throw new Error("La transacción vinculada no tiene cuenta válida.");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("La transacción vinculada tiene un monto inválido.");
    }

    // 3. Obtener y validar cuenta/bolsillo a restaurar
    const expenseSource = await loadExpenseSourceState({
      accountId,
      db,
      ownerId,
      pocketId,
      transaction,
    });

    // ==========================================
    // FASE DE ESCRITURA
    // ==========================================

    // 1. Revertir el saldo descontado al declarar el pago
    applyExpenseSourceDelta({
      amountDelta: amount,
      source: expenseSource,
      transaction,
    });

    // 2. Borrar la transacción personal de pago declarado
    transaction.delete(transactionRef);

    // 3. Regresar la deuda a "pending"
    transaction.update(debtRef, {
      status: "pending",
      outgoingTransactionId: null,
      paymentDeclaredAt: null,
      updatedAt: serverTimestamp(),
    });
  });
};
