import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  isCountableMonthlyExpense,
  isTechnicalBalanceMovement,
  computeNetPersonalExpenses,
  buildExpenseCategoryBreakdown,
} from "../../src/features/dashboard/lib/personal-view-model";
import type { Category } from "../../src/types/category";
import type { Transaction } from "../../src/types/transaction";

console.log("Running unit tests for technical-balance-movement-exclusion.test.ts...");

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
];

// ==========================================
// Paridad Android: TransactionRepository.kt isTechnicalBalanceMovement()
// compara la descripción (en Web, title) trimmed contra las 2 etiquetas
// canónicas exactas — sin inventar variantes.
// ==========================================

function runNormalExpenseCountsTest() {
  const tx = baseTx({ id: "tx-1", type: "expense", title: "Mercado", amount: 50000, categoryId: "cat-hogar" });
  assert.equal(isTechnicalBalanceMovement(tx), false);
  assert.equal(isCountableMonthlyExpense(tx), true);
  assert.equal(computeNetPersonalExpenses([tx]), 50000, "un gasto normal debe contar completo");

  console.log("Gasto normal cuenta: 3/3 aserciones pasadas.");
}

function runInitialBalanceExpenseDoesNotCountTest() {
  const tx = baseTx({ id: "tx-2", type: "expense", title: "Saldo inicial", amount: 100000 });
  assert.equal(isTechnicalBalanceMovement(tx), true);
  assert.equal(isCountableMonthlyExpense(tx), false);
  assert.equal(computeNetPersonalExpenses([tx]), 0, "'Saldo inicial' como expense no debe contar como gasto mensual");

  console.log("'Saldo inicial' (expense) no cuenta: 3/3 aserciones pasadas.");
}

function runManualAdjustmentExpenseDoesNotCountTest() {
  const tx = baseTx({ id: "tx-3", type: "expense", title: "Ajuste manual de saldo", amount: 30000 });
  assert.equal(isTechnicalBalanceMovement(tx), true);
  assert.equal(isCountableMonthlyExpense(tx), false);
  assert.equal(computeNetPersonalExpenses([tx]), 0, "'Ajuste manual de saldo' como expense no debe contar como gasto mensual");

  console.log("'Ajuste manual de saldo' (expense) no cuenta: 3/3 aserciones pasadas.");
}

function runLabelsWithOuterWhitespaceStillExcludedTest() {
  const tx1 = baseTx({ id: "tx-4", type: "expense", title: "  Saldo inicial  ", amount: 100000 });
  const tx2 = baseTx({ id: "tx-5", type: "expense", title: "\tAjuste manual de saldo\n", amount: 30000 });
  assert.equal(isTechnicalBalanceMovement(tx1), true, "espacios externos alrededor de 'Saldo inicial' no deben burlar la exclusión");
  assert.equal(isTechnicalBalanceMovement(tx2), true, "espacios externos alrededor de 'Ajuste manual de saldo' no deben burlar la exclusión");
  assert.equal(computeNetPersonalExpenses([tx1, tx2]), 0);

  console.log("Etiquetas con espacios externos también se excluyen (paridad trim de Android): 3/3 aserciones pasadas.");
}

// ==========================================
// Caso combinado exacto pedido: gasto $120.000 + ajuste técnico expense
// $30.000 + reembolso incoming relacionado $60.000 -> neto $60.000, NUNCA
// $90.000 (que sería el resultado si el ajuste técnico se sumara).
// ==========================================
function runCombinedCaseNeverCountsTechnicalAdjustmentTest() {
  const expense = baseTx({ id: "tx-expense", type: "expense", title: "Adelanto Hogar", amount: 120000, categoryId: "cat-hogar" });
  const technicalAdjustment = baseTx({ id: "tx-adjustment", type: "expense", title: "Ajuste manual de saldo", amount: 30000 });
  const reimbursement = baseTx({
    id: "tx-reimb",
    type: "reimbursement",
    title: "Reembolso recibido",
    amount: 60000,
    categoryId: "cat-hogar",
    relatedDebtId: "debt-1",
    reimbursementDirection: "incoming",
  });

  const periodTxs = [expense, technicalAdjustment, reimbursement];
  const net = computeNetPersonalExpenses(periodTxs);
  assert.equal(net, 60000, `el neto debe ser 60.000 (120.000 - 60.000), nunca 90.000; obtenido: ${net}`);

  const breakdown = buildExpenseCategoryBreakdown(periodTxs, categories);
  assert.equal(breakdown.length, 1);
  assert.equal(breakdown[0].categoryId, "cat-hogar");
  assert.equal(breakdown[0].amount, 60000, "el desglose por categoría no debe incorporar el ajuste técnico");

  console.log("Caso combinado (gasto + ajuste técnico + reembolso) da 60.000, nunca 90.000: 3/3 aserciones pasadas.");
}

