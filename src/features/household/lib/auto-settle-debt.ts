/**
 * Política pura de auto-settle de deudas del Hogar (household-debt-auto-settle).
 * Paridad Android: HouseholdDebtAttribution.kt (shouldAutoSettleReception,
 * resolveCreditorCreditAttribution) + HouseholdDebtRepository.kt:500-509
 * (resolveCreditorCreditAttributionForEvent).
 *
 * Solo el acreedor (toUserId) puede auto-liquidar; solo con deuda
 * `payment_declared` y sin `incomingTransactionId` (idempotencia); la cuenta de
 * crédito automática es la del gasto origen del acreedor y solo si es
 * resoluble con seguridad (sin cuenta origen resoluble, no se acredita a ciegas).
 *
 * Contrato Android vigente para resolver la fuente del gasto origen (orden
 * exacto, ver `resolveDebtSourceTransactionId`):
 * 1. `household_events.sourceTransactionId`;
 * 2. si falta o está vacío, `household_event_shares.completedByTransactionId`
 *    de la share del pagador (`memberUserId === resolvePayerUserId(event)`,
 *    donde `resolvePayerUserId` prioriza `event.paidByUserId` y cae a
 *    `event.createdByUserId` si el primero está ausente/vacío — paridad
 *    exacta con `event.paidByUserId.takeIf { it.isNotBlank() } ?: event.createdByUserId`
 *    de Android).
 * Solo cuando ninguna de las dos fuentes resuelve una transacción propia del
 * acreedor con cuenta viva, el resultado es `needs_manual_account` — nunca se
 * inventa una cuenta. `Settled` SÍ es alcanzable por el camino real de Android
 * (share del pagador completada), no solo por `sourceTransactionId`.
 */

export type AutoSettleDebtSnapshot = {
  toUserId: string;
  status: string;
  incomingTransactionId?: string | null;
};

export const shouldAttemptAutoSettle = (params: {
  viewerUserId: string;
  debt: AutoSettleDebtSnapshot;
}): boolean => {
  const { viewerUserId, debt } = params;
  if (!viewerUserId.trim()) return false;
  if (viewerUserId !== debt.toUserId) return false;
  if (debt.status !== "payment_declared") return false;
  if (debt.incomingTransactionId) return false;
  return true;
};

export const selectDebtsEligibleForAutoSettle = <T extends AutoSettleDebtSnapshot>(
  debts: T[],
  viewerUserId: string
): T[] => debts.filter((debt) => shouldAttemptAutoSettle({ viewerUserId, debt }));

/**
 * Reconciliación del store de UI contra el snapshot vigente: cualquier
 * `debtId` que el store sigue rastreando (entry y/o descarte) pero que ya NO
 * está en el conjunto de deudas elegibles del snapshot actual (pasó a `paid`,
 * recibió `incomingTransactionId`, dejó de ser del acreedor, o el documento
 * desapareció) debe limpiarse. Una deuda que SIGUE siendo elegible (incluida
 * una que sigue en `needs_manual_account`) nunca aparece en este resultado, así
 * que su descarte ("Ahora no") no se toca mientras el estado no cambie.
 */
export const selectDebtIdsToReconcileAway = (
  trackedDebtIds: string[],
  eligibleDebtIds: ReadonlySet<string>
): string[] => trackedDebtIds.filter((debtId) => !eligibleDebtIds.has(debtId));

export type CreditorCreditAttribution = {
  accountId: string;
  categoryId: string | null;
};

/**
 * Resuelve la cuenta/categoría del gasto origen del acreedor para acreditar el
 * reembolso automático sin selector libre. `sourceOwnerId` debe ser el
 * `ownerId` real de la transacción origen ya resuelta por el contrato; si no
 * coincide con `creditorUserId` o no hay `accountId` resoluble, no hay
 * atribución segura (espejo de Android: null bloquea acreditar a ciegas).
 */
export const resolveCreditorCreditAttribution = (params: {
  sourceOwnerId: string | null;
  creditorUserId: string;
  accountId: string | null | undefined;
  categoryId: string | null | undefined;
}): CreditorCreditAttribution | null => {
  const { sourceOwnerId, creditorUserId, accountId, categoryId } = params;
  if (!sourceOwnerId || sourceOwnerId !== creditorUserId) return null;
  const acc = accountId?.trim();
  if (!acc) return null;
  const cat = categoryId?.trim();
  return { accountId: acc, categoryId: cat ? cat : null };
};

