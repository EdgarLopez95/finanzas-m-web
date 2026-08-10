/**
 * tests/unit/household-share-confirm-on-expense.test.ts
 *
 * Verificación estática (sin React/RTL, siguiendo el patrón del repo):
 * confirma que "Crear gasto Personal" preselecciona compartir con Hogar
 * cuando es elegible, abre una confirmación previa antes de guardar (con el
 * switch como única fuente de verdad), reutiliza los dos flujos existentes
 * sin duplicar su lógica, y que "Otro"/Hogar-no-elegible se saltan la
 * confirmación.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf-8");

const cardPath = "src/features/transactions/components/create-expense-card.tsx";
const dialogPath = "src/components/finance/household-share-confirm-dialog.tsx";

// ═══════════════════════════════════════════════════════════════════════════
// Caso 1 — Objetivo 1: `isHouseholdShared` arranca en `canShareWithHousehold`.
// ═══════════════════════════════════════════════════════════════════════════
async function testInitialValueMatchesEligibility() {
  const content = read(cardPath);

  assert.ok(
    /const \[isHouseholdShared, setIsHouseholdShared\] = useState\(canShareWithHousehold\);/.test(
      content,
    ),
    "isHouseholdShared debe inicializarse con canShareWithHousehold (preseleccionado cuando es elegible)",
  );

  // `canShareWithHousehold` debe estar calculado ANTES de ese useState para
  // que el valor inicial no sea siempre `false` por orden de declaración.
  const canShareIdx = content.indexOf("const canShareWithHousehold =");
  const useStateIdx = content.indexOf(
    "const [isHouseholdShared, setIsHouseholdShared] = useState(canShareWithHousehold);",
  );
  assert.ok(canShareIdx > -1 && useStateIdx > -1 && canShareIdx < useStateIdx,
    "canShareWithHousehold debe declararse antes del useState que lo usa como valor inicial",
  );

  console.log("✅ Caso 1: isHouseholdShared preseleccionado con canShareWithHousehold al abrir");
}

// ═══════════════════════════════════════════════════════════════════════════
// Caso 2 — Objetivo 2: al pulsar Guardar con Hogar elegible, no se guarda de
// inmediato: se abre la confirmación previa en vez de llamar a runSubmit.
// ═══════════════════════════════════════════════════════════════════════════
async function testSubmitOpensConfirmWhenEligible() {
  const content = read(cardPath);

  assert.ok(
    /const householdShareConfirmEligible = canShareWithHousehold && !consumesThirdPartyFunds;/.test(
      content,
    ),
    "debe existir householdShareConfirmEligible = elegible Y no-Otro",
  );

  assert.ok(
    /if \(householdShareConfirmEligible\) \{\s*setShowHouseholdConfirm\(true\);\s*return;\s*\}/.test(
      content,
    ),
    "handleSubmit debe abrir la confirmación (y salir) cuando householdShareConfirmEligible",
  );

  // El guardado real solo ocurre después, fuera de esa rama.
  const submitFnMatch = content.match(
    /const handleSubmit = async[\s\S]*?\n  \};/,
  );
  assert.ok(submitFnMatch, "debe existir handleSubmit");
  assert.ok(
    /await runSubmit\(isHouseholdShared\);/.test(submitFnMatch![0]),
    "handleSubmit solo debe guardar directo (runSubmit) cuando no aplica la confirmación",
  );

  console.log("✅ Caso 2: Guardar con Hogar elegible abre la confirmación antes de guardar");
}

// ═══════════════════════════════════════════════════════════════════════════
// Caso 3 — Objetivo 4: switch apagado en la confirmación → flujo Personal
// puro (sin evento/deuda/proyección de Hogar).
// ═══════════════════════════════════════════════════════════════════════════
async function testToggleOffUsesPersonalFlow() {
  const content = read(cardPath);

  assert.ok(
    /const effectiveShareWithHousehold =\s*shareWithHousehold && canShareWithHousehold && Boolean\(householdActiveId\) && !consumesThirdPartyFunds;/.test(
      content,
    ),
    "runSubmit debe derivar effectiveShareWithHousehold del parámetro shareWithHousehold recibido",
  );
  assert.ok(
    /const ok = effectiveShareWithHousehold\s*\? await submitExpenseWithHouseholdProjection\(\{/.test(
      content,
    ),
    "con effectiveShareWithHousehold=false, runSubmit debe caer al submitExpense normal (rama else)",
  );
  assert.ok(
    /: await submitExpense\(\{/.test(content),
    "la rama else de runSubmit debe ser submitExpense (flujo Personal existente, sin duplicar lógica)",
  );

  console.log("✅ Caso 3: switch apagado en la confirmación usa el flujo Personal existente (submitExpense)");
}

// ═══════════════════════════════════════════════════════════════════════════
// Caso 4 — Objetivo 5: switch encendido → se mantiene
// submitExpenseWithHouseholdProjection con reparto y categoría mapeada.
// ═══════════════════════════════════════════════════════════════════════════
async function testToggleOnKeepsHouseholdProjectionFlow() {
  const content = read(cardPath);

  assert.ok(
    /householdId: householdActiveId as string,\s*householdCategoryId: resolveHouseholdCategoryId\(\),\s*memberShares: householdMemberShares,/.test(
      content,
    ),
    "el payload de proyección debe seguir mapeando categoría (resolveHouseholdCategoryId) y reparto (householdMemberShares)",
  );

  // El botón "Confirmar y guardar" ejecuta el mismo runSubmit con el valor
  // actual del switch, no una copia de la lógica de envío.
  assert.ok(
    /const handleConfirmAndSaveWithHousehold = async \(\) => \{[\s\S]{0,120}await runSubmit\(isHouseholdShared\);/.test(
      content,
    ),
    "el botón de confirmación debe llamar a runSubmit(isHouseholdShared), reutilizando la misma función",
  );

  console.log("✅ Caso 4: switch encendido mantiene submitExpenseWithHouseholdProjection con reparto/categoría");
}

// ═══════════════════════════════════════════════════════════════════════════
// Caso 5 — Objetivo 6/7: sin Hogar elegible, o con "Otro" seleccionado, no
// aparece la confirmación: se guarda directo.
// ═══════════════════════════════════════════════════════════════════════════
async function testNoConfirmWhenNotEligibleOrOtherSelected() {
  const content = read(cardPath);

  // householdShareConfirmEligible ya exige !consumesThirdPartyFunds (cubre "Otro")
  // y canShareWithHousehold (cubre Hogar no elegible) — ambos casos comparten
  // la misma guarda, así que si esa condición es false, cae directo a runSubmit.
  assert.ok(
    /const householdShareConfirmEligible = canShareWithHousehold && !consumesThirdPartyFunds;/.test(
      content,
    ),
    "la guarda de elegibilidad debe exigir Hogar elegible Y que no esté seleccionado 'Otro'",
  );

  // "Otro" sigue apagando el toggle como antes (comportamiento previo intacto).
  assert.ok(
    /if \(nextConsumesThirdParty && isHouseholdShared\) \{\s*setIsHouseholdShared\(false\);\s*\}/.test(
      content,
    ),
    "seleccionar 'Otro' debe seguir apagando isHouseholdShared",
  );

  console.log(
    "✅ Caso 5: sin Hogar elegible o con 'Otro' seleccionado, no se abre confirmación (guarda directo)",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Caso 6 — Contrato del diálogo de confirmación: copy exacto, switch
// sincronizado con la elección actual, accesibilidad y protección de doble
// envío + Hogar dejando de ser usable mientras está abierta.
// ═══════════════════════════════════════════════════════════════════════════
async function testConfirmDialogContractAndSafety() {
  const dialog = read(dialogPath);

  assert.ok(dialog.includes("¿También registrar en Hogar?"), "falta el título exacto");
  assert.ok(
    dialog.includes("Este gasto se verá en tu Hogar y no volverá a mover el saldo de tu cuenta."),
    "falta el texto exacto",
  );
  assert.ok(dialog.includes("Ver también en Hogar"), "falta la etiqueta exacta del switch");
  assert.ok(dialog.includes("Volver a editar"), "falta la acción secundaria exacta");
  assert.ok(dialog.includes("Confirmar y guardar"), "falta la acción primaria exacta");

  // Accesibilidad: dialog + aria-modal + labelledby/describedby + foco inicial seguro.
  assert.ok(/role="dialog"/.test(dialog), "debe usar role=\"dialog\"");
  assert.ok(/aria-modal="true"/.test(dialog), "debe declarar aria-modal");
  assert.ok(
    /aria-labelledby=\{titleId\}/.test(dialog) && /aria-describedby=\{descriptionId\}/.test(dialog),
    "título y mensaje deben estar asociados vía aria-labelledby/describedby",
  );
  assert.ok(
    /ref=\{returnToEditRef\}[\s\S]{0,300}Volver a editar/.test(dialog),
    "\"Volver a editar\" debe llevar la ref de foco inicial (no el CTA primario)",
  );
  assert.ok(
    /returnToEditRef\.current\?\.focus\(\)/.test(dialog),
    "debe enfocar \"Volver a editar\" al abrir",
  );

  // Escape/backdrop equivalen a "Volver a editar" (cierra solo la confirmación).
  assert.ok(
    /useFocusTrap\(panelRef, open, onReturnToEdit\)/.test(dialog),
    "Escape debe resolver a onReturnToEdit vía la pila compartida de focus-trap",
  );
  assert.ok(
    /onMouseDown=\{\(event\) => \{\s*if \(event\.target === event\.currentTarget\) \{\s*onReturnToEdit\(\);/.test(
      dialog,
    ),
    "el backdrop debe invocar onReturnToEdit, nunca onConfirm",
  );

  // Doble envío: ambos botones se deshabilitan mientras isSubmitting.
  assert.ok(
    /onClick=\{onReturnToEdit\}\s*disabled=\{isSubmitting\}/.test(dialog),
    "\"Volver a editar\" debe deshabilitarse mientras isSubmitting",
  );
  assert.ok(
    /onClick=\{onConfirm\}\s*disabled=\{isSubmitting\}/.test(dialog),
    "\"Confirmar y guardar\" debe deshabilitarse mientras isSubmitting",
  );

  // Switch sincronizado con la elección actual: el mismo estado que controla
  // el ToggleRow del formulario (isHouseholdShared) alimenta el diálogo.
  const cardContent = read(cardPath);
  assert.ok(
    /shareWithHousehold=\{isHouseholdShared\}\s*onShareWithHouseholdChange=\{setIsHouseholdShared\}/.test(
      cardContent,
    ),
    "el diálogo debe recibir isHouseholdShared/setIsHouseholdShared (misma fuente de verdad que el formulario)",
  );

  // Protección: si el Hogar deja de ser usable mientras la confirmación está
  // abierta, se cierra sola en vez de dejar una confirmación huérfana.
  assert.ok(
    /if \(showHouseholdConfirm && !canShareWithHousehold\) \{\s*setShowHouseholdConfirm\(false\);\s*\}/.test(
      cardContent,
    ),
    "debe cerrar la confirmación automáticamente si canShareWithHousehold pasa a false mientras está abierta",
  );

  console.log(
    "✅ Caso 6: diálogo de confirmación — copy exacto, a11y, foco inicial, doble-envío y Hogar-inestable cubiertos",
  );
}

async function run() {
  console.log("Running household-share-confirm-on-expense tests...");
  await testInitialValueMatchesEligibility();
  await testSubmitOpensConfirmWhenEligible();
  await testToggleOffUsesPersonalFlow();
  await testToggleOnKeepsHouseholdProjectionFlow();
  await testNoConfirmWhenNotEligibleOrOtherSelected();
  await testConfirmDialogContractAndSafety();
  console.log("All household-share-confirm-on-expense tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
