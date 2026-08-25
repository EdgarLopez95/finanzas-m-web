import assert from "node:assert/strict";
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

  console.log(`\nTests for personal-dashboard-category-chart: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runPersonalDashboardCategoryChartTests();
