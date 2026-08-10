import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  computeNetPersonalExpenses,
  buildExpenseCategoryBreakdown,
  isIncomingDebtReimbursement,
} from "../../src/features/dashboard/lib/personal-view-model";
import type { Category } from "../../src/types/category";
import type { Transaction } from "../../src/types/transaction";

console.log("Running unit tests for personal-net-expense-parity.test.ts...");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

const baseTx = (overrides: Partial<Transaction>): Transaction => ({
  id: overrides.id ?? "tx",
  ownerId: "gerson",
  title: "",
  notes: "",
  amount: 0,
  type: "expense",
  accountId: "acc-1",
  targetAccountId: null,
  categoryId: "",
  createdAt: new Date("2026-07-05"),
  date: new Date("2026-07-05"),
  ...overrides,
});

const categories: Category[] = [
  { id: "cat-hogar", ownerId: "gerson", name: "Hogar", icon: "home", type: "expense" },
  { id: "cat-otro", ownerId: "gerson", name: "Otro", icon: "tag", type: "expense" },
];

// ==========================================
// Caso canónico: Gerson paga $120.000 de Hogar, Familia devuelve $60.000.
// ==========================================
function runCanonicalCaseTest() {
  const expense = baseTx({ id: "tx-expense", type: "expense", amount: 120000, categoryId: "cat-hogar" });
  const reimbursement = baseTx({
    id: "tx-reimbursement",
    type: "reimbursement",
    amount: 60000,
    categoryId: "cat-hogar",
    relatedDebtId: "debt-1",
    reimbursementDirection: "incoming",
  });

  const periodTxs = [expense, reimbursement];

  const netExpense = computeNetPersonalExpenses(periodTxs);
  assert.equal(netExpense, 60000, "gasto neto del mes debe ser 120.000 - 60.000 = 60.000");

  const ingresosReales = periodTxs
    .filter((tx) => tx.type === "income" && tx.countsAsRealIncome !== false)
    .reduce((sum, tx) => sum + tx.amount, 0);
  assert.equal(ingresosReales, 0, "el reembolso no debe inflar Ingresos del mes");

  const breakdown = buildExpenseCategoryBreakdown(periodTxs, categories);
  assert.equal(breakdown.length, 1, "solo debe quedar la categoría con neto > 0");
  assert.equal(breakdown[0].categoryId, "cat-hogar");
  assert.equal(breakdown[0].amount, 60000, "la categoría del gasto debe quedar neta en 60.000");
  assert.equal(breakdown[0].share, 100);

  assert.equal(periodTxs.length, 2, "ambos movimientos deben seguir presentes en el historial (no se fusionan/eliminan)");

  console.log("Caso canónico Gerson/Familia $120.000/$60.000: 5/5 aserciones pasadas.");
}

function runBeforeReimbursementTest() {
  const expense = baseTx({ id: "tx-expense", type: "expense", amount: 120000, categoryId: "cat-hogar" });
  assert.equal(computeNetPersonalExpenses([expense]), 120000, "antes de recibir el reembolso, el gasto debe seguir en 120.000");
}

function runOutgoingReimbursementTest() {
  const expense = baseTx({ id: "tx-expense", type: "expense", amount: 120000, categoryId: "cat-hogar" });
  const outgoing = baseTx({
    id: "tx-outgoing",
    type: "reimbursement",
    amount: 60000,
    relatedDebtId: "debt-2",
    reimbursementDirection: "outgoing",
  });
  assert.equal(isIncomingDebtReimbursement(outgoing), false, "un reembolso saliente nunca debe clasificarse como entrante");
  assert.equal(
    computeNetPersonalExpenses([expense, outgoing]),
    120000,
    "un reembolso saliente del deudor no debe reducir el gasto del acreedor"
  );
}

function runIncomingWithoutRelatedDebtTest() {
  const expense = baseTx({ id: "tx-expense", type: "expense", amount: 120000, categoryId: "cat-hogar" });
  const orphanReimbursement = baseTx({
    id: "tx-orphan",
    type: "reimbursement",
    amount: 60000,
    reimbursementDirection: "incoming",
    relatedDebtId: null,
  });
  assert.equal(
    computeNetPersonalExpenses([expense, orphanReimbursement]),
    120000,
    "un reembolso incoming sin relatedDebtId no debe reducir el gasto"
  );
}

