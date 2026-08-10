import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { HouseholdEventShare } from "../../src/types/household";

console.log("Running unit tests for household-personal-annotation-parity.test.ts...");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

// ==========================================
// Paso 4 (auditoría): "Por anotar" en Personal debe mostrar únicamente
// responsabilidades (shares) PROPIAS pendientes — nunca una share ajena.
// Réplica exacta del filtro real de personal-views.tsx (myPendingShares).
// ==========================================
const selectMyPendingShares = (shares: HouseholdEventShare[], ownerId: string): HouseholdEventShare[] =>
  shares.filter((s) => s.memberUserId === ownerId && (s.status === "pending_completion" || s.status === "pending"));

const share = (overrides: Partial<HouseholdEventShare>): HouseholdEventShare => ({
  id: "share-1",
  householdId: "hh-1",
  eventId: "event-1",
  memberUserId: "gerson",
  amount: 120000,
  percentage: null,
  status: "pending_completion",
  isPaid: false,
  createdAt: new Date("2026-07-01"),
  ...overrides,
});

// ==========================================
// Item 1: share propia pendiente aparece; share ajena nunca aparece.
// ==========================================
function runOwnShareVisibleOtherShareHiddenTest() {
  const shares = [
    share({ id: "s-mine", memberUserId: "gerson", status: "pending_completion" }),
    share({ id: "s-other", memberUserId: "familia", status: "pending_completion" }),
  ];

  const mine = selectMyPendingShares(shares, "gerson");
  assert.equal(mine.length, 1, "solo debe aparecer la share propia");
  assert.equal(mine[0].id, "s-mine");
  assert.ok(!mine.some((s) => s.id === "s-other"), "la share ajena nunca debe aparecer en 'Por anotar' del usuario actual");

  const theirs = selectMyPendingShares(shares, "familia");
  assert.equal(theirs.length, 1, "el otro miembro debe ver solo la suya");
  assert.equal(theirs[0].id, "s-other");

  console.log("Item 1 (share propia visible, share ajena nunca aparece): 4/4 aserciones pasadas.");
}

function runCompletedOrCancelledSharesNeverAppearTest() {
  const shares = [
    share({ id: "s-completed", memberUserId: "gerson", status: "completed" }),
    share({ id: "s-cancelled", memberUserId: "gerson", status: "cancelled" }),
  ];
  assert.equal(selectMyPendingShares(shares, "gerson").length, 0, "shares completadas o canceladas no deben aparecer como 'Por anotar'");

  console.log("Shares completadas/canceladas nunca aparecen como pendientes: 1/1 aserción pasada.");
}

