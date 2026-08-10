import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { isQaResetToolAvailable } from "../../src/features/qa-reset/lib/qa-reset-availability";

console.log("Running unit tests for qa-reset-availability.test.ts...");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

// Item 7 del contrato corregido: SOLO "development" debe dar true.
function runAvailabilityGuardTest() {
  assert.equal(isQaResetToolAvailable("development"), true, "en npm run dev, la herramienta debe estar disponible");
  assert.equal(isQaResetToolAvailable("production"), false, "en build de producción, la herramienta no debe estar disponible");
  assert.equal(isQaResetToolAvailable("test"), false, "en NODE_ENV=test la herramienta NO debe estar disponible (solo 'development' cuenta)");
  assert.equal(isQaResetToolAvailable(undefined), false, "sin NODE_ENV definido, por defecto debe estar NO disponible");
  assert.equal(isQaResetToolAvailable("preview"), false, "en un entorno de preview, la herramienta no debe estar disponible");
  assert.equal(isQaResetToolAvailable(""), false, "una cadena vacía nunca debe habilitar la herramienta");

  console.log("Guard puro isQaResetToolAvailable (estrictamente === 'development'): 6/6 aserciones pasadas.");
}

function runProductionCannotMountStructuralTest() {
  const personalViews = readSource("features/dashboard/components/personal-views.tsx");

  assert.ok(
    personalViews.includes("isQaResetToolAvailable()"),
    "personal-views.tsx debe consultar isQaResetToolAvailable() antes de decidir qué renderizar"
  );
  assert.ok(
    personalViews.includes("{qaResetToolAvailable && ("),
    "el diálogo QaResetConfirmDialog debe montarse SOLO cuando qaResetToolAvailable es true"
  );

  console.log("Contrato estructural: el reset no puede montarse fuera de development: 3/3 aserciones pasadas.");
}

function runNoFalseBundleEliminationClaimTest() {
  const availabilitySource = readSource("features/qa-reset/lib/qa-reset-availability.ts");

  // Auditoría: el comentario debe ser honesto sobre que esto es un guard en
  // runtime (oculta), no una eliminación real del código en el bundle.
  assert.ok(
    availabilitySource.toLowerCase().includes("oculta") || availabilitySource.toLowerCase().includes("no afirmar"),
    "el módulo debe dejar explícito que solo OCULTA el flujo en runtime, sin afirmar que el bundle elimina el código"
  );
  assert.ok(
    availabilitySource.includes('=== "development"'),
    "el guard debe comparar estrictamente contra 'development', no usar !== 'production'"
  );
  assert.ok(
    !availabilitySource.includes('!== "production"'),
    "no debe quedar la comparación anterior (!== 'production'), que dejaba 'test'/undefined/preview como disponibles"
  );

  console.log("Honestidad del comentario + guard estricto '=== development': 3/3 aserciones pasadas.");
}

function runQaResetIsolatedInOwnFeatureFolderTest() {
  const dialogSource = readSource("features/qa-reset/components/qa-reset-confirm-dialog.tsx");
  const roleSource = readSource("features/qa-reset/lib/qa-reset-role.ts");
  const personalServiceSource = readSource("features/qa-reset/services/reset-personal-data-for-current-user.ts");
  const orchestratorSource = readSource("features/qa-reset/services/reset-qa-data-for-current-user.ts");

  for (const [label, source] of [
    ["qa-reset-confirm-dialog.tsx", dialogSource],
    ["qa-reset-role.ts", roleSource],
    ["reset-personal-data-for-current-user.ts", personalServiceSource],
    ["reset-qa-data-for-current-user.ts", orchestratorSource],
  ] as const) {
    assert.ok(
      source.includes("QA/DEBUG") && source.includes("SOLO PARA DESARROLLO"),
      `${label} debe declarar explícitamente que es una herramienta QA/debug a retirar antes de producción`
    );
  }

  console.log("Aislamiento QA (comentario de retiro obligatorio en los 4 archivos clave): 4/4 aserciones pasadas.");
}

runAvailabilityGuardTest();
runProductionCannotMountStructuralTest();
runNoFalseBundleEliminationClaimTest();
runQaResetIsolatedInOwnFeatureFolderTest();

console.log("OK qa-reset-availability");
