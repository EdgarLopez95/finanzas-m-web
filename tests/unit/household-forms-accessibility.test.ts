import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running instrumental unit tests for household-forms-accessibility.test.ts...");

const readComponent = (fileName: string): string =>
  fs.readFileSync(
    path.resolve(__dirname, "../../src/features/household/components", fileName),
    "utf-8"
  );

// Contrato H4.3: cada control nativo (<select>/<input>) con texto visible de label debe
// tener un id estable y su <label> debe apuntar a él vía htmlFor. Verifica presencia de AMBOS
// atributos (no solo el par exacto) porque el house convention estructural no parsea JSX.
const assertLabelInputPair = (content: string, fileName: string, id: string) => {
  assert.ok(
    content.includes(`htmlFor="${id}"`),
    `${fileName}: debe existir <label htmlFor="${id}">`
  );
  assert.ok(
    content.includes(`id="${id}"`),
    `${fileName}: debe existir un control con id="${id}"`
  );
};

// Contrato: un label que encabeza un GRUPO (no controla un único input/select) no debe usar
// el elemento <label> (que exige htmlFor hacia un control concreto); debe degradarse a un
// elemento no interactivo (<span>/<p>) para no crear una asociación implícita incorrecta.
const assertNotDanglingLabel = (content: string, fileName: string, visibleText: string) => {
  const danglingLabelRe = new RegExp(`<label[^>]*>\\s*${visibleText}\\s*<\\/label>`, "s");
  assert.ok(
    !danglingLabelRe.test(content),
    `${fileName}: el encabezado de grupo "${visibleText}" no debe ser un <label> sin control asociado`
  );
};

