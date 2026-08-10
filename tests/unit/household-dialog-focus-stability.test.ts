import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for household-dialog-focus-stability.test.ts...");

const dialogSrc = fs.readFileSync(
  path.resolve(__dirname, "../../src/features/household/components/ui/household-dialog.tsx"),
  "utf-8"
);
const createSrc = fs.readFileSync(
  path.resolve(__dirname, "../../src/features/household/components/create-household-expense-dialog.tsx"),
  "utf-8"
);

function run() {
  assert.match(
    dialogSrc,
    /onCloseRef\.current = onClose/,
    "HouseholdDialog debe guardar onClose en un ref para no re-ejecutar el efecto por identidad"
  );
  assert.match(
    dialogSrc,
    /\}, \[open\]\);/,
    "el efecto de apertura/Escape de HouseholdDialog debe depender solo de open"
  );
  assert.doesNotMatch(
    dialogSrc,
    /\}, \[onClose, open\]\);/,
    "HouseholdDialog no debe reenfocar al cambiar onClose en cada tecla"
  );

  assert.match(
    createSrc,
    /const primaryDisabled = isSubmitting/,
    "Continuar/Guardar debe poder clicarse con campos incompletos para revelar errores"
  );
  assert.match(
    createSrc,
    /Falta \$\{missingParts\.join/,
    "el pie debe anunciar los campos faltantes"
  );
  assert.match(
    createSrc,
    /hh-destructive-content/,
    "el aviso de campos faltantes debe ser visible (tono destructivo)"
  );

  console.log("  ✓ Foco estable al tipear + aviso de campos faltantes clicable");
  console.log("All household-dialog-focus-stability unit tests passed successfully!");
}

try {
  run();
} catch (err) {
  console.error("Test failure in household-dialog-focus-stability.test.ts:", err);
  process.exit(1);
}
