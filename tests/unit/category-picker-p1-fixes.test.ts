import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for category-picker-p1-fixes.test.ts...");

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

/** Extrae el cuerpo de una función exportada, desde su firma hasta el siguiente `export function` (o fin de archivo). */
function extractFunctionBody(source: string, functionName: string): string {
  const startMarker = new RegExp(`export function ${functionName}\\b`);
  const startMatch = startMarker.exec(source);
  assert.ok(startMatch, `No se encontró 'export function ${functionName}' en el archivo`);
  const start = startMatch.index;
  const rest = source.slice(start + startMatch[0].length);
  const nextExportMatch = /\nexport function \w/.exec(rest);
  const end = nextExportMatch ? start + startMatch[0].length + nextExportMatch.index : source.length;
  return source.slice(start, end);
}

async function runCategoryPickerP1FixesTests() {
  const householdIconSelectSrc = readSrc("features/household/components/ui/household-icon-select.tsx");
  const householdViewSrc = readSrc("features/household/components/views/household-categories-view.tsx");
  const personalViewsSrc = readSrc("features/dashboard/components/personal-views.tsx");
  const personalPickerSrc = readSrc("components/finance/category-icon-color-picker.tsx");

  // Test 1: picker Hogar unificado — paleta, grupos, sin buscador, sin CTA Listo.
  {
    assert.match(
      householdIconSelectSrc,
      /colorPalette/,
      "P1-A: HouseholdIconSelect debe recibir la paleta de color como prop (única fuente, sin hex propios)"
    );
    assert.match(
      householdIconSelectSrc,
      /selectedColor/,
      "P1-A: HouseholdIconSelect debe conocer el color activo para tintar el ícono seleccionado"
    );
    assert.match(
      householdIconSelectSrc,
      /groups\.map/,
      "P1-A: HouseholdIconSelect debe renderizar el filtro de grupos en la misma superficie"
    );
    assert.doesNotMatch(
      householdIconSelectSrc,
      /Buscar|type="text"/,
      "P1-A: HouseholdIconSelect ya no incluye buscador (filtro solo por grupo)"
    );
    assert.doesNotMatch(
      householdIconSelectSrc,
      /Listo|onDone|showConfirmButton/,
      "P1-A: HouseholdIconSelect no debe tener CTA 'Listo' ni confirmación intermedia"
    );
    assert.doesNotMatch(
      personalPickerSrc,
      /Listo|onDone|showConfirmButton/,
      "P1-A: CategoryIconColorPicker no debe tener CTA 'Listo' ni confirmación intermedia"
    );

    assert.doesNotMatch(
      householdViewSrc,
      /HOUSEHOLD_CATEGORY_COLORS\.map\(/,
      "P1-A: household-categories-view.tsx no debe renderizar su propio grid de colores; debe delegarlo al picker unificado"
    );
    assert.match(
      householdViewSrc,
      /<HouseholdIconSelect[\s\S]{0,400}colorPalette=\{HOUSEHOLD_CATEGORY_COLORS\}/,
      "P1-A: household-categories-view.tsx debe pasar la paleta canónica al picker unificado"
    );
    assert.match(
      householdViewSrc,
      /<HouseholdDialog[\s\S]{0,500}size="wide"/,
      "P1-A: crear/editar categoría Hogar debe usar HouseholdDialog wide (no formulario inline)"
    );

    console.log("  ✓ Test 1: picker Hogar/Personal unificado sin Listo (paleta + grupos + modal)");
  }

  // Test 2: Hogar nunca referencia catálogo/grupos de ingreso.
  {
    assert.doesNotMatch(
      householdIconSelectSrc,
      /incomeIconOptions|incomeIconCatalog|INCOME_ICON_GROUPS/,
      "household-icon-select.tsx no debe referenciar ningún catálogo de ingreso"
    );
    assert.doesNotMatch(
      householdViewSrc,
      /incomeIconOptions|incomeIconCatalog|INCOME_ICON_GROUPS/,
      "household-categories-view.tsx no debe referenciar ningún catálogo de ingreso"
    );
    console.log("  ✓ Test 2: Hogar sin referencias a catálogo de ingreso tras el rediseño");
  }

  // Test 3: Crear categoría Personal — un solo CTA Guardar; solo exige nombre.
  {
    const createDialog = extractFunctionBody(personalViewsSrc, "CreateCategoryDialog");
    assert.doesNotMatch(
      createDialog,
      /iconColorConfirmed|setIconColorConfirmed|onDone|showConfirmButton|Listo/,
      "P1-B: CreateCategoryDialog no debe exigir confirmación intermedia de ícono/color"
    );
    assert.match(
      createDialog,
      /disabled=\{isSubmitting \|\| !name\.trim\(\) \|\| !selectedIconKey \|\| !selectedColor\}/,
      "P1-B: Guardar categoría (Personal) se habilita con nombre + selección (defaults incluidos)"
    );
    assert.match(
      createDialog,
      /Guardar categoría/,
      "P1-B: CreateCategoryDialog usa un único CTA de guardado"
    );
    assert.match(
      createDialog,
      /OBLIGATORIO/i,
      "P1-B: el nombre sigue marcado como obligatorio"
    );
    console.log("  ✓ Test 3: creación Personal con un solo Guardar (sin Listo)");
  }

  // Test 4: Crear categoría Hogar — un solo CTA; solo exige nombre.
  {
    assert.doesNotMatch(
      householdViewSrc,
      /iconColorConfirmed|setIconColorConfirmed|onDone|showConfirmButton|Listo/,
      "P1-B: household-categories-view no debe exigir confirmación intermedia de ícono/color"
    );
    assert.match(
      householdViewSrc,
      /disabled=\{isSubmitting \|\| !form\.name\.trim\(\)\}/,
      "P1-B: el botón de creación (Hogar) se habilita con nombre"
    );
    assert.match(
      householdViewSrc,
      /Obligatorio/i,
      "P1-B: el nombre (Hogar) sigue marcado como obligatorio"
    );
    console.log("  ✓ Test 4: creación Hogar con un solo Guardar (sin Listo)");
  }

  // Test 5: Editar conserva ícono/color existentes sin bloquear el guardado.
  {
    const editDialog = extractFunctionBody(personalViewsSrc, "EditCategoryDialog");
    assert.doesNotMatch(
      editDialog,
      /iconColorConfirmed|setIconColorConfirmed|Listo/,
      "P1-B: EditCategoryDialog no usa confirmación intermedia"
    );
    assert.match(
      editDialog,
      /category\.color/,
      "P1-B: EditCategoryDialog (Personal) debe seguir precargando el color existente de la categoría"
    );
    assert.match(
      editDialog,
      /category\.iconKey/,
      "P1-B: EditCategoryDialog (Personal) debe seguir precargando el iconKey existente de la categoría"
    );
    assert.match(
      editDialog,
      /disabled=\{isSubmitting \|\| !name\.trim\(\)\}/,
      "P1-B: Guardar cambios (Personal) solo exige nombre"
    );

    assert.match(
      householdViewSrc,
      /iconKey: cat\.iconKey \|\| DEFAULT_ICON, color: cat\.color \|\| DEFAULT_HOUSEHOLD_CATEGORY_COLOR/,
      "P1-B: goEdit (Hogar) debe seguir precargando el iconKey/color existentes de la categoría"
    );

    console.log("  ✓ Test 5: edición conserva ícono/color existentes en Personal y Hogar");
  }

  console.log("All category-picker-p1-fixes unit tests passed successfully!");
}

runCategoryPickerP1FixesTests().catch((err) => {
  console.error("Test failure in category-picker-p1-fixes.test.ts:", err);
  process.exit(1);
});
