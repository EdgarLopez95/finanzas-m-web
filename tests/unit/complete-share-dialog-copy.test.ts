import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

console.log("Running unit tests for complete-share-dialog-copy.test.ts...");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

const dialogPath = "features/household/components/complete-share-dialog.tsx";

// ==========================================
// Paridad Android (HomeScreen.kt card "Por anotar" + CTA "Anotar";
// ExpenseEntryScreen.kt título/acción "Completar mi parte";
// ExpenseEntryViewModel.kt: el concepto prellenado parte del título REAL del
// evento, nunca de un prefijo fijo de "pago de cuota").
// ==========================================

function runDialogContainsCompletarMiParteTest() {
  const source = readSource(dialogPath);
  assert.ok(source.includes("Completar mi parte"), "el diálogo debe usar el título/acción canónico 'Completar mi parte'");

  console.log("Item 2 (diálogo contiene 'Completar mi parte'): 1/1 aserción pasada.");
}

function runNoLegacyDebtCopyLiteralsTest() {
  const source = readSource(dialogPath);
  assert.ok(!source.includes("Pagar mi parte"), "no debe quedar el literal 'Pagar mi parte'");
  assert.ok(!source.includes("Pago cuota Hogar"), "no debe quedar el literal 'Pago cuota Hogar'");
  assert.ok(!source.includes("Confirmar Pago"), "no debe quedar el copy de pago 'Confirmar Pago'");
  assert.ok(!source.includes("Monto a Debitar"), "no debe quedar el copy de deuda 'Monto a Debitar'");

  console.log("Item 3 (sin literales legacy de pago/deuda): 4/4 aserciones pasadas.");
}

function runPrefilledDescriptionIsEventTitleTest() {
  const source = readSource(dialogPath);
  // El valor prellenado de la descripción debe ser exactamente el título del
  // evento, sin ningún prefijo fijo concatenado.
  assert.ok(
    source.match(/setDescription\(eventTitle\)/),
    "la descripción prellenada debe ser exactamente eventTitle, sin prefijo 'Pago cuota Hogar:' ni ningún otro"
  );
  assert.ok(
    !source.match(/setDescription\(`[^`]*\$\{eventTitle\}[^`]*`\)/),
    "no debe quedar ningún template literal con prefijo/sufijo alrededor de eventTitle"
  );

  console.log("Item 4 (descripción prellenada = título real del evento): 2/2 aserciones pasadas.");
}

function runCopyIsModeAgnosticTest() {
  const source = readSource(dialogPath);
  // El copy corregido no debe introducir ninguna ramificación por
  // settlementMode — debe ser el mismo texto neutral para los 3 modos.
  assert.ok(
    !source.includes("settlementMode"),
    "el diálogo no debe ramificar copy por settlementMode — un único copy neutral sirve para advancedByPayer, eachPaysOwn e invitation"
  );
  assert.ok(
    !source.includes("deuda") && !source.includes("Deuda"),
    "el copy corregido no debe mencionar 'deuda' en ningún punto del diálogo de anotar"
  );

  console.log("Item 5 (copy neutral sin ramificaciones por modo): 2/2 aserciones pasadas.");
}

function runNoFinancialLogicChangedStructuralTest() {
  const source = readSource(dialogPath);
  // Confirmar que la lógica financiera (props, submit, validaciones) sigue
  // intacta — solo cambió texto visible.
  assert.ok(source.includes("shareId"), "prop shareId intacta");
  assert.ok(source.includes("shareAmount"), "prop shareAmount intacta");
  assert.ok(source.includes("useCompleteHouseholdEventShare"), "el hook de negocio sigue siendo el mismo, sin reimplementar");
  assert.ok(source.includes("hasEnoughBalance"), "la validación de saldo suficiente sigue intacta");
  assert.ok(source.includes('categoryId,\n      date: parsedDate'), "el payload enviado al servicio real sigue incluyendo categoryId/date sin cambios");

  console.log("Sin cambios a lógica financiera (solo copy): 5/5 aserciones pasadas.");
}

runDialogContainsCompletarMiParteTest();
runNoLegacyDebtCopyLiteralsTest();
runPrefilledDescriptionIsEventTitleTest();
runCopyIsModeAgnosticTest();
runNoFinancialLogicChangedStructuralTest();

console.log("OK complete-share-dialog-copy");
