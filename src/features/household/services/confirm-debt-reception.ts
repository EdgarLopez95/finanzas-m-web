import { collection, doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  applyExpenseSourceDelta,
  loadExpenseSourceState,
} from "@/lib/finance/expense-source";
import {
  resolveDebtSourceTransactionId,
  resolvePayerUserId,
} from "@/features/household/lib/auto-settle-debt";

const isPermissionDenied = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "permission-denied";

export type ConfirmDebtReceptionInput = {
  debtId: string;
  ownerId: string;
  accountId: string;
};

/**
 * Fallback manual excepcional: solo debe invocarse cuando el auto-settle
 * (`autoSettleDebtReception`) reportó `needs_manual_account` (sin cuenta
 * origen resoluble). Paridad Android: `confirmReception` en
 * `HouseholdDebtRepository.kt:361-395` NO acepta fecha ni descripción libres
 * (usa `LocalDate.now()` y una descripción fija "Reembolso recibido"); este
 * servicio hace lo mismo para no divergir del contrato de ese camino.
 * Ejecuta en una sola transacción:
 * 1. Lee y valida la deuda.
 * 2. Lee y valida la cuenta personal de destino (que pertenezca a ownerId).
 * 3. Crea la transacción de reembolso entrante personal privado.
 * 4. Suma el saldo a la cuenta elegida.
 * 5. Actualiza el estado de la deuda a "paid" con la referencia a la transacción personal entrante.
 */
export const confirmDebtReception = async (input: ConfirmDebtReceptionInput): Promise<void> => {
  const { debtId, ownerId, accountId } = input;

  if (!debtId.trim()) {
    throw new Error("El ID de la deuda es obligatorio.");
  }
  if (!ownerId.trim()) {
    throw new Error("El ID del usuario es obligatorio.");
  }
  if (!accountId.trim()) {
    throw new Error("La cuenta de destino es obligatoria.");
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

    // 2. Obtener y validar cuenta destino (pocketId se fuerza a null)
    const expenseSource = await loadExpenseSourceState({
      accountId,
      db,
      ownerId,
      pocketId: null,
      transaction,
    });

    // 3. Resolver la categoría atribuible del gasto origen con la misma
    // prioridad que el camino automático (auto-settle-debt-reception.ts):
    // event.sourceTransactionId, luego la share completada del pagador. Si
    // ninguna fuente resuelve, la categoría queda null — nunca se inventa.
    // Este fallback manual NO cambia la cuenta elegida por el usuario; solo
    // intenta recuperar la categoría para no divergir de Android en el
    // desglose por categoría.
    const eventId = typeof debtData.eventId === "string" ? debtData.eventId : "";
    let attributedCategoryId: string | null = null;

    if (eventId) {
      const eventRef = doc(db, "household_events", eventId);
      const eventSnap = await transaction.get(eventRef);
      const eventData = eventSnap.exists() ? eventSnap.data() : null;
      const eventSourceTransactionId = eventData
        ? ((eventData.sourceTransactionId as string | undefined)?.trim() || null)
        : null;

      let payerShareCompletedByTransactionId: string | null = null;
      if (!eventSourceTransactionId && eventData) {
        const resolvedPayerId = resolvePayerUserId({
          paidByUserId: typeof eventData.paidByUserId === "string" ? eventData.paidByUserId : null,
          createdByUserId: typeof eventData.createdByUserId === "string" ? eventData.createdByUserId : null,
        });
        if (resolvedPayerId) {
          const payerShareRef = doc(db, "household_event_shares", `${eventId}_${resolvedPayerId}`);
          const payerShareSnap = await transaction.get(payerShareRef);
          if (payerShareSnap.exists()) {
            const shareData = payerShareSnap.data();
            if (shareData.memberUserId === resolvedPayerId) {
              payerShareCompletedByTransactionId =
                typeof shareData.completedByTransactionId === "string"
                  ? shareData.completedByTransactionId
                  : null;
            }
          }
        }
      }

      const resolvedSourceTransactionId = resolveDebtSourceTransactionId({
        eventSourceTransactionId,
        payerShareCompletedByTransactionId,
      });

      if (resolvedSourceTransactionId) {
        try {
          const sourceTxRef = doc(db, "transactions", resolvedSourceTransactionId);
          const sourceTxSnap = await transaction.get(sourceTxRef);
          if (sourceTxSnap.exists()) {
            const txData = sourceTxSnap.data();
            if (txData.ownerId === ownerId) {
              attributedCategoryId =
                typeof txData.categoryId === "string" && txData.categoryId.trim()
                  ? txData.categoryId
                  : null;
            }
          }
        } catch (readError) {
          if (!isPermissionDenied(readError)) {
            throw readError;
          }
        }
      }
    }

    // ==========================================
    // FASE DE VALIDACIÓN Y CÁLCULO
    // ==========================================

    // Validar propiedad de la deuda (el acreedor debe ser el usuario actual)
    if (debtData.toUserId !== ownerId) {
      throw new Error("Solo el acreedor puede confirmar la recepción de esta deuda.");
    }

    // Validar estado de la deuda
    const debtStatus = String(debtData.status ?? "pending");
    if (debtStatus === "paid") {
      throw new Error("Esta deuda ya ha sido pagada y confirmada.");
    }
    if (debtStatus === "cancelled") {
      throw new Error("Esta deuda ha sido cancelada.");
    }
    if (debtStatus !== "payment_declared") {
      throw new Error("No se puede confirmar la recepción de una deuda cuyo pago no ha sido declarado.");
    }

    // Validar que exista outgoingTransactionId
    if (!debtData.outgoingTransactionId) {
      throw new Error("La deuda no cuenta con un pago declarado válido.");
    }

    // Validar monto
    const debtAmount = Number(debtData.amount ?? 0);
    if (debtAmount <= 0) {
      throw new Error("El monto de la deuda debe ser mayor a cero.");
    }

    // ==========================================
    // FASE DE ESCRITURA
    // ==========================================

    // 1. Crear documento de transacción personal entrante (reimbursement incoming)
    const transactionRef = doc(collection(db, "transactions"));
    transaction.set(transactionRef, {
      ownerId,
      type: "reimbursement",
      amount: debtAmount,
      accountId,
      pocketId: null,
      categoryId: attributedCategoryId, // Solo si se resolvió con la misma prioridad que el camino automático
      date: Timestamp.now(),
      description: "Reembolso recibido",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      source: "manual",
      status: "confirmed",
      isHousehold: false,
      householdId: debtData.householdId || null,
      relatedDebtId: debtId,
      relatedEventId: debtData.eventId || null,
      reimbursementDirection: "incoming",
    });

    // 2. Sumar saldo a la cuenta destino
    applyExpenseSourceDelta({
      amountDelta: debtAmount,
      source: expenseSource,
      transaction,
    });

    // 3. Actualizar la deuda a "paid"
    transaction.update(debtRef, {
      status: "paid",
      incomingTransactionId: transactionRef.id,
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
};