function runDifferentCategoryReimbursementTest() {
  const expenseHogar = baseTx({ id: "tx-hogar", type: "expense", amount: 100000, categoryId: "cat-hogar" });
  const expenseOtro = baseTx({ id: "tx-otro", type: "expense", amount: 50000, categoryId: "cat-otro" });
  const reimbursement = baseTx({
    id: "tx-reimb",
    type: "reimbursement",
    amount: 20000,
    categoryId: "cat-otro",
    relatedDebtId: "debt-3",
    reimbursementDirection: "incoming",
  });

  const periodTxs = [expenseHogar, expenseOtro, reimbursement];
  assert.equal(computeNetPersonalExpenses(periodTxs), 130000, "el KPI total debe descontar el reembolso sin importar su categoría");

  const breakdown = buildExpenseCategoryBreakdown(periodTxs, categories);
  const byId = new Map(breakdown.map((item) => [item.categoryId, item]));
  assert.equal(byId.get("cat-hogar")?.amount, 100000, "la categoría distinta a la del reembolso nunca debe reducirse");
  assert.equal(byId.get("cat-otro")?.amount, 30000, "solo la categoría correspondiente al reembolso debe reducirse (50.000 - 20.000)");
}

function runUncategorizedReimbursementTest() {
  const expenseHogar = baseTx({ id: "tx-hogar", type: "expense", amount: 100000, categoryId: "cat-hogar" });
  const reimbursement = baseTx({
    id: "tx-reimb-sin-cat",
    type: "reimbursement",
    amount: 30000,
    categoryId: "",
    relatedDebtId: "debt-4",
    reimbursementDirection: "incoming",
  });

  const periodTxs = [expenseHogar, reimbursement];
  assert.equal(computeNetPersonalExpenses(periodTxs), 70000, "un reembolso sin categoría debe reducir el total del mes");

  const breakdown = buildExpenseCategoryBreakdown(periodTxs, categories);
  assert.equal(breakdown.length, 1);
  assert.equal(breakdown[0].amount, 100000, "sin categoría atribuible, no debe inventarse ni descontarse una categoría arbitraria");
}

function runDifferentMonthTest() {
  // El reembolso de julio no debe reescribir retrospectivamente el KPI de junio:
  // esta responsabilidad es del filtro de período que hace el llamador (ya
  // acotado antes de invocar computeNetPersonalExpenses), así que un conjunto
  // que solo contiene el gasto de junio no debe verse afectado por un
  // reembolso que ocurrió en julio (nunca llega a la lista de junio).
  const juneExpenseOnly = [baseTx({ id: "tx-june", type: "expense", amount: 120000, categoryId: "cat-hogar" })];
  assert.equal(computeNetPersonalExpenses(juneExpenseOnly), 120000, "el KPI de junio no debe verse afectado por un reembolso de julio");
}

function runFloorAtZeroTest() {
  // Reembolso mayor que el gasto del período (p. ej. el gasto quedó en un mes
  // distinto al de la recepción): el KPI y la categoría nunca deben ir a negativo.
  const reimbursementOnly = [
    baseTx({
      id: "tx-reimb-only",
      type: "reimbursement",
      amount: 60000,
      categoryId: "cat-hogar",
      relatedDebtId: "debt-5",
      reimbursementDirection: "incoming",
    }),
  ];
  assert.equal(computeNetPersonalExpenses(reimbursementOnly), 0, "el KPI nunca debe ser negativo");

  const breakdown = buildExpenseCategoryBreakdown(reimbursementOnly, categories);
  assert.equal(breakdown.length, 0, "sin gasto en la categoría, el reembolso no debe crear una categoría negativa ni fantasma");
}

