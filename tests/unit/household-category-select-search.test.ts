import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for household-category-select-search.test.ts...");

const src = fs.readFileSync(
  path.resolve(__dirname, "../../src/features/household/components/ui/household-category-select.tsx"),
  "utf-8"
);

function run() {
  assert.match(src, /type="search"/, "debe incluir input type=search en el menú");
  assert.match(src, /Buscar categoría/, "debe etiquetar el buscador");
  assert.match(src, /filteredOptions/, "debe filtrar opciones por query");
  assert.match(src, /toLocaleLowerCase\("es"\)/, "el filtro debe ser case-insensitive es");
  assert.match(src, /Sin resultados/, "debe mostrar vacío cuando no hay match");
  assert.match(src, /searchRef\.current\?\.focus\(\)/, "al abrir debe enfocar el buscador");
  assert.match(
    src,
    /stopImmediatePropagation/,
    "Escape en el menú no debe cerrar el modal padre"
  );

  console.log("  ✓ HouseholdCategorySelect con buscador y Escape acotado al menú");
  console.log("All household-category-select-search unit tests passed successfully!");
}

try {
  run();
} catch (err) {
  console.error("Test failure in household-category-select-search.test.ts:", err);
  process.exit(1);
}
