import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for household-8d-views.test.ts...");

/**
 * Paso 8D — Completar Movimientos, Ajustes y Categorías de Hogar.
 *
 * Cubre los hallazgos confirmados de la auditoría Android → Web (ver
 * docs/11_WEB_DEV_LOG.md, entrada Paso 8D):
 * - Categorías Hogar: falta "restaurar" (unarchive), que Android sí tiene
 *   (`HouseholdCategoryManagementScreen.kt`, "Reabrir categoría").
 * - Movimientos Hogar: falta el filtro "Tipo de movimiento" (Todos/Gastos/
 *   Ingresos) que Android sí ofrece en el contexto Hogar.
 * - Regresión: las tres páginas conservan sus guardas de
 *   loading/error/empty/dissolved/not_found/waiting_for_members, ninguna es
 *   un overlay raíz, y las vistas puras Hogar no importan de
 *   `@/components/finance/**`.
 */

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

const PAGES = [
  "app/(dashboard)/household/movements/page.tsx",
  "app/(dashboard)/household/settings/page.tsx",
  "app/(dashboard)/household/categories/page.tsx",
];

const VIEWS = [
  "features/household/components/views/household-movements-view.tsx",
  "features/household/components/views/household-settings-view.tsx",
  "features/household/components/views/household-categories-view.tsx",
];

export function runHousehold8dViewsTests() {
  let checks = 0;

  // ---------------------------------------------------------------
  // 1. Las tres páginas conservan las guardas de estado (regresión M+).
  // ---------------------------------------------------------------
  for (const rel of PAGES) {
    const content = readSrc(rel);
    for (const guard of [
      'status === "loading"',
      'status === "error"',
      'household.status === "waiting"',
    ]) {
      assert.ok(content.includes(guard), `${rel}: debe conservar la guarda "${guard}"`);
      checks++;
    }
  }

  // ---------------------------------------------------------------
  // 2. Ninguna de las tres páginas ni vistas es un overlay raíz.
  // ---------------------------------------------------------------
  for (const rel of [...PAGES, ...VIEWS]) {
    const content = readSrc(rel);
    assert.doesNotMatch(content, /\b(fixed|absolute)\b[^"']*\binset-0\b/, `${rel}: no debe usar posicionamiento fijo raíz (fixed/absolute inset-0)`);
    assert.doesNotMatch(content, /role=["']dialog["']/, `${rel}: no debe declarar role="dialog"`);
    checks++;
  }

  // ---------------------------------------------------------------
  // 3. Las tres vistas puras Hogar no importan de @/components/finance/**.
  // ---------------------------------------------------------------
  for (const rel of VIEWS) {
    const content = readSrc(rel);
    const offenders = content
      .split("\n")
      .filter((line) => /from\s+"@\/components\/finance\//.test(line));
    assert.deepEqual(offenders, [], `${rel}: es Hogar puro, no debe importar de @/components/finance/** -> ${offenders.join(" | ")}`);
    checks++;
  }

  // ---------------------------------------------------------------
  // 4. Movimientos Hogar: combina eventos + ingresos, sin datos personales.
  // ---------------------------------------------------------------
  const movementsView = readSrc("features/household/components/views/household-movements-view.tsx");
  assert.match(movementsView, /events\.map/, "household-movements-view.tsx: debe combinar los eventos de gasto Hogar");
  assert.match(movementsView, /incomeEntries\.map/, "household-movements-view.tsx: debe combinar los ingresos/proyecciones seguras del Hogar");
  assert.match(movementsView, /visibleDescription/, "household-movements-view.tsx: el ingreso debe usar solo el campo seguro visibleDescription");
  checks += 3;

  for (const forbidden of [
    "accountId",
    "pocketId",
    "bankName",
    "currentBalance",
    "Por anotar",
    "Te deben",
    "Le debés",
    "Declarar pago",
    "Acreditar",
  ]) {
    assert.doesNotMatch(
      movementsView,
      new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `household-movements-view.tsx: no debe referenciar "${forbidden}" (dato/acción personal)`
    );
    checks++;
  }

  // ---------------------------------------------------------------
  // 5. Nuevo — filtro "Tipo de movimiento" en Movimientos Hogar (paridad
  //    Android confirmada: MovementsViewModel.kt expone Todos/Gastos/
  //    Ingresos/Transferencias también en contexto Hogar).
  // ---------------------------------------------------------------
  assert.match(
    movementsView,
    /household-history-type/,
    'household-movements-view.tsx: debe existir un control con id "household-history-type" (filtro de tipo de movimiento)'
  );
  assert.match(movementsView, /selectedType/, "household-movements-view.tsx: debe existir estado selectedType para el filtro de tipo");
  checks += 2;

  // ---------------------------------------------------------------
  // 6. Nuevo — restaurar (unarchive) categorías Hogar (paridad Android
  //    confirmada: HouseholdCategoryManagementScreen.kt, "Reabrir categoría").
  // ---------------------------------------------------------------
  const categoriesView = readSrc("features/household/components/views/household-categories-view.tsx");
  assert.match(categoriesView, /\bunarchive\b/i, "household-categories-view.tsx: debe existir la acción de restaurar (unarchive) una categoría archivada");
  checks++;

  const categoriesHook = readSrc("features/household/hooks/use-household-categories.ts");
  assert.match(categoriesHook, /unarchive:/, "use-household-categories.ts: debe exponer unarchive");
  checks++;

  const unarchiveServicePath = path.resolve(repoRoot, "src/features/household/services/unarchive-household-category.ts");
  assert.ok(fs.existsSync(unarchiveServicePath), "debe existir el servicio unarchive-household-category.ts");
  const unarchiveService = fs.readFileSync(unarchiveServicePath, "utf-8");
  assert.match(unarchiveService, /archived:\s*false/, "unarchive-household-category.ts: debe escribir archived: false");
  checks += 2;

  console.log(`  ✓ Paso 8D — Movimientos/Ajustes/Categorías Hogar validados (${checks} comprobaciones).`);
}

runHousehold8dViewsTests();
