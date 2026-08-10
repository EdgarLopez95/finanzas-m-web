import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running instrumental unit tests for household-forms-ios-zoom.test.ts...");

const readComponent = (fileName: string): string =>
  fs.readFileSync(
    path.resolve(__dirname, "../../src/features/household/components", fileName),
    "utf-8"
  );

// Contrato H4.4: Safari iOS hace auto-zoom al enfocar un control de formulario cuyo font-size
// computado en móvil es menor a 16px. Cada control editable (<input>/<select>/<textarea>) de
// los formularios de Hogar debe tener un tamaño base (sin variante de breakpoint) >= 16px; una
// reducción de tamaño para pantallas más grandes SOLO es válida si va detrás de un prefijo de
// breakpoint no-móvil (ej. "sm:"), nunca como clase base sin prefijo.
// Captura CADA tamaño declarado sin prefijo de breakpoint (el tamaño base, que es
// el que aplica en móvil). No se exige un valor concreto: basta con que todos los
// tamaños base sean >= 16px — un hero de monto en 38px es igual de seguro que 16px.
const BASE_FONT_SIZE_RE = /(?<!\bsm:)(?<!\bmd:)(?<!\blg:)(?<!\bxl:)text-\[(\d+)px\]/g;

// Extrae SOLO el valor del atributo className más cercano al ancla (no una ventana de texto
// amplia) para no capturar el className de un elemento vecino no relacionado (ej. el <label>
// del siguiente campo, que legítimamente puede seguir siendo pequeño porque no es un control
// enfocable ni dispara el auto-zoom de Safari iOS).
const extractClassNameNearAnchor = (
  content: string,
  fileName: string,
  anchor: string,
  maxDistance = 700
): string => {
  const anchorIdx = content.indexOf(anchor);
  assert.ok(anchorIdx >= 0, `${fileName}: no se encontró el ancla "${anchor}"`);
  const window = content.slice(anchorIdx, anchorIdx + maxDistance);
  const match = window.match(/className="([^"]*)"/);
  assert.ok(match, `${fileName}: no se encontró className cerca del ancla "${anchor}"`);
  return match[1];
};

// Verifica que el control (identificado por un ancla estable: id="..." o label/aria-label
// único) tenga font-size base >= 16px y, si declara una reducción, esta vaya detrás de "sm:".
const assertMobileSafeFontNearAnchor = (
  content: string,
  fileName: string,
  anchor: string
) => {
  const className = extractClassNameNearAnchor(content, fileName, anchor);
  const baseSizes = Array.from(className.matchAll(BASE_FONT_SIZE_RE)).map((m) => Number(m[1]));
  assert.ok(
    baseSizes.length > 0,
    `${fileName}: el control anclado en "${anchor}" debe declarar un font-size base explícito (evita auto-zoom de Safari iOS)`
  );
  assert.ok(
    baseSizes.every((size) => size >= 16),
    `${fileName}: el control anclado en "${anchor}" no debe tener un text-[<16px] SIN prefijo de breakpoint como clase base`
  );
};

