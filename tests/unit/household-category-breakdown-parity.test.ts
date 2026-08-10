/**
 * tests/unit/household-category-breakdown-parity.test.ts
 *
 * Verificación estática (sin React/RTL, siguiendo el patrón del repo):
 * confirma que la fila de "Distribución de gastos" de Hogar replica la
 * jerarquía estructural del listado Personal (icono · nombre · % · monto,
 * barra completa debajo) usando exclusivamente botón nativo + tokens
 * `--hh-*` + color real de categoría — sin tocar la lógica/datos ni el
 * tab "Categorías del hogar".
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const content = readFileSync(
  "src/features/household/components/views/household-categories-view.tsx",
  "utf-8",
);

// ═══════════════════════════════════════════════════════════════════════════
// Caso 1 — Fila accesible: botón nativo (navegable con teclado, Enter/Espacio
// nativos, sin role/tabIndex manual), con foco visible en token de Hogar.
// ═══════════════════════════════════════════════════════════════════════════
async function testRowIsNativeAccessibleButton() {
  const rowFnMatch = content.match(
    /function HouseholdCategoryBreakdownRow\([\s\S]*?\n\}\n/,
  );
  assert.ok(rowFnMatch, "debe existir el componente local HouseholdCategoryBreakdownRow");
  const row = rowFnMatch![0];

  assert.ok(/<button\s/.test(row), "la fila debe ser un <button> nativo (Enter/Espacio y teclado gratis)");
  assert.ok(/type="button"/.test(row), "debe declarar type=\"button\"");
  assert.ok(/onClick=\{onSelect\}/.test(row), "debe invocar onSelect al hacer click/Enter/Espacio");
  assert.ok(
    /focus-visible:ring-2[\s\S]{0,40}focus-visible:ring-\[var\(--hh-focus-ring\)\]/.test(row),
    "el foco visible debe usar el token de Hogar --hh-focus-ring",
  );

  console.log("✅ Caso 1: fila = <button> nativo con foco visible en --hh-focus-ring");
}

// ═══════════════════════════════════════════════════════════════════════════
// Caso 2 — Jerarquía: icono · nombre · porcentaje (antes del monto) · monto,
// y barra de progreso a todo el ancho, debajo de toda la fila (no solo bajo
// el nombre) — mismo orden que CategoryBreakdownList (Personal).
// ═══════════════════════════════════════════════════════════════════════════
async function testStructuralHierarchyMatchesPersonalPattern() {
  const rowFnMatch = content.match(
    /function HouseholdCategoryBreakdownRow\([\s\S]*?\n\}\n/,
  );
  const row = rowFnMatch![0];

  const iconIdx = row.indexOf("<CategoryIcon");
  const nameIdx = row.indexOf("{item.name}");
  const shareIdx = row.indexOf("{share}%");
  const amountIdx = row.indexOf("<HouseholdAmount");
  const barIdx = row.indexOf("backgroundColor: color");

  assert.ok(
    iconIdx > -1 && nameIdx > iconIdx && shareIdx > nameIdx && amountIdx > shareIdx && barIdx > amountIdx,
    "el orden en el DOM debe ser: icono, nombre, porcentaje, monto, barra (en ese orden)",
  );

  // El porcentaje vive junto al nombre (mismo contenedor flex-1), el monto es
  // un hermano posterior — igual que en CategoryBreakdownList de Personal.
  assert.ok(
    /justify-between gap-3">\s*<span[^>]*>\{item\.name\}<\/span>\s*<span[^>]*>\{share\}%<\/span>/.test(
      row,
    ),
    "nombre y porcentaje deben compartir la fila justify-between (percent a la derecha del nombre)",
  );

  // La barra es un bloque hermano FUERA del row de icono/nombre/monto (a todo
  // el ancho de la fila, no solo bajo el nombre): el <HouseholdAmount /> se
  // autocierra, luego cierra el div "flex items-center gap-3.5" y recién
  // después arranca el div de la barra.
  assert.ok(
    /\/>\s*<\/div>\s*<div className="h-2 w-full overflow-hidden rounded-full/.test(row),
    "la barra (h-2, w-full) debe estar fuera del bloque superior, ocupando toda la fila (hermana, no anidada bajo el nombre)",
  );

  console.log("✅ Caso 2: icono → nombre → % → monto, con barra completa debajo de toda la fila");
}

// ═══════════════════════════════════════════════════════════════════════════
// Caso 3 — Diferenciación Hogar: solo tokens --hh-*, HouseholdAmount, y color
// real de la categoría (no la paleta navy/--fm-* de Personal).
// ═══════════════════════════════════════════════════════════════════════════
async function testUsesOnlyHouseholdTokensAndRealColor() {
  const rowFnMatch = content.match(
    /function HouseholdCategoryBreakdownRow\([\s\S]*?\n\}\n/,
  );
  const row = rowFnMatch![0];

  assert.ok(/<HouseholdAmount/.test(row), "el monto debe usar HouseholdAmount, no Amount de Personal");
  assert.ok(!/\bAmount\b(?!.*Household)/.test(row.replace(/HouseholdAmount/g, "")), "no debe quedar Amount de Personal suelto");

  const hhTokenMatches = row.match(/var\(--hh-[a-z-]+\)/g) ?? [];
  assert.ok(hhTokenMatches.length >= 3, "debe usar múltiples tokens --hh-* (texto, borde, foco)");
  assert.ok(!/var\(--fm-/.test(row), "no debe colarse ningún token --fm-* de Personal");

  assert.ok(
    /const color = item\.color \|\| DEFAULT_HOUSEHOLD_CATEGORY_COLOR;/.test(row),
    "debe conservar el color real de la categoría de Hogar (con fallback del catálogo de Hogar)",
  );
  assert.ok(
    /style=\{\{ width: `\$\{share\}%`, backgroundColor: color \}\}/.test(row),
    "la barra debe pintarse con el color real de la categoría",
  );

  console.log("✅ Caso 3: solo tokens --hh-*, HouseholdAmount y color real de la categoría de Hogar");
}

// ═══════════════════════════════════════════════════════════════════════════
// Caso 4 — Responsive: nombre truncado y porcentaje/monto con shrink-0 para
// que nunca se superpongan en móvil.
// ═══════════════════════════════════════════════════════════════════════════
async function testResponsiveNoOverlap() {
  const rowFnMatch = content.match(
    /function HouseholdCategoryBreakdownRow\([\s\S]*?\n\}\n/,
  );
  const row = rowFnMatch![0];

  assert.ok(/truncate text-sm font-semibold/.test(row), "el nombre debe truncarse en espacios angostos");
  assert.ok(
    /shrink-0 text-xs font-medium[^>]*>\{share\}%/.test(row),
    "el porcentaje debe llevar shrink-0 para no comprimirse ni superponerse",
  );
  assert.ok(
    /HouseholdAmount[\s\S]{0,120}className="shrink-0/.test(row),
    "el monto debe llevar shrink-0 para mantenerse legible en móvil",
  );

  console.log("✅ Caso 4: nombre truncado + porcentaje/monto con shrink-0 (sin superposición móvil)");
}

// ═══════════════════════════════════════════════════════════════════════════
// Caso 5 — Fuera de alcance intacto: no se tocó groupCategoryBreakdown, ni el
// tab "Categorías del hogar" (manage), ni el diálogo de detalle.
// ═══════════════════════════════════════════════════════════════════════════
async function testScopeUntouched() {
  assert.ok(
    content.includes("groupCategoryBreakdown(filteredEvents, categories)"),
    "el cálculo de agrupación (groupCategoryBreakdown) debe seguir intacto",
  );
  assert.ok(
    content.includes('Nueva categoría'),
    "el tab de gestión (Categorías del hogar) debe seguir presente sin cambios de alcance",
  );
  assert.ok(
    content.includes("HouseholdEventDetailDialog"),
    "el diálogo de detalle de evento debe seguir presente",
  );
  assert.ok(
    /onClick=\{onSelect\}/.test(content),
    "el click de categoría sigue abriendo el detalle vía el mismo callback",
  );

  console.log("✅ Caso 5: lógica/datos, tab de gestión y diálogo de detalle fuera de alcance quedaron intactos");
}

async function run() {
  console.log("Running household-category-breakdown-parity tests...");
  await testRowIsNativeAccessibleButton();
  await testStructuralHierarchyMatchesPersonalPattern();
  await testUsesOnlyHouseholdTokensAndRealColor();
  await testResponsiveNoOverlap();
  await testScopeUntouched();
  console.log("All household-category-breakdown-parity tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
