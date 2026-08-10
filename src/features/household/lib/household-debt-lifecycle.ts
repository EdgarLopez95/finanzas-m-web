/**
 * Determina si una deuda del Hogar sigue "activa" (pendiente de resolver) en
 * las superficies de UI de Home Personal (Te deben / Le debés al hogar) y en
 * el resumen contextual del detalle de evento. Paridad Android: solo
 * `pending` y `payment_declared` son estados activos; `paid` deja de
 * pertenecer a esos buckets en cuanto el auto-settle (o el fallback manual)
 * liquida la deuda, y los estados cancelados nunca cuentan. Tolerante a
 * capitalización histórica (`Pending`, `PAID`), pero no reconoce estados
 * fuera del contrato conocido.
 */
export const isActiveHouseholdDebtStatus = (status: string): boolean => {
  const normalized = status.toLowerCase();
  return normalized === "pending" || normalized === "payment_declared";
};

/**
 * Filtra una lista de deudas a solo las activas (ver isActiveHouseholdDebtStatus).
 * Reutilizada por useHouseholdData() para construir debtsOwed/debtsReceivable
 * y por el resumen contextual del detalle de evento, para que ambas
 * superficies apliquen exactamente el mismo criterio.
 */
export const selectActiveHouseholdDebts = <T extends { status: string }>(debts: T[]): T[] =>
  debts.filter((debt) => isActiveHouseholdDebtStatus(debt.status));

export type HouseholdEventCancelBlock = {
  reason: "payment_declared" | "paid";
  debtId: string;
};

/**
 * Determina si un evento del Hogar puede cancelarse, replicando
 * HouseholdEventCapabilities.kt:64-82 (resolveHouseholdEventCancelState) de Android:
 * solo el estado de las deudas bloquea la cancelación (payment_declared tiene prioridad
 * sobre paid). Las shares completadas NUNCA bloquean ni se evalúan aquí a propósito:
 * Android las preserva intactas durante la cancelación del evento.
 */
export const resolveHouseholdEventCancelBlock = (
  debts: { id: string; status: string }[]
): HouseholdEventCancelBlock | null => {
  const declared = debts.find((d) => d.status === "payment_declared");
  if (declared) {
    return { reason: "payment_declared", debtId: declared.id };
  }
  const paid = debts.find((d) => d.status === "paid");
  if (paid) {
    return { reason: "paid", debtId: paid.id };
  }
  return null;
};

/**
 * Determina a qué status debe revertir un household_event_share "completed" cuando se
 * elimina la transacción personal que lo completó, según el status del evento padre.
 * Replica HouseholdEventRepository.kt:707-735 (revertShareCompletionByTransactionId) y
 * la decisión 1 documentada en firestore.rules:505-523: evento activo -> pending_completion;
 * evento ya cancelado -> cancelled (nunca vuelve a pending_completion bajo un evento cerrado,
 * la Rule lo rechazaría).
 */
export const resolveShareRevertStatusOnTransactionDelete = (
  parentEventStatus: string
): "pending_completion" | "cancelled" => {
  return parentEventStatus === "cancelled" ? "cancelled" : "pending_completion";
};

export type LinkedShareForRevert = {
  id: string;
  eventId?: string | null;
};

export type ShareRevertUpdate = {
  id: string;
  status: "pending_completion" | "cancelled";
};

/**
 * Calcula, para un lote de household_event_shares completadas cuya transacción vinculada se
 * está borrando, el status objetivo de cada una según el status pre-transacción de su evento
 * padre (ver resolveShareRevertStatusOnTransactionDelete). Compartido por
 * delete-personal-transaction.ts y delete-personal-entity-cascade.ts (H1.5/H1.6) para que ambos
 * caminos de borrado apliquen exactamente la misma regla. Un share sin eventId resuelto (dato
 * huérfano) se trata de forma conservadora como si el evento estuviera activo.
 */
export const buildLinkedEventShareRevertUpdates = (
  shares: LinkedShareForRevert[],
  eventStatusById: Map<string, string>
): ShareRevertUpdate[] =>
  shares.map((share) => {
    const parentStatus = (share.eventId && eventStatusById.get(share.eventId)) || "active";
    return { id: share.id, status: resolveShareRevertStatusOnTransactionDelete(parentStatus) };
  });

export type UndoDeclaredDebtPaymentGuardInput = {
  debt: {
    fromUserId: string;
    status: string;
    outgoingTransactionId: string | null | undefined;
    incomingTransactionId: string | null | undefined;
  };
  ownerId: string;
};

/**
 * Valida las precondiciones para deshacer la declaración de pago de una deuda,
 * replicando HouseholdDebtRepository.kt:280-320 (undoDeclaredPayment) y
 * firestore.rules:574-584 (payment_declared -> pending, solo deudor, requiere que el
 * acreedor todavía no haya confirmado la recepción).
 */
export const assertCanUndoDeclaredDebtPayment = ({ debt, ownerId }: UndoDeclaredDebtPaymentGuardInput): void => {
  if (debt.fromUserId !== ownerId) {
    throw new Error("Solo el deudor puede deshacer la declaración de esta deuda.");
  }
  if (debt.status !== "payment_declared") {
    throw new Error("Solo se puede deshacer una deuda con pago declarado.");
  }
  if (debt.incomingTransactionId) {
    throw new Error("No se puede deshacer: el acreedor ya confirmó la recepción del pago.");
  }
  if (!debt.outgoingTransactionId) {
    throw new Error("La deuda no tiene un pago declarado válido.");
  }
};
