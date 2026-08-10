import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { selectEachPaysOwnEventIds, groupMemberResponsibilities } from "../../src/features/household/lib/household-view-model";
import { isActiveHouseholdDebtStatus, selectActiveHouseholdDebts } from "../../src/features/household/lib/household-debt-lifecycle";
import type { HouseholdDebt, HouseholdEvent, HouseholdEventShare } from "../../src/types/household";

console.log("Running unit tests for household-personal-debt-parity.test.ts...");

const readComponent = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

// ==========================================
// Caso canónico de referencia (paridad Android — Paso 3):
// Hogar Gerson/Familia. Evento $120.000, advancedByPayer, paidByUserId=Gerson.
// Share pendiente: Gerson $120.000. Deuda: Familia -> Gerson $60.000, pending.
// ==========================================

const canonicalEvent: HouseholdEvent = {
  id: "event-canonico",
  householdId: "hh-1",
  title: "Adelanto Gerson",
  notes: "",
  amount: 120000,
  categoryId: "cat-1",
  createdByUserId: "gerson",
  paidByUserId: "gerson",
  settlementMode: "advancedByPayer",
  sourceTransactionId: null,
  status: "active",
  isActive: true,
  eventDate: new Date("2026-07-01"),
  createdAt: new Date("2026-07-01"),
};

const canonicalShares: HouseholdEventShare[] = [
  {
    id: "event-canonico_gerson",
    householdId: "hh-1",
    eventId: "event-canonico",
    memberUserId: "gerson",
    amount: 120000,
    percentage: null,
    status: "pending_completion",
    isPaid: false,
    createdAt: new Date("2026-07-01"),
  },
];

const canonicalDebt: HouseholdDebt = {
  id: "debt-canonico",
  householdId: "hh-1",
  eventId: "event-canonico",
  title: "Adelanto Gerson",
  fromUserId: "familia",
  toUserId: "gerson",
  amount: 60000,
  status: "pending",
  outgoingTransactionId: null,
  incomingTransactionId: null,
  createdAt: new Date("2026-07-01"),
};

function runModelClassificationTests() {
  // Test 1: el evento advancedByPayer nunca queda en el conjunto de aportes
  // (eachPaysOwn) de Home Hogar.
  {
    const eachPaysOwnIds = selectEachPaysOwnEventIds([canonicalEvent]);
    assert.equal(eachPaysOwnIds.size, 0, "advancedByPayer no debe aparecer como aporte de Home Hogar");

    const responsibilities = groupMemberResponsibilities(canonicalShares, eachPaysOwnIds, "gerson");
    assert.deepEqual(responsibilities, [], "Sin eventos eachPaysOwn, no debe haber responsabilidades/aportes que mostrar");
  }

  // Test 2: clasificación personal de Gerson — share propia pendiente
  // ($120.000, "Por anotar") separada de la deuda por cobrar ($60.000, "Te deben").
  {
    const gersonPendingShares = canonicalShares.filter(
      (s) => s.memberUserId === "gerson" && (s.status === "pending_completion" || s.status === "pending")
    );
    assert.equal(gersonPendingShares.length, 1);
    assert.equal(gersonPendingShares[0].amount, 120000, "Gerson anota el total, $120.000");

    const gersonDebtsReceivable = [canonicalDebt].filter(
      (d) => d.toUserId === "gerson" && d.status !== "cancelled" && d.status !== "cancelado"
    );
    assert.equal(gersonDebtsReceivable.length, 1);
    assert.equal(gersonDebtsReceivable[0].amount, 60000, "A Gerson le deben $60.000, no $120.000");
    assert.notEqual(
      gersonPendingShares[0].amount,
      gersonDebtsReceivable[0].amount,
      "Por anotar ($120.000) y Te deben ($60.000) deben ser cifras distintas y separadas"
    );
  }

  // Test 3: clasificación personal de Familia — NO tiene share propia pendiente
  // para este evento (advancedByPayer solo genera 1 share, la del pagador),
  // pero SÍ tiene una deuda por pagar. La tarjeta "Le debés al hogar" se activa
  // por la deuda propia, no por una share.
  {
    const familiaPendingShares = canonicalShares.filter(
      (s) => s.memberUserId === "familia" && (s.status === "pending_completion" || s.status === "pending")
    );
    assert.equal(familiaPendingShares.length, 0, "Familia no debe recibir la tarjeta 'Por anotar' por este evento");

    const familiaDebtsOwed = [canonicalDebt].filter(
      (d) => d.fromUserId === "familia" && d.status !== "cancelled" && d.status !== "cancelado"
    );
    assert.equal(familiaDebtsOwed.length, 1, "Familia sí debe ver 'Le debés al hogar' aunque no tenga share pendiente");
    assert.equal(familiaDebtsOwed[0].amount, 60000);
  }

  console.log("Clasificación de modelo (aportes vs Por anotar vs deudas): 3/3 pruebas pasadas.");
}

