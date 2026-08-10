import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  resolveDebtPaymentEligibility,
  buildDebtPaymentBlockedCopy,
  DEBT_PAYMENT_BLOCKED_COPY_GENERIC,
  isDebtPaymentBlockedByMissingPayerAnnotation,
  type DebtPaymentEligibilityEvent,
  type DebtPaymentEligibilityShare,
} from "../../src/features/household/lib/auto-settle-debt";
import { declareDebtPayment, type DeclareDebtPaymentTransactionLike } from "../../src/features/household/services/declare-debt-payment";

console.log("Running unit tests for household-debt-payment-gate.test.ts...");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

// ==========================================
// Caso canónico: Gerson adelanta $120.000 de Hogar (advancedByPayer);
// Familia le debe $60.000 (pending).
// ==========================================

const advancedByPayerEvent = (overrides: Partial<DebtPaymentEligibilityEvent> = {}): DebtPaymentEligibilityEvent => ({
  id: "event-1",
  settlementMode: "advancedByPayer",
  sourceTransactionId: null,
  paidByUserId: "gerson",
  createdByUserId: "gerson",
  ...overrides,
});

// ==========================================
// Item 1: advancedByPayer sin fuente -> gateApplies=true, bloqueado, sin CTA
// Pagar, estado "Esperando anotación".
// ==========================================
function runNoSourceBlocksTest() {
  const eligibility = resolveDebtPaymentEligibility({
    debtStatus: "pending",
    event: advancedByPayerEvent(),
    eventShares: [],
  });

  assert.deepEqual(eligibility, { gateApplies: true, eligible: false, reasonCode: "payer_has_not_recorded_expense" });
  assert.ok(isDebtPaymentBlockedByMissingPayerAnnotation(eligibility));

  const personalViews = readSource("features/dashboard/components/personal-views.tsx");
  assert.ok(
    personalViews.includes('<FinanceChip variant="pending">Esperando anotación</FinanceChip>'),
    "Home Personal debe mostrar el chip 'Esperando anotación' cuando el gate bloquea"
  );
  assert.ok(
    personalViews.includes("isWaitingForPayerAnnotation"),
    "Home Personal debe derivar el estado bloqueado del gate (gateApplies && !eligible), no de una condición ad hoc"
  );
  assert.ok(
    /debt\.status === "pending" && !isWaitingForPayerAnnotation && \(\s*<FinanceButton/.test(personalViews),
    "el botón Pagar NO debe renderizarse (ni siquiera deshabilitado) cuando isWaitingForPayerAnnotation es true"
  );
  assert.ok(
    !personalViews.includes("disabled={!paymentEligibility.eligible}"),
    "ya no debe quedar un botón Pagar deshabilitado por elegibilidad — el estado bloqueado usa el chip, no el botón"
  );

  console.log("Item 1 (advancedByPayer sin fuente -> bloqueado, sin CTA Pagar, chip 'Esperando anotación'): 6/6 aserciones pasadas.");
}

// ==========================================
// Item 2: advancedByPayer con sourceTransactionId -> habilitado.
// ==========================================
function runEventSourceTransactionEligibleTest() {
  const eligibility = resolveDebtPaymentEligibility({
    debtStatus: "pending",
    event: advancedByPayerEvent({ sourceTransactionId: "tx-source-1" }),
    eventShares: [],
  });

  assert.deepEqual(eligibility, { gateApplies: true, eligible: true });

  console.log("Item 2 (sourceTransactionId del evento -> habilitado): 1/1 aserción pasada.");
}

// ==========================================
// Item 3: advancedByPayer con share del pagador completada -> habilitado.
// ==========================================
function runPayerShareEligibleTest() {
  const event = advancedByPayerEvent({ sourceTransactionId: null });
  const shares: DebtPaymentEligibilityShare[] = [
    { eventId: "event-1", memberUserId: "gerson", completedByTransactionId: "tx-from-share" },
  ];

  const eligibility = resolveDebtPaymentEligibility({ debtStatus: "pending", event, eventShares: shares });
  assert.deepEqual(eligibility, { gateApplies: true, eligible: true });

  console.log("Item 3 (share completada del pagador -> habilitado): 1/1 aserción pasada.");
}

// ==========================================
// Item 4: eachPaysOwn -> gateApplies=false; nunca queda bloqueado por esta regla.
// ==========================================
function runEachPaysOwnGateDoesNotApplyTest() {
  const withoutSource = resolveDebtPaymentEligibility({
    debtStatus: "pending",
    event: advancedByPayerEvent({ settlementMode: "eachPaysOwn", sourceTransactionId: null }),
    eventShares: [],
  });
  assert.deepEqual(withoutSource, { gateApplies: false }, "eachPaysOwn nunca debe activar el gate, ni siquiera sin fuente");

  const withSource = resolveDebtPaymentEligibility({
    debtStatus: "pending",
    event: advancedByPayerEvent({ settlementMode: "eachPaysOwn", sourceTransactionId: "tx-1" }),
    eventShares: [],
  });
  assert.deepEqual(withSource, { gateApplies: false });

  console.log("Item 4 (eachPaysOwn -> gateApplies=false, nunca bloqueado): 2/2 aserciones pasadas.");
}

// ==========================================
// Item 5: invitation -> gateApplies=false; nunca queda bloqueado por esta regla.
// ==========================================
function runInvitationGateDoesNotApplyTest() {
  const eligibility = resolveDebtPaymentEligibility({
    debtStatus: "pending",
    event: advancedByPayerEvent({ settlementMode: "invitation", sourceTransactionId: null }),
    eventShares: [],
  });
  assert.deepEqual(eligibility, { gateApplies: false });

  console.log("Item 5 (invitation -> gateApplies=false, nunca bloqueado): 1/1 aserción pasada.");
}

// ==========================================
// Item 6: tras completar la share, la UI cambia de "Esperando anotación" a
// "Pagar" sin recargar — se simula recomputando con el mismo evento y un
// array de shares actualizado (el listener real ya refresca ese array, tal
// como usa personal-views.tsx con householdEventShares).
// ==========================================
function runReactivityTransitionTest() {
  const event = advancedByPayerEvent({ sourceTransactionId: null });

  const before = resolveDebtPaymentEligibility({ debtStatus: "pending", event, eventShares: [] });
  assert.deepEqual(before, { gateApplies: true, eligible: false, reasonCode: "payer_has_not_recorded_expense" });
  const isWaitingBefore = before.gateApplies && !before.eligible;
  assert.equal(isWaitingBefore, true, "antes de anotar, la UI debe mostrar 'Esperando anotación' (sin CTA Pagar)");

  const after = resolveDebtPaymentEligibility({
    debtStatus: "pending",
    event,
    eventShares: [{ eventId: "event-1", memberUserId: "gerson", completedByTransactionId: "tx-anotado" }],
  });
  assert.deepEqual(after, { gateApplies: true, eligible: true });
  const isWaitingAfter = after.gateApplies && !after.eligible;
  assert.equal(isWaitingAfter, false, "tras anotar (misma deuda, mismo evento), debe desaparecer 'Esperando anotación' y aparecer Pagar");

  console.log("Item 6 (transición 'Esperando anotación' -> 'Pagar' sin recargar): 4/4 aserciones pasadas.");
}

// ==========================================
// Item 7: prueba conductual del servicio con una transacción Firestore
// simulada. advancedByPayer bloqueado -> rechaza; cero escritura de
// outgoing; cero cambio de saldo; cero cambio de estado de deuda.
//
// Se ejerce el `declareDebtPayment` REAL (no una reimplementación) con un
// seam de inyección interno (`DeclareDebtPaymentDeps`, mismo patrón ya
// establecido en `cancel-pending-share.ts`): `db`/`doc`/`collection`/
// `runTransaction` simulados en memoria, sin tocar Firebase real. El
// escenario bloqueado nunca llega a leer cuenta/bolsillo (el gate se valida
// antes), así que no hace falta simular esas colecciones.
// ==========================================
async function runServiceRejectsBlockedPaymentWithSimulatedTransactionTest() {
  const docsByPath = new Map<string, Record<string, unknown>>();
  docsByPath.set("household_debts/debt-1", {
    fromUserId: "familia",
    status: "pending",
    amount: 60000,
    eventId: "event-1",
    householdId: "hh-1",
  });
  docsByPath.set("household_events/event-1", {
    settlementMode: "advancedByPayer",
    sourceTransactionId: null,
    paidByUserId: "gerson",
    createdByUserId: "gerson",
    // Sin share completada del pagador: household_event_shares/event-1_gerson
    // no existe en este mapa -> la fuente no resuelve -> bloqueado.
  });

  let setCalls = 0;
  let updateCalls = 0;

  const fakeTransaction: DeclareDebtPaymentTransactionLike = {
    get: async (ref) => {
      const key = ref as string;
      const data = docsByPath.get(key);
      return {
        exists: () => data !== undefined,
        data: () => data ?? {},
      };
    },
    set: (_ref, _data) => {
      setCalls += 1;
    },
    update: (_ref, _data) => {
      updateCalls += 1;
    },
  };

  let rejected = false;
  let rejectionMessage = "";
  try {
    await declareDebtPayment(
      {
        debtId: "debt-1",
        ownerId: "familia",
        accountId: "acc-familia-1",
        pocketId: null,
        date: new Date("2026-07-30"),
      },
      {
        getFirebaseDbFn: () => ({ __fakeDb: true }),
        docFn: (...args: unknown[]) => args.slice(1).join("/"),
        collectionFn: (...args: unknown[]) => args.slice(1).join("/"),
        runTransactionFn: (_db, updateFunction) => updateFunction(fakeTransaction),
      }
    );
  } catch (error) {
    rejected = true;
    rejectionMessage = error instanceof Error ? error.message : String(error);
  }

  assert.equal(rejected, true, "advancedByPayer bloqueado por falta de anotación debe rechazar la promesa");
  assert.equal(rejectionMessage, DEBT_PAYMENT_BLOCKED_COPY_GENERIC, "el mensaje de rechazo debe ser el copy seguro del gate, sin datos privados");
  assert.equal(setCalls, 0, "cero escritura de outgoing (transaction.set nunca debe llamarse)");
  assert.equal(updateCalls, 0, "cero cambio de saldo ni de estado de deuda (transaction.update nunca debe llamarse)");

  console.log("Item 7 (servicio con transacción Firestore simulada: advancedByPayer bloqueado rechaza sin ningún efecto): 4/4 aserciones pasadas.");
}

// ==========================================
// Item 8 (no regresión): evento con fuente resuelta (sourceTransactionId) y
// cuenta borrada permite declarar pago — el gate no depende de la cuenta;
// el fallback manual del acreedor permanece disponible.
// ==========================================
function runSourceResolvedButAccountGoneStillEligibleTest() {
  const eligibility = resolveDebtPaymentEligibility({
    debtStatus: "pending",
    // La fuente sí resuelve (sourceTransactionId no vacío); el gate no
    // conoce ni le importa si la cuenta detrás de esa transacción sigue
    // existiendo — eso lo decide auto-settle-debt-reception.ts en su propio
    // camino (needs_manual_account), no este gate del deudor.
    event: advancedByPayerEvent({ sourceTransactionId: "tx-source-cuenta-borrada" }),
    eventShares: [],
  });
  assert.deepEqual(eligibility, { gateApplies: true, eligible: true }, "una fuente resoluble debe habilitar el pago aunque la cuenta detrás desaparezca después");

  const confirmDebtReception = readSource("features/household/services/confirm-debt-reception.ts");
  assert.ok(
    confirmDebtReception.includes("export const confirmDebtReception"),
    "el fallback manual de recepción debe seguir existiendo intacto para el caso excepcional needs_manual_account"
  );
  assert.ok(
    !confirmDebtReception.includes("resolveDebtPaymentEligibility"),
    "el fallback manual del acreedor es un flujo distinto (recepción, no declarar pago) y no debe acoplarse a este gate del deudor"
  );

  console.log("Item 8 (fuente resuelta + cuenta borrada -> no bloquea; fallback manual intacto): 3/3 aserciones pasadas.");
}

// ==========================================
// Cobertura adicional: distinguir "gate no aplicable" de "bloqueado" para
// estado de deuda incompatible y evento ausente/corrupto — no debe
// disfrazarse como "esperando anotación" (eso lo decide la validación normal
// preexistente del servicio, con sus propios mensajes específicos).
// ==========================================
function runGateNotApplicableEdgeCasesTest() {
  const notPending = resolveDebtPaymentEligibility({
    debtStatus: "payment_declared",
    event: advancedByPayerEvent({ sourceTransactionId: "tx-1" }),
    eventShares: [],
  });
  assert.deepEqual(notPending, { gateApplies: false }, "un estado distinto de pending no debe decidirse por este gate");

  const noEvent = resolveDebtPaymentEligibility({ debtStatus: "pending", event: null, eventShares: [] });
  assert.deepEqual(noEvent, { gateApplies: false }, "evento ausente/corrupto no debe disfrazarse como 'esperando anotación'");

  console.log("Cobertura adicional (gate no aplicable para estado/evento fuera de alcance): 2/2 aserciones pasadas.");
}

// ==========================================
// declareDebtPayment.ts: el rechazo por el gate solo debe ocurrir cuando
// `gateApplies && !eligible` — nunca para un modo fuera del gate.
// ==========================================
function runServiceOnlyRejectsWhenGateAppliesStructuralTest() {
  const declareDebtPaymentService = readSource("features/household/services/declare-debt-payment.ts");
  assert.ok(
    declareDebtPaymentService.includes("if (paymentEligibility.gateApplies && !paymentEligibility.eligible)"),
    "declare-debt-payment.ts debe rechazar únicamente cuando gateApplies && !eligible, nunca por gateApplies=false"
  );
  assert.ok(
    !declareDebtPaymentService.includes("if (!paymentEligibility.eligible)"),
    "no debe quedar la condición antigua que rechazaba cualquier resultado no-elegible sin distinguir gateApplies"
  );

  console.log("Contrato de rechazo del servicio (solo gateApplies && !eligible): 2/2 aserciones pasadas.");
}

// ==========================================
// Contrato estructural: no debe haber lógica de elegibilidad duplicada entre
// tarjeta, detalle de evento y servicio — las tres reutilizan la MISMA
// función.
// ==========================================
function runNoDuplicatedLogicStructuralTest() {
  const personalViews = readSource("features/dashboard/components/personal-views.tsx");
  const eventDetailDialog = readSource("features/household/components/household-event-detail-dialog.tsx");
  const declareDebtPaymentService = readSource("features/household/services/declare-debt-payment.ts");

  for (const [label, source] of [
    ["personal-views.tsx", personalViews],
    ["household-event-detail-dialog.tsx", eventDetailDialog],
    ["declare-debt-payment.ts", declareDebtPaymentService],
  ] as const) {
    assert.ok(
      source.includes("resolveDebtPaymentEligibility"),
      `${label} debe reutilizar resolveDebtPaymentEligibility, no reimplementar la regla`
    );
  }

  const libSource = readSource("features/household/lib/auto-settle-debt.ts");
  assert.ok(libSource.includes("export const resolveDebtPaymentEligibility"));
  for (const [label, source] of [
    ["personal-views.tsx", personalViews],
    ["household-event-detail-dialog.tsx", eventDetailDialog],
    ["declare-debt-payment.ts", declareDebtPaymentService],
  ] as const) {
    assert.ok(
      !source.includes("const resolveDebtPaymentEligibility ="),
      `${label} no debe definir su propia copia de resolveDebtPaymentEligibility`
    );
  }

  // El detalle de evento no debe mostrar el copy bloqueado para modos fuera
  // del gate (eachPaysOwn/invitation) — depende de paymentEligibility.gateApplies.
  assert.ok(
    eventDetailDialog.includes("paymentEligibility.gateApplies && !paymentEligibility.eligible"),
    "household-event-detail-dialog.tsx debe condicionar el copy bloqueado a gateApplies, no solo a !eligible"
  );

  console.log("Contrato estructural (sin lógica de elegibilidad duplicada, condicionada a gateApplies): 8/8 aserciones pasadas.");
}

// ==========================================
// El copy bloqueado no debe contener identificadores ni datos privados.
// ==========================================
function runCopyHasNoPrivateDataTest() {
  const generic = DEBT_PAYMENT_BLOCKED_COPY_GENERIC;
  const withName = buildDebtPaymentBlockedCopy("Gerson");
  const withoutName = buildDebtPaymentBlockedCopy(null);

  const forbiddenSubstrings = ["accountId", "pocketId", "categoryId", "acc-", "cat-", "tx-", "saldo", "banco", "Banco"];
  for (const copy of [generic, withName, withoutName]) {
    for (const forbidden of forbiddenSubstrings) {
      assert.ok(!copy.includes(forbidden), `el copy "${copy}" no debe contener "${forbidden}"`);
    }
  }

  assert.equal(withoutName, DEBT_PAYMENT_BLOCKED_COPY_GENERIC);
  assert.equal(withName, "Gerson debe anotar el gasto desde su cuenta antes de que puedas pagar.");

  console.log("Copy sin datos privados: pasada.");
}

// ==========================================
// Regresión estructural: un pago válido sigue creando un único outgoing, y
// el camino de auto-settle sigue acreditando un único incoming al acreedor.
// ==========================================
function runSingleOutgoingAndSingleIncomingRegressionTest() {
  const declareDebtPaymentService = readSource("features/household/services/declare-debt-payment.ts");
  const outgoingWrites = declareDebtPaymentService.match(/transaction\.set\(transactionRef,/g) ?? [];
  assert.equal(outgoingWrites.length, 1, "declare-debt-payment.ts debe seguir creando exactamente un outgoing por llamada");
  assert.ok(
    declareDebtPaymentService.includes('reimbursementDirection: "outgoing"'),
    "el reembolso creado debe seguir marcado como outgoing"
  );

  const autoSettleService = readSource("features/household/services/auto-settle-debt-reception.ts");
  const incomingWrites = autoSettleService.match(/transaction\.set\(transactionRef,/g) ?? [];
  assert.equal(incomingWrites.length, 1, "auto-settle-debt-reception.ts debe seguir acreditando exactamente un incoming");
  assert.ok(
    autoSettleService.includes('reimbursementDirection: "incoming"'),
    "el reembolso acreditado automáticamente debe seguir marcado como incoming"
  );
  assert.ok(
    !autoSettleService.includes("resolveDebtPaymentEligibility"),
    "el camino de auto-settle del acreedor no debe tocarse por este gate (el gate es del deudor, no del acreedor)"
  );

  console.log("Regresión (un solo outgoing, un solo incoming, auto-settle intacto): 5/5 aserciones pasadas.");
}

export async function runHouseholdDebtPaymentGateUnitTests(): Promise<void> {
  runNoSourceBlocksTest();
  runEventSourceTransactionEligibleTest();
  runPayerShareEligibleTest();
  runEachPaysOwnGateDoesNotApplyTest();
  runInvitationGateDoesNotApplyTest();
  runReactivityTransitionTest();
  await runServiceRejectsBlockedPaymentWithSimulatedTransactionTest();
  runSourceResolvedButAccountGoneStillEligibleTest();
  runGateNotApplicableEdgeCasesTest();
  runServiceOnlyRejectsWhenGateAppliesStructuralTest();
  runNoDuplicatedLogicStructuralTest();
  runCopyHasNoPrivateDataTest();
  runSingleOutgoingAndSingleIncomingRegressionTest();

  console.log("OK household-debt-payment-gate");
}
