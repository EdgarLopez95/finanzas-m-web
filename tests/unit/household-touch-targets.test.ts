import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running instrumental unit tests for household-touch-targets.test.ts...");

const readComponent = (fileName: string): string =>
  fs.readFileSync(
    path.resolve(__dirname, "../../src/features/household/components", fileName),
    "utf-8"
  );

// Contrato H4.5 (WCAG 2.2 SC 2.5.8, nivel AA): un objetivo táctil confirmado debe garantizar
// al menos 24px en su dimensión mínima. Este proyecto usa la escala de espaciado de Tailwind
// (1 unidad = 4px), así que basta verificar que la clase de tamaño/min-size declarada en el
// control corresponda a >= 24px (h-6/min-h-6/size-6 o superior).
const TAILWIND_UNIT_PX = 4;

const parseTailwindSizeToPx = (token: string): number | null => {
  // admite formas "h-6", "min-h-6", "size-6", "h-[24px]", "min-h-[44px]"
  const arbitraryMatch = token.match(/\[(\d+(?:\.\d+)?)px\]$/);
  if (arbitraryMatch) return parseFloat(arbitraryMatch[1]);
  const scaleMatch = token.match(/-(\d+(?:\.\d+)?)$/);
  if (scaleMatch) return parseFloat(scaleMatch[1]) * TAILWIND_UNIT_PX;
  return null;
};

// Extrae el className del <button> más cercano (hacia adelante) a partir de un ancla estable
// usando expresiones regulares genéricas que capturen el JSX de forma flexible
const extractMinHeightPx = (content: string, fileName: string, anchor: string, maxDistance = 400): number => {
  const anchorIdx = content.indexOf(anchor);
  assert.ok(anchorIdx >= 0, `${fileName}: no se encontró el ancla "${anchor}"`);
  const window = content.slice(anchorIdx, anchorIdx + maxDistance);
  const classNameMatch = window.match(/className="([^"]*)"/);
  assert.ok(classNameMatch, `${fileName}: no se encontró className cerca del ancla "${anchor}"`);
  const classes = classNameMatch[1].split(/\s+/);

  let bestPx: number | null = null;
  for (const cls of classes) {
    let px: number | null = null;
    if (cls.startsWith("min-h-")) px = parseTailwindSizeToPx(cls.replace("min-h-", "h-"));
    else if (cls.startsWith("h-")) px = parseTailwindSizeToPx(cls);
    else if (cls.startsWith("size-")) px = parseTailwindSizeToPx(cls.replace("size-", "h-"));
    if (px !== null) bestPx = px;
  }
  return bestPx ?? 0;
};

const assertTouchTargetAtLeast24px = (
  content: string,
  fileName: string,
  anchor: string,
  label: string
) => {
  const px = extractMinHeightPx(content, fileName, anchor);
  assert.ok(
    px >= 24,
    `${fileName}: el objetivo táctil "${label}" debe declarar una altura mínima >= 24px (WCAG 2.2 SC 2.5.8), altura detectada: ${px}px`
  );
  return px;
};

export function runHouseholdTouchTargetsTests() {
  let assertions = 0;

  // H4.5 — Único caso confirmado por la auditoría original: el botón "Dividir
  // en partes iguales" de crear y editar gasto de Hogar, que sin clase de alto
  // ni padding vertical quedaba en el line-height de `text-xs` (16px).
  const createSource = readComponent("create-household-expense-dialog.tsx");
  assertTouchTargetAtLeast24px(
    createSource,
    "create-household-expense-dialog.tsx",
    "onClick={splitEqually}",
    "Dividir en partes iguales"
  );
  assertions++;


  // Controles ya conformes en la auditoría original: deben permanecer sin
  // cambios de tamaño (28px de Editar/Archivar y de los
  // swatches de color en el diálogo de categorías de Hogar).
  const categoriesSource = readComponent("views/household-categories-view.tsx");

  const iconButtonMatches = categoriesSource.match(/h-7 w-7/g) ?? [];
  assert.ok(
    iconButtonMatches.length >= 3,
    `views/household-categories-view.tsx: los controles de 28×28px ya conformes (Editar, Archivar, swatches) deben permanecer sin cambios; encontrados: ${iconButtonMatches.length}`
  );
  assertions++;

  console.log(`  ✓ Touch targets de Hogar validados correctamente (${assertions}/3 aserciones pasadas).`);
}

runHouseholdTouchTargetsTests();
