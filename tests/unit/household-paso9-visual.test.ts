import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for household-paso9-visual.test.ts...");

/**
 * Paso 9 — Pulido visual canónico de Hogar.
 *
 * Cubre las dos correcciones confirmadas por lectura directa de Android
 * (sin suposiciones): QA-001 (rol exacto del Sage canónico `#6C8E7F`) y el
 * `TopBar` compartido, que nunca se adaptaba al contexto Hogar.
 *
 * QA-001 — evidencia Android (ver docs/11_WEB_DEV_LOG.md, entrada Paso 9):
 * `HouseholdTokens.kt` documenta DOS paletas vigentes sin reconciliar:
 * `Current`/`Roles` (fondo/superficie/texto/borde/acción-primaria `#8BCFBC`,
 * consumida de hecho por MovementsScreen.kt/SettingsScreen.kt/
 * HouseholdCategoryManagementScreen.kt) y el Sage `#6C8E7F`
 * (`FinanzasColors.Sage`), que `FinanzasHomeContextVisuals.household()` usa
 * SOLO para: `householdAddFabContainerColor` (el FAB "Nuevo gasto" del shell)
 * y `householdToggleSelectedBackground/Border` (el toggle Personal/Hogar
 * seleccionado). Decisión confirmada con el usuario: Sage se aplica
 * exclusivamente a esos dos elementos de chrome; `--hh-primary-action`
 * (`#8BCFBC`) se mantiene sin cambios para los botones DENTRO de las vistas
 * Hogar, paridad con `HouseholdTokens.Roles.primaryAction`.
 */

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