/**
 * Un resultado de auto-settle solo debe aplicarse si la sesión (uid, hogar
 * activo, generación de carga) sigue siendo la misma que cuando se disparó el
 * intento. Evita que un callback tardío liquide una deuda de una sesión
 * anterior (cambio de usuario, salida/cambio de hogar, o recarga de datos).
 */
export const isAutoSettleResultStillApplicable = (params: {
  attemptUid: string;
  attemptGeneration: number;
  attemptHouseholdId: string | null;
  currentUid: string | null;
  currentGeneration: number;
  currentHouseholdId: string | null;
}): boolean => {
  return (
    params.currentUid === params.attemptUid &&
    params.currentGeneration === params.attemptGeneration &&
    params.currentHouseholdId === params.attemptHouseholdId
  );
};

export type AutoSettleDebtUiEntry =
  | { status: "processing" }
  | { status: "needs_manual_account"; reason: string };

/**
 * El botón/estado de acreditación manual solo debe mostrarse cuando el intento
 * automático reportó explícitamente `needs_manual_account`.
 * Nunca
 * mientras se está verificando o para una deuda ya liquidada/saltada.
 */
export const shouldShowManualFallback = (entry: AutoSettleDebtUiEntry | undefined): boolean =>
  entry?.status === "needs_manual_account";

/**
 * Resuelve el `userId` del pagador de un evento con la misma prioridad exacta
 * que Android: `event.paidByUserId.takeIf { it.isNotBlank() } ?: event.createdByUserId`.
 * Eventos históricos pueden tener `paidByUserId` ausente/vacío; en ese caso el
 * pagador real es quien creó el evento. Si ambos faltan, no hay pagador
 * resoluble (null) y no debe intentarse leer ninguna share.
 */
export const resolvePayerUserId = (params: {
  paidByUserId?: string | null;
  createdByUserId?: string | null;
}): string | null => {
  const paidBy = params.paidByUserId?.trim() || null;
  if (paidBy) return paidBy;
  return params.createdByUserId?.trim() || null;
};

/**
 * Resuelve el ID de la transacción fuente del gasto origen para un evento del
 * Hogar, en el orden exacto del contrato Android vigente:
 * 1. `household_events.sourceTransactionId`;
 * 2. si falta o está vacío, `household_event_shares.completedByTransactionId`
 *    de la share del pagador (`memberUserId === resolvePayerUserId(event)`).
 * Pura: no lee Firestore, solo decide con datos ya obtenidos por el llamador.
 */
export const resolveDebtSourceTransactionId = (params: {
  eventSourceTransactionId?: string | null;
  payerShareCompletedByTransactionId?: string | null;
}): string | null => {
  const fromEvent = params.eventSourceTransactionId?.trim() || null;
  if (fromEvent) return fromEvent;
  return params.payerShareCompletedByTransactionId?.trim() || null;
};

export type AutoSettleDecisionInput = {
  viewerUserId: string;
  debt: AutoSettleDebtSnapshot & {
    outgoingTransactionId?: string | null;
    amount: number;
  };
  /**
   * Ya resuelto por `resolveDebtSourceTransactionId`: `event.sourceTransactionId`,
   * o si falta, `household_event_shares.completedByTransactionId` de la share
   * del pagador. Null si ninguna fuente es resoluble.
   */
  sourceTransactionId: string | null;
  /** Transacción fuente (`sourceTransactionId`), o null si no aplica/no se pudo leer. */
  sourceTransaction: { ownerId?: string | null; accountId?: string | null; categoryId?: string | null } | null;
};

export type AutoSettleDecision =
  | { kind: "skipped" }
  | { kind: "needs_manual_account"; reason: string }
  | { kind: "settled"; accountId: string; categoryId: string | null };

/**
 * Decisión pura y completa de auto-settle a partir de datos ya leídos (deuda,
 * evento, transacción origen). Sin efectos secundarios: no escribe nada, por
 * lo que un resultado `needs_manual_account` o `skipped` garantiza, por
 * construcción, que no se creó ningún incoming ni se tocó saldo/deuda.
 * Paridad Android: HouseholdDebtRepository.kt:404-432 + :500-509.
 */
