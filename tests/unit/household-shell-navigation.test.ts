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

  test("WA-HOU-NAV-001: La navegación Hogar sólo contiene /household temporalmente y el sidebar discrimina", () => {
    const navSource = readSource("components/layout/navigation.ts");
    assert.ok(navSource.includes('export const householdNavigationItems'), "Debe existir householdNavigationItems");
    assert.ok(navSource.includes('href: "/household"'), "Debe incluir /household");

    const sidebarSource = readSource("components/layout/sidebar.tsx");
    assert.ok(sidebarSource.includes('personalIsActive ? personalNavigationItems : householdNavigationItems'), "El sidebar debe discriminar navegación");
  });

  test("WA-HOU-NAV-002: El Top Bar Hogar excluye controles Personales y monta 'Nuevo gasto' globalmente en operabilidad", () => {
    const shellSource = readSource("components/layout/dashboard-shell.tsx");
    // Los controles Personales del top bar viven en una rama propia guardada
    // por `!isHousehold`, de modo que el contexto Hogar nunca los renderiza.
    assert.ok(
      /const personalTopBarActions\s*=[\s\S]{0,400}?!isHousehold \?/.test(shellSource),
      "Los controles personales deben vivir en una rama guardada por !isHousehold"
    );
    assert.ok(shellSource.includes('["/household", "/household/movements", "/household/settings"].includes(pathname) &&\n    isHouseholdOperative'), "Nuevo gasto en todas las rutas Hogar si está operativo");
    // Contrato real del store de UI de Hogar (`stores/household-ui-store.ts`):
    // la acción se llama `openCreateExpense` y el diálogo `isCreateExpenseOpen`.
    // La implementación del shell invocaba `openCreateHouseholdExpense`, un
    // símbolo inexistente que además rompía la compilación.
    const uiStoreSource = readSource("stores/household-ui-store.ts");
    assert.ok(
      uiStoreSource.includes('openCreateExpense: () =>'),
      "El store de UI de Hogar debe exponer openCreateExpense"
    );
    assert.ok(
      shellSource.includes('openCreateExpense'),
      "El shell debe llamar a openCreateExpense (acción real del store de UI de Hogar)"
    );
    assert.ok(
      !shellSource.includes('openCreateHouseholdExpense'),
      "El shell no debe invocar openCreateHouseholdExpense: ese símbolo no existe en el store"
    );
  });

  test("WA-HOU-NAV-003: Un miembro no puede mantener abierto el diálogo (guarda en dashboard-shell.tsx)", () => {
    const shellSource = readSource("components/layout/dashboard-shell.tsx");
    assert.ok(shellSource.includes('{isHouseholdOperative && ('), "El diálogo debe estar guardado por isHouseholdOperative en el shell");
    assert.ok(shellSource.includes('open={isCreateExpenseOpen}'), "El diálogo debe abrirse con el estado del store");
  });

  test("WA-HOU-NAV-003B: El chrome del hogar monta su propio picker de período independientemente del personal", () => {
    const shellSource = readSource("components/layout/dashboard-shell.tsx");
    assert.ok(shellSource.includes('{isHousehold && ('), "Debe montar el picker de hogar condicionado a isHousehold");
    assert.ok(shellSource.includes('<HouseholdPeriodPickerDialog'), "Debe montar HouseholdPeriodPickerDialog");
    assert.ok(shellSource.includes('open={isPeriodPickerOpen}'), "Debe usar el mismo flag isPeriodPickerOpen global");
    
    const pageSource = readSource("app/(dashboard)/household/page.tsx");
    assert.ok(!pageSource.includes('useHouseholdUiStore'), "La página del Hogar no debe depender de useHouseholdUiStore");
    assert.ok(!pageSource.includes('householdActionsEnabled'), "La página del Hogar no debe calcular householdActionsEnabled");
  });

  test("WA-HOU-NAV-004: La limpieza de frontera resetea el store UI de Hogar", () => {
    const contextStoreSource = readSource("stores/app-context-store.ts");
    assert.ok(contextStoreSource.includes('useHouseholdUiStore.getState().reset()'), "Debe resetear el store de Hogar al limpiar frontera");
  });

  test("WA-HOU-NAV-005: El tema visual deriva de activeContext en AppShell mediante data-fm-context", () => {
    const appShellSource = readSource("components/layout/app-shell.tsx");
    assert.ok(appShellSource.includes('data-fm-context={context}'), "AppShell debe propagar data-fm-context");
    const dashboardShellSource = readSource("components/layout/dashboard-shell.tsx");
    assert.ok(dashboardShellSource.includes('context={activeContext}'), "DashboardShell debe pasar activeContext al AppShell");
  });

  test("WA-HOU-NAV-006: El placeholder de redirección de frontera usa el loading del contexto destino", () => {
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