// ==========================================
// No regresión: reembolso incoming relacionado sigue reduciendo; outgoing o
// sin relatedDebtId no reduce nada.
// ==========================================
function runReimbursementRegressionTest() {
  const expense = baseTx({ id: "tx-e", type: "expense", title: "Gasto", amount: 100000, categoryId: "cat-hogar" });

  const incoming = baseTx({
    id: "tx-in",
    type: "reimbursement",
    amount: 40000,
    categoryId: "cat-hogar",
    relatedDebtId: "debt-1",
    reimbursementDirection: "incoming",
  });
  assert.equal(computeNetPersonalExpenses([expense, incoming]), 60000, "incoming con relatedDebtId debe seguir reduciendo el gasto");

  const outgoing = baseTx({
    id: "tx-out",
    type: "reimbursement",
    amount: 40000,
    relatedDebtId: "debt-2",
    reimbursementDirection: "outgoing",
  });
  assert.equal(computeNetPersonalExpenses([expense, outgoing]), 100000, "outgoing no debe reducir nada");

  const noDebt = baseTx({
    id: "tx-nodebt",
    type: "reimbursement",
    amount: 40000,
    reimbursementDirection: "incoming",
    relatedDebtId: null,
  });
  assert.equal(computeNetPersonalExpenses([expense, noDebt]), 100000, "incoming sin relatedDebtId no debe reducir nada");

  console.log("No regresión de reembolsos (incoming reduce, outgoing/sin deuda no reducen): 3/3 aserciones pasadas.");
}

// ==========================================
// Detalle de categoría: no debe listar el ajuste técnico (mismo filtro que
// personal-views.tsx usa para el detalle de categoría).
// ==========================================
function runCategoryDetailExcludesTechnicalAdjustmentTest() {
  const expense = baseTx({ id: "tx-e", type: "expense", title: "Gasto", amount: 100000, categoryId: "cat-hogar" });
  const technicalAdjustment = baseTx({ id: "tx-adj", type: "expense", title: "Ajuste manual de saldo", amount: 20000, categoryId: "cat-hogar" });
  const reimbursement = baseTx({
    id: "tx-r",
    type: "reimbursement",
    amount: 30000,
    categoryId: "cat-hogar",
    relatedDebtId: "debt-1",
    reimbursementDirection: "incoming",
  });

  const periodTxs = [expense, technicalAdjustment, reimbursement];

  // Réplica exacta del filtro usado en personal-views.tsx para el detalle de
  // categoría (isCountableMonthlyExpense en vez de type === "expense").
  const categoryDetailFilter = (transactions: Transaction[], categoryId: string) =>
    transactions.filter(
      (tx) =>
        (isCountableMonthlyExpense(tx) ||
          (tx.type === "reimbursement" && tx.reimbursementDirection === "incoming" && !!tx.relatedDebtId)) &&
        tx.categoryId === categoryId
    );

  const detail = categoryDetailFilter(periodTxs, "cat-hogar");
  assert.equal(detail.length, 2, "el detalle debe incluir el gasto real y el reembolso, pero no el ajuste técnico");
  assert.ok(detail.some((tx) => tx.id === "tx-e"));
  assert.ok(detail.some((tx) => tx.id === "tx-r"));
  assert.ok(!detail.some((tx) => tx.id === "tx-adj"), "el ajuste técnico no debe aparecer en el detalle de categoría");

  console.log("Detalle de categoría excluye el ajuste técnico: 4/4 aserciones pasadas.");
}

function runStructuralSharedFormulaTest() {
  const personalViews = readFileSync(
    path.join(__dirname, "..", "..", "src", "features", "dashboard", "components", "personal-views.tsx"),
    "utf8"
  );
  const viewModel = readFileSync(
    path.join(__dirname, "..", "..", "src", "features", "dashboard", "lib", "personal-view-model.ts"),
    "utf8"
  );

  assert.ok(viewModel.includes("export const isTechnicalBalanceMovement"), "debe existir la función pura isTechnicalBalanceMovement");
  assert.ok(viewModel.includes("export const isCountableMonthlyExpense"), "debe existir la función pura isCountableMonthlyExpense");
  assert.ok(
    personalViews.includes("isCountableMonthlyExpense"),
    "personal-views.tsx debe reutilizar isCountableMonthlyExpense en los filtros de detalle de categoría, no reimplementar la regla"
  );
  assert.ok(
    !personalViews.match(/\(tx\.type === "expense" \|\| isIncomingDebtReimbursement\(tx\)\)/),
    "no debe quedar el filtro antiguo basado solo en type === 'expense' sin excluir ajustes técnicos"
  );

  console.log("Contrato estructural (función compartida reutilizada, sin fórmula divergente): 3/3 aserciones pasadas.");
}

runNormalExpenseCountsTest();
runInitialBalanceExpenseDoesNotCountTest();
runManualAdjustmentExpenseDoesNotCountTest();
runLabelsWithOuterWhitespaceStillExcludedTest();
runCombinedCaseNeverCountsTechnicalAdjustmentTest();
runReimbursementRegressionTest();
runCategoryDetailExcludesTechnicalAdjustmentTest();
runStructuralSharedFormulaTest();

console.log("OK technical-balance-movement-exclusion");
