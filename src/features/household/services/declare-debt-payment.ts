import { collection, doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  applyExpenseSourceDelta,
  assertExpenseSourceHasEnoughBalance,
  loadExpenseSourceState,
} from "@/lib/finance/expense-source";
import { assertSufficientOwnFunds } from "@/lib/finance/own-funds-gate";
import { projectThirdPartyHeldAtLocation } from "@/lib/finance/third-party-location";
import {
  resolveDebtPaymentEligibility,
  resolvePayerUserId,
  DEBT_PAYMENT_BLOCKED_COPY_GENERIC,
  type DebtPaymentEligibilityEvent,
  type DebtPaymentEligibilityShare,
} from "@/features/household/lib/auto-settle-debt";
import { readThirdPartyLocationSnapshot } from "@/features/transactions/services/read-third-party-location-snapshot";

export type DeclareDebtPaymentInput = {
  debtId: string;
  ownerId: string;
  accountId: string;
  pocketId: string | null;
  date: Date;
  description?: string;
};

/**
 * Seam de inyección interno solo para pruebas (household-debt-payment-gate):
 * permite ejercer `declareDebtPayment` real con una transacción Firestore
 * simulada, sin tocar Firebase real, sin cambiar la firma pública ni afectar
 * a ningún llamador productivo (todos los deps son opcionales y por defecto
 * usan las funciones reales de `firebase/firestore`). Mismo patrón ya
 * establecido en `cancel-pending-share.ts` (`CancelPendingShareDeps`).
 */
export type DeclareDebtPaymentTransactionLike = {
  get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  set: (ref: unknown, data: Record<string, unknown>) => void;
  update: (ref: unknown, data: Record<string, unknown>) => void;
};

export type DeclareDebtPaymentDeps = {
  getFirebaseDbFn?: () => unknown;
  runTransactionFn?: (
    db: unknown,
    updateFunction: (transaction: DeclareDebtPaymentTransactionLike) => Promise<void>,
  ) => Promise<void>;
  docFn?: (...args: unknown[]) => unknown;
  collectionFn?: (...args: unknown[]) => unknown;
  readThirdPartyLocationSnapshotFn?: typeof readThirdPartyLocationSnapshot;
  loadExpenseSourceStateFn?: typeof loadExpenseSourceState;
  applyExpenseSourceDeltaFn?: typeof applyExpenseSourceDelta;
};

/**
 * Declara el pago de una deuda del Hogar por parte del deudor (usuario actual).
 * Ejecuta en una sola transacción:
 * 1. Lee y valida la deuda (propiedad, estado).
 * 2. household-debt-payment-gate: lee el evento/share necesarios y valida
 *    elegibilidad ANTES de tocar la cuenta origen (evita una lectura de
 *    cuenta innecesaria cuando el pago ya está bloqueado por el gate).
 * 3. Lee y valida la cuenta/bolsillo origen.
 * 4. Crea la transacción de reembolso saliente personal privado.
 * 5. Descuenta el saldo de la cuenta/bolsillo.
 * 6. Actualiza el estado de la deuda a "payment_declared" con la referencia a la transacción personal.
 */
