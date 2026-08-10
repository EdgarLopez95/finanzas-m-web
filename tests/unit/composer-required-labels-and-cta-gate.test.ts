/**
 * tests/unit/composer-required-labels-and-cta-gate.test.ts
 *
 * Verificación estática (sin React/RTL, siguiendo el patrón del repo):
 * - Los CTA de creación (Personal + Hogar) deben iniciar deshabilitados
 *   mientras el formulario no sea válido, no solo tras `submitAttempted`.
 * - Los campos realmente obligatorios muestran "(obligatorio)"; los
 *   opcionales/condicionales no.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf-8");

// ═══════════════════════════════════════════════════════════════════════════
// Caso 1 — Personal: CTA inicial deshabilitado por `!isFormValid`, no por
// `submitAttempted && !isFormValid` (eso solo controlaba el mensaje de error).
// ═══════════════════════════════════════════════════════════════════════════
async function testPersonalCtaGatedByValidityNotSubmitAttempted() {
  const files = [
    "src/features/transactions/components/create-expense-card.tsx",
    "src/features/transactions/components/create-income-card.tsx",
    "src/features/transactions/components/create-transfer-card.tsx",
  ];

  for (const file of files) {
    const content = read(file);
    assert.ok(
      !/disabled=\{[^}]*submitAttempted && !isFormValid[^}]*\}/.test(content),
      `${file}: el CTA no debe depender de submitAttempted para deshabilitarse`,
    );
    assert.ok(
      /disabled=\{(isBlocked \|\| )?!isFormValid\}/.test(content),
      `${file}: el CTA debe deshabilitarse con !isFormValid (más isBlocked si aplica)`,
    );
  }

  console.log("✅ Caso 1: CTA personal (gasto/ingreso/transferencia) gateado por validez real");
}

// ═══════════════════════════════════════════════════════════════════════════
// Caso 2 — Hogar: "Continuar" (paso 1) y "Guardar gasto" dependen del estado
// real del paso activo, no solo de `isSubmitting`.
// ═══════════════════════════════════════════════════════════════════════════
async function testHouseholdCtaGatedByStepValidity() {
  const content = read(
    "src/features/household/components/create-household-expense-dialog.tsx",
  );

  assert.ok(
    !/const primaryDisabled = isSubmitting;/.test(content),
    "primaryDisabled ya no debe ser solo isSubmitting",
  );
  assert.ok(
    /const primaryDisabled = isSubmitting \|\| \(step === 1 \? !canContinue : !canSubmit\);/.test(
      content,
    ),
    "primaryDisabled debe exigir canContinue en paso 1 y canSubmit en paso 2 (incluye reparto)",
  );

  console.log("✅ Caso 2: CTA Hogar (Continuar/Guardar gasto) gateado por validez del paso activo");
}

// ═══════════════════════════════════════════════════════════════════════════
// Caso 3 — Etiquetas "(obligatorio)" solo en campos realmente requeridos.
// ═══════════════════════════════════════════════════════════════════════════
async function testRequiredLabelsOnlyOnRequiredFields() {
  const expense = read("src/features/transactions/components/create-expense-card.tsx");
  const income = read("src/features/transactions/components/create-income-card.tsx");
  const transfer = read("src/features/transactions/components/create-transfer-card.tsx");
  const household = read(
    "src/features/household/components/create-household-expense-dialog.tsx",
  );

  // Requeridos reales (validados en `errors` / `persistExpense`).
  assert.ok(/Monto del gasto \(obligatorio\)/.test(expense));
  assert.ok(/label="Concepto"\s*\n\s*htmlFor="expenseDescription"\s*\n\s*required/.test(expense));
  assert.ok(/label="Fecha" htmlFor="expenseDate" required/.test(expense));
  assert.ok(/label="Categoría"\s*\n\s*htmlFor="expenseCategoryId"\s*\n\s*required/.test(expense));
  assert.ok(/label="Cuenta"\s*\n\s*htmlFor="expenseAccountId"\s*\n\s*required/.test(expense));

  assert.ok(/Monto del ingreso \(obligatorio\)/.test(income));
  assert.ok(/label="Concepto"\s*\n\s*htmlFor="incomeDescription"\s*\n\s*required/.test(income));
  assert.ok(/label="Fecha" htmlFor="incomeDate" required/.test(income));
  assert.ok(/label="Categoría"\s*\n\s*htmlFor="incomeCategoryId"\s*\n\s*required/.test(income));
  assert.ok(
    /label="Cuenta destino"\s*\n\s*htmlFor="incomeAccountId"\s*\n\s*required/.test(income),
  );
  // "Entra a" (bolsillo destino) es opcional: no debe llevar la marca.
  assert.ok(!/label="Entra a"[\s\S]{0,80}required/.test(income));

  assert.ok(/Monto a transferir \(obligatorio\)/.test(transfer));
  assert.ok(/label="Sale de \(obligatorio\)"/.test(transfer));
  assert.ok(/label="Llega a \(obligatorio\)"/.test(transfer));
  assert.ok(/label="Concepto"\s*\n\s*htmlFor="transferDescription"\s*\n\s*required/.test(transfer));
  assert.ok(/label="Fecha" htmlFor="transferDate" required/.test(transfer));

  assert.ok(/Monto total \(obligatorio\)/.test(household));
  assert.ok(/label="Título \(obligatorio\)"/.test(household));
  // Categoría del Hogar es opcional (permite "Sin categoría"): no lleva marca.
  assert.ok(!/Categoría del Hogar[\s\S]{0,120}\(obligatorio\)/.test(household));

  console.log("✅ Caso 3: (obligatorio) presente solo en campos exigidos por la validación real");
}

// ═══════════════════════════════════════════════════════════════════════════
// Caso 4 — Accesibilidad conservada: los campos con `required` siguen usando
// `htmlFor`/`id` y `visibleError` (aria-invalid/describedby vía FieldError).
// ═══════════════════════════════════════════════════════════════════════════
async function testAccessibilityPreserved() {
  const primitives = read(
    "src/features/transactions/components/composer/composer-primitives.tsx",
  );
  assert.ok(
    /required\?: boolean/.test(primitives),
    "ComposerField debe declarar `required` como prop tipada",
  );
  assert.ok(
    /htmlFor=\{htmlFor\}/.test(primitives),
    "la etiqueta debe seguir asociada al control vía htmlFor",
  );
  assert.ok(
    !/optional\?: boolean/.test(primitives),
    "la convención `optional` debe quedar reemplazada por `required`",
  );

  console.log("✅ Caso 4: accesibilidad de ComposerField conservada (htmlFor + required tipado)");
}

async function run() {
  console.log("Running composer-required-labels-and-cta-gate tests...");
  await testPersonalCtaGatedByValidityNotSubmitAttempted();
  await testHouseholdCtaGatedByStepValidity();
  await testRequiredLabelsOnlyOnRequiredFields();
  await testAccessibilityPreserved();
  console.log("All composer-required-labels-and-cta-gate tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
