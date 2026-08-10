import { collection, doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  applyExpenseSourceDelta,
  loadExpenseSourceState,
} from "@/lib/finance/expense-source";
import {
  decideAutoSettleOutcome,
  resolveDebtSourceTransactionId,
  resolvePayerUserId,
} from "@/features/household/lib/auto-settle-debt";

export type AutoSettleDebtReceptionInput = {
  debtId: string;
  creditorUserId: string;
};

export type AutoSettleDebtReceptionResult =
  | { kind: "settled" }
  | { kind: "skipped" }
  | { kind: "needs_manual_account"; reason: string }
  | { kind: "failed"; reason: string };

const isPermissionDenied = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "permission-denied";

/**
 * Intenta acreditar el reembolso de una deuda del Hogar en el dispositivo del
 * acreedor, sin CTA manual previo (household-debt-auto-settle). Paridad
 * Android: HouseholdDebtRepository.kt:404-432 (autoSettleReceptionIfNeeded)
 * + :439-483 (settleIncomingAndMarkPaid) + :500-509
 * (resolveCreditorCreditAttributionForEvent).
 *
 * Contrato Android vigente para resolver la fuente del gasto origen (orden
 * exacto, `resolveDebtSourceTransactionId`):
 * 1. `household_events.sourceTransactionId`;
 * 2. si falta o está vacío, `household_event_shares.completedByTransactionId`
 *    de la share del pagador (`memberUserId === resolvePayerUserId(event)`),
 *    leída puntualmente por su ID determinista `${eventId}_${resolvedPayerId}`
 *    — sin consulta amplia ni escritura extra. `resolvePayerUserId` prioriza
 *    `event.paidByUserId` y cae a `event.createdByUserId` si el primero está
 *    ausente/vacío (paridad exacta con Android: eventos históricos pueden
 *    tener `paidByUserId` vacío y aun así tener un pagador real).
 *
 * Solo se auto-acredita si la transacción fuente es propia del acreedor y su
 * cuenta personal sigue viva; sin fuente válida, transacción ajena/inexistente
 * o cuenta borrada, el resultado es `needs_manual_account` — nunca se inventa
 * una cuenta. Este servicio no acepta una cuenta elegida por UI en este
 * camino: la única cuenta válida es la resuelta por el contrato.
 *
 * Ejecuta una sola `runTransaction` con fase de lecturas completa (deuda,
 * evento vinculado, share del pagador si el evento no resuelve fuente,
 * movimiento fuente, cuenta destino) antes de cualquier escritura.
 */
