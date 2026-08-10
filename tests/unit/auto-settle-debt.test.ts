import assert from "node:assert/strict";

import {
  shouldAttemptAutoSettle,
  selectDebtsEligibleForAutoSettle,
  selectDebtIdsToReconcileAway,
  resolveCreditorCreditAttribution,
  isAutoSettleResultStillApplicable,
  shouldShowManualFallback,
  decideAutoSettleOutcome,
  shouldAutoOpenManualFallback,
  shouldAutoCloseManualFallback,
  shouldMountHouseholdDebtReceptionFallback,
  resolveDebtSourceTransactionId,
  resolvePayerUserId,
} from "../../src/features/household/lib/auto-settle-debt";

console.log("Running unit tests for auto-settle-debt.test.ts...");

function runAutoSettleDebtTests() {
  // ==========================================
  // shouldAttemptAutoSettle
  // Android: HouseholdDebtAttribution.kt:31-41 (shouldAutoSettleReception).
  // Solo el acreedor (toUserId) puede auto-liquidar; solo payment_declared sin
  // incomingTransactionId.
  // ==========================================

  const baseDebt = {
    toUserId: "user-creditor",
    status: "payment_declared",
    incomingTransactionId: null as string | null,
  };

  // Test 1: acreedor elegible + payment_declared sin incoming -> true
  {
    const result = shouldAttemptAutoSettle({ viewerUserId: "user-creditor", debt: baseDebt });
    assert.strictEqual(result, true, "Acreedor con deuda payment_declared sin incoming debe ser elegible");
  }

  // Test 2: deudor / usuario ajeno -> false (skipped, sin escritura)
  {
    const result = shouldAttemptAutoSettle({ viewerUserId: "user-debtor", debt: baseDebt });
    assert.strictEqual(result, false, "El deudor no puede auto-liquidar su propia deuda");
  }
  {
    const result = shouldAttemptAutoSettle({ viewerUserId: "user-unrelated", debt: baseDebt });
    assert.strictEqual(result, false, "Un usuario ajeno a la deuda nunca es elegible");
  }

  // Test 3: deuda ya paid -> false
  {
    const result = shouldAttemptAutoSettle({
      viewerUserId: "user-creditor",
      debt: { ...baseDebt, status: "paid" },
    });
    assert.strictEqual(result, false, "Una deuda ya paid no debe reintentar auto-settle");
  }

  // Test 4: deuda pending (aún no declarada) -> false
  {
    const result = shouldAttemptAutoSettle({
      viewerUserId: "user-creditor",
      debt: { ...baseDebt, status: "pending" },
    });
    assert.strictEqual(result, false, "Una deuda pending todavía no tiene pago declarado");
  }

  // Test 5: ya tiene incomingTransactionId (idempotencia: segundo intento no duplica) -> false
  {
    const result = shouldAttemptAutoSettle({
      viewerUserId: "user-creditor",
      debt: { ...baseDebt, incomingTransactionId: "tx-incoming-1" },
    });
    assert.strictEqual(result, false, "Con incomingTransactionId ya asignado no debe reintentar");
  }

  // Test 6: viewerUserId vacío -> false (defensivo)
  {
    const result = shouldAttemptAutoSettle({ viewerUserId: "", debt: baseDebt });
    assert.strictEqual(result, false, "viewerUserId vacío nunca es elegible");
  }

  // ==========================================
  // selectDebtsEligibleForAutoSettle
  // ==========================================

  // Test 7: filtra correctamente una lista mixta
  {
    const debts = [
      { id: "d1", toUserId: "user-creditor", status: "payment_declared", incomingTransactionId: null },
      { id: "d2", toUserId: "user-creditor", status: "paid", incomingTransactionId: "tx-1" },
      { id: "d3", toUserId: "user-other", status: "payment_declared", incomingTransactionId: null },
      { id: "d4", toUserId: "user-creditor", status: "payment_declared", incomingTransactionId: null },
    ];
    const eligible = selectDebtsEligibleForAutoSettle(debts, "user-creditor");
    assert.deepStrictEqual(eligible.map((d) => d.id), ["d1", "d4"]);
  }

  // ==========================================
  // resolveCreditorCreditAttribution
  // Android: HouseholdDebtAttribution.kt:15-24 (resolveCreditorCreditAttribution) +
  // HouseholdDebtRepository.kt:500-509 (resolveCreditorCreditAttributionForEvent):
  // sin sourceOwnerId == creditorUserId o sin accountId resoluble, no hay atribución
  // (bloquea acreditar a ciegas).
  // ==========================================

  // Test 8: atribución válida -> accountId + categoryId
  {
    const attribution = resolveCreditorCreditAttribution({
      sourceOwnerId: "user-creditor",
      creditorUserId: "user-creditor",
      accountId: "acc-1",
      categoryId: "cat-1",
    });
    assert.deepStrictEqual(attribution, { accountId: "acc-1", categoryId: "cat-1" });
  }

  // Test 9: categoryId ausente -> atribución válida con categoryId null (Android: categoryId nullable)
  {
    const attribution = resolveCreditorCreditAttribution({
      sourceOwnerId: "user-creditor",
      creditorUserId: "user-creditor",
      accountId: "acc-1",
      categoryId: null,
    });
    assert.deepStrictEqual(attribution, { accountId: "acc-1", categoryId: null });
  }

  // Test 10: sin sourceOwnerId (evento sin sourceTransactionId resoluble) -> null (needs_manual_account)
  {
    const attribution = resolveCreditorCreditAttribution({
      sourceOwnerId: null,
      creditorUserId: "user-creditor",
      accountId: "acc-1",
      categoryId: "cat-1",
    });
    assert.strictEqual(attribution, null, "Sin sourceOwnerId no debe haber atribución");
  }

  // Test 11: sourceOwnerId distinto al acreedor -> null (el gasto origen no es del acreedor)
  {
    const attribution = resolveCreditorCreditAttribution({
      sourceOwnerId: "user-other",
      creditorUserId: "user-creditor",
      accountId: "acc-1",
      categoryId: "cat-1",
    });
    assert.strictEqual(attribution, null, "El gasto origen debe pertenecer al acreedor");
  }

  // Test 12: accountId vacío/ausente -> null (no acreditar a ciegas)
  {
    const attribution = resolveCreditorCreditAttribution({
      sourceOwnerId: "user-creditor",
      creditorUserId: "user-creditor",
      accountId: null,
      categoryId: "cat-1",
    });
    assert.strictEqual(attribution, null, "Sin accountId resoluble no debe haber atribución");
  }
  {
    const attribution = resolveCreditorCreditAttribution({
      sourceOwnerId: "user-creditor",
      creditorUserId: "user-creditor",
      accountId: "   ",
      categoryId: "cat-1",
    });
    assert.strictEqual(attribution, null, "accountId en blanco debe tratarse como ausente");
  }

  // ==========================================
  // isAutoSettleResultStillApplicable
  // Cambio de usuario/hogar o callback tardío (generación vieja) no puede
  // liquidar una deuda de una sesión anterior.
  // ==========================================

  // Test 13: misma sesión (uid/generation/household) -> aplicable
  {
    const applicable = isAutoSettleResultStillApplicable({
      attemptUid: "user-creditor",
      attemptGeneration: 3,
      attemptHouseholdId: "hh-1",
      currentUid: "user-creditor",
      currentGeneration: 3,
      currentHouseholdId: "hh-1",
    });
    assert.strictEqual(applicable, true);
  }

  // Test 14: usuario cambió (logout/login de otra cuenta) -> no aplicable
  {
    const applicable = isAutoSettleResultStillApplicable({
      attemptUid: "user-creditor",
      attemptGeneration: 3,
      attemptHouseholdId: "hh-1",
      currentUid: "user-other",
      currentGeneration: 3,
      currentHouseholdId: "hh-1",
    });
    assert.strictEqual(applicable, false, "Un cambio de usuario invalida el resultado tardío");
  }

  // Test 15: generación vieja (callback tardío tras load() nuevo) -> no aplicable
  {
    const applicable = isAutoSettleResultStillApplicable({
      attemptUid: "user-creditor",
      attemptGeneration: 2,
      attemptHouseholdId: "hh-1",
      currentUid: "user-creditor",
      currentGeneration: 3,
      currentHouseholdId: "hh-1",
    });
    assert.strictEqual(applicable, false, "Un callback de una generación vieja no debe aplicarse");
  }

  // Test 16: hogar activo cambió (salió/entró a otro) -> no aplicable
  {
    const applicable = isAutoSettleResultStillApplicable({
      attemptUid: "user-creditor",
      attemptGeneration: 3,
      attemptHouseholdId: "hh-1",
      currentUid: "user-creditor",
      currentGeneration: 3,
      currentHouseholdId: "hh-2",
    });
    assert.strictEqual(applicable, false, "Un cambio de hogar activo invalida el resultado tardío");
  }

  // ==========================================
  // shouldShowManualFallback
  // El fallback manual NUNCA se muestra en el camino feliz (processing/settled/skipped);
  // solo cuando needs_manual_account.
  // ==========================================

  // Test 17: sin entry -> no mostrar
  {
    assert.strictEqual(shouldShowManualFallback(undefined), false);
  }

  // Test 18: processing -> no mostrar
  {
    assert.strictEqual(shouldShowManualFallback({ status: "processing" }), false);
  }

  // Test 19: needs_manual_account -> mostrar
  {
    assert.strictEqual(
      shouldShowManualFallback({ status: "needs_manual_account", reason: "sin cuenta origen" }),
      true
    );
  }

  // ==========================================
  // resolvePayerUserId (corrección P1)
  // Paridad exacta con Android:
  // event.paidByUserId.takeIf { it.isNotBlank() } ?: event.createdByUserId
  // Eventos históricos pueden tener paidByUserId ausente/vacío; el pagador
  // real en ese caso es quien creó el evento.
  // ==========================================

  // Test (requisito 1 de la corrección): paidByUserId presente -> prioridad normal
  {
    const payerId = resolvePayerUserId({
      paidByUserId: "user-payer",
      createdByUserId: "user-creator",
    });
    assert.strictEqual(payerId, "user-payer", "Con paidByUserId presente, ese es el pagador");
  }

  // Test (requisito 2 de la corrección): paidByUserId ausente (null) y
  // createdByUserId presente -> se usa el creador como pagador
  {
    const payerId = resolvePayerUserId({
      paidByUserId: null,
      createdByUserId: "user-creator",
    });
    assert.strictEqual(payerId, "user-creator");
  }

  // Test: paidByUserId vacío ("") equivale a ausente -> también cae al creador
  {
    const payerId = resolvePayerUserId({
      paidByUserId: "",
      createdByUserId: "user-creator",
    });
    assert.strictEqual(payerId, "user-creator");
  }

  // Test (requisito 3 de la corrección): ambos ausentes -> null, sin pagador
  // resoluble (el llamador no debe intentar leer ninguna share)
  {
    const payerId = resolvePayerUserId({
      paidByUserId: null,
      createdByUserId: null,
    });
    assert.strictEqual(payerId, null, "Sin paidByUserId ni createdByUserId no hay pagador resoluble");
  }
  {
    const payerId = resolvePayerUserId({
      paidByUserId: "",
      createdByUserId: "",
    });
    assert.strictEqual(payerId, null, "Ambos vacíos equivale a ambos ausentes");
  }
  {
    const payerId = resolvePayerUserId({});
    assert.strictEqual(payerId, null, "Parámetros omitidos (undefined) también resuelven a null");
  }

  // ==========================================
  // resolveDebtSourceTransactionId
  // Contrato Android vigente, orden exacto:
  // 1. household_events.sourceTransactionId;
  // 2. si falta/vacío, household_event_shares.completedByTransactionId de la
  //    share del pagador (memberUserId === resolvePayerUserId(event)).
  // ==========================================

  // Test (requisito 1): evento con sourceTransactionId válido Y share presente
  // -> se prioriza el evento, no la share.
  {
    const resolved = resolveDebtSourceTransactionId({
      eventSourceTransactionId: "tx-from-event",
      payerShareCompletedByTransactionId: "tx-from-share",
    });
    assert.strictEqual(resolved, "tx-from-event", "El sourceTransactionId del evento tiene prioridad");
  }

  // Test (requisito 2): evento sin source (null) y share del pagador completada
  // con tx propia -> se usa la de la share.
  {
    const resolved = resolveDebtSourceTransactionId({
      eventSourceTransactionId: null,
      payerShareCompletedByTransactionId: "tx-from-share",
    });
    assert.strictEqual(resolved, "tx-from-share");
  }

  // Test: evento con sourceTransactionId vacío ("") equivale a ausente -> cae a la share
  {
    const resolved = resolveDebtSourceTransactionId({
      eventSourceTransactionId: "",
      payerShareCompletedByTransactionId: "tx-from-share",
    });
    assert.strictEqual(resolved, "tx-from-share");
  }

  // Test: ninguna fuente disponible -> null
  {
    const resolved = resolveDebtSourceTransactionId({
      eventSourceTransactionId: null,
      payerShareCompletedByTransactionId: null,
    });
    assert.strictEqual(resolved, null);
  }

  // Test: share sin completedByTransactionId (aún no completada) y sin source de evento -> null
  {
    const resolved = resolveDebtSourceTransactionId({
      eventSourceTransactionId: undefined,
      payerShareCompletedByTransactionId: undefined,
    });
    assert.strictEqual(resolved, null);
  }

  // ==========================================
  // Pipeline combinado resolveDebtSourceTransactionId -> decideAutoSettleOutcome
  // (escenarios obligatorios 2 y 3 del contrato Android aprobado)
  // ==========================================

  const eligibleDebtForPipeline = {
    toUserId: "user-creditor",
    status: "payment_declared",
    incomingTransactionId: null as string | null,
    outgoingTransactionId: "tx-outgoing-1",
    amount: 60000,
  };

  // Test (requisito 2 obligatorio): evento SIN source y share del pagador
  // completada con transacción propia + cuenta viva -> settled.
  {
    const sourceTransactionId = resolveDebtSourceTransactionId({
      eventSourceTransactionId: null,
      payerShareCompletedByTransactionId: "tx-from-share",
    });
    const decision = decideAutoSettleOutcome({
      viewerUserId: "user-creditor",
      debt: eligibleDebtForPipeline,
      sourceTransactionId,
      sourceTransaction: { ownerId: "user-creditor", accountId: "acc-1", categoryId: "cat-1" },
    });
    assert.deepStrictEqual(decision, { kind: "settled", accountId: "acc-1", categoryId: "cat-1" });
  }

  // Test (requisito 3 obligatorio, "orden tardío"): primera evaluación sin
  // completedByTransactionId todavía -> needs_manual_account; una segunda
  // evaluación posterior, tras completarse la share, resuelve settled UNA
  // sola vez; una tercera evaluación (ya con incomingTransactionId asignado
  // por la segunda) no vuelve a intentar -> skipped, nunca un segundo settled.
  {
    // 1ra evaluación: la share del pagador aún no se completó.
    const firstSourceTransactionId = resolveDebtSourceTransactionId({
      eventSourceTransactionId: null,
      payerShareCompletedByTransactionId: null,
    });
    const firstDecision = decideAutoSettleOutcome({
      viewerUserId: "user-creditor",
      debt: eligibleDebtForPipeline,
      sourceTransactionId: firstSourceTransactionId,
      sourceTransaction: null,
    });
    assert.strictEqual(firstDecision.kind, "needs_manual_account");

    // 2da evaluación (nuevo snapshot): completedByTransactionId ya apareció.
    const secondSourceTransactionId = resolveDebtSourceTransactionId({
      eventSourceTransactionId: null,
      payerShareCompletedByTransactionId: "tx-from-share",
    });
    const secondDecision = decideAutoSettleOutcome({
      viewerUserId: "user-creditor",
      debt: eligibleDebtForPipeline,
      sourceTransactionId: secondSourceTransactionId,
      sourceTransaction: { ownerId: "user-creditor", accountId: "acc-1", categoryId: "cat-1" },
    });
    assert.deepStrictEqual(secondDecision, { kind: "settled", accountId: "acc-1", categoryId: "cat-1" });

    // 3ra evaluación (la deuda ya tiene incomingTransactionId tras la 2da) ->
    // skipped, jamás un segundo settled/incoming.
    const thirdDecision = decideAutoSettleOutcome({
      viewerUserId: "user-creditor",
      debt: { ...eligibleDebtForPipeline, incomingTransactionId: "tx-incoming-from-second" },
      sourceTransactionId: secondSourceTransactionId,
      sourceTransaction: { ownerId: "user-creditor", accountId: "acc-1", categoryId: "cat-1" },
    });
    assert.deepStrictEqual(thirdDecision, { kind: "skipped" });
  }

  // ==========================================
  // decideAutoSettleOutcome
  // Hecho confirmado por investigación de código Android: para una deuda
  // normal `advancedByPayer` creada por `createEventWithShares`, el evento
  // vinculado siempre tiene `sourceTransactionId = null`. El resultado real
  // de Android para ese caso es `NeedsManualAccount`, no `Settled`. La
  // función es pura (sin efectos secundarios): un resultado distinto de
  // `settled` garantiza, por construcción, que no se creó ningún incoming ni
  // se tocó saldo/deuda.
  // ==========================================

  const eligibleDebt = {
    toUserId: "user-creditor",
    status: "payment_declared",
    incomingTransactionId: null as string | null,
    outgoingTransactionId: "tx-outgoing-1",
    amount: 60000,
  };

  // Test 20 (RED del escenario pedido): sin sourceTransactionId resuelto (ni por
  // evento ni por share) -> needs_manual_account.
  {
    const decision = decideAutoSettleOutcome({
      viewerUserId: "user-creditor",
      debt: eligibleDebt,
      sourceTransactionId: null,
      sourceTransaction: null,
    });
    assert.deepStrictEqual(decision, {
      kind: "needs_manual_account",
      reason: "No se encontró la cuenta del gasto origen para acreditar el reembolso.",
    });
  }

  // Test 21: sourceTransactionId resuelto pero sin datos de la transacción (no
  // encontrada/no leída) -> mismo resultado, misma razón
  {
    const decision = decideAutoSettleOutcome({
      viewerUserId: "user-creditor",
      debt: eligibleDebt,
      sourceTransactionId: "tx-source-1",
      sourceTransaction: null,
    });
    assert.strictEqual(decision.kind, "needs_manual_account");
  }

  // Test 22: sourceTransactionId presente pero la transacción pertenece a otro
  // usuario (no es del acreedor) -> needs_manual_account, no acredita a ciegas
  {
    const decision = decideAutoSettleOutcome({
      viewerUserId: "user-creditor",
      debt: eligibleDebt,
      sourceTransactionId: "tx-source-1",
      sourceTransaction: { ownerId: "user-other", accountId: "acc-1", categoryId: "cat-1" },
    });
    assert.strictEqual(decision.kind, "needs_manual_account");
  }

  // Test 23: caso donde SÍ hay atribución completa y segura (sourceTransactionId
  // propio y resoluble, sin importar si vino del evento o de la share) -> settled
  {
    const decision = decideAutoSettleOutcome({
      viewerUserId: "user-creditor",
      debt: eligibleDebt,
      sourceTransactionId: "tx-source-1",
      sourceTransaction: { ownerId: "user-creditor", accountId: "acc-1", categoryId: "cat-1" },
    });
    assert.deepStrictEqual(decision, { kind: "settled", accountId: "acc-1", categoryId: "cat-1" });
  }

  // Test 24: sin outgoingTransactionId (contrato inconsistente) -> needs_manual_account
  {
    const decision = decideAutoSettleOutcome({
      viewerUserId: "user-creditor",
      debt: { ...eligibleDebt, outgoingTransactionId: null },
      sourceTransactionId: "tx-source-1",
      sourceTransaction: { ownerId: "user-creditor", accountId: "acc-1", categoryId: "cat-1" },
    });
    assert.strictEqual(decision.kind, "needs_manual_account");
  }

  // Test 25: monto inválido -> needs_manual_account
  {
    const decision = decideAutoSettleOutcome({
      viewerUserId: "user-creditor",
      debt: { ...eligibleDebt, amount: 0 },
      sourceTransactionId: "tx-source-1",
      sourceTransaction: { ownerId: "user-creditor", accountId: "acc-1", categoryId: "cat-1" },
    });
    assert.strictEqual(decision.kind, "needs_manual_account");
  }

  // Test 26 (éxito manual / no duplicar en reintento): deuda que ya tiene
  // incomingTransactionId (ya se acreditó manualmente antes) -> skipped, jamás
  // un segundo settled/incoming en una recarga o reintento posterior.
  {
    const decision = decideAutoSettleOutcome({
      viewerUserId: "user-creditor",
      debt: { ...eligibleDebt, incomingTransactionId: "tx-incoming-1" },
      sourceTransactionId: "tx-source-1",
      sourceTransaction: { ownerId: "user-creditor", accountId: "acc-1", categoryId: "cat-1" },
    });
    assert.deepStrictEqual(decision, { kind: "skipped" });
  }

  // Test 27: usuario ajeno -> skipped (no revalida ni siquiera evento/transacción)
  {
    const decision = decideAutoSettleOutcome({
      viewerUserId: "user-unrelated",
      debt: eligibleDebt,
      sourceTransactionId: "tx-source-1",
      sourceTransaction: { ownerId: "user-creditor", accountId: "acc-1", categoryId: "cat-1" },
    });
    assert.deepStrictEqual(decision, { kind: "skipped" });
  }

  // ==========================================
  // shouldAutoOpenManualFallback
  // El sheet se abre automáticamente una sola vez por needs_manual_account;
  // si el usuario lo descarta ("Ahora no"), no debe reabrirse en bucle en el
  // mismo estado/snapshot.
  // ==========================================

  // Test 28: needs_manual_account y no descartado -> debe abrirse
  {
    const shouldOpen = shouldAutoOpenManualFallback({
      entry: { status: "needs_manual_account", reason: "sin cuenta origen" },
      dismissed: false,
    });
    assert.strictEqual(shouldOpen, true);
  }

  // Test 29 (prueba de descarte): needs_manual_account pero ya descartado -> no reabrir
  {
    const shouldOpen = shouldAutoOpenManualFallback({
      entry: { status: "needs_manual_account", reason: "sin cuenta origen" },
      dismissed: true,
    });
    assert.strictEqual(shouldOpen, false, "Descartado por el usuario no debe reabrirse en el mismo estado");
  }

  // Test 30: processing -> nunca abrir automáticamente, sin importar el descarte
  {
    assert.strictEqual(shouldAutoOpenManualFallback({ entry: { status: "processing" }, dismissed: false }), false);
    assert.strictEqual(shouldAutoOpenManualFallback({ entry: { status: "processing" }, dismissed: true }), false);
  }

  // Test 31: sin entry -> no abrir
  {
    assert.strictEqual(shouldAutoOpenManualFallback({ entry: undefined, dismissed: false }), false);
  }

  // ==========================================
  // shouldAutoCloseManualFallback (corrección P1)
  // El sheet abierto para debt-1 debe cerrarse automáticamente si SU PROPIA
  // entry deja de ser needs_manual_account (processing por reintento, o
  // desaparece por settled/skipped/reconciliación). Un cambio en la entry de
  // OTRA deuda nunca debe evaluarse aquí -- el llamador solo pasa la entry de
  // la deuda actualmente seleccionada.
  // ==========================================

  // Escenario obligatorio: sheet abierto para debt-1 + entry needs_manual_account -> sigue abierto
  {
    const shouldClose = shouldAutoCloseManualFallback({ status: "needs_manual_account", reason: "sin cuenta origen" });
    assert.strictEqual(shouldClose, false, "Con needs_manual_account vigente, el sheet no debe cerrarse");
  }

  // Escenario obligatorio: la entry de debt-1 pasa a processing -> el sheet se cierra
  {
    const shouldClose = shouldAutoCloseManualFallback({ status: "processing" });
    assert.strictEqual(shouldClose, true, "Un reintento en processing debe cerrar el sheet abierto");
  }

  // Escenario obligatorio: la entry de debt-1 se limpia (settled/skipped/reconciliación,
  // ya no existe en el store) -> el sheet se cierra
  {
    const shouldClose = shouldAutoCloseManualFallback(undefined);
    assert.strictEqual(shouldClose, true, "Sin entry (limpiada) el sheet debe cerrarse");
  }

  // ==========================================
  // selectDebtIdsToReconcileAway
  // P1: el observador debe limpiar entries/dismissed de deudas que dejaron de
  // ser elegibles (paid, incomingTransactionId asignado, o ya no del acreedor)
  // sin tocar las que siguen elegibles (incluida needs_manual_account, cuyo
  // descarte del usuario no debe perderse mientras el estado no cambie).
  // ==========================================

  // Test 32 (RED del escenario pedido): deuda tracked que ya no es elegible
  // (p. ej. pasó a paid tras acreditación manual) -> debe reconciliarse (limpiarse)
  {
    const toReconcile = selectDebtIdsToReconcileAway(["debt-1", "debt-2"], new Set(["debt-2"]));
    assert.deepStrictEqual(toReconcile, ["debt-1"]);
  }

  // Test 33: ninguna tracked deja de ser elegible -> nada que reconciliar
  {
    const toReconcile = selectDebtIdsToReconcileAway(["debt-1", "debt-2"], new Set(["debt-1", "debt-2"]));
    assert.deepStrictEqual(toReconcile, []);
  }

  // Test 34: todas dejaron de ser elegibles -> se reconcilian todas
  {
    const toReconcile = selectDebtIdsToReconcileAway(["debt-1", "debt-2"], new Set());
    assert.deepStrictEqual(toReconcile, ["debt-1", "debt-2"]);
  }

  // Test 35: sin tracked -> nada que reconciliar
  {
    const toReconcile = selectDebtIdsToReconcileAway([], new Set(["debt-1"]));
    assert.deepStrictEqual(toReconcile, []);
  }

  // ==========================================
  // shouldMountHouseholdDebtReceptionFallback
  // Paridad Android: el sheet aparece en Home Personal ("home") y Home Hogar
  // ("household"), nunca en Movimientos/Cuentas/Categorías/Ajustes.
  // ==========================================

  // Test 36: home (Personal) -> debe montarse
  {
    assert.strictEqual(shouldMountHouseholdDebtReceptionFallback("home"), true);
  }

  // Test 37: household (Hogar) -> debe montarse
  {
    assert.strictEqual(shouldMountHouseholdDebtReceptionFallback("household"), true);
  }

  // Test 38: movements/accounts/categories/settings -> NO debe montarse
  {
    assert.strictEqual(shouldMountHouseholdDebtReceptionFallback("movements"), false);
    assert.strictEqual(shouldMountHouseholdDebtReceptionFallback("accounts"), false);
    assert.strictEqual(shouldMountHouseholdDebtReceptionFallback("categories"), false);
    assert.strictEqual(shouldMountHouseholdDebtReceptionFallback("settings"), false);
  }

  console.log("auto-settle-debt.test.ts: 55/55 pruebas pasadas.");
}

runAutoSettleDebtTests();
