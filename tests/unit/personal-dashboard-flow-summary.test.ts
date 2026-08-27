import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { calculatePersonalFlowSummary } from "../../src/features/movements/lib/personal-month-view-model";

console.log("Running unit tests for personal-dashboard-flow-summary.test.ts...");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

export const runPersonalDashboardFlowSummaryTests = (): void => {
  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => void) => {
    try {
      fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (error) {
      failed++;
      console.error(`  ✗ ${name}`);
      console.error(error);
    }
  };

  test("WA-DASH-FLOW-001: Ingresos mayores que gastos produce cálculo proporcional seguro, escala independiente y balance positivo", () => {
    const summary = calculatePersonalFlowSummary({
      income: 300_000,
      expense: 100_000,
      periodLabel: "agosto de 2026",
    });

    assert.equal(summary.income, 300_000);
    assert.equal(summary.expense, 100_000);
    assert.equal(summary.difference, 200_000);
    assert.equal(summary.totalFlow, 400_000);
    assert.equal(summary.maxFlow, 300_000);
    assert.equal(summary.incomeScalePercent, 100);
    assert.ok(Math.abs(summary.expenseScalePercent - 33.333) < 0.1);
    assert.equal(summary.incomeSharePercent, 75);
    assert.equal(summary.expenseSharePercent, 25);
    assert.equal(summary.incomeSharePercent + summary.expenseSharePercent, 100);
    assert.equal(summary.isBalanced, false);
    assert.equal(summary.isEmpty, false);
    assert.ok(summary.accessibleLabel.includes("agosto de 2026"));
    assert.ok(summary.accessibleLabel.includes("ingresos"));
    assert.ok(summary.accessibleLabel.includes("gastos"));
  });

  test("WA-DASH-FLOW-002: Gastos mayores que ingresos produce escala 100% en gastos y proporcional en ingresos", () => {
    const summary = calculatePersonalFlowSummary({
      income: 100_000,
      expense: 300_000,
      periodLabel: "agosto de 2026",
    });

    assert.equal(summary.income, 100_000);
    assert.equal(summary.expense, 300_000);
    assert.equal(summary.difference, -200_000);
    assert.equal(summary.totalFlow, 400_000);
    assert.equal(summary.maxFlow, 300_000);
    assert.ok(Math.abs(summary.incomeScalePercent - 33.333) < 0.1);
    assert.equal(summary.expenseScalePercent, 100);
    assert.equal(summary.incomeSharePercent, 25);
    assert.equal(summary.expenseSharePercent, 75);
    assert.equal(summary.incomeSharePercent + summary.expenseSharePercent, 100);
    assert.equal(summary.isBalanced, false);
    assert.equal(summary.isEmpty, false);
  });

  test("WA-DASH-FLOW-003: Ingresos y gastos iguales genera distribución 50/50, escala 100/100, balance cero y equilibrio", () => {
    const summary = calculatePersonalFlowSummary({
      income: 500_000,
      expense: 500_000,
      periodLabel: "agosto de 2026",
    });

    assert.equal(summary.difference, 0);
    assert.equal(summary.incomeScalePercent, 100);
    assert.equal(summary.expenseScalePercent, 100);
    assert.equal(summary.incomeSharePercent, 50);
    assert.equal(summary.expenseSharePercent, 50);
    assert.equal(summary.incomeSharePercent + summary.expenseSharePercent, 100);
    assert.equal(summary.isBalanced, true);
    assert.equal(summary.isEmpty, false);
  });

  test("WA-DASH-FLOW-004: Solo ingresos genera escala 100% ingresos y 0% gastos", () => {
    const summary = calculatePersonalFlowSummary({
      income: 1_200_000,
      expense: 0,
      periodLabel: "agosto de 2026",
    });

    assert.equal(summary.incomeScalePercent, 100);
    assert.equal(summary.expenseScalePercent, 0);
    assert.equal(summary.incomeSharePercent, 100);
    assert.equal(summary.expenseSharePercent, 0);
    assert.equal(summary.difference, 1_200_000);
    assert.equal(summary.isEmpty, false);
  });

  test("WA-DASH-FLOW-005: Solo gastos genera escala 0% ingresos y 100% gastos", () => {
    const summary = calculatePersonalFlowSummary({
      income: 0,
      expense: 450_000,
      periodLabel: "agosto de 2026",
    });

    assert.equal(summary.incomeScalePercent, 0);
    assert.equal(summary.expenseScalePercent, 100);
    assert.equal(summary.incomeSharePercent, 0);
    assert.equal(summary.expenseSharePercent, 100);
    assert.equal(summary.difference, -450_000);
    assert.equal(summary.isEmpty, false);
  });

  test("WA-DASH-FLOW-006: Mes sin ingresos ni gastos activa estado vacío con escala cero", () => {
    const summary = calculatePersonalFlowSummary({
      income: 0,
      expense: 0,
      periodLabel: "agosto de 2026",
    });

    assert.equal(summary.totalFlow, 0);
    assert.equal(summary.maxFlow, 0);
    assert.equal(summary.incomeScalePercent, 0);
    assert.equal(summary.expenseScalePercent, 0);
    assert.equal(summary.incomeSharePercent, 0);
    assert.equal(summary.expenseSharePercent, 0);
    assert.equal(summary.difference, 0);
    assert.equal(summary.isEmpty, true);
    assert.equal(summary.isBalanced, true);
    assert.ok(summary.accessibleLabel.includes("sin ingresos ni gastos"));
  });

  test("WA-DASH-FLOW-007: Invariantes matemáticas contra entradas anómalas (sin NaN, sin divisiones por cero)", () => {
    const anomalousCases = [
      { income: 0, expense: 0 },
      { income: 1, expense: 999_999 },
      { income: 999_999, expense: 1 },
      { income: 12345.67, expense: 76543.21 },
    ];

    for (const entry of anomalousCases) {
      const summary = calculatePersonalFlowSummary({
        income: entry.income,
        expense: entry.expense,
        periodLabel: "test",
      });

      assert.equal(Number.isNaN(summary.incomeSharePercent), false);
      assert.equal(Number.isNaN(summary.expenseSharePercent), false);
      assert.equal(Number.isNaN(summary.incomeScalePercent), false);
      assert.equal(Number.isNaN(summary.expenseScalePercent), false);
      assert.equal(Number.isFinite(summary.incomeSharePercent), true);
      assert.equal(Number.isFinite(summary.expenseSharePercent), true);
      assert.equal(Number.isFinite(summary.incomeScalePercent), true);
      assert.equal(Number.isFinite(summary.expenseScalePercent), true);
      assert.ok(summary.incomeSharePercent >= 0 && summary.incomeSharePercent <= 100);
      assert.ok(summary.expenseSharePercent >= 0 && summary.expenseSharePercent <= 100);
      assert.ok(summary.incomeScalePercent >= 0 && summary.incomeScalePercent <= 100);
      assert.ok(summary.expenseScalePercent >= 0 && summary.expenseScalePercent <= 100);

      if (summary.totalFlow > 0) {
        assert.equal(
          Math.round(summary.incomeSharePercent + summary.expenseSharePercent),
          100,
          "La suma de participaciones debe ser exactamente 100%",
        );
      }
    }
  });

  test("WA-DASH-FLOW-008: [Estructural] Hero card presenta Balance del mes como dato protagonista y barras comparativas independientes", () => {
    const homeViewSource = readSource("features/movements/components/personal-home-view.tsx");

    assert.equal(
      homeViewSource.includes("Diferencia del mes"),
      false,
      "No debe existir el encabezado 'Diferencia del mes'",
    );
    assert.ok(
      homeViewSource.includes("Resumen de {periodLabel}"),
      "Debe usar el encabezado contextual discreto 'Resumen de [mes]'",
    );
    assert.ok(
      homeViewSource.includes('role="img"'),
      "Las barras de flujo deben tener role='img' descriptivo",
    );
    assert.equal(
      homeViewSource.includes('role="progressbar"'),
      false,
      "No debe tener role='progressbar' al ser una comparación de dos valores de flujo",
    );
    assert.equal(
      homeViewSource.includes("aria-valuenow"),
      false,
      "No debe tener atributos propios de progressbar como aria-valuenow",
    );
    assert.ok(
      homeViewSource.includes("Balance del mes"),
      "Debe mostrar 'Balance del mes' como KPI protagonista",
    );
    assert.ok(
      homeViewSource.includes("En equilibrio"),
      "Debe soportar el indicador 'En equilibrio' cuando el balance es cero",
    );
    assert.ok(
      homeViewSource.includes("incomeScalePercent"),
      "Debe usar escala comparativa para ingresos",
    );
    assert.ok(
      homeViewSource.includes("expenseScalePercent"),
      "Debe usar escala comparativa para gastos",
    );
    assert.ok(
      homeViewSource.includes("lg:grid-cols-12") && homeViewSource.includes("lg:col-span-5") && homeViewSource.includes("lg:col-span-7"),
      "Debe usar composición asimétrica en 2 zonas con columnas 5 (Balance) y 7 (Ingresos/Gastos apilados)",
    );
    assert.ok(
      homeViewSource.includes("Gastaste $") && homeViewSource.includes("más de lo que"),
      "Debe incluir insight contextual bajo el Balance",
    );
  });

  console.log(`\nTests for personal-dashboard-flow-summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runPersonalDashboardFlowSummaryTests();
