import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildDashboardCategoryChartData,
  type CategoryBreakdownItem,
  type DashboardCategoryChartItem,
} from "../../src/features/movements/lib/personal-month-view-model";

console.log("Running unit tests for personal-dashboard-category-chart.test.ts...");

const createItem = (
  categoryId: string,
  name: string,
  amount: number,
  share: number,
  color = "#22C55E",
  iconKey = "groceries",
): CategoryBreakdownItem => ({
  categoryId,
  name,
  amount,
  share,
  color,
  iconKey,
});

export const runPersonalDashboardCategoryChartTests = (): void => {
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

  test("WA-CAT-CHART-001: Entrada vacía retorna arreglo vacío", () => {
    const result = buildDashboardCategoryChartData([]);
    assert.deepEqual(result, []);
  });

  test("WA-CAT-CHART-002: Ignora categorías con importe cero", () => {
    const items = [
      createItem("c1", "Comida", 100_000, 100),
      createItem("c2", "Transporte", 0, 0),
    ];
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "c1");
    assert.equal(result[0].amount, 100_000);
  });

  test("WA-CAT-CHART-003: Una sola categoría conserva datos y 100% de participación", () => {
    const items = [createItem("c1", "Salario", 3_000_000, 100, "#10B981", "salary")];
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Salario");
    assert.equal(result[0].amount, 3_000_000);
    assert.equal(result[0].share, 100);
    assert.equal(result[0].color, "#10B981");
    assert.equal(result[0].iconKey, "salary");
  });

  test("WA-CAT-CHART-004: Hasta 6 categorías se muestran completas sin crear 'Otras'", () => {
    const items = [
      createItem("c1", "Cat 1", 600_000, 30),
      createItem("c2", "Cat 2", 400_000, 20),
      createItem("c3", "Cat 3", 300_000, 15),
      createItem("c4", "Cat 4", 300_000, 15),
      createItem("c5", "Cat 5", 200_000, 10),
      createItem("c6", "Cat 6", 200_000, 10),
    ];
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result.length, 6);
    assert.equal(result.some((i) => i.name === "Otras"), false);
    assert.equal(result[0].name, "Cat 1");
    assert.equal(result[5].name, "Cat 6");
  });

  test("WA-CAT-CHART-005: 7 categorías agrupa la 7ma en 'Otras' con suma exacta de importe y porcentaje", () => {
    const items = [
      createItem("c1", "Cat 1", 700_000, 35),
      createItem("c2", "Cat 2", 500_000, 25),
      createItem("c3", "Cat 3", 300_000, 15),
      createItem("c4", "Cat 4", 200_000, 10),
      createItem("c5", "Cat 5", 100_000, 5),
      createItem("c6", "Cat 6", 100_000, 5),
      createItem("c7", "Cat 7", 100_000, 5),
    ];
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result.length, 7); // 6 top + Otras
    assert.equal(result[0].name, "Cat 1");
    assert.equal(result[5].name, "Cat 6");
    assert.equal(result[6].id, "other");
    assert.equal(result[6].name, "Otras");
    assert.equal(result[6].amount, 100_000);
    assert.equal(result[6].share, 5);
    assert.equal(result[6].iconKey, "other");
  });

  test("WA-CAT-CHART-006: Múltiples categorías (>7) suma exactamente todas las sobrantes en 'Otras'", () => {
    const items = [
      createItem("c1", "Cat 1", 1_000_000, 50),
      createItem("c2", "Cat 2", 300_000, 15),
      createItem("c3", "Cat 3", 200_000, 10),
      createItem("c4", "Cat 4", 100_000, 5),
      createItem("c5", "Cat 5", 100_000, 5),
      createItem("c6", "Cat 6", 100_000, 5),
      createItem("c7", "Cat 7", 80_000, 4),
      createItem("c8", "Cat 8", 60_000, 3),
      createItem("c9", "Cat 9", 40_000, 2),
      createItem("c10", "Cat 10", 20_000, 1),
    ];
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result.length, 7);
    const otherItem = result[6];
    assert.equal(otherItem.id, "other");
    assert.equal(otherItem.name, "Otras");
    assert.equal(otherItem.amount, 80_000 + 60_000 + 40_000 + 20_000); // 200_000
    assert.equal(otherItem.share, 10); // 4 + 3 + 2 + 1 = 10%
  });

  test("WA-CAT-CHART-007: Invariantes numéricas (no NaN, porcentajes finitos >= 0)", () => {
    const items = [
      createItem("c1", "Cat 1", 100_000, 50),
      createItem("c2", "Cat 2", 100_000, 50),
    ];
    const result = buildDashboardCategoryChartData(items);
    for (const item of result) {
      assert.equal(Number.isNaN(item.share), false);
      assert.equal(Number.isFinite(item.share), true);
      assert.ok(item.share >= 0 && item.share <= 100);
      assert.ok(item.amount >= 0);
    }
  });

  test("WA-CAT-CHART-008: [Estructural] PersonalCategoryChart renderiza barras verticales en desktop y horizontales en móvil sin overflow-x", () => {
    const chartSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-category-chart.tsx"),
      "utf8",
    );

    // 1. Desktop vertical
    assert.ok(
      chartSource.includes("hidden md:flex"),
      "Debe incluir contenedor de barras verticales para escritorio (>= md)",
    );
    assert.ok(
      chartSource.includes("motion-safe:transition-[height]"),
      "Las barras de escritorio deben transicionar altura de forma motion-safe",
    );

    // 2. Mobile horizontal
    assert.ok(
      chartSource.includes("md:hidden"),
      "Debe incluir contenedor de barras horizontales para móvil (< md)",
    );
    assert.ok(
      chartSource.includes("motion-safe:transition-[width]"),
      "Las barras de móvil deben transicionar ancho de forma motion-safe",
    );

    // 3. Accesibilidad
    assert.ok(
      chartSource.includes('role="img"'),
      "Cada barra debe tener semántica de role='img'",
    );
    assert.ok(
      chartSource.includes("aria-label="),
      "Cada barra debe incluir descripción completa accesible",
    );

    // 4. Sin scroll horizontal
    assert.equal(
      chartSource.includes("overflow-x-auto"),
      false,
      "No debe usar overflow-x-auto que force scroll horizontal",
    );
  });

  test("WA-CAT-CHART-009: [Integración] MplusHomeView integra PersonalCategoryChart y elimina cards secundarias y edición de tablero", () => {
    const homeViewSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-home-view.tsx"),
      "utf8",
    );
    const shellSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "components", "layout", "dashboard-shell.tsx"),
      "utf8",
    );

    // 1. Integración de gráfico y selector en MplusHomeView
    assert.ok(
      homeViewSource.includes("<PersonalCategoryChart"),
      "MplusHomeView debe renderizar PersonalCategoryChart",
    );
    assert.ok(
      homeViewSource.includes('aria-pressed={breakdownMode === "expense"}'),
      "Debe incluir selector accesible para Gastos con aria-pressed",
    );
    assert.ok(
      homeViewSource.includes('aria-pressed={breakdownMode === "income"}'),
      "Debe incluir selector accesible para Ingresos con aria-pressed",
    );
    assert.ok(
      homeViewSource.includes('useState<"expense" | "income">("expense")'),
      "El selector debe iniciar por defecto en 'expense'",
    );

    // 2. Eliminación de cards secundarias y drag & drop del Inicio
    assert.equal(
      homeViewSource.includes("MPLUS_BOARD_CARDS"),
      false,
      "No debe existir la cuadrícula de cards reordenables MPLUS_BOARD_CARDS",
    );
    assert.equal(
      homeViewSource.includes("PersonalRecentMovementRow"),
      false,
      "No debe renderizar fila de movimientos recientes en el Inicio",
    );
    assert.equal(
      homeViewSource.includes("AccountIcon"),
      false,
      "No debe renderizar lista de cuentas en el Inicio",
    );
    assert.equal(
      homeViewSource.includes("isEditingBoard"),
      false,
      "No debe contener estado ni UI de edición de tablero en personal-home-view.tsx",
    );

    // 3. Eliminación de 'Editar tablero' en dashboard-shell.tsx
    assert.equal(
      shellSource.includes("Editar tablero"),
      false,
      "dashboard-shell.tsx no debe tener el botón 'Editar tablero'",
    );
  });

  console.log(`\nTests for personal-dashboard-category-chart: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runPersonalDashboardCategoryChartTests();