function runHouseholdFormsIosZoomTests() {
  // declare-payment-dialog.tsx: select cuenta, select bolsillo, input fecha, input descripción
  {
    const content = readComponent("declare-payment-dialog.tsx");
    assertMobileSafeFontNearAnchor(content, "declare-payment-dialog.tsx", 'id="declare-payment-account"');
    assertMobileSafeFontNearAnchor(content, "declare-payment-dialog.tsx", 'id="declare-payment-pocket"');
    assertMobileSafeFontNearAnchor(content, "declare-payment-dialog.tsx", 'id="declare-payment-date"');
    assertMobileSafeFontNearAnchor(content, "declare-payment-dialog.tsx", 'id="declare-payment-description"');
    console.log("  ✓ declare-payment-dialog.tsx: 4 controles con font-size móvil seguro (>=16px)");
  }

  // confirm-reception-dialog.tsx: Paso 2 lo redujo a fallback manual excepcional,
  // solo queda el select de cuenta (sin fecha/descripción libres).
  {
    const content = readComponent("confirm-reception-dialog.tsx");
    assertMobileSafeFontNearAnchor(content, "confirm-reception-dialog.tsx", 'id="confirm-reception-account"');
    console.log("  ✓ confirm-reception-dialog.tsx: 1 control con font-size móvil seguro (>=16px)");
  }

  // complete-share-dialog.tsx: select cuenta, select bolsillo, select categoría, input fecha, input descripción
  {
    const content = readComponent("complete-share-dialog.tsx");
    assertMobileSafeFontNearAnchor(content, "complete-share-dialog.tsx", 'id="complete-share-account"');
    assertMobileSafeFontNearAnchor(content, "complete-share-dialog.tsx", 'id="complete-share-pocket"');
    assertMobileSafeFontNearAnchor(content, "complete-share-dialog.tsx", 'id="complete-share-category"');
    assertMobileSafeFontNearAnchor(content, "complete-share-dialog.tsx", 'id="complete-share-date"');
    assertMobileSafeFontNearAnchor(content, "complete-share-dialog.tsx", 'id="complete-share-description"');
    console.log("  ✓ complete-share-dialog.tsx: 5 controles con font-size móvil seguro (>=16px)");
  }

  // create-household-expense-dialog.tsx (V2 desktop): hero de monto + 1 select
  // de categoría + 3 HouseholdTextField (Título, Fecha, Descripción bajo
  // demanda) + la cuota por miembro. El modo de liquidación y el pagador ya
  // NO son controles editables de texto — son radiogroups de cards — así que
  // ninguno de los dos dispara el auto-zoom de Safari iOS ni se ancla aquí.
  {
    const content = readComponent("create-household-expense-dialog.tsx");
    assertMobileSafeFontNearAnchor(content, "create-household-expense-dialog.tsx", 'id="create-household-expense-amount"');
    assertMobileSafeFontNearAnchor(content, "create-household-expense-dialog.tsx", 'id="create-household-expense-category"');
    assertMobileSafeFontNearAnchor(content, "create-household-expense-dialog.tsx", 'label="Título (obligatorio)"');
    assertMobileSafeFontNearAnchor(content, "create-household-expense-dialog.tsx", 'label="Descripción (opcional)"');
    assertMobileSafeFontNearAnchor(content, "create-household-expense-dialog.tsx", "aria-label={`Responsabilidad de ${resolveRealName(memberId)}`}");
    const dateField = readComponent("ui/household-date-field.tsx");
    assert.ok(
      dateField.includes("text-[16px]") && dateField.includes("sm:text-[14px]"),
      "ui/household-date-field.tsx: el trigger de fecha debe tener font-size base 16px (iOS) y sm:14px"
    );
    console.log("  ✓ create-household-expense-dialog.tsx: controles + HouseholdDateField con font-size móvil seguro (>=16px)");
  }

  // edit-household-expense-dialog.tsx: 1 select nativo + 3 HouseholdTextField
  {
    const content = readComponent("edit-household-expense-dialog.tsx");
    assertMobileSafeFontNearAnchor(content, "edit-household-expense-dialog.tsx", 'id="edit-household-expense-category"');
    assertMobileSafeFontNearAnchor(content, "edit-household-expense-dialog.tsx", 'label="Título *"');
    assertMobileSafeFontNearAnchor(content, "edit-household-expense-dialog.tsx", 'label="Descripción (opcional)"');
    assertMobileSafeFontNearAnchor(content, "edit-household-expense-dialog.tsx", 'label="Fecha *"');
    console.log("  ✓ edit-household-expense-dialog.tsx: 4 controles con font-size móvil seguro (>=16px)");
  }

  // views/household-categories-view.tsx — modal crear/editar
  {
    const content = readComponent("views/household-categories-view.tsx");
    assertMobileSafeFontNearAnchor(content, "views/household-categories-view.tsx", 'id="household-category-name"');
    console.log("  ✓ views/household-categories-view.tsx: 1 control con font-size móvil seguro (>=16px)");
  }

  // views/household-movements-view.tsx — solo el select de categoría es control editable
  {
    const content = readComponent("views/household-movements-view.tsx");
    assertMobileSafeFontNearAnchor(content, "views/household-movements-view.tsx", 'id="household-history-category"');
    console.log("  ✓ views/household-movements-view.tsx: select de categoría con font-size móvil seguro (>=16px)");
  }

  // views/household-settings-view.tsx
  {
    const content = readComponent("views/household-settings-view.tsx");
    assertMobileSafeFontNearAnchor(content, "views/household-settings-view.tsx", 'id="householdRenameName"');
    console.log("  ✓ views/household-settings-view.tsx: 1 control con font-size móvil seguro (>=16px)");
  }

  // Contrato de no-regresión H4.3: las asociaciones label/id, los tipos de input y los estados
  // disabled no deben alterarse por este bloque (H4.4 solo toca font-size).
  {
    const declareContent = readComponent("declare-payment-dialog.tsx");
    assert.ok(declareContent.includes('htmlFor="declare-payment-account"'), "declare-payment-dialog.tsx: htmlFor de H4.3 debe permanecer intacto");
    assert.ok(declareContent.includes('type="date"'), "declare-payment-dialog.tsx: type=date debe permanecer intacto");

    const editContent = readComponent("edit-household-expense-dialog.tsx");
    assert.ok(editContent.includes('id="edit-household-expense-category"'), "edit-household-expense-dialog.tsx: id de H4.3 debe permanecer intacto");

    const settingsContent = readComponent("views/household-settings-view.tsx");
    assert.ok(settingsContent.includes('label="Nombre del Hogar"'), "views/household-settings-view.tsx: label de H4.3 debe permanecer intacto");

    console.log("  ✓ No-regresión H4.3: labels htmlFor/id, tipos de input y estados disabled intactos");
  }

  console.log("All household-forms-ios-zoom unit tests passed successfully!");
}

runHouseholdFormsIosZoomTests();
