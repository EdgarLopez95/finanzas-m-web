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

  test("WA-CAT-CHART-006: Hasta 10 categorías se muestran completas sin crear 'Otras'", () => {
    const items = [
      createItem("c1", "Cat 1", 600_000),
      createItem("c2", "Cat 2", 400_000),
      createItem("c3", "Cat 3", 300_000),
      createItem("c4", "Cat 4", 300_000),
      createItem("c5", "Cat 5", 200_000),
      createItem("c6", "Cat 6", 200_000),
      createItem("c7", "Cat 7", 150_000),
      createItem("c8", "Cat 8", 120_000),
      createItem("c9", "Cat 9", 100_000),
      createItem("c10", "Cat 10", 80_000),
    ];
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result.length, 10);
    assert.equal(result.some((i) => i.name === "Otras"), false);
    assert.equal(result[0].name, "Cat 1");
    assert.equal(result[9].name, "Cat 10");
  });

  test("WA-CAT-CHART-007: Más de 10 categorías agrupa a partir de la 10ma en 'Otras' con suma y porcentaje exactos", () => {
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
      createItem("c11", "Cat 11", 10_000),
    ];
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result.length, 10); // 9 top + Otras
    assert.equal(result[0].name, "Cat 1");
    assert.equal(result[8].name, "Cat 9");

    const otherItem = result[9];
    assert.equal(otherItem.id, "other");
    assert.equal(otherItem.name, "Otras");
    assert.equal(otherItem.iconKey, "other");
    assert.equal(otherItem.color, "#94A3B8");
    assert.equal(otherItem.amount, 20_000 + 10_000); // 30_000
  });

  test("WA-CAT-CHART-008: Escala visual normalizada contra categoría máxima y porcentaje real de total independiente", () => {
    // 1. Caso dominante + pequeño ($8M vs $8.222)
    const items = [
      createItem("c1", "Arriendo / vivienda", 8_000_000),
      createItem("c2", "Mercado", 8_222), // < 1%
    ];
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result.length, 2);
    assert.equal(result[0].barScalePercent, 100);
    assert.equal(result[0].shareLabel, "99,9%");
    assert.ok(result[1].barScalePercent >= 0.1);
    assert.equal(result[1].shareLabel, "<1%");

    for (const item of result) {
      assert.equal(Number.isNaN(item.share), false);
      assert.equal(Number.isFinite(item.share), true);
      assert.equal(Number.isInteger(item.share), true);
      assert.ok(item.share >= 0 && item.share <= 100);
      assert.ok(item.amount >= 0);
    }
  });

  test("WA-CAT-CHART-008B: Empate de máximos ($8M, $8M, $8.222) — ambas barras de $8M alcanzan 100% con 50% de share", () => {
    const items = [
      createItem("c1", "Transporte", 8_000_000),
      createItem("c2", "Arriendo / vivienda", 8_000_000),
      createItem("c3", "Mercado", 8_222),
    ];
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result.length, 3);
    assert.equal(result[0].barScalePercent, 100);
    assert.equal(result[0].shareLabel, "50%");
    assert.equal(result[1].barScalePercent, 100);
    assert.equal(result[1].shareLabel, "50%");
    assert.ok(result[2].barScalePercent <= 0.2);
    assert.equal(result[2].shareLabel, "<1%");
  });

  test("WA-CAT-CHART-008C: 10 categorías iguales de $100.000 — 10 barras al 100% de altura con 10% de share cada una", () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      createItem(`cat-${i + 1}`, `Cat ${i + 1}`, 100_000),
    );
    const result = buildDashboardCategoryChartData(items);
    assert.equal(result.length, 10);
    for (const item of result) {
      assert.equal(item.barScalePercent, 100, "Todas las categorías máximas empatadas deben medir 100% de altura");
      assert.equal(item.shareLabel, "10%", "Cada categoría debe reportar su porcentaje real del total (10%)");
      assert.equal(item.share, 10);
    }
  });

  test("WA-CAT-CHART-009: [Estructural] PersonalCategoryChart muestra gráfica de comparación relativa y texto de apoyo discreto", () => {
    const chartSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-category-chart.tsx"),
      "utf8",
    );

    // 1. La preferencia "Ocultar saldos" fue retirada del producto: el gráfico
    //    muestra los montos siempre y no conserva la prop ni el copy asociados.
    assert.equal(
      chartSource.includes("masked"),
      false,
      "PersonalCategoryChart no puede conservar la prop retirada masked",
    );
    assert.equal(
      chartSource.includes("monto oculto"),
      false,
      "el aria-label ya no puede ocultar cifras: la preferencia no existe",
    );

    // 2. Ausencia de falsas marcas porcentuales en eje Y y presencia de texto explicativo
    assert.ok(
      chartSource.includes("Las barras comparan cada categoría con la de mayor valor"),
      "Debe incluir texto de apoyo accesible/visible aclarando que las barras comparan contra la categoría mayor",
    );
    assert.ok(
      chartSource.includes("border-b border-white/"),
      "Debe incluir líneas guía horizontales para estructurar el plot",
    );
    assert.ok(
      chartSource.includes("motion-safe:transition-[height]"),
      "Las barras verticales deben transicionar su altura con motion-safe:transition-[height]",
    );
    assert.ok(
      chartSource.includes("focus-visible:ring-"),
      "Debe incluir anillo de foco visible accesible por teclado",
    );

    // 3. Sin scroll horizontal forzado
    assert.equal(
      chartSource.includes("overflow-x-auto"),
      false,
      "No debe usar overflow-x-auto que force scroll horizontal",
    );
  });

  test("WA-CAT-CHART-010: [Integración] MplusHomeView renderiza PersonalCategoryChart sin masked y mantiene inicio simplificado", () => {
    const homeViewSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-home-view.tsx"),
      "utf8",
    );
    const shellSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "components", "layout", "dashboard-shell.tsx"),
      "utf8",
    );

    // 1. Integración de gráfico, ya sin la preferencia retirada
    assert.ok(
      homeViewSource.includes("<PersonalCategoryChart"),
      "MplusHomeView debe renderizar PersonalCategoryChart",
    );
    assert.equal(
      homeViewSource.includes("masked"),
      false,
      "el Inicio Personal no puede recibir ni propagar la prop retirada masked",
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

  test("WA-CAT-CHART-011: [Estructural] PersonalCategoryChart incluye distribución responsiva a todo el ancho y metadata inferior", () => {
    const chartSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-category-chart.tsx"),
      "utf8",
    );

    assert.ok(
      chartSource.includes("Mostrando") && chartSource.includes("categorías") && chartSource.includes("Total: $"),
      "Debe incluir chip de metadata contextual inferior (Mostrando X de X categorías · Total: $)",
    );
    assert.ok(
      chartSource.includes("justify-around") || chartSource.includes("px-4"),
      "Debe distribuir las columnas aprovechando el ancho útil del plot de forma balanceada",
    );
    assert.ok(
      chartSource.includes("barScalePercent"),
      "Debe usar barScalePercent para la altura proporcional de cada barra",
    );
  });

  test("WA-CAT-CHART-012: [Estructural] Flexibilidad vertical: card de categorías y plot absorben el alto restante del viewport", () => {
    const homeViewSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-home-view.tsx"),
      "utf8",
    );
    const shellSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "components", "layout", "app-shell.tsx"),
      "utf8",
    );
    const chartSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-category-chart.tsx"),
      "utf8",
    );

    // 1. AppShell main ofrece flex-1 min-h-0 para soportar la página
    assert.ok(
      shellSource.includes("flex-1") && shellSource.includes("min-h-0"),
      "AppShell main debe tener flex-1 y min-h-0",
    );

    // 2. MplusHomeView estructura el resumen con shrink-0 y la sección de categorías con flex-1
    assert.ok(
      homeViewSource.includes("flex-1 min-h-0"),
      "MplusHomeView debe estructurar su contenedor principal con flex-1 min-h-0",
    );
    assert.ok(
      homeViewSource.includes("shrink-0"),
      "El resumen superior de flujo debe tener shrink-0",
    );
    assert.ok(
      homeViewSource.includes("flex-1 min-h-0 flex flex-col"),
      "La tarjeta de categorías debe tener flex-1 min-h-0 flex flex-col para absorber el alto restante",
    );

    // 3. PersonalCategoryChart y su plot tienen flex-1
    assert.ok(
      chartSource.includes("flex-1 min-h-0 flex flex-col justify-between"),
      "PersonalCategoryChart debe estructurarse con flex-1 min-h-0 flex flex-col justify-between",
    );
    assert.ok(
      chartSource.includes("w-full flex-1 min-h-[220px] flex items-stretch"),
      "El plot debe estructurarse con flex-1 min-h-[220px] para crecer verticalmente",
    );
  });

  test("WA-CAT-CHART-013: [Estructural] Nombres de categorías en una sola línea mediante truncate sin saltos de línea", () => {
    const chartSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-category-chart.tsx"),
      "utf8",
    );

    assert.ok(
      chartSource.includes("truncate"),
      "Los nombres de categoría deben usar truncate para mantener exactamente una sola línea",
    );
    assert.equal(
      chartSource.includes("line-clamp-2"),
      false,
      "No debe permitir wrapping a segunda línea con line-clamp-2",
    );
  });

  test("WA-CAT-CHART-014: [Estructural] Tooltip flotante con detalle completo por categoría", () => {
    const chartSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-category-chart.tsx"),
      "utf8",
    );

    assert.ok(
      chartSource.includes('role="tooltip"') || chartSource.includes("animate-in fade-in"),
      "Debe incluir tooltip flotante con detalle completo de categoría",
    );
    assert.ok(
      chartSource.includes("onMouseEnter") && chartSource.includes("onFocus"),
      "Debe activar tooltip y unificar interacción por hover y focus de teclado",
    );
  });

  test("WA-CAT-CHART-015: [Estructural] Textura sutil en barras, esquinas superiores contenidas (8-10px) y guías detrás", () => {
    const chartSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-category-chart.tsx"),
      "utf8",
    );

    // 1. Textura sutil CSS en las barras
    assert.ok(
      chartSource.includes("repeating-linear-gradient") || chartSource.includes("linear-gradient"),
      "Debe incluir gradiente/textura sutil CSS superpuesta sobre el color de categoría",
    );

    // 2. Radio superior contenido (rounded-t-lg ~ 8px / 10px)
    assert.ok(
      chartSource.includes("rounded-t-lg") || chartSource.includes("rounded-t-[8px]") || chartSource.includes("rounded-t-[10px]"),
      "Debe usar esquinas superiores suavemente redondeadas pero contenidas (8-10px)",
    );
    // 3. Guías con z-0 detrás de las barras (z-10)
    assert.ok(
      chartSource.includes("z-0") && chartSource.includes("z-10"),
      "Las guías horizontales deben situarse en capa z-0 detrás de las barras en z-10",
    );
  });

  test("WA-CAT-CHART-016: [Estructural] Posición dinámica de etiquetas y tooltip por encima del extremo superior de cada barra", () => {
    const chartSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-category-chart.tsx"),
      "utf8",
    );

    // 1. Las etiquetas de monto y porcentaje se posicionan de forma relativa y dinámica sobre la barra
    assert.ok(
      chartSource.includes("bottom-[calc(100%+6px)]"),
      "Las etiquetas de monto y porcentaje deben anclarse dinámicamente sobre el extremo superior de la barra con separación constante",
    );

    // 2. El tooltip siempre se ancla por encima de los valores de la barra activa
    assert.ok(
      chartSource.includes("bottom-[calc(100%+44px)]") || chartSource.includes("bottom-[calc(100%+"),
      "El tooltip debe anclarse por encima de los valores de la barra activa",
    );
  });

  test("WA-CAT-CHART-017: [Navegación e Interacción] Clic en columna/barra navega a /movements con el filtro de esa categoría", () => {
    const chartSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-category-chart.tsx"),
      "utf8",
    );
    const movementsViewSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "movements", "components", "movements-view.tsx"),
      "utf8",
    );

    // 1. PersonalCategoryChart tiene handlers de clic y teclado que navegan a /movements?categoryId=...
    assert.ok(
      chartSource.includes("/movements?categoryId=") || chartSource.includes("router.push"),
      "PersonalCategoryChart debe navegar a /movements pasando categoryId en query params",
    );
    assert.ok(
      chartSource.includes("onClick") && chartSource.includes("cursor-pointer"),
      "Las columnas y barras deben ser clickeables con cursor-pointer y onClick",
    );

    // 2. MplusMovementsView lee searchParams para inicializar y sincronizar el filtro de categoría
    assert.ok(
      movementsViewSource.includes("useSearchParams") && movementsViewSource.includes("categoryId"),
      "MplusMovementsView debe leer useSearchParams para aplicar el filtro de categoría recibido por URL",
    );
  });

  console.log(`\nTests for personal-dashboard-category-chart: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runPersonalDashboardCategoryChartTests();
