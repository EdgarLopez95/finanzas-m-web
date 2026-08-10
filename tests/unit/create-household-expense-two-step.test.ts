import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for create-household-expense-two-step.test.ts...");

const src = fs.readFileSync(
  path.resolve(__dirname, "../../src/features/household/components/create-household-expense-dialog.tsx"),
  "utf-8"
);

function run() {
  assert.match(src, /const \[step, setStep\] = useState<1 \| 2>\(1\)/, "debe rastrear paso 1 | 2");
  assert.match(src, /size="default"/, "el modal debe usar ancho default (no composer/composer-lg)");
  assert.doesNotMatch(src, /size="composer/, "nuevo gasto no debe abrir en composer ancho");

  assert.match(src, /return "Continuar"/, "paso 1 con Adelanto/Cada uno debe CTA Continuar");
  assert.match(src, /setSharesRaw\(buildEqualShares\(totalAmount\)\)/, "al continuar debe prellenar partes iguales");
  assert.match(src, /setStep\(2\)/, "Continuar debe abrir el paso de reparto");

  assert.match(
    src,
    /if \(!requiresShares\) \{\s*await persistExpense\(\)/,
    "Invitación debe guardar en el paso 1 sin abrir el reparto"
  );

  assert.match(src, /step === 1 \? "Nuevo gasto Hogar" : "Reparto del gasto"/, "título distinto por paso");
  assert.match(src, /step === 2 \? "Atrás" : "Cancelar"/, "paso 2 ofrece Atrás");

  // El bloque de reparto no debe vivir en el paso 1
  assert.match(
    src,
    /step === 1 \? \([\s\S]*¿Quién pagó\?[\s\S]*\) : \([\s\S]*¿Cómo se reparte el gasto\?/,
    "paso 1 tiene quién/cómo; el reparto solo aparece en el otro branch"
  );

  assert.match(src, /useState<SettlementMode>\("advancedByPayer"\)/, "Adelanto preseleccionado");
  assert.match(src, /setPaidByUserId\(currentUid\)/, "Yo (usuario actual) preseleccionado al abrir");

  console.log("  ✓ Flujo 2 pasos: Continuar → reparto 50/50; Invitación guarda directo; modal angosto");
  console.log("All create-household-expense-two-step unit tests passed successfully!");
}

try {
  run();
} catch (err) {
  console.error("Test failure in create-household-expense-two-step.test.ts:", err);
  process.exit(1);
}