export const autoSettleDebtReception = async (
  input: AutoSettleDebtReceptionInput
): Promise<AutoSettleDebtReceptionResult> => {
  const { debtId, creditorUserId } = input;

  if (!debtId.trim() || !creditorUserId.trim()) {
    return { kind: "skipped" };
  }

  const db = getFirebaseDb();

  try {
    return await runTransaction(db, async (transaction) => {
      // ==========================================
      // FASE DE LECTURA (todos los gets antes de cualquier write)
      // ==========================================

      const debtRef = doc(db, "household_debts", debtId);
      const debtSnap = await transaction.get(debtRef);
      if (!debtSnap.exists()) {
        return { kind: "skipped" as const };
      }
      const debtData = debtSnap.data();

      const debtSnapshot = {
        toUserId: typeof debtData.toUserId === "string" ? debtData.toUserId : "",
        status: typeof debtData.status === "string" ? debtData.status : "pending",
        incomingTransactionId:
          typeof debtData.incomingTransactionId === "string" ? debtData.incomingTransactionId : null,
        outgoingTransactionId:
          typeof debtData.outgoingTransactionId === "string" ? debtData.outgoingTransactionId : null,
        amount: Number(debtData.amount ?? 0),
      };

      const eventId = typeof debtData.eventId === "string" ? debtData.eventId : "";

      let eventSourceTransactionId: string | null = null;
      let payerShareCompletedByTransactionId: string | null = null;
      let sourceTransaction: { ownerId?: string | null; accountId?: string | null; categoryId?: string | null } | null = null;

      if (eventId) {
        const eventRef = doc(db, "household_events", eventId);
        const eventSnap = await transaction.get(eventRef);
        const eventData = eventSnap.exists() ? eventSnap.data() : null;
        eventSourceTransactionId = eventData
          ? ((eventData.sourceTransactionId as string | undefined)?.trim() || null)
          : null;

        // Contrato Android vigente: si el evento no resuelve fuente, leer
        // puntualmente la share determinista del pagador
        // (`${eventId}_${resolvedPayerId}`). El pagador se resuelve con la
        // misma prioridad exacta que Android (paidByUserId, o si está
        // ausente/vacío, createdByUserId) — eventos históricos pueden tener
        // paidByUserId vacío y aun así tener un pagador real (el creador).
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
      }

      const sourceTransactionId = resolveDebtSourceTransactionId({
        eventSourceTransactionId,
        payerShareCompletedByTransactionId,
      });

      if (sourceTransactionId) {
        try {
          const sourceTxRef = doc(db, "transactions", sourceTransactionId);
          const sourceTxSnap = await transaction.get(sourceTxRef);
          if (sourceTxSnap.exists()) {
            const txData = sourceTxSnap.data();
            sourceTransaction = {
              ownerId: typeof txData.ownerId === "string" ? txData.ownerId : null,
              accountId: typeof txData.accountId === "string" ? txData.accountId : null,
              categoryId: typeof txData.categoryId === "string" ? txData.categoryId : null,
            };
          }
        } catch (readError) {
          // Rules owner-only: si el gasto origen no pertenece al acreedor, la
          // lectura se rechaza. Tratar como atribución no resoluble, no como
          // fallo inesperado.
          if (!isPermissionDenied(readError)) {
            throw readError;
          }
        }
      }

      // ==========================================
      // DECISIÓN PURA (sin efectos secundarios)
      // ==========================================

      const decision = decideAutoSettleOutcome({
        viewerUserId: creditorUserId,
        debt: debtSnapshot,
        sourceTransactionId,
        sourceTransaction,
      });

      if (decision.kind !== "settled") {
        return decision;
      }

      // ==========================================
      // FASE DE ESCRITURA (solo si la decisión fue `settled`)
      // ==========================================

      // Cuenta destino: siempre la resuelta por la decisión pura (sin bolsillo receptor, E4B).
      // Si la cuenta ya no existe (borrada) o no pertenece al acreedor,
      // loadExpenseSourceState lanza; se trata como needs_manual_account, sin
      // inventar cuenta ni degradar a fallo inesperado.
      let expenseSource: Awaited<ReturnType<typeof loadExpenseSourceState>>;
      try {
        expenseSource = await loadExpenseSourceState({
          accountId: decision.accountId,
          db,
          ownerId: creditorUserId,
          pocketId: null,
          transaction,
        });
      } catch {
        return {
          kind: "needs_manual_account" as const,
          reason: "La cuenta del gasto origen ya no existe o no está disponible.",
        };
      }

      const transactionRef = doc(collection(db, "transactions"));
      transaction.set(transactionRef, {
        ownerId: creditorUserId,
        type: "reimbursement",
        amount: debtSnapshot.amount,
        accountId: decision.accountId,
        pocketId: null,
        categoryId: decision.categoryId,
        date: Timestamp.now(),
        description: "Reembolso recibido",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        source: "auto",
        status: "confirmed",
        isHousehold: false,
        householdId: debtData.householdId || null,
        relatedDebtId: debtId,
        relatedEventId: eventId || null,
        reimbursementDirection: "incoming",
      });

      applyExpenseSourceDelta({
        amountDelta: debtSnapshot.amount,
        source: expenseSource,
        transaction,
      });

      transaction.update(debtRef, {
        status: "paid",
        incomingTransactionId: transactionRef.id,
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return { kind: "settled" as const };
    });
  } catch (error) {
    return {
      kind: "failed",
      reason: error instanceof Error ? error.message : "Error inesperado al intentar acreditar el reembolso.",
    };
  }
};