export const decideAutoSettleOutcome = (input: AutoSettleDecisionInput): AutoSettleDecision => {
  const { viewerUserId, debt, sourceTransactionId, sourceTransaction } = input;

  if (!shouldAttemptAutoSettle({ viewerUserId, debt })) {
    return { kind: "skipped" };
  }

  if (!debt.outgoingTransactionId) {
    return {
      kind: "needs_manual_account",
      reason: "La deuda no tiene un pago declarado válido.",
    };
  }

  if (!Number.isFinite(debt.amount) || debt.amount <= 0) {
    return {
      kind: "needs_manual_account",
      reason: "El monto de la deuda no es válido.",
    };
  }

  const attribution = sourceTransactionId && sourceTransaction
    ? resolveCreditorCreditAttribution({
        sourceOwnerId: sourceTransaction.ownerId ?? null,
        creditorUserId: viewerUserId,
        accountId: sourceTransaction.accountId ?? null,
        categoryId: sourceTransaction.categoryId ?? null,
      })
    : null;

  if (!attribution) {
    return {
      kind: "needs_manual_account",
      reason: "No se encontró la cuenta del gasto origen para acreditar el reembolso.",
    };
  }

  return { kind: "settled", accountId: attribution.accountId, categoryId: attribution.categoryId };
};

/**
 * El sheet de acreditación manual (paridad Android: sheet Home tras
 * `NeedsManualAccount`) debe abrirse automáticamente una sola vez al recibir
 * `needs_manual_account`. Si el usuario lo descarta ("Ahora no"), no debe
 * reabrirse en bucle mientras la deuda siga en el mismo estado/snapshot; solo
 * un cambio real (la deuda deja de necesitar cuenta manual, o una sesión/deuda
 * nueva) puede volver a habilitarlo — eso se modela limpiando el descarte
 * cuando la entry deja de ser `needs_manual_account` (ver `auto-settle-debt-store`).
 */
export const shouldAutoOpenManualFallback = (params: {
  entry: AutoSettleDebtUiEntry | undefined;
  dismissed: boolean;
}): boolean => {
  if (params.entry?.status !== "needs_manual_account") return false;
  return !params.dismissed;
};

/**
 * El sheet manual abierto para un `debtId` concreto debe cerrarse
 * automáticamente si la entry de ESA MISMA deuda deja de ser
 * `needs_manual_account` (pasa a `processing` por un reintento del
 * observador, o desaparece por `settled`/`skipped`/reconciliación). Cubre el
 * orden tardío: el sheet queda abierto esperando cuenta manual, aparece
 * `completedByTransactionId` de una share completada mientras tanto, el
 * observador auto-acredita y limpia el store — el sheet no debe seguir
 * abierto mostrando un estado ya superado. Solo evalúa la entry de la deuda
 * actualmente seleccionada: un cambio en la entry de OTRA deuda nunca debe
 * cerrar este sheet.
 */
export const shouldAutoCloseManualFallback = (
  entry: AutoSettleDebtUiEntry | undefined
): boolean => entry?.status !== "needs_manual_account";

/**
 * Rutas donde el sheet de acreditación manual (`HouseholdDebtReceptionFallback`)
 * debe montarse. Paridad Android: el sheet `NeedsManualAccount` aparece en Home
 * Personal y Home Hogar, no en Movimientos/Cuentas/Categorías/Ajustes ni otras
 * rutas; permanece pendiente en estado mientras el usuario está fuera de Home
 * y se muestra de nuevo al volver (aquí: se remonta al volver a la vista, y el
 * estado vive en `auto-settle-debt-store`, no en el componente).
 */
export const HOUSEHOLD_DEBT_RECEPTION_FALLBACK_VIEWS = ["home", "household"] as const;

export const shouldMountHouseholdDebtReceptionFallback = (view: string): boolean =>
  (HOUSEHOLD_DEBT_RECEPTION_FALLBACK_VIEWS as readonly string[]).includes(view);

