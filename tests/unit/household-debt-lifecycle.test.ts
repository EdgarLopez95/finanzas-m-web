import assert from "node:assert/strict";

import {
  resolveHouseholdEventCancelBlock,
  resolveShareRevertStatusOnTransactionDelete,
  assertCanUndoDeclaredDebtPayment,
  isActiveHouseholdDebtStatus,
  selectActiveHouseholdDebts,
} from "../../src/features/household/lib/household-debt-lifecycle";

console.log("Running unit tests for household-debt-lifecycle.test.ts...");

function runHouseholdDebtLifecycleTests() {
  // ==========================================
  // resolveHouseholdEventCancelBlock
  // Android: HouseholdEventCapabilities.kt:64-82 — solo las deudas bloquean la
  // cancelación (payment_declared tiene prioridad sobre paid); shares NUNCA bloquean.
  // ==========================================

  // Test 1: sin deudas -> cancelación disponible
  {
    const block = resolveHouseholdEventCancelBlock([]);
    assert.strictEqual(block, null, "Sin deudas, la cancelación debe estar disponible");
  }

  // Test 2: solo deudas pending -> cancelación disponible
  {
    const block = resolveHouseholdEventCancelBlock([
      { id: "debt-1", status: "pending" },
      { id: "debt-2", status: "pending" },
    ]);
    assert.strictEqual(block, null, "Deudas pending no bloquean la cancelación");
  }

  // Test 3: una deuda payment_declared -> bloquea
  {
    const block = resolveHouseholdEventCancelBlock([
      { id: "debt-1", status: "pending" },
      { id: "debt-2", status: "payment_declared" },
    ]);
    assert.deepStrictEqual(block, { reason: "payment_declared", debtId: "debt-2" });
  }

  // Test 4: una deuda paid (sin declared) -> bloquea
  {
    const block = resolveHouseholdEventCancelBlock([
      { id: "debt-1", status: "pending" },
      { id: "debt-2", status: "paid" },
    ]);
    assert.deepStrictEqual(block, { reason: "paid", debtId: "debt-2" });
  }

  // Test 5: payment_declared y paid simultáneos -> prioriza payment_declared (paridad Android)
  {
    const block = resolveHouseholdEventCancelBlock([
      { id: "debt-1", status: "paid" },
      { id: "debt-2", status: "payment_declared" },
    ]);
    assert.deepStrictEqual(block, { reason: "payment_declared", debtId: "debt-2" });
  }

  // Test 6: firma de la función NO acepta shares -- shares completadas nunca deben
  // poder bloquear la cancelación (divergencia corregida vs. versión previa de Web).
  {
    assert.strictEqual(resolveHouseholdEventCancelBlock.length, 1, "Solo debe tomar la lista de deudas");
  }

  // ==========================================
  // resolveShareRevertStatusOnTransactionDelete
  // Android: HouseholdEventRepository.kt:707-735 (revertShareCompletionByTransactionId) +
  // firestore.rules:505-523 (decisión 1).
  // ==========================================

  // Test 7: evento padre activo -> vuelve a pending_completion
  {
    const status = resolveShareRevertStatusOnTransactionDelete("active");
    assert.strictEqual(status, "pending_completion");
  }

  // Test 8: evento padre cancelado -> el share revertido queda cancelled, no pending_completion
  {
    const status = resolveShareRevertStatusOnTransactionDelete("cancelled");
    assert.strictEqual(status, "cancelled");
  }

  // ==========================================
  // assertCanUndoDeclaredDebtPayment
  // Android: HouseholdDebtRepository.kt:280-320 (undoDeclaredPayment) +
  // firestore.rules:574-584 (payment_declared -> pending, solo deudor).
  // ==========================================

  const baseDebt = {
    fromUserId: "user-debtor",
    status: "payment_declared",
    outgoingTransactionId: "tx-outgoing-1",
    incomingTransactionId: null as string | null,
  };

  // Test 9: caso válido no lanza
  {
    assert.doesNotThrow(() =>
      assertCanUndoDeclaredDebtPayment({ debt: baseDebt, ownerId: "user-debtor" })
    );
  }

  // Test 10: solo el deudor puede deshacer
  {
    assert.throws(() =>
      assertCanUndoDeclaredDebtPayment({ debt: baseDebt, ownerId: "user-creditor" })
    );
  }

  // Test 11: no se puede deshacer si el estado no es payment_declared
  {
    assert.throws(() =>
      assertCanUndoDeclaredDebtPayment({
        debt: { ...baseDebt, status: "pending" },
        ownerId: "user-debtor",
      })
    );
  }

  // Test 12: no se puede deshacer si el acreedor ya confirmó la recepción
  {
    assert.throws(() =>
      assertCanUndoDeclaredDebtPayment({
        debt: { ...baseDebt, incomingTransactionId: "tx-incoming-1" },
        ownerId: "user-debtor",
      })
    );
  }

  // Test 13: no se puede deshacer sin una transacción de pago declarado válida
  {
    assert.throws(() =>
      assertCanUndoDeclaredDebtPayment({
        debt: { ...baseDebt, outgoingTransactionId: null },
        ownerId: "user-debtor",
      })
    );
  }

  console.log("household-debt-lifecycle.test.ts: 13/13 pruebas pasadas.");

  // ==========================================
  // isActiveHouseholdDebtStatus / selectActiveHouseholdDebts
  // Corrección P1: una deuda `paid` debe dejar de aparecer en los buckets
  // activos de Home Personal (Te deben / Le debés al hogar). Solo
  // pending/payment_declared son "activas"; paid/cancelled/cancelado no.
  // ==========================================

  // Test 14: pending aparece como activa
  {
    assert.strictEqual(isActiveHouseholdDebtStatus("pending"), true);
  }

  // Test 15: payment_declared aparece como activa
  {
    assert.strictEqual(isActiveHouseholdDebtStatus("payment_declared"), true);
  }

  // Test 16: paid NO es activa
  {
    assert.strictEqual(isActiveHouseholdDebtStatus("paid"), false);
  }

  // Test 17: cancelled/cancelado NO son activas
  {
    assert.strictEqual(isActiveHouseholdDebtStatus("cancelled"), false);
    assert.strictEqual(isActiveHouseholdDebtStatus("cancelado"), false);
  }

  // Test 18: tolerante a capitalización histórica (defensivo, sin inventar estados nuevos)
  {
    assert.strictEqual(isActiveHouseholdDebtStatus("Pending"), true);
    assert.strictEqual(isActiveHouseholdDebtStatus("PAID"), false);
    assert.strictEqual(isActiveHouseholdDebtStatus("Payment_Declared"), true);
  }

  // Test 19: selectActiveHouseholdDebts filtra una lista completa —
  // mezcla paid + pending deja solo la pendiente.
  {
    const debts = [
      { id: "d-paid", status: "paid" },
      { id: "d-pending", status: "pending" },
      { id: "d-declared", status: "payment_declared" },
      { id: "d-cancelled", status: "cancelled" },
    ];
    const active = selectActiveHouseholdDebts(debts);
    assert.deepStrictEqual(
      active.map((d) => d.id),
      ["d-pending", "d-declared"],
      "Solo pending/payment_declared deben quedar como activas; paid/cancelled fuera"
    );
  }

  console.log("isActiveHouseholdDebtStatus/selectActiveHouseholdDebts: 6/6 pruebas pasadas.");
}

runHouseholdDebtLifecycleTests();
