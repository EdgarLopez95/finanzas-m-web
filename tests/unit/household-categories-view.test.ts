import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runHouseholdCategoriesTests = () => {
  console.log("Running unit tests for household-categories-view.test.ts...");
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

  const readSource = (relativePath: string): string =>
    readFileSync(path.join(__dirname, "..", "..", relativePath), "utf8");

  // ─── 1. Control Segmentado Superior ─────────────────────────────────────────
  test("WA-HOU-CAT-001: [Estructural] Tabs centrados a max-w-md mx-auto con etiquetas coherentes", () => {
    const source = readSource("src/features/household/components/mplus-household-categories-view.tsx");

    assert.ok(
      source.includes("max-w-md mx-auto") && source.includes("w-full"),
      "El switch de tabs debe estar centrado con max-w-md mx-auto",
    );
    assert.ok(
      source.includes("Distribución de gastos"),
      "Debe tener la pestaña 'Distribución de gastos'",
    );
    assert.ok(
      source.includes("Categorías del hogar"),
      "Debe tener la pestaña 'Categorías del hogar'",
    );
  });

  // ─── 2. Distribución de Gastos (2 Cards) ───────────────────────────────────
  test("WA-HOU-CAT-002: [Estructural] Distribución usa 2 Cards: Hero (Total gastado) + Desglose", () => {
    const source = readSource("src/features/household/components/mplus-household-categories-view.tsx");

    assert.ok(
      source.includes('variant="hero"'),
      "Debe renderizar HouseholdCard con variant='hero'",
    );
    assert.ok(
      source.includes("Total gastado en"),
      "La Hero card debe mostrar 'Total gastado en [Mes]'",
    );
    assert.ok(
      source.includes('size="hero"'),
      "El monto principal en Hero card debe tener size='hero'",
    );
    assert.ok(
      source.includes("distributionItems.map"),
      "La segunda card debe mapear la lista de distribución con barras de porcentaje",
    );
  });

  // ─── 3. Gestión de Categorías ───────────────────────────────────────────────
  test("WA-HOU-CAT-003: [Estructural] Gestión usa botón dashed superior a ancho completo", () => {
    const source = readSource("src/features/household/components/mplus-household-categories-view.tsx");

    assert.ok(
      source.includes("border-dashed") && source.includes("w-full h-14"),
      "Debe tener botón superior de alta punteado (border-dashed w-full h-14)",
    );
    assert.ok(
      source.includes("Nueva categoría"),
      "El botón punteado debe decir 'Nueva categoría'",
    );
  });

  test("WA-HOU-CAT-004: [Estructural] Lista vertical con menú MoreVertical y confirmación inline al archivar", () => {
    const source = readSource("src/features/household/components/mplus-household-categories-view.tsx");

    // Menú de 3 puntos
    assert.ok(
      source.includes("<MoreVertical"),
      "Cada fila debe ofrecer botón MoreVertical",
    );
    assert.ok(
      source.includes("Editar") && source.includes("Archivar"),
      "El menú debe ofrecer opciones de Editar y Archivar",
    );

    // Confirmación inline
    assert.ok(
      source.includes("isConfirmingArchive") && source.includes("¿Archivar"),
      "Debe mostrar banner de confirmación inline antes de archivar",
    );
  });

  test("WA-HOU-CAT-005: [Estructural] Sección de Archivadas con badge de conteo y botón Reactivar", () => {
    const source = readSource("src/features/household/components/mplus-household-categories-view.tsx");

    assert.ok(
      source.includes("Archivadas") && source.includes("archivedCategories.length"),
      "Debe incluir sección de categorías archivadas con conteo",
    );
    assert.ok(
      source.includes("Reactivar") && source.includes("handleReactivate"),
      "Debe permitir reactivar categorías archivadas",
    );
  });

  // ─── 4. Aislamiento de Tokens ───────────────────────────────────────────────
  test("WA-HOU-CAT-006: [Aislamiento] Vista de Hogar usa exclusivamente tokens --hh-* y no --fm-*", () => {
    const source = readSource("src/features/household/components/mplus-household-categories-view.tsx");

    assert.ok(source.includes("--hh-"), "Debe usar tokens de Hogar (--hh-*)");
    assert.ok(!source.includes("--fm-"), "No debe usar tokens de Personal (--fm-*) en Hogar");
  });

  test("WA-HOU-CAT-007: [Integridad] Vista de Personal (MplusCategoriesView) conserva sus tokens y estructura", () => {
    const personalSource = readSource("src/features/categories/components/mplus-categories-view.tsx");

    assert.ok(
      personalSource.includes("CategoryBreakdownList"),
      "Personal usa CategoryBreakdownList",
    );
    assert.ok(
      personalSource.includes("--fm-"),
      "Personal conserva sus tokens --fm-*",
    );
  });

  // ─── 5. Grid de 2 Columnas en Escritorio ────────────────────────────────────
  test("WA-HOU-CAT-008: [Responsive] Categorías se muestran en grilla de 2 columnas en escritorio en Personal y Hogar", () => {
    const personalSource = readSource("src/features/categories/components/mplus-categories-view.tsx");
    const householdSource = readSource("src/features/household/components/mplus-household-categories-view.tsx");

    assert.ok(
      personalSource.includes("grid-cols-1 md:grid-cols-2"),
      "Personal debe renderizar categorías en grid grid-cols-1 md:grid-cols-2",
    );
    assert.ok(
      householdSource.includes("grid-cols-1 md:grid-cols-2"),
      "Hogar debe renderizar categorías en grid grid-cols-1 md:grid-cols-2",
    );
  });

  console.log(`\nTests for household-categories-view: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runHouseholdCategoriesTests();
}
