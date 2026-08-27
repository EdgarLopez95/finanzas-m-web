import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildHouseholdExpenseChartData,
  buildHouseholdIncomeCategoryChartData,
  buildHouseholdIncomeMemberChartData,
  buildHouseholdIncomeSections,
  calculateHouseholdFlowSummary,
  resolveHouseholdIncomeCategoryLabel,
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
    assert.equal(summary.maxFlow, 3_000_000);
    assert.equal(summary.incomeSharePercent, 75);
    assert.equal(summary.expenseSharePercent, 25);
    assert.equal(summary.incomeScalePercent, 100);
    assert.equal(Math.round(summary.expenseScalePercent), 33);
    assert.equal(summary.isBalanced, false);
    assert.equal(summary.isEmpty, false);
    assert.ok(summary.accessibleLabel.includes("ingresos $ 3.000.000"));
    assert.ok(summary.accessibleLabel.includes("gastos $ 1.000.000"));
  });

  test("WA-HOU-DASH-002: Gastos mayores que ingresos produce segmento de gasto mayor y balance negativo", () => {
    const summary = calculateHouseholdFlowSummary({
      income: 1_000_000,
      expense: 3_000_000,
      periodLabel: "Agosto 2026",
    });

    assert.equal(summary.difference, -2_000_000);
    assert.equal(summary.maxFlow, 3_000_000);
    assert.equal(summary.incomeSharePercent, 25);
    assert.equal(summary.expenseSharePercent, 75);
    assert.equal(Math.round(summary.incomeScalePercent), 33);
    assert.equal(summary.expenseScalePercent, 100);
  });

  test("WA-HOU-DASH-003: Ingresos y gastos iguales genera distribución 50/50 y estado en equilibrio", () => {
    const summary = calculateHouseholdFlowSummary({
      income: 2_000_000,
      expense: 2_000_000,
      periodLabel: "Agosto 2026",
    });

    assert.equal(summary.difference, 0);
    assert.equal(summary.maxFlow, 2_000_000);
    assert.equal(summary.incomeSharePercent, 50);
    assert.equal(summary.expenseSharePercent, 50);
    assert.equal(summary.incomeScalePercent, 100);
    assert.equal(summary.expenseScalePercent, 100);
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
    assert.equal(summary.incomeScalePercent, 100);
    assert.equal(summary.expenseScalePercent, 0);
  });

  test("WA-HOU-DASH-005: Solo gastos genera barra 0% ingresos y 100% gastos", () => {
    const summary = calculateHouseholdFlowSummary({
      income: 0,
      expense: 1_500_000,
      periodLabel: "Agosto 2026",
    });

    assert.equal(summary.incomeSharePercent, 0);
    assert.equal(summary.expenseSharePercent, 100);
    assert.equal(summary.incomeScalePercent, 0);
    assert.equal(summary.expenseScalePercent, 100);
  });

  test("WA-HOU-DASH-006: Mes sin ingresos ni gastos activa estado vacío con barra neutral", () => {
    const summary = calculateHouseholdFlowSummary({
      income: 0,
      expense: 0,
      periodLabel: "Agosto 2026",
    });

    assert.equal(summary.totalFlow, 0);
    assert.equal(summary.maxFlow, 0);
    assert.equal(summary.isEmpty, true);
    assert.equal(summary.incomeSharePercent, 0);
    assert.equal(summary.expenseSharePercent, 0);
    assert.equal(summary.incomeScalePercent, 0);
    assert.equal(summary.expenseScalePercent, 0);
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

  test("WA-HOU-DASH-008: buildHouseholdExpenseChartData ordena descendentemente, normaliza escala y preserva Por clasificar", () => {
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
    assert.equal(result[0].shareLabel, "50%");
    assert.equal(result[0].barScalePercent, 100);

    assert.equal(result[1].name, "Por clasificar");
    assert.equal(result[1].amount, 300_000);
    assert.equal(result[1].share, 30);
    assert.equal(result[1].shareLabel, "30%");
    assert.equal(result[1].barScalePercent, 60);
    assert.equal(result[1].isUnclassified, true);
    assert.equal(result[1].color, "#94A3B8");

    assert.equal(result[2].name, "Servicios");
    assert.equal(result[2].amount, 200_000);
    assert.equal(result[2].share, 20);
    assert.equal(result[2].shareLabel, "20%");
    assert.equal(result[2].barScalePercent, 40);
  });

  test("WA-HOU-DASH-009: buildHouseholdExpenseChartData muestra hasta 10 categorías y agrupa más de 10 en Otras", () => {
    const rawExpenses: Record<string, number> = {};
    const categoryMap = new Map<string, { id: string; name: string; color: string; iconKey: string }>();

    for (let i = 1; i <= 12; i++) {
      rawExpenses[`c${i}`] = 100_000 * (13 - i);
      categoryMap.set(`c${i}`, { id: `c${i}`, name: `Cat ${i}`, color: "#22C55E", iconKey: "groceries" });
    }

    const result = buildHouseholdExpenseChartData(rawExpenses, categoryMap);
    assert.equal(result.length, 10); // 9 top + Otras
    assert.equal(result[0].name, "Cat 1");
    assert.equal(result[8].name, "Cat 9");

    const otherItem = result[9];
    assert.equal(otherItem.id, "other");
    assert.equal(otherItem.name, "Otras");
    assert.equal(otherItem.amount, 600_000); // 300_000 + 200_000 + 100_000
    assert.equal(otherItem.color, "#94A3B8");
  });

  // --- Bloque 3: buildHouseholdIncomeMemberChartData & buildHouseholdIncomeSections ---

  test("WA-HOU-DASH-010: buildHouseholdIncomeMemberChartData agrupa por integrante con normalización de escala", () => {
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
    assert.equal(result[0].shareLabel, "67%");
    assert.equal(result[0].barScalePercent, 100);

    assert.equal(result[1].id, "user_b");
    assert.equal(result[1].name, "Camila");
    assert.equal(result[1].amount, 1_500_000);
    assert.equal(result[1].share, 33);
    assert.equal(result[1].shareLabel, "33%");
    assert.equal(result[1].barScalePercent, 50);
  });

  test("WA-HOU-DASH-010B: buildHouseholdIncomeCategoryChartData construye desglose plano de barras ordenadas por monto global descendente", () => {
    const movements = [
      { id: "m1", type: "income" as const, amount: 3_000_000, occurredAtMillis: 1000, householdCategoryId: null, ownerId: "user_a", categoryId: "cat_salario" },
      { id: "m2", type: "income" as const, amount: 1_000_000, occurredAtMillis: 2000, householdCategoryId: null, ownerId: "user_a", categoryId: "cat_freelance" },
      { id: "m3", type: "income" as const, amount: 5_000_000, occurredAtMillis: 3000, householdCategoryId: null, ownerId: "user_b", categoryId: "partner_salario" },
      { id: "m4", type: "income" as const, amount: 1_000_000, occurredAtMillis: 4000, householdCategoryId: null, ownerId: "user_b", categoryId: "partner_inversiones" },
    ];

    const memberMap = new Map([
      ["user_a", { userId: "user_a", displayName: "Edgar", photoUrl: "https://photos/a.jpg" }],
      ["user_b", { userId: "user_b", displayName: "Camila", photoUrl: "https://photos/b.jpg" }],
    ]);

    const ownCategoriesMap = new Map([
      ["cat_salario", { name: "Salario Principal", iconKey: "salary", color: "#22C55E" }],
      ["cat_freelance", { name: "Freelance", iconKey: "freelance", color: "#3B82F6" }],
    ]);

    const categoryLabels = [
      { ownerId: "user_b", categoryId: "partner_salario", name: "Sueldo Camila", iconKey: "salary", color: "#10B981" },
      { ownerId: "user_b", categoryId: "partner_inversiones", name: "Dividendos", iconKey: "invest", color: "#8B5CF6" },
    ];

    const items = buildHouseholdIncomeCategoryChartData({
      movements,
      memberMap,
      currentUid: "user_a",
      ownCategoriesMap,
      categoryLabels,
    });

    // Total ingresos = 10.000.000. Max category = 5.000.000 (Sueldo Camila)
    // 1. Debe retornar 4 barras planas ordenadas globalmente por importe desc
    assert.equal(items.length, 4);

    // Posición 0: Sueldo Camila (5.000.000 -> 50% total, 100% escala)
    assert.equal(items[0].ownerId, "user_b");
    assert.equal(items[0].ownerLabel, "Camila");
    assert.equal(items[0].name, "Sueldo Camila");
    assert.equal(items[0].amount, 5_000_000);
    assert.equal(items[0].share, 50);
    assert.equal(items[0].shareLabel, "50%");
    assert.equal(items[0].barScalePercent, 100);

    // Posición 1: Salario Principal (3.000.000 -> 30% total, 60% escala)
    assert.equal(items[1].ownerId, "user_a");
    assert.equal(items[1].ownerLabel, "Tú");
    assert.equal(items[1].name, "Salario Principal");
    assert.equal(items[1].amount, 3_000_000);
    assert.equal(items[1].share, 30);
    assert.equal(items[1].shareLabel, "30%");
    assert.equal(items[1].barScalePercent, 60);

    // Posición 2 y 3: Dividendos y Freelance (1.000.000 cada uno -> 10% total, 20% escala)
    assert.equal(items[2].amount, 1_000_000);
    assert.equal(items[2].share, 10);
    assert.equal(items[2].shareLabel, "10%");
    assert.equal(items[2].barScalePercent, 20);

    assert.equal(items[3].amount, 1_000_000);
    assert.equal(items[3].share, 10);
    assert.equal(items[3].shareLabel, "10%");
    assert.equal(items[3].barScalePercent, 20);
  });

  test("WA-HOU-DASH-010C: resolveHouseholdIncomeCategoryLabel aplica fallback seguro cuando falta la etiqueta", () => {
    const ownCategoriesMap = new Map([
      ["cat_known", { name: "Salario", iconKey: "salary", color: "#22C55E" }],
    ]);

    const partnerCategoryLabels = [
      { ownerId: "user_b", categoryId: "cat_b_known", name: "Comisiones", iconKey: "commission", color: "#F59E0B" },
    ];

    // Propia conocida
    const ownKnown = resolveHouseholdIncomeCategoryLabel({
      ownerId: "user_a",
      categoryId: "cat_known",
      currentUid: "user_a",
      ownCategoriesMap,
      partnerCategoryLabels,
    });
    assert.equal(ownKnown.name, "Salario");
    assert.equal(ownKnown.iconKey, "salary");
    assert.equal(ownKnown.color, "#22C55E");

    // Propia desconocida (fallback)
    const ownUnknown = resolveHouseholdIncomeCategoryLabel({
      ownerId: "user_a",
      categoryId: "cat_missing",
      currentUid: "user_a",
      ownCategoriesMap,
      partnerCategoryLabels,
    });
    assert.equal(ownUnknown.name, "Categoría de ingreso");
    assert.equal(ownUnknown.iconKey, "other");
    assert.equal(ownUnknown.color, "#94A3B8");

    // Pareja conocida
    const partnerKnown = resolveHouseholdIncomeCategoryLabel({
      ownerId: "user_b",
      categoryId: "cat_b_known",
      currentUid: "user_a",
      ownCategoriesMap,
      partnerCategoryLabels,
    });
    assert.equal(partnerKnown.name, "Comisiones");
    assert.equal(partnerKnown.iconKey, "commission");
    assert.equal(partnerKnown.color, "#F59E0B");

    // Pareja desconocida (fallback)
    const partnerUnknown = resolveHouseholdIncomeCategoryLabel({
      ownerId: "user_b",
      categoryId: "cat_b_missing",
      currentUid: "user_a",
      ownCategoriesMap,
      partnerCategoryLabels,
    });
    assert.equal(partnerUnknown.name, "Categoría de ingreso");
    assert.equal(partnerUnknown.iconKey, "other");
    assert.equal(partnerUnknown.color, "#94A3B8");
  });

  // --- Bloque 4: Verificaciones Estructurales y de Accesibilidad ---

  test("WA-HOU-DASH-011: [Estructural] MplusHouseholdOverview implementa grid asimétrico de 2 zonas con tokens de Hogar", () => {
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

    // 2. Ausencia de listas o componentes de desglose planos/externos
    assert.equal(
      overviewSource.includes("HouseholdIncomeBreakdown"),
      false,
      "No debe usar HouseholdIncomeBreakdown; debe usar el mismo HouseholdCategoryChart",
    );

    // 3. Título y subtítulo en modo ingresos
    assert.ok(
      overviewSource.includes('Ingresos por categoría'),
      "El título en modo ingresos debe ser 'Ingresos por categoría'",
    );
    assert.ok(
      overviewSource.includes('Total ingresado en ${periodLabel}'),
      "El subtítulo en modo ingresos debe ser 'Total ingresado en {periodLabel}'",
    );

    // 4. Composición asimétrica en 2 zonas
    assert.ok(
      overviewSource.includes("grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8"),
      "Debe usar la cuadrícula asimétrica de 12 columnas (lg:grid-cols-12)",
    );
    assert.ok(
      overviewSource.includes("lg:col-span-5"),
      "Zona izquierda debe tener lg:col-span-5",
    );
    assert.ok(
      overviewSource.includes("lg:col-span-7"),
      "Zona derecha debe tener lg:col-span-7",
    );

    // 5. Insight dinámico del Balance
    assert.ok(
      overviewSource.includes("Gastaron $"),
      "Debe incluir insight dinámico para déficit",
    );
    assert.ok(
      overviewSource.includes("Ingresaron $"),
      "Debe incluir insight dinámico para superávit",
    );

    // 6. Selector accesible de Gastos e Ingresos
    assert.ok(
      overviewSource.includes('aria-pressed={breakdownMode === "expense"}'),
      "Debe incluir selector de Gastos con aria-pressed",
    );
    assert.ok(
      overviewSource.includes('aria-pressed={breakdownMode === "income"}'),
      "Debe incluir selector de Ingresos con aria-pressed",
    );

    // 7. Componentes y tokens de Hogar
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

  test("WA-HOU-DASH-012: [Estructural] HouseholdCategoryChart es flexible, interactivo y con tokens de Hogar", () => {
    const chartSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "household", "components", "household-category-chart.tsx"),
      "utf8",
    );

    // 1. Altura flexible y plot
    assert.ok(
      chartSource.includes("min-h-[220px]"),
      "El plot debe tener min-h-[220px]",
    );

    // 2. Líneas guía en z-0
    assert.ok(
      chartSource.includes("z-0"),
      "Debe posicionar las líneas guía en z-0",
    );

    // 3. Textura no plana en las barras
    assert.ok(
      chartSource.includes("linear-gradient(180deg"),
      "Debe incluir gradiente vertical en las barras",
    );
    assert.ok(
      chartSource.includes("repeating-linear-gradient(45deg"),
      "Debe incluir micro-patrón diagonal a 45deg",
    );

    // 4. Posicionamiento dinámico de etiquetas sobre la barra
    assert.ok(
      chartSource.includes("bottom-[calc(100%+6px)]"),
      "Las etiquetas de monto/porcentaje deben posicionarse dinámicamente en bottom-[calc(100%+6px)]",
    );

    // 5. Tooltip flotante en z-30 siempre superior
    assert.ok(
      chartSource.includes("bottom-[calc(100%+44px)]"),
      "El tooltip flotante debe estar anclado en bottom-[calc(100%+44px)]",
    );
    assert.ok(
      chartSource.includes("z-30"),
      "El tooltip debe estar en capa z-30",
    );

    // 6. Texto explicativo inferior
    assert.ok(
      chartSource.includes("Las barras comparan cada categoría con la de mayor valor"),
      "Debe incluir texto explicativo de comparación relativa",
    );

    // 7. Tokens exclusivos de Hogar
    assert.equal(
      chartSource.includes("--fm-"),
      false,
      "HouseholdCategoryChart no debe contener tokens --fm-*",
    );
    assert.ok(
      chartSource.includes("--hh-"),
      "HouseholdCategoryChart debe utilizar tokens --hh-*",
    );
  });

  test("WA-HOU-DASH-013: [Estructural] HouseholdCategoryChart renderiza un único gráfico plano de barras para ingresos con tooltip enriquecido", () => {
    const chartSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "household", "components", "household-category-chart.tsx"),
      "utf8",
    );

    // 1. Soporte de modo income con incomeItems plano
    assert.ok(
      chartSource.includes("incomeItems"),
      "Debe soportar prop incomeItems plano",
    );

    // 2. Uso de ProfileAvatar exclusivamente dentro del tooltip
    assert.ok(
      chartSource.includes("ProfileAvatar"),
      "Debe usar ProfileAvatar para mostrar la identidad del responsable dentro del tooltip",
    );

    // 3. Tooltip enriquecido con jerarquía completa: avatar, responsable, categoría, monto y % del total compartido
    assert.ok(
      chartSource.includes("item.ownerLabel"),
      "Debe mostrar el nombre del responsable en el tooltip",
    );
    assert.ok(
      chartSource.includes("item.name"),
      "Debe mostrar el nombre de la categoría en el tooltip",
    );
    assert.ok(
      chartSource.includes("del total de ingresos compartidos"),
      "El tooltip debe indicar que el porcentaje es sobre el total de ingresos compartidos",
    );

    // 4. Ausencia total de separadores por integrante o etiquetas de grupo inferiores
    assert.equal(
      chartSource.includes("border-l border-[var(--hh-border-soft)]"),
      false,
      "No debe contener separadores verticales entre integrantes",
    );
    assert.equal(
      chartSource.includes("group/member"),
      false,
      "No debe contener botones o badges de grupo por integrante debajo del gráfico",
    );

    // 5. Acciones clicables en barras filtrando por categoría y responsable
    assert.ok(
      chartSource.includes("onSelectIncomeCategory"),
      "Debe soportar onSelectIncomeCategory para filtrar por categoría y miembro",
    );
    assert.equal(
      chartSource.includes("Dialog"),
      false,
      "No debe usar modales en HouseholdCategoryChart",
    );
  });

  console.log(`\nTests for household-dashboard-chart: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runHouseholdDashboardChartTests();