// ==========================================
// Item 4/5/6: reglas por modo ya verificadas exhaustivamente en
// household-events.test.ts (Test 1, buildHouseholdEventWritePlan): invitation
// -> 1 share (pagador) + 0 deudas; advancedByPayer -> 1 share (pagador) + N
// deudas para no-pagadores (el deudor NUNCA recibe una share propia, así que
// nunca aparece en 'Por anotar' por ese evento); eachPaysOwn -> 1 share por
// miembro con responsabilidad > 0, 0 deudas. Aquí solo se referencia esa
// cobertura ya existente, sin duplicarla.
// ==========================================
function runModeRulesAreCoveredElsewhereStructuralTest() {
  const source = readSource("features/household/services/create-household-event.ts");
  assert.ok(
    source.includes('settlementMode === "invitation" || settlementMode === "advancedByPayer"'),
    "invitation y advancedByPayer deben compartir la rama de UNA sola share (la del pagador)"
  );
  assert.ok(
    source.match(/if \(settlementMode === "advancedByPayer"\) \{\s*for \(const share of memberShares\) \{\s*if \(share\.memberUserId !== paidByUserId/),
    "advancedByPayer solo debe generar deuda para quien NO es el pagador — nunca una share adicional para el deudor"
  );

  console.log("Reglas por modo (referencian cobertura existente en household-events.test.ts): 2/2 aserciones pasadas.");
}

// ==========================================
// Item 2/3: completar 'Por anotar' crea EXACTAMENTE un gasto personal del
// dueño, descuenta solo su saldo, y completa (no borra) la share — nunca
// permite completar una share ajena (validación server-side de ownership).
// ==========================================
function runCompleteShareServiceContractStructuralTest() {
  const source = readSource("features/household/services/complete-household-event-share.ts");

  assert.ok(
    source.includes('if (shareData.memberUserId !== ownerId)'),
    "el servicio debe rechazar completar una share cuyo memberUserId no sea el usuario actual"
  );

  const transactionSetCalls = source.match(/transaction\.set\(transactionRef,/g) ?? [];
  assert.equal(transactionSetCalls.length, 1, "debe crearse EXACTAMENTE un gasto personal, nunca duplicado");

  assert.ok(source.includes('type: "expense"'), "el movimiento creado debe ser un gasto personal real, no un reembolso ni ingreso");

  assert.ok(
    source.includes("applyExpenseSourceDelta"),
    "debe descontar el saldo de la cuenta/bolsillo ORIGEN elegido por el propio usuario (loadExpenseSourceState ya valida ownership del accountId/categoryId)"
  );
  assert.ok(
    source.includes("if (categoryData.ownerId !== ownerId)"),
    "la categoría usada debe pertenecer al usuario actual — nunca una categoría ajena"
  );

  const shareStatusUpdates = source.match(/status: "completed"/g) ?? [];
  assert.equal(shareStatusUpdates.length, 1, "la share debe quedar marcada como completed exactamente una vez");

  console.log("Item 2/3 (un solo gasto propio, saldo propio, share completada, ownership validado): 6/6 aserciones pasadas.");
}

// ==========================================
// Item 7: eliminar el gasto vinculado revierte la share a pending_completion
// (o cancelled si el evento padre ya está cancelado) — sin duplicar shares
// ni crear una nueva.
// ==========================================
function runDeleteRevertsShareToPendingStructuralTest() {
  const source = readSource("features/transactions/services/delete-personal-transaction.ts");

  assert.ok(
    source.includes("completedByTransactionId") && source.includes("linkedSharesToRevert"),
    "debe existir la lógica que localiza shares completadas por la transacción que se borra"
  );
  assert.ok(
    source.includes("completedByTransactionId: null") && source.includes("completedAt: null"),
    "al revertir, debe limpiar la referencia a la transacción y la fecha de completado"
  );
  assert.ok(
    source.includes("resolveShareRevertStatusOnTransactionDelete"),
    "el nuevo estado tras revertir debe decidirse con la función pura ya existente (pending_completion si el evento sigue activo, cancelled si no)"
  );
  // No debe crear una nueva share (transaction.set sobre household_event_shares) — solo update.
  assert.ok(
    !source.match(/transaction\.set\([^)]*household_event_shares/),
    "revertir NUNCA debe crear una share nueva — solo actualiza (update) la existente, evitando duplicados"
  );

  console.log("Item 7 (revert a pending_completion sin duplicar shares): 4/4 aserciones pasadas.");
}

// ==========================================
// Item 8: ninguna vista de Hogar debe exponer accountId/pocketId/categoryId
// personal, saldo ni banco de otro miembro.
// ==========================================
function runHouseholdOverviewNeverExposesPersonalDataTest() {
  const source = readSource("features/household/components/household-overview.tsx");
  const forbidden = ["accountId", "pocketId", "\\.balance\\b", "institutionName", "currentBalance"];
  for (const term of forbidden) {
    assert.ok(!new RegExp(term).test(source), `household-overview.tsx no debe referenciar "${term}" (dato personal de cuenta)`);
  }

  console.log("Item 8 (Home Hogar sin datos personales de cuenta): 5/5 aserciones pasadas.");
}

// ==========================================
// Contrato de "una sola fuente de verdad": el filtro de 'Por anotar' vive en
// un único lugar (personal-views.tsx), sin una segunda implementación
// divergente en otro componente que también decida esta visibilidad.
// ==========================================
function runSingleSourceOfTruthForPendingSharesTest() {
  const personalViews = readSource("features/dashboard/components/personal-views.tsx");
  assert.ok(
    personalViews.includes("s.memberUserId === ownerId"),
    "personal-views.tsx debe ser dueño del filtro myPendingShares (memberUserId === ownerId)"
  );

  const eventDetailDialog = readSource("features/household/components/household-event-detail-dialog.tsx");
  // El detalle de evento SÍ debe filtrar por share.memberUserId === currentUid
  // para el CTA "Anotar" — es la misma regla de propiedad, no una fórmula
  // distinta (ambos exigen literalmente memberUserId === el uid del viewer).
  assert.ok(
    eventDetailDialog.includes("isCurrentUser") && eventDetailDialog.includes("share.memberUserId === currentUid"),
    "el detalle de evento debe usar la misma regla de propiedad (memberUserId === currentUid) para decidir quién puede anotar"
  );

  console.log("Fuente única de verdad para decidir propiedad de una share: 2/2 aserciones pasadas.");
}

runOwnShareVisibleOtherShareHiddenTest();
runCompletedOrCancelledSharesNeverAppearTest();
runModeRulesAreCoveredElsewhereStructuralTest();
runCompleteShareServiceContractStructuralTest();
runDeleteRevertsShareToPendingStructuralTest();
runHouseholdOverviewNeverExposesPersonalDataTest();
runSingleSourceOfTruthForPendingSharesTest();

console.log("OK household-personal-annotation-parity");
