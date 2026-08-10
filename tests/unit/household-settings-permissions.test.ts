import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for household-settings-permissions.test.ts...");

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

export function runHouseholdSettingsPermissionsTests() {
  let checks = 0;

  const settingsContent = readSrc("features/household/components/views/household-settings-view.tsx");
  const categoriesContent = readSrc("features/household/components/views/household-categories-view.tsx");

  // 1. Paridad Android (SettingsScreen.kt · HouseholdMembershipActionsSection):
  // "Editar nombre del hogar" se muestra a owner Y miembro — Android valida
  // solo membresía (HouseholdRepository.renameHousehold), no ownership, y
  // `android/firestore.rules` (match /households/{householdId}) permite a
  // cualquier miembro escribir `name`. El formulario NO debe estar gateado
  // por isOwner: debe montarse siempre (fuera de la rama isOwner ? ... : ...
  // que antes lo excluía para el miembro).
  assert.doesNotMatch(
    settingsContent,
    /\{isOwner \? \(\s*<form onSubmit=\{handleRename\}/,
    "El formulario de renombrar Hogar NO debe estar gateado por isOwner (paridad Android: owner y miembro lo ven)"
  );
  assert.match(
    settingsContent,
    /<form onSubmit=\{handleRename\}/,
    "Debe existir el formulario de renombrar sin condicionar su montaje a isOwner"
  );
  // Ningún guard `isOwner` debe envolver todo el bloque del formulario de
  // renombrar: comprobamos que el patrón exacto "{isOwner ... <form onSubmit={handleRename}"
  // (que antes ocultaba el form al miembro) ya no aparece en ninguna variante.
  assert.doesNotMatch(
    settingsContent,
    /isOwner[\s\S]{0,40}<form onSubmit=\{handleRename\}/,
    "El <form> de renombrar no debe depender de isOwner en su condición de montaje inmediata"
  );
  checks += 3;

  // 2. Código de invitación: gateado por hogar INCOMPLETO, no por isOwner.
  // Paridad Android (SettingsScreen.kt) y con Home/waiting de la Web: la card
  // solo existe con memberIds.size < 2. Además el servicio
  // generate-household-invite-code.ts autoriza a cualquier miembro, así que
  // limitarla al owner dejaba al miembro sin poder reinvitar.
  assert.match(
    settingsContent,
    /const householdIsIncomplete = memberIds\.length < 2;/,
    "El gate de la sección de invitación debe derivarse de memberIds.length < 2"
  );
  assert.match(
    settingsContent,
    /\{householdIsIncomplete && !showConfirmLeave && !showConfirmDissolve && \([\s\S]*?Código de Invitación/,
    "La sección de invitación debe montarse solo con el hogar incompleto"
  );
  assert.match(
    settingsContent,
    /MoreVertical|Opciones del hogar/,
    "Renombrar/Disolver deben vivir en un menú desplegable del hero"
  );
  assert.doesNotMatch(
    settingsContent,
    /\{isOwner && !showConfirmLeave && !showConfirmDissolve && \([\s\S]*?Código de Invitación/,
    "La sección de invitación ya no debe estar gateada por isOwner"
  );
  // Con el hogar completo el markup de invitación no debe emitirse: el gate es
  // la única condición de montaje, así que basta con que no exista otra rama
  // que renderice el código fuera de él.
  assert.equal(
    (settingsContent.match(/Código de Invitación/g) ?? []).length,
    1,
    "Debe existir una sola sección de invitación, la gateada por householdIsIncomplete"
  );
  // La expiración debe mostrarse cuando hay código usable (paridad waiting/Home).
  assert.match(
    settingsContent,
    /getInviteCodeExpiryLabel\(inviteCodeExpiresAt\)/,
    "Ajustes debe mostrar la etiqueta de expiración del código"
  );
  checks += 5;

  // 3. isOwner logic for Destructive Action (Disolver vs Abandonar)
  assert.match(
    settingsContent,
    /isOwner \? [\s\S]*?Disolver Hogar[\s\S]*?:[\s\S]*?Abandonar Hogar/,
    "La acción destructiva debe ramificar estrictamente: Disolver para owner, Abandonar para miembro"
  );
  checks++;

  // 4. Access to categories
  assert.match(
    settingsContent,
    /onClick=\{\(\) => router\.push\("\/household\/categories\?mode=manage"\)\}/,
    "Debe existir un acceso directo a /household/categories?mode=manage"
  );
  checks++;

  // 5. Structure: Settings and Categories must be normal inline pages, not fixed dialogs
  for (const [name, content] of [
    ["Settings", settingsContent],
    ["Categories", categoriesContent],
  ]) {
    assert.doesNotMatch(content, /\b(fixed|absolute)\b.*\binset-0\b/, `${name} no debe usar posicionamiento fijo (fixed inset-0)`);
    assert.doesNotMatch(content, /role=["']dialog["']/, `${name} no debe declarar role="dialog"`);
    assert.doesNotMatch(content, /<div[^>]*className=["'][^"']*bg-black\/80/, `${name} no debe usar overlays oscuros`);
    checks++;
  }

  console.log(`  ✓ Household Settings & Categories Permissions estructural verificados (${checks} aserciones pasadas).`);
}

runHouseholdSettingsPermissionsTests();