/**
 * household-debt-payment-gate: contrato Android confirmado — este gate
 * SOLO aplica a deudas `pending` de un evento `advancedByPayer` (el deudor
 * solo puede declarar/pagar cuando la persona que adelantó ya anotó su gasto
 * personal). `eachPaysOwn` e `invitation` quedan explícitamente FUERA del
 * gate: para esos modos (o un evento ausente/corrupto, o un estado de deuda
 * distinto de `pending`), `gateApplies` es `false` y este gate no decide ni
 * bloquea nada — el flujo sigue su validación normal preexistente (estado de
 * la deuda, propiedad, etc.), sin disfrazar ese caso como "esperando
 * anotación". La fuente de la anotación se resuelve con la MISMA prioridad
 * exacta ya usada por auto-settle (`resolveDebtSourceTransactionId`/
 * `resolvePayerUserId`, no una variante nueva): 1) `event.sourceTransactionId`;
 * 2) si falta, `completedByTransactionId` de la share del pagador
 * (`memberUserId === resolvePayerUserId(event)`). No crea campos, colecciones
 * ni escrituras nuevas — decide únicamente a partir de datos ya existentes.
 * No expone `accountId`/`pocketId`/`categoryId`/banco/saldo/descripción
 * privada: solo `gateApplies` + elegible/no-elegible + un `reasonCode` seguro.
 */
export type DebtPaymentEligibilityEvent = {
  id: string;
  settlementMode: string;
  sourceTransactionId?: string | null;
  paidByUserId?: string | null;
  createdByUserId?: string | null;
};

export type DebtPaymentEligibilityShare = {
  eventId: string;
  memberUserId: string;
  completedByTransactionId?: string | null;
};

export type DebtPaymentEligibilityReasonCode = "payer_has_not_recorded_expense";

export type DebtPaymentEligibility =
  | { gateApplies: false }
  | { gateApplies: true; eligible: true }
  | { gateApplies: true; eligible: false; reasonCode: DebtPaymentEligibilityReasonCode };

export const resolveDebtPaymentEligibility = (params: {
  debtStatus: string;
  event: DebtPaymentEligibilityEvent | null | undefined;
  eventShares: DebtPaymentEligibilityShare[];
}): DebtPaymentEligibility => {
  const { debtStatus, event, eventShares } = params;

  // El gate solo decide para deudas pending de eventos advancedByPayer. Para
  // cualquier otro estado (payment_declared/paid/cancelled/desconocido) o
  // evento ausente/corrupto/eachPaysOwn/invitation, no aplica — el llamador
  // debe seguir su validación normal sin tratar esto como un bloqueo.
  if (debtStatus !== "pending") {
    return { gateApplies: false };
  }

  if (!event || event.settlementMode !== "advancedByPayer") {
    return { gateApplies: false };
  }

  const resolvedPayerId = resolvePayerUserId({
    paidByUserId: event.paidByUserId ?? null,
    createdByUserId: event.createdByUserId ?? null,
  });

  const payerShare = resolvedPayerId
    ? eventShares.find((share) => share.eventId === event.id && share.memberUserId === resolvedPayerId)
    : undefined;

  const sourceTransactionId = resolveDebtSourceTransactionId({
    eventSourceTransactionId: event.sourceTransactionId ?? null,
    payerShareCompletedByTransactionId: payerShare?.completedByTransactionId ?? null,
  });

  if (!sourceTransactionId) {
    return { gateApplies: true, eligible: false, reasonCode: "payer_has_not_recorded_expense" };
  }

  return { gateApplies: true, eligible: true };
};

/** Copy genérico (sin identidad) del bloqueo por anotación pendiente del pagador. */
export const DEBT_PAYMENT_BLOCKED_COPY_GENERIC =
  "La persona que adelantó debe anotar el gasto desde su cuenta antes de que puedas pagar.";

/**
 * Copy del bloqueo por anotación pendiente. Solo debe usarse con un nombre ya
 * autorizado a mostrarse en esa superficie (identidad mínima segura, ej.
 * displayName/"Tú"/"Otro miembro" ya resuelto por la superficie) — esta
 * función no decide privacidad, solo interpola el texto si se le da un
 * nombre no vacío.
 */
export const buildDebtPaymentBlockedCopy = (payerName?: string | null): string => {
  const trimmed = payerName?.trim();
  return trimmed ? `${trimmed} debe anotar el gasto desde su cuenta antes de que puedas pagar.` : DEBT_PAYMENT_BLOCKED_COPY_GENERIC;
};

/**
 * Único caso en el que el gate realmente bloquea (aplica y no es elegible).
 * `gateApplies: false` (eachPaysOwn/invitation/evento ausente/estado no
 * pending) nunca cuenta como bloqueo de este gate.
 */
export const isDebtPaymentBlockedByMissingPayerAnnotation = (eligibility: DebtPaymentEligibility): boolean =>
  eligibility.gateApplies && !eligibility.eligible;
