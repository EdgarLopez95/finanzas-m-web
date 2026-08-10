import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { selectActiveHouseholdDebts, isActiveHouseholdDebtStatus } from "../../src/features/household/lib/household-debt-lifecycle";
import { shouldAttemptAutoSettle } from "../../src/features/household/lib/auto-settle-debt";
import type { HouseholdDebt } from "../../src/types/household";

console.log("Running unit tests for household-personal-debt-position-parity.test.ts...");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

const debt = (overrides: Partial<HouseholdDebt>): HouseholdDebt => ({
  id: "debt-1",
  householdId: "hh-1",
  eventId: "event-1",
  title: "Adelanto Gerson",
  fromUserId: "familia",
  toUserId: "gerson",
  amount: 60000,
  status: "pending",
  outgoingTransactionId: null,
  incomingTransactionId: null,
  createdAt: new Date("2026-07-01"),
  ...overrides,
});

// ==========================================
// Paso 5 (auditoría): Caso canónico Gerson adelanta $120.000, Familia debe
// $60.000. Gerson debe ver "Te deben $60.000"; Familia "Le debés $60.000".
// ==========================================
function runCanonicalPositionTest() {
  const canonicalDebt = debt({ fromUserId: "familia", toUserId: "gerson", amount: 60000, status: "pending" });

  const gersonReceivable = selectActiveHouseholdDebts([canonicalDebt].filter((d) => d.toUserId === "gerson"));
  assert.equal(gersonReceivable.length, 1);
  assert.equal(gersonReceivable[0].amount, 60000, "Gerson debe ver 'Te deben $60.000', nunca $120.000");

  const familiaOwed = selectActiveHouseholdDebts([canonicalDebt].filter((d) => d.fromUserId === "familia"));
  assert.equal(familiaOwed.length, 1);
  assert.equal(familiaOwed[0].amount, 60000, "Familia debe ver 'Le debés $60.000'");

  console.log("Item 1 (Te deben/Le debés $60.000, caso canónico): 4/4 aserciones pasadas.");
}

// ==========================================
// Item 5: tras acreditación (paid), la deuda desaparece de los resúmenes
// activos de AMBOS, pero puede conservarse en historial con su estado real.
// ==========================================
function runPaidDebtDisappearsFromActiveSummariesTest() {
  const paidDebt = debt({ status: "paid", incomingTransactionId: "tx-in", outgoingTransactionId: "tx-out" });

  assert.equal(isActiveHouseholdDebtStatus("paid"), false, "'paid' no es un estado activo");
  assert.equal(selectActiveHouseholdDebts([paidDebt]).length, 0, "una deuda paid no debe aparecer en debtsOwed/debtsReceivable de ninguno de los dos");

  // Mezcla con una pending de otro evento: solo la activa sobrevive.
  const pendingDebt = debt({ id: "debt-2", eventId: "event-2", status: "pending" });
  const mixed = selectActiveHouseholdDebts([paidDebt, pendingDebt]);
  assert.deepEqual(mixed.map((d) => d.id), ["debt-2"], "solo la deuda activa debe sobrevivir cuando se mezcla con una ya pagada");

  console.log("Item 5 (deuda paid desaparece de resúmenes activos, sin ocultar la pending): 3/3 aserciones pasadas.");
}

function runCancelledDebtAlsoExcludedTest() {
  const cancelledDebt = debt({ status: "cancelled" });
  assert.equal(selectActiveHouseholdDebts([cancelledDebt]).length, 0, "una deuda cancelada tampoco debe generar resumen activo");

  console.log("Deuda cancelada tampoco genera resumen activo: 1/1 aserción pasada.");
}

// ==========================================
// Item 2/3: antes de que el pagador anote, el deudor ve 'Esperando anotación'
// sin botón Pagar; al anotar, Pagar se habilita — ya cubierto en detalle por
// household-debt-payment-gate.test.ts (Items 1/2/3/6). Aquí se referencia esa
// cobertura y se confirma que personal-views.tsx reutiliza la MISMA función,
// sin una segunda implementación.
// ==========================================
function runPaymentGateReusedNotDuplicatedTest() {
  const personalViews = readSource("features/dashboard/components/personal-views.tsx");
  assert.ok(
    personalViews.includes("resolveDebtPaymentEligibility"),
    "personal-views.tsx debe reutilizar resolveDebtPaymentEligibility (household-debt-payment-gate), no reimplementar el gate de pago"
  );
  assert.ok(
    personalViews.includes("Esperando anotación"),
    "debe existir el copy exacto 'Esperando anotación' cuando el gate bloquea"
  );
  assert.ok(
    !personalViews.match(/debtsOwed\.map[\s\S]{0,400}disabled=\{!paymentEligibility\.eligible\}/),
    "no debe quedar un botón Pagar deshabilitado — el estado bloqueado se representa con el chip, no con un botón inactivo"
  );

  console.log("Item 2/3 (gate reutilizado, sin botón Pagar deshabilitado): 3/3 aserciones pasadas.");
}

