import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

console.log("Running unit tests for web-settings-audit.test.ts...");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

function runQaHiddenInProductionTest() {
  const settingsBlocks = readSource("components/finance/settings-blocks.tsx");
  assert.ok(
    !settingsBlocks.includes("NO DISPONIBLE EN WEB TODAVÍA"),
    "No se debe renderizar el bloque deshabilitado de QA en producción."
  );
  assert.ok(
    settingsBlocks.includes("{qaResetToolAvailable && ("),
    "La herramienta QA debe estar envuelta en qaResetToolAvailable && (...)"
  );
  
  const idxQA = settingsBlocks.indexOf("{qaResetToolAvailable && (");
  const idxAuditar = settingsBlocks.indexOf("Auditar datos en Firebase");
  assert.ok(idxQA !== -1 && idxAuditar > idxQA && idxAuditar < idxQA + 250, "Auditar datos debe estar inmediatamente dentro del bloque qaResetToolAvailable");
  console.log("QA oculto en producción: aserciones pasadas.");
}

function runSincronizacionHonestaTest() {
  const settingsBlocks = readSource("components/finance/settings-blocks.tsx");
  assert.ok(
    !settingsBlocks.includes("Todo sincronizado"),
    "Debe removerse el fake 'Todo sincronizado'"
  );
  assert.ok(
    !settingsBlocks.includes("Sincronización en vivo activa"),
    "No debe fingir que hay un estado en vivo real activo"
  );
  assert.ok(
    settingsBlocks.includes("Sincronización automática") && settingsBlocks.includes("Tus cambios se sincronizan automáticamente cuando hay conexión."),
    "Debe usar copy honesto de sincronización automática"
  );
  assert.ok(
    !settingsBlocks.includes("sincronizado={true}"),
    "No debe usar estado visual verde si no hay comprobación real"
  );
  console.log("Sincronización honesta: aserciones pasadas.");
}

function runHouseholdSummaryInPersonalTest() {
  const personalViews = readSource("features/dashboard/components/personal-views.tsx");
  assert.ok(
    !personalViews.includes("householdData?.members"),
    "No debe usar householdData.members porque ese campo no existe en el contrato."
  );
  assert.ok(
    personalViews.includes("householdData?.household?.memberCount") || personalViews.includes("householdData?.household?.memberIds"),
    "Debe usar el contrato real (householdData.household.memberCount o memberIds) para calcular los miembros"
  );
  assert.doesNotMatch(
    personalViews,
    /Abandonar Hogar/i,
    "No debe duplicar la acción destructiva 'Abandonar Hogar' en el resumen Personal"
  );
  console.log("Resumen del Hogar en Ajustes Personal usa tipos reales: aserciones pasadas.");
}

function runLogoutDialogConfirmTest() {
  const settingsBlocks = readSource("components/finance/settings-blocks.tsx");
  const householdSettings = readSource("features/household/components/views/household-settings-view.tsx");
  
  assert.ok(
    settingsBlocks.includes("<FinanceDialog") && settingsBlocks.includes("setLogoutConfirmOpen"),
    "Debe usar FinanceDialog para la confirmación de logout en Ajustes Personal"
  );
  assert.ok(
    householdSettings.includes("<HouseholdDialog") && householdSettings.includes("setLogoutConfirmOpen"),
    "Debe usar HouseholdDialog para la confirmación de logout en Ajustes Hogar"
  );
  console.log("Logout con confirmación: aserciones pasadas.");
}

function runMembersShowNoFakeEmailTest() {
  const householdSettings = readSource("features/household/components/views/household-settings-view.tsx");
  assert.ok(
    !householdSettings.includes("as any"),
    "No debe forzar con ( ... as any) un campo que no existe en el perfil remoto"
  );
  console.log("Miembros sin campos email forzados con any: aserciones pasadas.");
}

async function main() {
  try {
    runQaHiddenInProductionTest();
    runSincronizacionHonestaTest();
    runHouseholdSummaryInPersonalTest();
    runLogoutDialogConfirmTest();
    runMembersShowNoFakeEmailTest();
    console.log("All web-settings-audit unit tests passed successfully!");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

main();