function runRenderArchitectureTests() {
  const overviewContent = readComponent("features/household/components/household-overview.tsx");
  const personalContent = readComponent("features/dashboard/components/personal-views.tsx");
  const dialogContent = readComponent("features/household/components/confirm-reception-dialog.tsx");

  // Test 4: /household (HouseholdOverview) no monta tarjetas, acciones ni
  // diálogos de deudas.
  {
    assert.ok(!overviewContent.includes("Deudas del Hogar"), "household-overview.tsx no debe tener la tarjeta 'Deudas del Hogar'");
    assert.ok(!overviewContent.includes("DeclarePaymentDialog"), "household-overview.tsx no debe montar DeclarePaymentDialog");
    assert.ok(!overviewContent.includes("Declarar pago"), "household-overview.tsx no debe ofrecer la acción 'Declarar pago'");
    assert.ok(!overviewContent.includes("debtsOwed") && !overviewContent.includes("debtsReceivable"), "household-overview.tsx no debe recibir/usar debtsOwed/debtsReceivable");
  }

  // Test 5: /household ya no monta "Estado de aportes" (tablero fijo: categorías | movimientos).
  {
    assert.ok(
      !overviewContent.includes("Estado de aportes"),
      "household-overview.tsx no debe montar la tarjeta 'Estado de aportes'"
    );
  }

  // Test 6: Home Personal monta una sola superficie para declarar pago
  // (DeclarePaymentDialog, una vez) y no monta un segundo ConfirmReceptionDialog
  // (el fallback de recepción vive únicamente en HouseholdDebtReceptionFallback).
  {
    const declareMatches = personalContent.match(/<DeclarePaymentDialog/g) ?? [];
    assert.equal(declareMatches.length, 1, "personal-views.tsx debe montar DeclarePaymentDialog exactamente una vez");
    assert.ok(
      !personalContent.includes("<ConfirmReceptionDialog"),
      "personal-views.tsx no debe montar ConfirmReceptionDialog directamente (eso ya lo hace HouseholdDebtReceptionFallback)"
    );
  }

  // Test 7: la tarjeta Personal "Por anotar" y las tarjetas de deuda usan el
  // copy canónico esperado.
  {
    assert.ok(personalContent.includes('title="Por anotar"'), "Debe existir la tarjeta 'Por anotar'");
    assert.ok(personalContent.includes('title="Te deben"'), "Debe existir la tarjeta 'Te deben'");
    assert.ok(personalContent.includes('title="Le debés al hogar"'), "Debe existir la tarjeta 'Le debés al hogar'");
    assert.ok(/>\s*Pagar\s*</.test(personalContent), "El CTA de pago debe decir 'Pagar'");
  }

  // Test 8: la tarjeta Personal de deudas se activa por `debtsReceivable`/`debtsOwed`
  // del resumen ya cargado (useHouseholdData), no por myPendingShares — así la
  // tarjeta de Familia se activa por su deuda propia aunque no tenga share.
  {
    assert.ok(
      personalContent.includes("householdSummary.debtsReceivable.length > 0 || householdSummary.debtsOwed.length > 0"),
      "Las tarjetas de deuda deben activarse por debtsReceivable/debtsOwed del resumen, no por myPendingShares"
    );
  }

  // Test 9: el sheet de acreditación manual sigue siendo la única superficie
  // con el copy real de Android (verificado ya en auto-settle-debt-store.test.ts,
  // se reconfirma aquí en el contexto de este paso).
  {
    assert.ok(dialogContent.includes("No pudimos acreditar automático"));
  }

  // Test 9b (corrección Codex): la lista "Eventos recientes" de Home Hogar no
  // debe contener copies ni lógica de progreso/situación personal por
  // miembro. Esos datos viven en Home Personal y en el detalle del evento.
  {
    const forbiddenCopies = [
      "Anotar total pagado",
      "Total pagado",
      "Anotar tu parte",
      "Tu parte completada",
      "Te invitaron (no debes)",
    ];
    for (const copy of forbiddenCopies) {
      assert.ok(
        !overviewContent.includes(copy),
        `household-overview.tsx no debe contener el copy personal "${copy}"`
      );
    }
    assert.ok(
      !overviewContent.includes("myShare"),
      "household-overview.tsx no debe derivar indicadores de myShare (progreso/situación personal)"
    );
    assert.ok(
      !overviewContent.includes("isPayer"),
      "household-overview.tsx no debe ramificar por isPayer para mostrar estado personal"
    );
  }

  console.log("Render/arquitectura (superficies únicas, sin duplicar, sin datos personales en Home Hogar): 7/7 pruebas pasadas.");
}