function runHouseholdFormsAccessibilityTests() {
  // declare-payment-dialog.tsx (ya corregido)
  {
    const content = readComponent("declare-payment-dialog.tsx");
    assertLabelInputPair(content, "declare-payment-dialog.tsx", "declare-payment-account");
    assertLabelInputPair(content, "declare-payment-dialog.tsx", "declare-payment-pocket");
    assertLabelInputPair(content, "declare-payment-dialog.tsx", "declare-payment-date");
    assertLabelInputPair(content, "declare-payment-dialog.tsx", "declare-payment-description");
    console.log("  ✓ declare-payment-dialog.tsx: 4 pares label/input asociados");
  }

  // confirm-reception-dialog.tsx: Paso 2 (household-debt-auto-settle) lo redujo a
  // fallback manual excepcional sin fecha/descripción libres (paridad Android:
  // confirmReception no las acepta), solo queda el selector de cuenta.
  {
    const content = readComponent("confirm-reception-dialog.tsx");
    assertLabelInputPair(content, "confirm-reception-dialog.tsx", "confirm-reception-account");
    console.log("  ✓ confirm-reception-dialog.tsx: 1 par label/input asociado (fallback manual)");
  }

  // complete-share-dialog.tsx
  {
    const content = readComponent("complete-share-dialog.tsx");
    assertLabelInputPair(content, "complete-share-dialog.tsx", "complete-share-account");
    assertLabelInputPair(content, "complete-share-dialog.tsx", "complete-share-pocket");
    assertLabelInputPair(content, "complete-share-dialog.tsx", "complete-share-category");
    assertLabelInputPair(content, "complete-share-dialog.tsx", "complete-share-date");
    assertLabelInputPair(content, "complete-share-dialog.tsx", "complete-share-description");
    console.log("  ✓ complete-share-dialog.tsx: 5 pares label/input asociados");
  }

  // create-household-expense-dialog.tsx (V2 desktop: quién pagó también es
  // un grupo de opciones visibles, no un <select> — mismo patrón que el modo
  // de liquidación, ya no aplica assertLabelInputPair a ninguno de los dos).
  {
    const content = readComponent("create-household-expense-dialog.tsx");
    assertLabelInputPair(content, "create-household-expense-dialog.tsx", "create-household-expense-category");
    assertLabelInputPair(content, "create-household-expense-dialog.tsx", "create-household-expense-amount");
    assert.ok(
      content.includes('id="create-household-expense-date"') && content.includes("HouseholdDateField"),
      "create-household-expense-dialog.tsx: la fecha debe usar HouseholdDateField con id estable"
    );
    const dateField = readComponent("ui/household-date-field.tsx");
    assert.ok(
      dateField.includes("htmlFor={fieldId}") && dateField.includes("id={fieldId}"),
      "ui/household-date-field.tsx: label y control deben asociarse por fieldId"
    );
    // "¿Quién pagó?" y "¿Cómo se pagó?" son grupos de opciones (cards de
    // persona / modo de liquidación): como grupo NO pueden llevar
    // <label htmlFor> (no hay un único control), sino id + aria-label, igual
    // que los grupos de la toolbar de movimientos.
    assert.ok(
      content.includes('id="create-household-expense-paid-by"') &&
        content.includes('role="radiogroup"') &&
        content.includes('aria-label="¿Quién pagó?"'),
      "create-household-expense-dialog.tsx: el pagador debe ser un radiogroup con id + aria-label"
    );
    assert.ok(
      content.includes('id="create-household-expense-settlement-mode"') &&
        content.includes('role="radiogroup"') &&
        content.includes('aria-label="¿Cómo se pagó?"') &&
        content.includes("grid-cols-3"),
      "create-household-expense-dialog.tsx: el modo de liquidación debe ser radiogroup en 3 columnas"
    );
    assert.ok(
      content.includes("CreditCard") && content.includes("Gift") && content.includes("WalletCards"),
      "create-household-expense-dialog.tsx: modos con íconos tarjeta / regalo / dos tarjetas"
    );
    assertNotDanglingLabel(content, "create-household-expense-dialog.tsx", "¿Quién pagó\\?");
    assertNotDanglingLabel(content, "create-household-expense-dialog.tsx", "¿Cómo se pagó\\?");
    console.log("  ✓ create-household-expense-dialog.tsx: fecha + categoría + modo 3 cols con íconos");
  }

  // edit-household-expense-dialog.tsx
  {
    const content = readComponent("edit-household-expense-dialog.tsx");
    assertLabelInputPair(content, "edit-household-expense-dialog.tsx", "edit-household-expense-category");
    console.log("  ✓ edit-household-expense-dialog.tsx: 1 par label/select asociado");
  }

  // views/household-categories-view.tsx — editor en modal; picker sin buscador
  {
    const viewContent = readComponent("views/household-categories-view.tsx");
    assertLabelInputPair(viewContent, "views/household-categories-view.tsx", "household-category-name");
    assert.ok(
      viewContent.includes('<HouseholdDialog') && viewContent.includes('size="wide"'),
      "views/household-categories-view.tsx: crear/editar debe vivir en HouseholdDialog wide (paridad con Personal)"
    );
    assertNotDanglingLabel(viewContent, "views/household-categories-view.tsx", "Color");
    assertNotDanglingLabel(viewContent, "views/household-categories-view.tsx", "Grupo");
    console.log("  ✓ views/household-categories-view.tsx: nombre asociado + editor en modal; Color/Grupo no son labels huérfanos");
  }

  // views/household-movements-view.tsx — toolbar tipo Personal (pills + select)
  {
    const content = readComponent("views/household-movements-view.tsx");
    assertLabelInputPair(content, "views/household-movements-view.tsx", "household-history-category");
    assert.ok(
      content.includes('id="household-history-type"') && content.includes('aria-label="Tipo de movimiento"'),
      "views/household-movements-view.tsx: el grupo de tipo debe tener id + aria-label"
    );
    assert.ok(
      content.includes('id="household-history-status"') && content.includes('aria-label="Estado"'),
      "views/household-movements-view.tsx: el grupo de estado debe tener id + aria-label"
    );
    assert.ok(
      content.includes('aria-label="Limpiar filtros"'),
      "views/household-movements-view.tsx: Limpiar filtros debe tener aria-label"
    );
    console.log("  ✓ views/household-movements-view.tsx: toolbar pills + categoría accesible");
  }

  // views/household-settings-view.tsx
  {
    const content = readComponent("views/household-settings-view.tsx");
    assertNotDanglingLabel(content, "views/household-settings-view.tsx", "Zona de riesgo");
    console.log("  ✓ views/household-settings-view.tsx: \"Zona de riesgo\" ya no es <label> huérfano");
  }

  console.log("All household-forms-accessibility unit tests passed successfully!");
}

runHouseholdFormsAccessibilityTests();
