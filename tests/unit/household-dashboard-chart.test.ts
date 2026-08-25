import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildHouseholdExpenseChartData,
  buildHouseholdIncomeMemberChartData,
  calculateHouseholdFlowSummary,
} from "../../src/features/household/lib/household-dashboard-view-model";
import { UNCLASSIFIED_HOUSEHOLD_CATEGORY_KEY } from "../../src/lib/mplus/derived";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runHouseholdDashboardChartTests = () => {
  console.log("Running unit tests for household-dashboard-chart.test.ts...");
  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => void) => {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (error) {
      console.error(`  ✗ ${name}`);
      console.error(error);
      failed++;
    }
  };

  // --- Bloque 1: calculateHouseholdFlowSummary ---

  test("WA-HOU-DASH-001: Ingresos mayores que gastos produce cálculo proporcional seguro y balance positivo", () => {
    const summary = calculateHouseholdFlowSummary({
      income: 3_000_000,
      expense: 1_000_000,
      periodLabel: "Agosto 2026",
    });

    assert.equal(summary.income, 3_000_000);
    assert.equal(summary.expense, 1_000_000);
    assert.equal(summary.difference, 2_000_000);
    assert.equal(summary.totalFlow, 4_000_000);
    assert.equal(summary.incomeSharePercent, 75);
    assert.equal(summary.expenseSharePercent, 25);
    assert.equal(summary.isBalanced, false);
    assert.equal(summary.isEmpty, false);
    assert.ok(summary.accessibleLabel.includes("75% ingresos"));
    assert.ok(summary.accessibleLabel.includes("25% gastos"));
  });

  test("WA-HOU-DASH-002: Gastos mayores que ingresos produce segmento de gasto mayor y balance negativo", () => {
    const summary = calculateHouseholdFlowSummary({
      income: 1_000_000,
      expense: 3_000_000,
      periodLabel: "Agosto 2026",
    });

    assert.equal(summary.difference, -2_000_000);
    assert.equal(summary.incomeSharePercent, 25);
    assert.equal(summary.expenseSharePercent, 75);
  });

  test("WA-HOU-DASH-003: Ingresos y gastos iguales genera distribución 50/50 y estado en equilibrio", () => {
    const summary = calculateHouseholdFlowSummary({
      income: 2_000_000,
      expense: 2_000_000,
      periodLabel: "Agosto 2026",
    });

    assert.equal(summary.difference, 0);
    assert.equal(summary.incomeSharePercent, 50);
    assert.equal(summary.expenseSharePercent, 50);
    assert.equal(summary.isBalanced, true);
  });

  test("WA-HOU-DASH-004: Solo ingresos genera barra 100% ingresos y 0% gastos", () => {
    const summary = calculateHouseholdFlowSummary({
      income: 1_500_000,
      expense: 0,
      periodLabel: "Agosto 2026",
    });

    assert.equal(summary.incomeSharePercent, 100);
    assert.equal(summary.expenseSharePercent, 0);
  });

  test("WA-HOU-DASH-005: Solo gastos genera barra 0% ingresos y 100% gastos", () => {
    const summary = calculateHouseholdFlowSummary({
      income: 0,
      expense: 1_500_000,
      periodLabel: "Agosto 2026",
    });

    assert.equal(summary.incomeSharePercent, 0);
    assert.equal(summary.expenseSharePercent, 100);
  });

  test("WA-HOU-DASH-006: Mes sin ingresos ni gastos activa estado vacío con barra neutral", () => {
    const summary = calculateHouseholdFlowSummary({
      income: 0,
      expense: 0,
      periodLabel: "Agosto 2026",
    });

    assert.equal(summary.totalFlow, 0);
    assert.equal(summary.isEmpty, true);
    assert.equal(summary.incomeSharePercent, 0);
    assert.equal(summary.expenseSharePercent, 0);
    assert.ok(summary.accessibleLabel.includes("Sin movimientos compartidos"));
  });

  test("WA-HOU-DASH-007: Invariantes matemáticas contra entradas anómalas (NaN, negativos, no finitos)", () => {
    const summary = calculateHouseholdFlowSummary({
      income: Number.NaN,
      expense: -1000,
      periodLabel: "Agosto 2026",
    });

    assert.equal(summary.income, 0);
    assert.equal(summary.expense, 0);
    assert.equal(summary.totalFlow, 0);
    assert.equal(summary.isEmpty, true);
  });

  // --- Bloque 2: buildHouseholdExpenseChartData ---

  test("WA-HOU-DASH-008: buildHouseholdExpenseChartData ordena descendentemente y preserva Por clasificar", () => {
    const rawExpenses = {
      cat_mercado: 500_000,
      cat_servicios: 200_000,
      [UNCLASSIFIED_HOUSEHOLD_CATEGORY_KEY]: 300_000,
    };

    const categoryMap = new Map([
      ["cat_mercado", { id: "cat_mercado", name: "Mercado", color: "#22C55E", iconKey: "groceries" }],
      ["cat_servicios", { id: "cat_servicios", name: "Servicios", color: "#3B82F6", iconKey: "home" }],
    ]);

    const result = buildHouseholdExpenseChartData(rawExpenses, categoryMap);
    assert.equal(result.length, 3);
    assert.equal(result[0].name, "Mercado");
    assert.equal(result[0].amount, 500_000);
    assert.equal(result[0].share, 50);

    assert.equal(result[1].name, "Por clasificar");
    assert.equal(result[1].amount, 300_000);
    assert.equal(result[1].share, 30);
    assert.equal(result[1].isUnclassified, true);
    assert.equal(result[1].color, "#94A3B8");

    assert.equal(result[2].name, "Servicios");
    assert.equal(result[2].amount, 200_000);
    assert.equal(result[2].share, 20);
  });

  test("WA-HOU-DASH-009: buildHouseholdExpenseChartData agrupa más de 6 categorías en Otras", () => {
    const rawExpenses: Record<string, number> = {
      c1: 1_000_000,
      c2: 800_000,
      c3: 600_000,
      c4: 400_000,
      c5: 300_000,
      c6: 200_000,
      c7: 100_000,
      c8: 50_000,
    };

    const categoryMap = new Map<string, { id: string; name: string; color: string; iconKey: string }>();
    for (let i = 1; i <= 8; i++) {
      categoryMap.set(`c${i}`, { id: `c${i}`, name: `Cat ${i}`, color: "#22C55E", iconKey: "groceries" });
    }

    const result = buildHouseholdExpenseChartData(rawExpenses, categoryMap);
    assert.equal(result.length, 7); // 6 top + Otras
    assert.equal(result[0].name, "Cat 1");
    assert.equal(result[5].name, "Cat 6");

    const otherItem = result[6];
    assert.equal(otherItem.id, "other");
    assert.equal(otherItem.name, "Otras");
    assert.equal(otherItem.amount, 150_000);
  });

  // --- Bloque 3: buildHouseholdIncomeMemberChartData ---

  test("WA-HOU-DASH-010: buildHouseholdIncomeMemberChartData agrupa por integrante (ownerId), no por categoría", () => {
    const movements = [
      { type: "income" as const, amount: 2_000_000, categoryId: "c1", householdCategoryId: null, ownerId: "user_a" },
      { type: "income" as const, amount: 1_000_000, categoryId: "c2", householdCategoryId: null, ownerId: "user_a" },
      { type: "income" as const, amount: 1_500_000, categoryId: "c1", householdCategoryId: null, ownerId: "user_b" },
      { type: "expense" as const, amount: 500_000, categoryId: "c1", householdCategoryId: null, ownerId: "user_a" },
    ];

    const memberMap = new Map([
      ["user_a", { userId: "user_a", displayName: "Felipe" }],
      ["user_b", { userId: "user_b", displayName: "Camila" }],
    ]);

    const result = buildHouseholdIncomeMemberChartData(movements, memberMap, "user_a");
    assert.equal(result.length, 2);

    // Felipe: 3_000_000 (67%), Camila: 1_500_000 (33%)
    assert.equal(result[0].id, "user_a");
    assert.equal(result[0].name, "Felipe");
    assert.equal(result[0].amount, 3_000_000);
    assert.equal(result[0].share, 67);

    assert.equal(result[1].id, "user_b");
    assert.equal(result[1].name, "Camila");
    assert.equal(result[1].amount, 1_500_000);
    assert.equal(result[1].share, 33);
  });

  // --- Bloque 4: Verificaciones Estructurales y de Accesibilidad ---

  test("WA-HOU-DASH-011: [Estructural] MplusHouseholdOverview elimina mini-cards viejas y renderiza 2 cards con selector y aviso integrado", () => {
    const overviewSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "household", "components", "mplus-household-overview.tsx"),
      "utf8",
    );

    // 1. Ausencia de cards viejas (grid 3 mini-cards, movimientos recientes en inicio)
    assert.equal(
      overviewSource.includes("Movimientos recientes"),
      false,
      "No debe renderizar 'Movimientos recientes' en el Inicio de Hogar",
    );
    assert.equal(
      overviewSource.includes("grid gap-6 sm:grid-cols-3"),
      false,
      "No debe contener el grid antiguo de tres mini-cards",
    );
    assert.equal(
      overviewSource.includes("grid gap-6 lg:grid-cols-2"),
      false,
      "No debe contener el grid antiguo de dos cards",
    );

    // 2. Selector accesible de Gastos e Ingresos
    assert.ok(
      overviewSource.includes('aria-pressed={breakdownMode === "expense"}'),
      "Debe incluir selector de Gastos con aria-pressed",
    );
    assert.ok(
      overviewSource.includes('aria-pressed={breakdownMode === "income"}'),
      "Debe incluir selector de Ingresos con aria-pressed",
    );
    assert.ok(
      overviewSource.includes('useState<"expense" | "income">("expense")'),
      "El selector debe iniciar por defecto en 'expense'",
    );

    // 3. Aviso integrado de Por clasificar
    assert.ok(
      overviewSource.includes("unclassifiedCount > 0"),
      "Debe condicionar el aviso a que existan gastos pendientes por clasificar",
    );
    assert.ok(
      overviewSource.includes("Clasificar gastos"),
      "Debe incluir botón accesible 'Clasificar gastos'",
    );

    // 4. Componentes y tokens de Hogar
    assert.ok(
      overviewSource.includes("HouseholdCard"),
      "Debe usar HouseholdCard",
    );
    assert.ok(
      overviewSource.includes("HouseholdAmount"),
      "Debe usar HouseholdAmount",
    );
    assert.equal(
      overviewSource.includes("FinanceCard"),
      false,
      "No debe mezclar FinanceCard de Personal en Hogar",
    );
    assert.equal(
      overviewSource.includes("--fm-"),
      false,
      "No debe contener tokens --fm-* en la vista de Hogar",
    );
  });

  test("WA-HOU-DASH-012: [Estructural] HouseholdCategoryChart es responsive, flexible en escritorio y respeta privacidad", () => {
    const chartSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "household", "components", "household-category-chart.tsx"),
      "utf8",
    );

    // 1. Privacidad (masked)
    assert.ok(
      chartSource.includes("masked"),
      "HouseholdCategoryChartProps debe incluir masked",
    );
    assert.ok(
      chartSource.includes("monto oculto"),
      "aria-label debe incluir 'monto oculto' cuando masked es true",
    );

    // 2. Responsive: móvil horizontal y escritorio vertical
    assert.ok(
      chartSource.includes("md:hidden"),
      "Debe contener vista de barras horizontales para móvil (< md)",
    );
    assert.ok(
      chartSource.includes("hidden md:flex"),
      "Debe contener vista de barras verticales para escritorio (>= md)",
    );

    // 3. Modo compacto en escritorio para <= 3 elementos
    assert.ok(
      chartSource.includes("items.length <= 3"),
      "Debe incluir condición de modo compacto para <= 3 elementos",
    );
    assert.ok(
      chartSource.includes("justify-start"),
      "En modo compacto debe alinear al inicio (justify-start)",
    );

    // 4. Altura flexible en escritorio
    assert.ok(
      chartSource.includes("flex-1 min-h-[220px]") || chartSource.includes("flex-1 min-h-0"),
      "Debe permitir expansión vertical con flex-1 min-h-[220px]",
    );
    assert.ok(
      chartSource.includes("min-h-[120px]"),
      "El área de trazado debe tener min-h-[120px]",
    );

    // 5. Sin overflow-x-auto ni truncate
    assert.equal(
      chartSource.includes("overflow-x-auto"),
      false,
      "No debe tener scroll horizontal",
    );
    assert.ok(
      chartSource.includes("break-words"),
      "Las etiquetas deben usar break-words",
    );
  });

  console.log(`\nTests for household-dashboard-chart: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runHouseholdDashboardChartTests();
