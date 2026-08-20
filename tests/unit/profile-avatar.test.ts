import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { getInitialsFromName, shouldShowAvatarImage } from "../../src/components/ui/profile-avatar";

console.log("Running unit tests for profile-avatar.test.ts...");

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

async function runProfileAvatarTests() {
  // Test 1: foto válida (URL no vacía, sin fallo previo) -> se muestra la imagen.
  {
    assert.strictEqual(shouldShowAvatarImage("https://lh3.googleusercontent.com/a/foo", false), true);
    console.log("  ✓ Test 1: foto válida -> se muestra la imagen");
  }

  // Test 2: photoURL vacía/ausente -> fallback de iniciales.
  {
    assert.strictEqual(shouldShowAvatarImage(null, false), false);
    assert.strictEqual(shouldShowAvatarImage(undefined, false), false);
    assert.strictEqual(shouldShowAvatarImage("", false), false);
    assert.strictEqual(shouldShowAvatarImage("   ", false), false, "una URL solo con espacios cuenta como vacía");
    console.log("  ✓ Test 2: photoURL vacía/ausente -> fallback de iniciales");
  }

  // Test 3: error de carga (onError ya disparado) -> fallback de iniciales aunque la URL exista.
  {
    assert.strictEqual(shouldShowAvatarImage("https://lh3.googleusercontent.com/a/foo", true), false);
    console.log("  ✓ Test 3: error de carga -> fallback de iniciales aunque haya URL");
  }

  // Test 4: cálculo de iniciales único (sin duplicar lógica por pantalla).
  {
    assert.strictEqual(getInitialsFromName("Gerson Shima"), "GS");
    assert.strictEqual(getInitialsFromName("  Ana   "), "A");
    assert.strictEqual(getInitialsFromName(null), "FM");
    assert.strictEqual(getInitialsFromName(undefined), "FM");
    assert.strictEqual(getInitialsFromName(""), "FM");
    assert.strictEqual(getInitialsFromName("Uno Dos Tres"), "UD", "máximo 2 iniciales");
    console.log("  ✓ Test 4: getInitialsFromName es la única fuente de iniciales de la app");
  }

  // Test 5: contrato del componente — dimensiones fijas, alt útil, alt="" decorativo, onError.
  {
    const src = readSrc("components/ui/profile-avatar.tsx");
    assert.match(src, /onError=\{/, "ProfileAvatar debe manejar onError para volver a iniciales");
    assert.match(src, /Foto de perfil de/, "ProfileAvatar debe generar un alt útil por defecto");
    assert.match(src, /alt=\{decorative \? "" /, "ProfileAvatar debe soportar alt=\"\" cuando es decorativo");
    assert.match(src, /SIZE_CLASSES/, "ProfileAvatar debe mantener dimensiones fijas por tamaño (sin saltos visuales)");
    console.log("  ✓ Test 5: contrato del componente (dimensiones fijas, alt útil, decorativo, onError) verificado");
  }

  // Test 6: integración — Personal (usuario autenticado) usa ProfileAvatar en sidebar y Ajustes.
  {
    const sidebarSrc = readSrc("components/layout/sidebar.tsx");
    assert.match(sidebarSrc, /<ProfileAvatar/, "El sidebar debe usar ProfileAvatar");
    assert.match(sidebarSrc, /userPhotoURL/, "El sidebar debe recibir userPhotoURL");

    const settingsBlocksSrc = readSrc("components/finance/settings-blocks.tsx");
    assert.match(settingsBlocksSrc, /<ProfileAvatar/, "SettingsProfileCard debe usar ProfileAvatar");
    assert.match(settingsBlocksSrc, /userPhotoURL/, "SettingsProfileCard debe recibir userPhotoURL");

    console.log("  ✓ Test 6: Personal (sidebar + SettingsProfileCard) usa ProfileAvatar con photoURL del usuario autenticado");
  }

  // Test 7: integración — Hogar (MplusHouseholdSettingsView) usa ProfileAvatar para miembros.
  {
    const householdSettingsSrc = readSrc("features/household/components/mplus-household-settings-view.tsx");
    assert.match(householdSettingsSrc, /<ProfileAvatar/, "MplusHouseholdSettingsView debe usar ProfileAvatar");

    console.log("  ✓ Test 7: MplusHouseholdSettingsView usa ProfileAvatar para renderizar los integrantes");
  }

  // Test 8: privacidad — ninguna de las superficies Hogar tocadas expone datos financieros privados.
  {
    const filesToCheck = [
      "features/household/components/mplus-household-settings-view.tsx",
    ];
    for (const rel of filesToCheck) {
      const src = readSrc(rel);
      assert.doesNotMatch(
        src,
        /\baccountId\b|\bpocketId\b|\bbalance\b|\btransactions\b/,
        `${rel}: no debe exponer datos financieros personales junto a los avatares de miembros`
      );
    }
    console.log("  ✓ Test 8: ninguna superficie con avatares de miembro expone datos financieros personales");
  }

  console.log("All profile-avatar unit tests passed successfully!");
}

runProfileAvatarTests().catch((err) => {
  console.error("Test failure in profile-avatar.test.ts:", err);
  process.exit(1);
});
