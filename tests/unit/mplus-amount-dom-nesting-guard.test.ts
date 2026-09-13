import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Amount } from "@/components/finance/amount";
import { HouseholdAmount } from "@/features/household/components/ui/household-amount";

console.log("Running unit tests for mplus-amount-dom-nesting-guard.test.ts...");

export function runAmountDomNestingGuardTests() {
  let passed = 0;

  // 1. HouseholdAmount renders as <span> by default to prevent DOM nesting violations
  const householdHtml = renderToStaticMarkup(
    React.createElement(HouseholdAmount, { value: 50000, variant: "expense", size: "sm" }),
  );
  assert.ok(
    householdHtml.startsWith("<span") && householdHtml.endsWith("</span>"),
    `HouseholdAmount debe renderizar como <span> por defecto para evitar anidamiento inválido en <p>, obtenido: ${householdHtml}`,
  );
  passed++;
  console.log("  ✓ [DOM-NEST-01] HouseholdAmount renderiza como <span> por defecto");

  // 2. HouseholdAmount respeta el prop 'as' cuando se solicita explícitamente
  const pMarkup = renderToStaticMarkup(
    React.createElement(HouseholdAmount, { value: 50000, variant: "expense", size: "sm", as: "p" }),
  );
  assert.ok(pMarkup.startsWith("<p") && pMarkup.endsWith("</p>"), "HouseholdAmount debe respetar as='p'");

  const divMarkup = renderToStaticMarkup(
    React.createElement(HouseholdAmount, { value: 50000, variant: "expense", size: "sm", as: "div" }),
  );
  assert.ok(divMarkup.startsWith("<div") && divMarkup.endsWith("</div>"), "HouseholdAmount debe respetar as='div'");
  passed++;
  console.log("  ✓ [DOM-NEST-02] HouseholdAmount respeta el prop 'as' (p, div, span)");

  // 3. Amount (personal) renderiza como <span> por defecto
  const amountHtml = renderToStaticMarkup(
    React.createElement(Amount, { value: 120000, variant: "expense", size: "sm" }),
  );
  assert.ok(
    amountHtml.startsWith("<span") && amountHtml.endsWith("</span>"),
    `Amount debe renderizar como <span> por defecto, obtenido: ${amountHtml}`,
  );
  passed++;
  console.log("  ✓ [DOM-NEST-03] Amount (personal) renderiza como <span> por defecto");

  // 4. mplus-household-movements-view.tsx: la fila de papelera no anida HouseholdAmount dentro de <p>
  const movementsViewPath = path.resolve(
    __dirname,
    "../../src/features/household/components/mplus-household-movements-view.tsx",
  );
  const movementsViewContent = fs.readFileSync(movementsViewPath, "utf8");

  // Buscar el bloque de papelera donde está daysLeft
  const trashBlockMatch = movementsViewContent.match(
    /<div[^>]*min-w-0 flex-1[^>]*>[\s\S]*?<\/div>/,
  );
  assert.ok(trashBlockMatch, "Debe existir el contenedor del ítem de papelera");
  assert.ok(
    !trashBlockMatch[0].includes("<p className=\"text-xs text-[var(--hh-text-muted)] mt-0.5\">\n                        <HouseholdAmount"),
    "La fila de papelera NO debe anidar <HouseholdAmount> dentro de un <p>",
  );
  assert.ok(
    trashBlockMatch[0].includes("<div className=\"text-xs text-[var(--hh-text-muted)] mt-0.5 flex items-center gap-1.5\">"),
    "La fila de papelera debe usar un <div> flex para el subtítulo de vencimiento",
  );
  passed++;
  console.log("  ✓ [DOM-NEST-04] Fila de papelera de Hogar usa <div> contenedor y no anida <p> dentro de <p>");

  // 5. mplus-household-movements-view.tsx: el diálogo de detalle de gasto de Hogar renderiza ProfileAvatar en los cuadros de distribución
  assert.ok(
    movementsViewContent.includes("import { ProfileAvatar } from \"@/components/ui/profile-avatar\";"),
    "movements view debe importar ProfileAvatar",
  );
  const distributionBlockMatch = movementsViewContent.match(
    /<div className="grid grid-cols-2 gap-3 text-xs">[\s\S]*?<\/div>\s*<\/div>/,
  );
  assert.ok(distributionBlockMatch, "Debe existir el bloque de distribución en el diálogo de detalle");
  assert.ok(
    distributionBlockMatch[0].includes("<ProfileAvatar"),
    "Los cuadros de distribución de gasto de Hogar deben renderizar ProfileAvatar",
  );
  passed++;
  console.log("  ✓ [DOM-NEST-05] Cuadros de distribución de gasto de Hogar incluyen ProfileAvatar con fotos de perfil");

  console.log(`\nTests for mplus-amount-dom-nesting-guard: ${passed} passed, 0 failed\n`);
}

if (require.main === module) {
  runAmountDomNestingGuardTests();
}