function runDetailDialogTests() {
  const detailContent = readComponent("features/household/components/household-event-detail-dialog.tsx");

  // Test 10: el detalle expone el modo de liquidación explícito y el resumen
  // contextual "te debe"/"debes", separado de la anotación.
  {
    assert.ok(detailContent.includes("settlementModeLabel"), "Debe existir un label explícito de modo de liquidación");
    assert.ok(detailContent.includes("Pagó por adelantado"), "advancedByPayer debe mostrarse como 'Pagó por adelantado'");
    assert.ok(detailContent.includes("contextualDebtSummary"), "Debe existir un resumen contextual de deuda");
    assert.ok(detailContent.includes("te debe"), "Debe incluir el copy 'te debe' para el acreedor");
    assert.ok(detailContent.includes("Debes"), "Debe incluir el copy 'Debes' para el deudor");
  }

  // Test 11: la deuda se muestra sin depender del estado de la share (pending
  // desde el inicio) — eventDebtsInvolvingMe no filtra por share.isPaid ni por
  // share.status, solo por status de la propia deuda.
  {
    const relevantDebtBlock = detailContent.match(/const relevantDebt = eventDebtsInvolvingMe\.find\([^)]*\)/);
    assert.ok(relevantDebtBlock, "Debe existir la selección de relevantDebt");
    assert.ok(
      !relevantDebtBlock![0].includes("isPaid") && !relevantDebtBlock![0].includes("share"),
      "La deuda relevante no debe depender del estado de la anotación/share"
    );
  }

  // Test 12: separación visual/semántica entre "Anotación" y "Deudas relacionadas".
  {
    assert.ok(detailContent.includes("Anotación"), "Debe existir la sección 'Anotación' (no es una deuda)");
    assert.ok(detailContent.includes("Deudas relacionadas"), "Debe existir la sección separada 'Deudas relacionadas'");
  }

  // Test 13 (corrección P1 — bug real QA): el resumen contextual superior debe
  // filtrar por isActiveHouseholdDebtStatus (pending/payment_declared), no
  // solo excluir cancelled/cancelado. Una deuda `paid` (p. ej. tras auto-settle)
  // no debe seguir produciendo el copy "te debe"/"debes".
  {
    assert.ok(
      detailContent.includes("isActiveHouseholdDebtStatus(d.status)"),
      "relevantDebt debe filtrar por isActiveHouseholdDebtStatus, no solo por !== cancelled"
    );
    assert.ok(
      !detailContent.match(/const relevantDebt = eventDebtsInvolvingMe\.find\(\(d\) => d\.status !== "cancelled"/),
      "relevantDebt no debe seguir usando el filtro antiguo que dejaba pasar deudas paid"
    );
  }

  // Test 14 (escenario obligatorio 6): deuda paid única relacionada al evento
  // -> isActiveHouseholdDebtStatus la excluye, así que relevantDebt no la
  // encuentra y no hay contextualDebtSummary, pero la fila histórica
  // (eventDebtsInvolvingMe, sin este filtro) sigue disponible para "Deudas
  // relacionadas" con su estado real.
  {
    const debtsForEvent: HouseholdDebt[] = [
      {
        id: "debt-paid",
        householdId: "hh-1",
        eventId: "event-x",
        title: "Adelanto",
        fromUserId: "familia",
        toUserId: "gerson",
        amount: 60000,
        status: "paid",
        outgoingTransactionId: "tx-out",
        incomingTransactionId: "tx-in",
        createdAt: new Date(),
      },
    ];
    const eventDebtsInvolvingMe = debtsForEvent.filter(
      (d) => d.eventId === "event-x" && (d.fromUserId === "familia" || d.toUserId === "familia")
    );
    assert.equal(eventDebtsInvolvingMe.length, 1, "La fila histórica de la deuda paid debe seguir disponible");

    const relevantDebt = eventDebtsInvolvingMe.find((d) => isActiveHouseholdDebtStatus(d.status));
    assert.equal(relevantDebt, undefined, "Con la única deuda relacionada ya paid, no debe haber relevantDebt");
  }

  console.log("Detalle de evento (modo, resumen contextual, separación anotación/deuda, deuda paid): 5/5 pruebas pasadas.");
}

