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
  share = 0,
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

  test("WA-CAT-CHART-002: Ignora categorías con importe cero, negativo, NaN o Infinity", () => {
    const items = [
      createItem("c1", "Comida", 100_000),
      createItem("c2", "Cero", 0),
      createItem("c3", "Negativo", -50_000),
      createItem("c4", "NaN", Number.NaN),
      createItem("c5", "Infinity", Number.POSITIVE_INFINITY),
    ];
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "c1");
    assert.equal(result[0].amount, 100_000);
    assert.equal(result[0].share, 100);
  });

  test("WA-CAT-CHART-003: Entrada desordenada se ordena automáticamente de mayor a menor", () => {
    const items = [
      createItem("c1", "Pequeño", 50_000),
      createItem("c2", "Grande", 500_000),
      createItem("c3", "Medio", 200_000),
    ];
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result.length, 3);
    assert.equal(result[0].name, "Grande");
    assert.equal(result[0].amount, 500_000);
    assert.equal(result[1].name, "Medio");
    assert.equal(result[1].amount, 200_000);
    assert.equal(result[2].name, "Pequeño");
    assert.equal(result[2].amount, 50_000);
  });

  test("WA-CAT-CHART-004: No muta el arreglo de entrada", () => {
    const items = Object.freeze([
      createItem("c1", "Cat 1", 100_000),
      createItem("c2", "Cat 2", 200_000),
    ]);
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result[0].name, "Cat 2");
    assert.equal(items[0].name, "Cat 1");
  });

  test("WA-CAT-CHART-005: Una sola categoría conserva datos y 100% de participación calculada", () => {
    const items = [createItem("c1", "Salario", 3_000_000, 0, "#10B981", "salary")];
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Salario");
    assert.equal(result[0].amount, 3_000_000);
    assert.equal(result[0].share, 100);
    assert.equal(result[0].color, "#10B981");
    assert.equal(result[0].iconKey, "salary");
  });

  test("WA-CAT-CHART-006: Hasta 6 categorías se muestran completas sin crear 'Otras'", () => {
    const items = [
      createItem("c1", "Cat 1", 600_000),
      createItem("c2", "Cat 2", 400_000),
      createItem("c3", "Cat 3", 300_000),
      createItem("c4", "Cat 4", 300_000),
      createItem("c5", "Cat 5", 200_000),
      createItem("c6", "Cat 6", 200_000),
    ];
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result.length, 6);
    assert.equal(result.some((i) => i.name === "Otras"), false);
    assert.equal(result[0].name, "Cat 1");
    assert.equal(result[5].name, "Cat 6");
  });

  test("WA-CAT-CHART-007: 7 o más categorías agrupa a partir de la 7ma en 'Otras' con suma y porcentaje exactos", () => {
    const items = [
      createItem("c1", "Cat 1", 1_000_000),
      createItem("c2", "Cat 2", 300_000),
      createItem("c3", "Cat 3", 200_000),
      createItem("c4", "Cat 4", 100_000),
      createItem("c5", "Cat 5", 100_000),
      createItem("c6", "Cat 6", 100_000),
      createItem("c7", "Cat 7", 80_000),
      createItem("c8", "Cat 8", 60_000),
      createItem("c9", "Cat 9", 40_000),
      createItem("c10", "Cat 10", 20_000),
    ];
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result.length, 7); // 6 top + Otras
    assert.equal(result[0].name, "Cat 1");
    assert.equal(result[5].name, "Cat 6");

    const otherItem = result[6];
    assert.equal(otherItem.id, "other");
    assert.equal(otherItem.name, "Otras");
    assert.equal(otherItem.iconKey, "other");
    assert.equal(otherItem.color, "#94A3B8");
    assert.equal(otherItem.amount, 80_000 + 60_000 + 40_000 + 20_000); // 200_000
    // Total sum = 2_000_000. 200_000 / 2_000_000 = 10%
    assert.equal(otherItem.share, 10);
  });

  test("WA-CAT-CHART-008: Invariantes numéricas (todos los porcentajes son enteros finitos entre 0 y 100)", () => {
    const items = [
      createItem("c1", "Cat 1", 333_333),
      createItem("c2", "Cat 2", 333_333),
      createItem("c3", "Cat 3", 333_334),
    ];
    const result = buildDashboardCategoryChartData(items);
    for (const item of result) {
      assert.equal(Number.isNaN(item.share), false);
      assert.equal(Number.isFinite(item.share), true);
      assert.equal(Number.isInteger(item.share), true);
      assert.ok(item.share >= 0 && item.share <= 100);
      assert.ok(item.amount >= 0);
    }
  });

  test("WA-CAT-CHART-009: [Estructural] PersonalCategoryChart maneja masked, sin truncate y con 3 zonas geométricas en desktop", () => {
    const chartSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-category-chart.tsx"),
      "utf8",
    );

    // 1. Privacidad de montos (masked)
    assert.ok(
      chartSource.includes("masked"),
      "PersonalCategoryChartProps debe incluir masked",
    );
    assert.ok(
      chartSource.includes("monto oculto"),
      "aria-label debe ocultar cifras cuando masked sea true",
    );
    assert.ok(
      chartSource.includes("masked={masked}"),
      "Debe pasar masked={masked} al componente Amount",
    );

    // 2. Eliminación de truncate en nombres
    assert.equal(
      chartSource.includes("truncate font-medium"),
      false,
      "No debe usar truncate en los nombres de categoría en móvil",
    );
    assert.equal(
      chartSource.includes("truncate text-xs"),
      false,
      "No debe usar truncate en los nombres de categoría en escritorio",
    );
    assert.ok(
      chartSource.includes("break-words"),
      "Los nombres deben usar break-words para wrapping controlado",
    );

    // 3. Geometría de 3 zonas en escritorio
    assert.ok(
      chartSource.includes("hidden md:flex"),
      "Debe incluir contenedor de barras verticales para escritorio (>= md)",
    );
    assert.ok(
      chartSource.includes("min-h-[120px]") || chartSource.includes("flex-1"),
      "El área de trazado vertical debe ser flexible y acotada",
    );
    assert.ok(
      chartSource.includes("motion-safe:transition-[height]"),
      "Las barras de escritorio deben transicionar altura de forma motion-safe",
    );

    // 4. Móvil horizontal
    assert.ok(
      chartSource.includes("md:hidden"),
      "Debe incluir contenedor de barras horizontales para móvil (< md)",
    );
    assert.ok(
      chartSource.includes("motion-safe:transition-[width]"),
      "Las barras de móvil deben transicionar ancho de forma motion-safe",
    );

    // 5. Sin scroll horizontal
    assert.equal(
      chartSource.includes("overflow-x-auto"),
      false,
      "No debe usar overflow-x-auto que force scroll horizontal",
    );
  });

  test("WA-CAT-CHART-010: [Integración] MplusHomeView pasa masked={masked} a PersonalCategoryChart y mantiene inicio simplificado", () => {
    const homeViewSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-home-view.tsx"),
      "utf8",
    );
    const shellSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "components", "layout", "dashboard-shell.tsx"),
      "utf8",
    );

    // 1. Integración de gráfico con masked
    assert.ok(
      homeViewSource.includes("<PersonalCategoryChart"),
      "MplusHomeView debe renderizar PersonalCategoryChart",
    );
    assert.ok(
      homeViewSource.includes("masked={masked}"),
      "MplusHomeView debe pasar masked={masked} a PersonalCategoryChart",
    );

    // 2. Selector accesible con aria-pressed
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

    // 3. Ausencia de cards viejas y drag & drop
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

    // 4. Eliminación de 'Editar tablero' en dashboard-shell.tsx
    assert.equal(
      shellSource.includes("Editar tablero"),
      false,
      "dashboard-shell.tsx no debe tener el botón 'Editar tablero'",
    );
  });

  test("WA-CAT-CHART-011: [Estructural] PersonalCategoryChart adapta el ancho en escritorio cuando hay pocas categorías (<= 3)", () => {
    const chartSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-category-chart.tsx"),
      "utf8",
    );

    // 1. Condición para pocas categorías (<= 3)
    assert.ok(
      chartSource.includes("items.length <= 3"),
      "Debe incluir condición para detectar <= 3 categorías en modo compacto",
    );

    // 2. Alineación a la izquierda (justify-start) y ancho controlado en modo compacto
    assert.ok(
      chartSource.includes("justify-start"),
      "En modo compacto debe alinear al inicio (justify-start) evitando distribución forzada a extremos",
    );
    assert.ok(
      chartSource.includes("w-28") || chartSource.includes("w-32") || chartSource.includes("max-w-[140px]"),
      "En modo compacto las columnas deben tener un ancho controlado y moderado",
    );

    // 3. Distribución comparativa amplia cuando hay 4 o más categorías
    assert.ok(
      chartSource.includes("justify-between"),
      "En modo normal (4-7 categorías) debe usar distribución comparativa amplia (justify-between)",
    );
    assert.ok(
      chartSource.includes("flex-1 min-w-0"),
      "En modo normal las columnas deben expandirse simétricamente con flex-1 min-w-0",
    );
  });

  console.log(`\nTests for personal-dashboard-category-chart: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runPersonalDashboardCategoryChartTests();