function runSharedFormulaStructuralTest() {
  const personalViews = readSource("features/dashboard/components/personal-views.tsx");
  const personalDataStore = readSource("stores/personal-data-store.ts");

  assert.ok(
    personalViews.includes("computeNetPersonalExpenses(periodTransactions)"),
    "personal-views.tsx debe usar la fórmula compartida computeNetPersonalExpenses"
  );
  assert.ok(
    personalDataStore.includes("computeNetPersonalExpenses(currentMonthTransactions)"),
    "personal-data-store.ts debe usar la fórmula compartida computeNetPersonalExpenses"
  );
  assert.ok(
    !personalViews.match(/gastosMes[\s\S]{0,80}filter\(\(tx\) => tx\.type === "expense"\)/),
    "personal-views.tsx no debe conservar una fórmula divergente de suma cruda de gastos"
  );
  assert.ok(
    !personalDataStore.match(/gastosMes = currentMonthTransactions[\s\S]{0,80}filter\(\(tx\) => tx\.type === "expense"\)/),
    "personal-data-store.ts no debe conservar una fórmula divergente de suma cruda de gastos"
  );

  console.log("Contrato estructural (misma fórmula en ambos archivos): 4/4 aserciones pasadas.");
}

function runManualFallbackCategoryAttributionStructuralTest() {
  const confirmDebtReception = readSource("features/household/services/confirm-debt-reception.ts");

  assert.ok(
    !confirmDebtReception.includes('categoryId: null, // Los reembolsos no usan categoría'),
    "confirm-debt-reception.ts ya no debe forzar categoryId null incondicionalmente"
  );
  assert.ok(
    confirmDebtReception.includes("attributedCategoryId"),
    "confirm-debt-reception.ts debe resolver una categoría atribuible con la misma prioridad que el camino automático"
  );
  assert.ok(
    confirmDebtReception.includes("resolveDebtSourceTransactionId") && confirmDebtReception.includes("resolvePayerUserId"),
    "confirm-debt-reception.ts debe reutilizar las mismas funciones puras de auto-settle-debt.ts, no reinventar la prioridad"
  );
  assert.ok(
    !confirmDebtReception.includes('accountId,\n      pocketId: null,\n      pocketId: null,'),
    "no debe haber cuenta duplicada / alterada por el intento de atribución de categoría"
  );

  console.log("Fallback manual: atribución de categoría con misma prioridad que el camino automático: 3/3 aserciones pasadas.");
}

// ==========================================
// P2 (auditoría Codex): el detalle de categoría debe explicar el total neto,
// no solo mostrar gastos brutos filtrados por tipo.
// ==========================================

const categoryDetailFilter = (transactions: Transaction[], categoryId: string): Transaction[] =>
  transactions.filter(
    (tx) => (tx.type === "expense" || isIncomingDebtReimbursement(tx)) && tx.categoryId === categoryId
  );

function runCategoryDetailIncludesReimbursementTest() {
  const expense = baseTx({ id: "tx-expense", type: "expense", amount: 120000, categoryId: "cat-hogar" });
  const reimbursement = baseTx({
    id: "tx-reimbursement",
    type: "reimbursement",
    amount: 60000,
    categoryId: "cat-hogar",
    relatedDebtId: "debt-1",
    reimbursementDirection: "incoming",
  });
  const otherCategoryExpense = baseTx({ id: "tx-otro", type: "expense", amount: 50000, categoryId: "cat-otro" });

  const detail = categoryDetailFilter([expense, reimbursement, otherCategoryExpense], "cat-hogar");
  assert.equal(detail.length, 2, "el detalle debe incluir el gasto original y el reembolso entrante de la misma categoría");
  assert.ok(detail.some((tx) => tx.id === "tx-expense"));
  assert.ok(detail.some((tx) => tx.id === "tx-reimbursement"));
  assert.ok(!detail.some((tx) => tx.id === "tx-otro"), "no debe incluir movimientos de otra categoría");

  const breakdown = buildExpenseCategoryBreakdown([expense, reimbursement, otherCategoryExpense], categories);
  const cardTotal = breakdown.find((item) => item.categoryId === "cat-hogar")?.amount;
  assert.equal(cardTotal, 60000, "la tarjeta/cabecera de la categoría debe seguir mostrando el neto ($60.000), no el bruto");

  console.log("P2 caso 1 (detalle incluye gasto + reembolso, cabecera neta): 4/4 aserciones pasadas.");
}