function runPersonalCardsPaidDebtTests() {
  const hookContent = readComponent("features/household/hooks/use-household-data.ts");

  // Test 15 (escenario obligatorio 3/4/5): debtsOwed/debtsReceivable de
  // useHouseholdData() deben construirse con selectActiveHouseholdDebts, no
  // con un filtro que solo excluya cancelled/cancelado (eso dejaba pasar paid).
  {
    assert.ok(
      hookContent.includes("selectActiveHouseholdDebts(data.debts.filter((d) => d.fromUserId === currentUid))"),
      "debtsOwed debe construirse con selectActiveHouseholdDebts"
    );
    assert.ok(
      hookContent.includes("selectActiveHouseholdDebts(data.debts.filter((d) => d.toUserId === currentUid))"),
      "debtsReceivable debe construirse con selectActiveHouseholdDebts"
    );
    assert.ok(
      !hookContent.match(/debtsOwed[\s\S]{0,120}status !== "cancelled"/),
      "debtsOwed no debe seguir usando el filtro antiguo que solo excluía cancelled/cancelado"
    );
  }

  // Test 16 (pure, escenario obligatorio 3/4/5 a nivel de función): mezcla de
  // deudas con distintos estados para el mismo usuario -> solo quedan las
  // activas; paid/cancelled quedan fuera aunque haya una pending simultánea.
  {
    const mixedDebts: HouseholdDebt[] = [
      { id: "d-paid", householdId: "hh-1", eventId: "e1", title: "t", fromUserId: "familia", toUserId: "gerson", amount: 60000, status: "paid", createdAt: new Date() },
      { id: "d-pending", householdId: "hh-1", eventId: "e2", title: "t", fromUserId: "familia", toUserId: "gerson", amount: 30000, status: "pending", createdAt: new Date() },
      { id: "d-cancelled", householdId: "hh-1", eventId: "e3", title: "t", fromUserId: "familia", toUserId: "gerson", amount: 15000, status: "cancelled", createdAt: new Date() },
    ];
    const active = selectActiveHouseholdDebts(mixedDebts);
    assert.deepEqual(active.map((d) => d.id), ["d-pending"], "Con paid+pending+cancelled mezclados, solo debe quedar la pendiente");
  }

  console.log("Buckets personales con deuda paid (corrección P1): 2/2 pruebas pasadas.");
}

runModelClassificationTests();
runRenderArchitectureTests();
runDetailDialogTests();
runPersonalCardsPaidDebtTests();
