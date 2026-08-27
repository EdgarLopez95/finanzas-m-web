import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

console.log("Running unit tests for household-shell-navigation.test.ts...");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

const runTests = () => {
  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => void) => {
    try {
      fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (error) {
      failed++;
      console.error(`  ✗ ${name}`);
      console.error(error);
    }
  };

  test("WA-HOU-NAV-001: La navegación Hogar contiene las 4 rutas M+ y el sidebar discrimina", () => {
    const navSource = readSource("components/layout/navigation.ts");
    assert.ok(navSource.includes('export const householdNavigationItems'), "Debe existir householdNavigationItems");
    assert.ok(navSource.includes('href: "/household"'), "Debe incluir /household");
    assert.ok(navSource.includes('href: "/household/movements"'), "Debe incluir /household/movements");
    assert.ok(navSource.includes('href: "/household/categories"'), "Debe incluir /household/categories");
    assert.ok(navSource.includes('href: "/household/settings"'), "Debe incluir /household/settings");

    const sidebarSource = readSource("components/layout/sidebar.tsx");
    assert.ok(sidebarSource.includes('personalIsActive ? personalNavigationItems : householdNavigationItems'), "El sidebar debe discriminar navegación");
  });

  test("WA-HOU-NAV-002: El Top Bar Hogar monta selector de período y excluye botones de alta de movimientos (alineado con Android)", () => {
    const shellSource = readSource("components/layout/dashboard-shell.tsx");
    assert.ok(
      /const personalTopBarActions\s*=[\s\S]{0,400}?!isHousehold \?/.test(shellSource),
      "Los controles personales deben vivir en una rama guardada por !isHousehold"
    );
    assert.ok(
      shellSource.includes('["/household", "/household/movements", "/household/categories", "/household/settings"].includes(pathname) &&\n    isHouseholdOperative'),
      "Selector de período activo en todas las rutas Hogar si está operativo"
    );

    // Extraer bloque de householdTopBarActions
    const householdActionsMatch = shellSource.match(/const householdTopBarActions\s*=[\s\S]*?const personalTopBarActions/);
    assert.ok(householdActionsMatch, "Debe existir la constante householdTopBarActions");
    const householdActionsCode = householdActionsMatch[0];

    assert.ok(
      !householdActionsCode.includes("Nuevo gasto") && !householdActionsCode.includes("Nuevo ingreso"),
      "El Top Bar de Hogar no debe incluir botón de alta de movimientos"
    );
    assert.ok(
      !householdActionsCode.includes("<HouseholdButton") && !householdActionsCode.includes("<FinanceButton"),
      "El Top Bar de Hogar no debe renderizar botones de alta"
    );
    assert.ok(
      householdActionsCode.includes("Elegir período del hogar") && householdActionsCode.includes("openPeriodPicker"),
      "El Top Bar de Hogar debe montar exclusivamente el selector de período"
    );
    assert.ok(
      !shellSource.includes("openCreateExpense"),
      "dashboard-shell no debe exponer handler openCreateExpense"
    );
  });

  test("WA-HOU-NAV-003: El chrome del hogar monta su propio picker de período independientemente del personal", () => {
    const shellSource = readSource("components/layout/dashboard-shell.tsx");
    assert.ok(shellSource.includes('{isHousehold && ('), "Debe montar el picker de hogar condicionado a isHousehold");
    assert.ok(shellSource.includes('<HouseholdPeriodPickerDialog'), "Debe montar HouseholdPeriodPickerDialog");
    assert.ok(shellSource.includes('open={isPeriodPickerOpen}'), "Debe usar el mismo flag isPeriodPickerOpen global");
  });

  test("WA-HOU-NAV-004: El tema visual deriva de activeContext en AppShell mediante data-fm-context", () => {
    const appShellSource = readSource("components/layout/app-shell.tsx");
    assert.ok(appShellSource.includes('data-fm-context={context}'), "AppShell debe propagar data-fm-context");
    const dashboardShellSource = readSource("components/layout/dashboard-shell.tsx");
    assert.ok(dashboardShellSource.includes('context={activeContext}'), "DashboardShell debe pasar activeContext al AppShell");
  });

  test("WA-HOU-NAV-005: El placeholder de redirección de frontera usa el loading del contexto destino", () => {
    const shellSource = readSource("components/layout/dashboard-shell.tsx");
    const redirectBranch = shellSource.match(
      /if \(sharedRouteFallback\.shouldRedirect\) \{[\s\S]*?\} else if \(status === "loading"\)/
    )?.[0];
    assert.ok(redirectBranch, "Debe existir la rama sharedRouteFallback.shouldRedirect");
    assert.ok(
      redirectBranch!.includes("isHousehold ? <HouseholdLoadingContent /> : <PersonalLoadingContent />"),
      "Al redirigir por frontera, el shimmer debe seguir isHousehold (destino), no forzar siempre HouseholdLoadingContent"
    );
  });

  console.log(`\nTests for household-shell-navigation: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
