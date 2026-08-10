/**
 * tests/unit/discard-confirm-on-create.test.ts
 *
 * Verificación estática (sin React/RTL, siguiendo el patrón del repo):
 * confirma que las 4 rutas de cierre (X, Escape, backdrop, Cancelar) de los
 * composers de creación Personal y del paso 1/2 de "Nuevo gasto Hogar" pasan
 * por la confirmación de descarte, que el botón "Atrás" de Hogar (paso 2) es
 * la única excepción, y que el CTA destructivo es el único camino que cierra
 * de verdad.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf-8");

// ═══════════════════════════════════════════════════════════════════════════
// Caso 1 — Personal: las 4 rutas de cierre del composer de creación pasan por
// la confirmación (nunca llaman a closePanel directo), y solo edición sigue
// cerrando directo (fuera de alcance).
// ═══════════════════════════════════════════════════════════════════════════
async function testPersonalCreateRoutesRequireConfirm() {
  const content = read("src/features/transactions/components/create-movement-dialog.tsx");

  // X y Escape/backdrop: los tres pasan por el mismo onClose del FinanceDialog.
  assert.ok(
    /onClose=\{handleRequestClose\}/.test(content),
    "FinanceDialog debe recibir handleRequestClose (X, Escape y backdrop comparten esa única puerta)",
  );

  // Cancelar de los 3 composers de creación: gasto, ingreso, transferencia.
  const cancelMatches = content.match(/onCancel=\{handleRequestClose\}/g) ?? [];
  assert.equal(
    cancelMatches.length,
    3,
    "los 3 composers de creación (gasto/ingreso/transferencia) deben usar handleRequestClose en Cancelar",
  );

  // Edición queda fuera de alcance: sigue cerrando directo.
  assert.ok(
    /EditTransactionCard[\s\S]{0,300}onCancel=\{closePanel\}/.test(content),
    "editar movimiento debe seguir cerrando directo (fuera de alcance de esta tarea)",
  );

  // handleRequestClose no cierra por sí mismo cuando no es edición: solo abre confirmación.
  assert.ok(
    /const handleRequestClose = \(\) => \{[\s\S]{0,120}setShowDiscardConfirm\(true\);/.test(content),
    "handleRequestClose debe abrir la confirmación en vez de cerrar directo (fuera de edición)",
  );

  // El único cierre real vive en el onDiscard de la confirmación.
  assert.ok(
    /onDiscard=\{\(\) => \{\s*setShowDiscardConfirm\(false\);\s*closePanel\(\);\s*\}\}/.test(content),
    "solo el onDiscard de DiscardConfirmDialog debe llamar a closePanel",
  );

  // Guardar con éxito sigue cerrando directo (handleCreated no pasa por confirmación).
  assert.ok(
    /const handleCreated = async \(\) => \{\s*await personalData\.refresh\(\);\s*closePanel\(\);\s*\};/.test(
      content,
    ),
    "guardar con éxito debe seguir cerrando directo, sin confirmación",
  );

  console.log("✅ Caso 1: Personal — X/Escape/backdrop/Cancelar piden confirmación; éxito cierra directo");
}

// ═══════════════════════════════════════════════════════════════════════════
// Caso 2 — Hogar: X/Escape/backdrop piden confirmación en ambos pasos; el
// botón "Cancelar" del paso 1 también; "Atrás" del paso 2 es la excepción.
// ═══════════════════════════════════════════════════════════════════════════
async function testHouseholdStepAwareConfirm() {
  const content = read(
    "src/features/household/components/create-household-expense-dialog.tsx",
  );

  // X y Escape/backdrop del diálogo (ambos pasos: HouseholdDialog es una sola instancia).
  assert.ok(
    /onClose=\{handleRequestDiscardConfirm\}/.test(content),
    "HouseholdDialog debe recibir handleRequestDiscardConfirm en su onClose (X, Escape, backdrop)",
  );
  assert.ok(
    /useFocusTrap\(dialogRef, open, handleRequestDiscardConfirm\)/.test(content),
    "el trap de foco (Escape) debe delegar en handleRequestDiscardConfirm en ambos pasos",
  );

  // El footer usa handleGoBackToStep1 en paso 2 (sin confirmar) y
  // handleRequestDiscardConfirm en paso 1 (Cancelar, con confirmación).
  assert.ok(
    /onClick=\{step === 2 \? handleGoBackToStep1 : handleRequestDiscardConfirm\}/.test(content),
    "el botón del footer debe usar handleGoBackToStep1 en paso 2 y handleRequestDiscardConfirm en paso 1",
  );

  // "Atrás" no debe llamar a la confirmación ni a onClose.
  assert.ok(
    /const handleGoBackToStep1 = \(\) => \{\s*setStep\(1\);\s*setSubmitted\(false\);\s*\};/.test(content),
    "handleGoBackToStep1 solo debe volver al paso 1, sin abrir confirmación ni cerrar",
  );
  assert.ok(
    !/handleGoBackToStep1[\s\S]{0,80}(onClose\(\)|setShowDiscardConfirm)/.test(content),
    "handleGoBackToStep1 no debe invocar onClose ni abrir la confirmación",
  );

  // El único cierre real del diálogo de Hogar vive en el onDiscard de la confirmación
  // (y en el guardado exitoso vía persistExpense, que ya usa onClose() aparte).
  assert.ok(
    /onDiscard=\{\(\) => \{\s*setShowDiscardConfirm\(false\);\s*onClose\(\);\s*\}\}/.test(content),
    "solo el onDiscard de HouseholdDiscardConfirmDialog debe llamar a onClose",
  );
  assert.ok(
    /if \(ok\) onClose\(\);/.test(content),
    "guardar con éxito debe seguir cerrando directo, sin pasar por la confirmación",
  );

  console.log(
    "✅ Caso 2: Hogar — X/Escape/backdrop/Cancelar confirman en ambos pasos; Atrás vuelve sin confirmar",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Caso 3 — Componentes de confirmación: título/mensaje exactos, foco inicial
// en "Seguir editando", Escape/backdrop equivalen a "Seguir editando" (nunca
// descartan), y usan la pila compartida de focus-trap para no propagar el
// cierre al formulario original.
// ═══════════════════════════════════════════════════════════════════════════
async function testConfirmDialogsContractAndA11y() {
  const files = [
    "src/components/finance/discard-confirm-dialog.tsx",
    "src/features/household/components/ui/household-discard-confirm-dialog.tsx",
  ];

  for (const file of files) {
    const content = read(file);

    assert.ok(content.includes("¿Cancelar registro?"), `${file}: falta el título exacto`);
    assert.ok(
      content.includes("Se perderán los datos que has ingresado."),
      `${file}: falta el mensaje exacto`,
    );
    assert.ok(content.includes("Seguir editando"), `${file}: falta el botón secundario`);
    assert.ok(content.includes("Sí, descartar"), `${file}: falta el CTA destructivo`);

    // Accesibilidad: alertdialog + aria-modal + labelledby/describedby.
    assert.ok(/role="alertdialog"/.test(content), `${file}: debe usar role="alertdialog"`);
    assert.ok(/aria-modal="true"/.test(content), `${file}: debe declarar aria-modal`);
    assert.ok(
      /aria-labelledby=\{titleId\}/.test(content) && /aria-describedby=\{descriptionId\}/.test(content),
      `${file}: título y mensaje deben estar asociados vía aria-labelledby/describedby`,
    );

    // Foco inicial en "Seguir editando", no en el CTA destructivo.
    assert.ok(
      /ref=\{keepEditingRef\}[\s\S]{0,300}Seguir editando/.test(content),
      `${file}: "Seguir editando" debe llevar la ref de foco inicial`,
    );
    assert.ok(
      /keepEditingRef\.current\?\.focus\(\)/.test(content),
      `${file}: debe enfocar "Seguir editando" al abrir`,
    );

    // Backdrop equivale a "Seguir editando", nunca a descartar.
    assert.ok(
      /onMouseDown=\{\(event\) => \{\s*if \(event\.target === event\.currentTarget\) \{\s*onKeepEditing\(\);/.test(
        content,
      ),
      `${file}: el backdrop debe invocar onKeepEditing, nunca onDiscard`,
    );

    // Escape: delega en la pila compartida de focus-trap (evita cerrar también
    // el formulario de atrás) y su callback es onKeepEditing, no onDiscard.
    assert.ok(
      /useFocusTrap\(panelRef, open, onKeepEditing\)/.test(content),
      `${file}: Escape debe resolver a onKeepEditing vía useFocusTrap (pila compartida, sin propagar el cierre)`,
    );
    assert.ok(
      !/useFocusTrap\(panelRef, open, onDiscard\)/.test(content),
      `${file}: Escape nunca debe resolver a onDiscard`,
    );
  }

  console.log(
    "✅ Caso 3: DiscardConfirmDialog (Personal/Hogar) — copy, a11y, foco inicial y Escape/backdrop correctos",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Caso 4 — El CTA destructivo ("Sí, descartar") es el único que ejecuta el
// cierre definitivo: en ambos componentes, `onDiscard` solo se conecta al
// botón destructivo, no al secundario.
// ═══════════════════════════════════════════════════════════════════════════
async function testOnlyDestructiveCtaClosesForGood() {
  const files = [
    "src/components/finance/discard-confirm-dialog.tsx",
    "src/features/household/components/ui/household-discard-confirm-dialog.tsx",
  ];

  for (const file of files) {
    const content = read(file);

    assert.ok(
      /tone="destructive"[\s\S]{0,80}onClick=\{onDiscard\}/.test(content),
      `${file}: onDiscard debe estar conectado únicamente al botón tone="destructive"`,
    );
    assert.ok(
      !/tone="outlined"[\s\S]{0,120}onClick=\{onDiscard\}/.test(content),
      `${file}: el botón secundario (outlined) no debe descartar`,
    );
  }

  console.log("✅ Caso 4: en ambos componentes, solo el CTA destructivo ejecuta onDiscard");
}

async function run() {
  console.log("Running discard-confirm-on-create tests...");
  await testPersonalCreateRoutesRequireConfirm();
  await testHouseholdStepAwareConfirm();
  await testConfirmDialogsContractAndA11y();
  await testOnlyDestructiveCtaClosesForGood();
  console.log("All discard-confirm-on-create tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