export function runHouseholdPaso9VisualTests() {
  let checks = 0;

  // ---------------------------------------------------------------
  // 1. Token --hh-sage-accent existe, con el hex canónico exacto de Android.
  // ---------------------------------------------------------------
  const cssContent = readSrc("app/globals.css");
  assert.match(cssContent, /--hh-sage-accent:\s*#6C8E7F/i, "Debe definir --hh-sage-accent: #6C8E7F (Sage canónico, FinanzasColors.Sage)");
  checks++;

  // ---------------------------------------------------------------
  // 2. Sidebar: el toggle "Hogar" seleccionado usa --hh-sage-accent.
  // ---------------------------------------------------------------
  const sidebarContent = readSrc("components/layout/sidebar.tsx");
  assert.match(
    sidebarContent,
    /toggleActive:\s*"[^"]*--hh-sage-accent/,
    "HOUSEHOLD_SIDEBAR_STYLES.toggleActive debe usar --hh-sage-accent (paridad household().householdToggleSelectedBackground/Border)"
  );
  checks++;

  // ---------------------------------------------------------------
  // 3. DashboardShell: el FAB "Nuevo gasto" usa --hh-sage-accent.
  // ---------------------------------------------------------------
  const shellContent = readSrc("components/layout/dashboard-shell.tsx");
  const fabMatch = shellContent.match(/<HouseholdButton[^>]*onClick=\{openCreateExpense\}[^>]*>/);
  assert.ok(fabMatch, "Debe existir el botón 'Nuevo gasto' (onClick={openCreateExpense})");
  assert.match(
    fabMatch![0],
    /--hh-sage-accent/,
    "El FAB 'Nuevo gasto' debe usar --hh-sage-accent (paridad household().householdAddFabContainerColor)"
  );
  checks += 2;

  // ---------------------------------------------------------------
  // 4. --hh-sage-accent NO se usa dentro de las vistas Hogar (Settings/
  //    Categories/Movements): esos botones conservan --hh-primary-action,
  //    paridad con HouseholdTokens.Roles.primaryAction que esas mismas
  //    pantallas Android consumen.
  // ---------------------------------------------------------------
  for (const rel of [
    "features/household/components/views/household-settings-view.tsx",
    "features/household/components/views/household-categories-view.tsx",
    "features/household/components/views/household-movements-view.tsx",
    "features/household/components/household-overview.tsx",
  ]) {
    const content = readSrc(rel);
    assert.doesNotMatch(content, /--hh-sage-accent/, `${rel}: no debe usar --hh-sage-accent (ese rol es exclusivo del chrome: toggle + FAB)`);
    checks++;
  }

  // ---------------------------------------------------------------
  // 5. TopBar: antes era un chrome único sin adaptar a Hogar (bug real:
  //    montado por DashboardShell/AppShell en TODAS las rutas, incluidas las
  //    4 rutas Hogar, pero siempre con --fm-* y rgba() hardcodeados). Ahora
  //    debe ramificar por contexto igual que Sidebar/DashboardShell.
  // ---------------------------------------------------------------
  const topBarContent = readSrc("components/layout/top-bar.tsx");
  assert.match(topBarContent, /context/, "TopBar debe recibir/leer el contexto activo");

  const appShellContent = readSrc("components/layout/app-shell.tsx");
  assert.match(
    appShellContent,
    /<TopBar[^>]*context=\{context\}/,
    "AppShell debe propagar `context` a TopBar (antes se perdía y el top bar nunca se veía Hogar)"
  );
  checks += 2;

  // ---------------------------------------------------------------
  // 6. Corrección P0 de Paso 9 — Sidebar: el contexto activo tiene una única
  //    autoridad (useAppContextStore().activeContext). La URL NUNCA debe
  //    desempatar/pintar el contexto del sidebar: eso rompía la frontera de
  //    contexto del Paso 6 (Android tampoco deriva el chrome de la URL, solo
  //    de `homeContext`/`activeContext`). `resolveContextForPath` sigue
  //    siendo válido en app-context.ts (redirecciones/recuperación de
  //    rutas), pero sidebar.tsx no debe importarlo ni usarlo para pintar.
  // ---------------------------------------------------------------
  const sidebarCode = sidebarContent
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
  assert.doesNotMatch(
    sidebarCode,
    /resolveContextForPath/,
    "sidebar.tsx no debe importar ni usar resolveContextForPath en código real (comentarios explicativos sí pueden mencionarlo)"
  );
  assert.match(
    sidebarContent,
    /const activeContext = storeContext;/,
    "sidebar.tsx debe usar storeContext directamente como activeContext, sin desempate por URL"
  );
  checks += 2;

  // resolveContextForPath debe seguir existiendo en app-context.ts (sigue
  // siendo válido para redirecciones/recuperación de rutas) — no se borra
  // la función, solo se deja de usar para pintar el sidebar.
  const appContextLibContent = readSrc("lib/navigation/app-context.ts");
  assert.match(
    appContextLibContent,
    /export const resolveContextForPath/,
    "resolveContextForPath debe seguir exportado en app-context.ts (válido para redirecciones, no se elimina)"
  );
  checks++;

  // ---------------------------------------------------------------
  // 7. Corrección P0 de Paso 9 — el switch Personal/Hogar de la Sidebar solo
  //    debe ser visible con Hogar activo (paridad Android: el switch solo
  //    existe si hay un hogar activo; crear/unirse vive en Ajustes Personal,
  //    no como "onboarding" visible en el switch). Nada de excepción de
  //    onboarding.
  // ---------------------------------------------------------------
  assert.doesNotMatch(
    sidebarContent,
    /SHOW_HOUSEHOLD_FOR_ONBOARDING/,
    "sidebar.tsx no debe tener la excepción de onboarding SHOW_HOUSEHOLD_FOR_ONBOARDING"
  );
  assert.match(
    sidebarContent,
    /const showHouseholdToggle = activeHouseholdId !== null;/,
    "showHouseholdToggle debe depender exclusivamente de activeHouseholdId !== null, sin excepción de onboarding"
  );
  checks += 2;

  console.log(`  ✓ Paso 9 — Sage canónico (QA-001), TopBar por contexto y corrección P0 de Sidebar validados (${checks} comprobaciones).`);
}

runHouseholdPaso9VisualTests();