// ==========================================
// Item 4: tras declarar el pago, el deudor no puede volver a pagar (el
// servicio rechaza server-side); el acreedor nunca ve una acción de pago.
// ==========================================
function runCannotPayTwiceAndCreditorNeverPaysStructuralTest() {
  const declareService = readSource("features/household/services/declare-debt-payment.ts");
  assert.ok(declareService.includes('debtStatus === "payment_declared"'), "debe rechazar declarar pago si ya está payment_declared");
  assert.ok(declareService.includes('debtStatus === "paid"'), "debe rechazar declarar pago si ya está paid");

  const personalViews = readSource("features/dashboard/components/personal-views.tsx");
  // La sección "Te deben" (debtsReceivable, el acreedor) no debe contener
  // ningún FinanceButton — nunca hay una acción de pago para el acreedor.
  const receivableSection = personalViews.match(/title="Te deben"[\s\S]*?title="Le debés al hogar"/);
  assert.ok(receivableSection, "debe existir la sección 'Te deben'");
  assert.ok(
    !receivableSection![0].includes("FinanceButton"),
    "la tarjeta 'Te deben' (acreedor) nunca debe contener un botón de acción — el acreedor no puede 'pagarse' ni declarar nada"
  );

  console.log("Item 4 (no se puede pagar dos veces; acreedor sin acción de pago): 3/3 aserciones pasadas.");
}

// ==========================================
// Auto-settle: idempotencia — una deuda con incomingTransactionId ya
// asignado nunca vuelve a intentar auto-acreditarse (evita doble crédito).
// ==========================================
function runAutoSettleIdempotencyTest() {
  const alreadyCredited = { toUserId: "gerson", status: "payment_declared", incomingTransactionId: "tx-in-1" };
  assert.equal(
    shouldAttemptAutoSettle({ viewerUserId: "gerson", debt: alreadyCredited }),
    false,
    "una deuda ya acreditada (incomingTransactionId presente) nunca debe reintentarse"
  );

  const notYetCredited = { toUserId: "gerson", status: "payment_declared", incomingTransactionId: null };
  assert.equal(shouldAttemptAutoSettle({ viewerUserId: "gerson", debt: notYetCredited }), true);

  console.log("Auto-settle es idempotente (nunca doble crédito): 2/2 aserciones pasadas.");
}

// ==========================================
// Item 6: invitation y eachPaysOwn no generan household_debts en absoluto —
// ya verificado en household-events.test.ts (debtDocs.length === 0 para
// ambos modos). Confirmación estructural de que solo advancedByPayer crea
// deudas.
// ==========================================
function runOnlyAdvancedByPayerCreatesDebtsStructuralTest() {
  const source = readSource("features/household/services/create-household-event.ts");
  assert.ok(
    source.match(/if \(settlementMode === "advancedByPayer"\) \{\s*for \(const share of memberShares\)/),
    "household_debts solo debe generarse dentro de la rama advancedByPayer"
  );

  console.log("Item 6 (solo advancedByPayer crea deudas; referencia a household-events.test.ts): 1/1 aserción pasada.");
}

// ==========================================
// Item 7: ninguna card/detalle de deuda debe exponer accountId, pocketId,
// categoryId personal, banco o descripción privada de la contraparte.
// ==========================================
function runNoPrivateDataInDebtCardsTest() {
  const personalViews = readSource("features/dashboard/components/personal-views.tsx");
  const debtSection = personalViews.match(/title="Te deben"[\s\S]*?\{selectedDebtForPayment && \(/);
  assert.ok(debtSection, "debe existir el bloque de tarjetas de deuda");

  const forbidden = ["accountId", "pocketId", "institutionName", "currentBalance", "\\.balance\\b"];
  for (const term of forbidden) {
    assert.ok(!new RegExp(term).test(debtSection![0]), `las tarjetas de deuda no deben referenciar "${term}"`);
  }

  console.log("Item 7 (tarjetas de deuda sin datos privados de cuenta): 5/5 aserciones pasadas.");
}

runCanonicalPositionTest();
runPaidDebtDisappearsFromActiveSummariesTest();
runCancelledDebtAlsoExcludedTest();
runPaymentGateReusedNotDuplicatedTest();
runCannotPayTwiceAndCreditorNeverPaysStructuralTest();
runAutoSettleIdempotencyTest();
runOnlyAdvancedByPayerCreatesDebtsStructuralTest();
runNoPrivateDataInDebtCardsTest();

console.log("OK household-personal-debt-position-parity");