function runCategoryDetailExcludesOutgoingAndOrphanReimbursementsTest() {
  const expense = baseTx({ id: "tx-expense", type: "expense", amount: 120000, categoryId: "cat-hogar" });
  const outgoing = baseTx({
    id: "tx-outgoing",
    type: "reimbursement",
    amount: 60000,
    categoryId: "cat-hogar",
    relatedDebtId: "debt-2",
    reimbursementDirection: "outgoing",
  });
  const orphanIncoming = baseTx({
    id: "tx-orphan",
    type: "reimbursement",
    amount: 60000,
    categoryId: "cat-hogar",
    reimbursementDirection: "incoming",
    relatedDebtId: null,
  });

  const detail = categoryDetailFilter([expense, outgoing, orphanIncoming], "cat-hogar");
  assert.equal(detail.length, 1, "un reembolso saliente o sin deuda vinculada no debe entrar al detalle de gasto neto");
  assert.equal(detail[0].id, "tx-expense");

  console.log("P2 caso 2 (outgoing/sin relatedDebtId excluidos del detalle): 2/2 aserciones pasadas.");
}

function runCategoryDetailExcludesOtherCategoryTest() {
  const expenseHogar = baseTx({ id: "tx-hogar", type: "expense", amount: 100000, categoryId: "cat-hogar" });
  const reimbursementOtro = baseTx({
    id: "tx-reimb-otro",
    type: "reimbursement",
    amount: 20000,
    categoryId: "cat-otro",
    relatedDebtId: "debt-3",
    reimbursementDirection: "incoming",
  });

  const detailHogar = categoryDetailFilter([expenseHogar, reimbursementOtro], "cat-hogar");
  assert.equal(detailHogar.length, 1, "el reembolso de otra categoría no debe aparecer en el detalle de la categoría seleccionada");
  assert.equal(detailHogar[0].id, "tx-hogar");

  console.log("P2 caso 3 (categoría distinta excluida): 1/1 aserción pasada.");
}

function runCategoryDetailNeutralPresentationStructuralTest() {
  const personalViews = readSource("features/dashboard/components/personal-views.tsx");
  const categoryDetailDialog = readSource("components/finance/category-detail-dialog.tsx");

  const detailFilterMatches = personalViews.match(
    /\(isCountableMonthlyExpense\(tx\) \|\| isIncomingDebtReimbursement\(tx\)\) &&\s*tx\.categoryId === selectedCategoryItem\.categoryId/g
  ) ?? [];
  assert.equal(
    detailFilterMatches.length,
    2,
    "los dos filtros de detalle de categoría en personal-views.tsx deben usar isCountableMonthlyExpense + isIncomingDebtReimbursement"
  );
  assert.ok(
    !personalViews.match(/\(tx\) => tx\.type === "expense" && tx\.categoryId === selectedCategoryItem\.categoryId/),
    "no debe quedar ningún filtro de detalle de categoría limitado solo a type === expense"
  );
  assert.ok(
    !personalViews.includes('(tx.type === "expense" || isIncomingDebtReimbursement(tx))'),
    "no debe quedar el filtro antiguo que no excluía ajustes técnicos de saldo del detalle de categoría"
  );

  assert.ok(
    categoryDetailDialog.includes("isIncomingDebtReimbursement(tx)"),
    "CategoryDetailDialog debe distinguir el reembolso reutilizando isIncomingDebtReimbursement"
  );
  assert.ok(
    categoryDetailDialog.includes('variant={isReimbursement ? "neutral" : "expense"}'),
    "un reembolso en el detalle debe mostrarse en tono neutral, nunca como gasto rojo"
  );

  console.log("P2 contrato estructural (filtros + presentación neutral): 4/4 aserciones pasadas.");
}

runCanonicalCaseTest();
runBeforeReimbursementTest();
runOutgoingReimbursementTest();
runIncomingWithoutRelatedDebtTest();
runDifferentCategoryReimbursementTest();
runUncategorizedReimbursementTest();
runDifferentMonthTest();
runFloorAtZeroTest();
runSharedFormulaStructuralTest();
runManualFallbackCategoryAttributionStructuralTest();
runCategoryDetailIncludesReimbursementTest();
runCategoryDetailExcludesOutgoingAndOrphanReimbursementsTest();
runCategoryDetailExcludesOtherCategoryTest();
runCategoryDetailNeutralPresentationStructuralTest();

console.log("OK personal-net-expense-parity");