export const declareDebtPayment = async (
  input: DeclareDebtPaymentInput,
  deps: DeclareDebtPaymentDeps = {},
): Promise<void> => {
  const { debtId, ownerId, accountId, pocketId, date, description } = input;

  // Validaciones locales básicas
  if (!debtId.trim()) {
    throw new Error("El ID de la deuda es obligatorio.");
  }
  if (!ownerId.trim()) {
    throw new Error("El ID del usuario es obligatorio.");
  }
  if (!accountId.trim()) {
    throw new Error("La cuenta origen es obligatoria.");
  }

  const getDbImpl = deps.getFirebaseDbFn ?? getFirebaseDb;
  const docImpl = deps.docFn ?? ((...args: unknown[]) => (doc as unknown as (...a: unknown[]) => unknown)(...args));
  const collectionImpl = deps.collectionFn ?? ((...args: unknown[]) => (collection as unknown as (...a: unknown[]) => unknown)(...args));
  const runTransactionImpl =
    deps.runTransactionFn ??
    ((database: unknown, updateFunction: (transaction: DeclareDebtPaymentTransactionLike) => Promise<void>) =>
      runTransaction(
        database as ReturnType<typeof getFirebaseDb>,
        updateFunction as unknown as Parameters<typeof runTransaction>[1],
      ) as unknown as Promise<void>);
  const readSnapshot = deps.readThirdPartyLocationSnapshotFn ?? readThirdPartyLocationSnapshot;
  const loadSource = deps.loadExpenseSourceStateFn ?? loadExpenseSourceState;
  const applyDelta = deps.applyExpenseSourceDeltaFn ?? applyExpenseSourceDelta;

  const db = getDbImpl();

  await runTransactionImpl(db, async (transaction) => {
    // ==========================================
    // FASE DE LECTURA (Todos los gets al inicio)
    // ==========================================

    // 1. Obtener y validar la deuda
    const debtRef = docImpl(db, "household_debts", debtId);
    const debtSnap = await transaction.get(debtRef);
    if (!debtSnap.exists()) {
      throw new Error("La deuda seleccionada no existe.");
    }
    const debtData = debtSnap.data();

    // Validar propiedad de la deuda (el deudor debe ser el usuario actual)
    if (debtData.fromUserId !== ownerId) {
      throw new Error("Solo el deudor puede declarar el pago de esta deuda.");
    }

    // Validar estado de la deuda (debe estar pending)
    const debtStatus = String(debtData.status ?? "pending");
    if (debtStatus === "payment_declared") {
      throw new Error("Esta deuda ya tiene un pago declarado.");
    }
    if (debtStatus === "paid") {
      throw new Error("Esta deuda ya ha sido pagada y confirmada.");
    }
    if (debtStatus === "cancelled") {
      throw new Error("Esta deudor ha sido cancelada.");
    }

    // 2. household-debt-payment-gate: leer el evento (y, si hace falta, la
    // share determinista del pagador) para volver a validar elegibilidad
    // dentro de la MISMA transacción — no basta con la validación de UI, un
    // cliente distinto podría intentar declarar el pago sin haber refrescado
    // el estado de la anotación. Misma prioridad exacta que auto-settle
    // (resolveDebtSourceTransactionId/resolvePayerUserId), sin reimplementar.
    // El gate solo aplica (`gateApplies`) a deudas `pending` de eventos
    // `advancedByPayer`; para `eachPaysOwn`/`invitation` (o evento
    // ausente/corrupto), `gateApplies` es `false` y este bloque NO rechaza el
    // pago por esta razón — el flujo sigue su validación normal.
    const eventId = typeof debtData.eventId === "string" ? debtData.eventId : "";
    let eventForGate: DebtPaymentEligibilityEvent | null = null;
    let payerShareForGate: DebtPaymentEligibilityShare | null = null;

    if (eventId) {
      const eventRef = docImpl(db, "household_events", eventId);
      const eventSnap = await transaction.get(eventRef);
      if (eventSnap.exists()) {
        const eventData = eventSnap.data();
        eventForGate = {
          id: eventId,
          settlementMode: typeof eventData.settlementMode === "string" ? eventData.settlementMode : "",
          sourceTransactionId: (eventData.sourceTransactionId as string | undefined)?.trim() || null,
          paidByUserId: typeof eventData.paidByUserId === "string" ? eventData.paidByUserId : null,
          createdByUserId: typeof eventData.createdByUserId === "string" ? eventData.createdByUserId : null,
        };

        if (eventForGate.settlementMode === "advancedByPayer" && !eventForGate.sourceTransactionId) {
          const resolvedPayerId = resolvePayerUserId({
            paidByUserId: eventForGate.paidByUserId,
            createdByUserId: eventForGate.createdByUserId,
          });
          if (resolvedPayerId) {
            const payerShareRef = docImpl(db, "household_event_shares", `${eventId}_${resolvedPayerId}`);
            const payerShareSnap = await transaction.get(payerShareRef);
            if (payerShareSnap.exists()) {
              const shareData = payerShareSnap.data();
              if (shareData.memberUserId === resolvedPayerId) {
                payerShareForGate = {
                  eventId,
                  memberUserId: resolvedPayerId,
                  completedByTransactionId:
                    typeof shareData.completedByTransactionId === "string"
                      ? shareData.completedByTransactionId
                      : null,
                };
              }
            }
          }
        }
      }
    }

    // household-debt-payment-gate: revalidar elegibilidad dentro de la misma
    // transacción, con los datos ya leídos arriba. Solo rechaza cuando el
    // gate REALMENTE aplica (advancedByPayer, pending) y no es elegible; para
    // cualquier otro modo/estado, `gateApplies` es `false` y el flujo
    // continúa con sus validaciones preexistentes (no se disfraza como
    // "esperando anotación"). Sin fuente de anotación resoluble, se aborta
    // sin crear movimiento, sin tocar saldo y sin cambiar la deuda — el
    // mensaje no expone cuenta/categoría.
    const paymentEligibility = resolveDebtPaymentEligibility({
      debtStatus,
      event: eventForGate,
      eventShares: payerShareForGate ? [payerShareForGate] : [],
    });
    if (paymentEligibility.gateApplies && !paymentEligibility.eligible) {
      throw new Error(DEBT_PAYMENT_BLOCKED_COPY_GENERIC);
    }

    // Proyección de no propio solo si el gate permitió continuar (evita I/O
    // y dependencias Firebase en el camino bloqueado de pruebas/UI).
    const ownershipSnapshot = await readSnapshot(ownerId);

    // 3. Obtener y validar cuenta/bolsillo origen (solo si el gate no bloqueó)
    // Nota: `loadExpenseSourceState`/`applyExpenseSourceDelta` usan Firestore
    // real internamente (no forman parte de este seam de pruebas) — solo se
    // alcanzan en el camino real/elegible, nunca en el escenario bloqueado
    // simulado por los tests de este archivo.
    const expenseSource = await loadSource({
      accountId,
      db: db as Parameters<typeof loadExpenseSourceState>[0]["db"],
      ownerId,
      pocketId: pocketId || null,
      transaction: transaction as unknown as Parameters<typeof loadExpenseSourceState>[0]["transaction"],
    });

    // Validar monto de la deuda
    const debtAmount = Number(debtData.amount ?? 0);
    if (debtAmount <= 0) {
      throw new Error("El monto de la deuda debe ser mayor a cero.");
    }
    assertExpenseSourceHasEnoughBalance(expenseSource, debtAmount);

    const heldAtLocation = projectThirdPartyHeldAtLocation(
      { accountId, pocketId: pocketId || null },
      ownershipSnapshot.entries,
      ownershipSnapshot.moves,
      ownershipSnapshot.consumptions,
    );
    assertSufficientOwnFunds({
      physicalBalance: expenseSource.availableBalance,
      thirdPartyHeld: heldAtLocation,
      amount: debtAmount,
    });

    // ==========================================
    // FASE DE ESCRITURA
    // ==========================================

    // 1. Crear documento de transacción personal (reimbursement saliente)
    const transactionRef = docImpl(collectionImpl(db, "transactions"));
    transaction.set(transactionRef, {
      ownerId,
      type: "reimbursement",
      amount: debtAmount,
      accountId,
      pocketId: pocketId || null,
      categoryId: null, // Los reembolsos no usan categoría
      date: Timestamp.fromDate(date),
      description: description?.trim() || "Pago de deuda del Hogar",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      source: "manual",
      status: "confirmed",
      isHousehold: false,
      householdId: debtData.householdId || null,
      relatedDebtId: debtId,
      relatedEventId: debtData.eventId || null,
      reimbursementDirection: "outgoing",
    });

    // 2. Descontar saldo de la cuenta/bolsillo
    applyDelta({
      amountDelta: -debtAmount,
      source: expenseSource,
      transaction: transaction as unknown as Parameters<typeof applyExpenseSourceDelta>[0]["transaction"],
    });

    // 3. Actualizar estado de la deuda a "payment_declared"
    transaction.update(debtRef, {
      status: "payment_declared",
      outgoingTransactionId: (transactionRef as { id: string }).id,
      paymentDeclaredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
};
