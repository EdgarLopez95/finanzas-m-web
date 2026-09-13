import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Asegurar globalThis.React para subcomponentes
globalThis.React = React;

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { MovementComposerDialog } from "@/features/movements/components/movement-composer-dialog";
import { PeriodPickerDialog } from "@/components/finance/period-picker-dialog";
import { HouseholdPeriodPickerDialog } from "@/features/household/components/ui/household-period-picker-dialog";
import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { FinanceDropdown } from "@/components/finance/finance-dropdown";
import { useAppContextStore } from "@/stores/app-context-store";
import { useAuthStore } from "@/stores/auth-store";
import { useMplusComposerStore } from "@/stores/mplus-composer-store";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";
import type { MplusHousehold, MplusHouseholdMember } from "@/lib/mplus/models";

// Helper para búsqueda en el árbol de elementos React
function findElement(node: any, predicate: (n: any) => boolean): any {
  if (!node) return null;
  if (predicate(node)) return node;
  if (node.props) {
    if (node.props.actions) {
      const found = findElement(node.props.actions, predicate);
      if (found) return found;
    }
    if (Array.isArray(node.props.children)) {
      for (const child of node.props.children) {
        const found = findElement(child, predicate);
        if (found) return found;
      }
    } else if (node.props.children) {
      const found = findElement(node.props.children, predicate);
      if (found) return found;
    }
  }
  return null;
}

function findChildByType(node: any, targetType: any): any {
  return findElement(node, (n) => n.type === targetType);
}

export async function runHouseholdComposerMountingTests(): Promise<void> {
  console.log("Running unit/integration tests for household-composer-mounting.test.ts...");

  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => void | Promise<void>) => {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (error) {
      console.error(`  ✗ ${name}`);
      console.error(error);
      failed++;
    }
  };

  // Interceptar useSyncExternalStore en SSR para que Zustand evalúe con el estado actual
  const originalSyncExternalStore = React.useSyncExternalStore;
  React.useSyncExternalStore = (subscribe, getSnapshot) => getSnapshot();

  const mockRouter = {
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
  };

  /**
   * Monta DashboardShell dentro del router context de Next.js, ejecuta sus hooks
   * de forma válida en el ciclo de render de React y captura tanto el árbol de
   * elementos devuelto como el marcado HTML generado.
   */
  const inspectShell = (pathname: string, children: React.ReactNode = "Contenido") => {
    let capturedTree: any = null;

    function Inspector() {
      const tree = (DashboardShell as any)({ children });
      capturedTree = tree;
      return tree;
    }

    const rootElement = React.createElement(
      AppRouterContext.Provider,
      { value: mockRouter as any },
      React.createElement(
        PathnameContext.Provider,
        { value: pathname },
        React.createElement(Inspector)
      )
    );

    const html = renderToStaticMarkup(rootElement);
    return { tree: capturedTree, html, rootElement };
  };

  const resetAllStores = () => {
    useMplusComposerStore.getState().close();
    useAppContextStore.getState().closePeriodPicker();
    useAppContextStore.getState().setActiveContext("personal");
  };

  const mockHousehold: MplusHousehold = {
    id: "hh-test-1",
    schemaVersion: 1,
    name: "Hogar Feliz",
    status: "active",
    memberAId: "user-test-a",
    memberBId: "user-test-b",
    activeInviteId: null,
    catalogVersion: 1,
    cleanupPhase: "none",
    revision: 1,
    lastMutationId: "11111111-1111-4111-8111-111111111111",
    createdAtMillis: Date.now(),
    updatedAtMillis: Date.now(),
  };

  const mockMembers: MplusHouseholdMember[] = [
    {
      id: "mem-a",
      schemaVersion: 1,
      householdId: "hh-test-1",
      userId: "user-test-a",
      state: "active",
      displayName: "Felipe",
      photoUrl: "",
      joinedAtMillis: Date.now(),
      leftAtMillis: null,
      revision: 1,
      lastMutationId: "22222222-2222-4222-8222-222222222222",
      updatedAtMillis: Date.now(),
    },
    {
      id: "mem-b",
      schemaVersion: 1,
      householdId: "hh-test-1",
      userId: "user-test-b",
      state: "active",
      displayName: "Pareja",
      photoUrl: "",
      joinedAtMillis: Date.now(),
      leftAtMillis: null,
      revision: 1,
      lastMutationId: "33333333-3333-4333-8333-333333333333",
      updatedAtMillis: Date.now(),
    },
  ];

  const setupOperativeHousehold = () => {
    useAuthStore.setState({
      status: "authenticated",
      user: {
        uid: "user-test-a",
        displayName: "Felipe",
        email: "felipe@test.com",
      } as any,
    });

    useMplusPersonalStore.setState({
      profile: {
        householdId: "hh-test-1",
        status: "active",
      } as any,
      status: "success",
      movements: [],
    });

    useMplusHouseholdStore.setState({
      household: mockHousehold,
      members: mockMembers,
      categories: [],
      mappings: [],
      status: "success",
    });

    useAppContextStore.getState().setActiveContext("household");
  };

  try {
    // ─────────────────────────────────────────────────────────────────────────────
    // 1. Integración real en Hogar operativo: localizar botón real "Nuevo gasto", activarlo y verificar
    // ─────────────────────────────────────────────────────────────────────────────
    test("WA-HOU-INT-001: [Integración Hogar] DashboardShell en Hogar operativo monta el botón real 'Nuevo gasto', al activarlo abre el composer y renderiza 'Nuevo gasto en Hogar'", () => {
      resetAllStores();
      setupOperativeHousehold();

      // 1. Montar DashboardShell en estado inicial: composer cerrado
      const initialMount = inspectShell("/household", React.createElement("div", { id: "test-content" }, "Hogar View"));

      assert.equal(
        useMplusComposerStore.getState().mode.kind,
        "closed",
        "El composer debe iniciar cerrado",
      );

      // El diálogo no debe estar montado en el DOM mientras está cerrado
      assert.equal(
        initialMount.html.includes('role="dialog"'),
        false,
        "No debe haber ningún diálogo abierto inicialmente",
      );

      // 2. Localizar el botón real "Nuevo gasto" en el árbol retornado por DashboardShell
      const nuevoGastoButton = findElement(
        initialMount.tree,
        (n) =>
          n.type === HouseholdButton &&
          (n.props["aria-label"] === "Nuevo gasto en Hogar" ||
            n.props.children?.includes?.("Nuevo gasto"))
      );
      assert.ok(
        nuevoGastoButton,
        "Debe localizarse el componente HouseholdButton 'Nuevo gasto' en las acciones de DashboardShell",
      );
      assert.equal(
        typeof nuevoGastoButton.props.onClick,
        "function",
        "El botón 'Nuevo gasto' debe tener un handler onClick definido",
      );

      // 3. Activar el botón real mediante su onClick
      nuevoGastoButton.props.onClick();

      // Verificar que la mutación de estado en el store fue ejecutada por la acción real del botón
      const composerMode = useMplusComposerStore.getState().mode;
      assert.equal(composerMode.kind, "create", "El modo debe ser 'create'");
      assert.equal((composerMode as any).target, "household", "El target debe ser 'household'");
      assert.equal((composerMode as any).type, "expense", "El tipo debe ser 'expense'");

      // 4. Renderizar el DashboardShell montado con el diálogo activo
      const activeMount = inspectShell("/household", React.createElement("div", { id: "test-content" }, "Hogar View"));

      assert.ok(
        activeMount.html.includes('role="dialog"'),
        "DashboardShell montado debe contener un diálogo accesible con role='dialog'",
      );
      assert.ok(
        activeMount.html.includes("Nuevo gasto en Hogar"),
        "DashboardShell montado debe renderizar el título 'Nuevo gasto en Hogar'",
      );
      assert.ok(
        activeMount.html.includes("Registrar una salida de dinero en las cuentas del Hogar"),
        "Debe renderizar la descripción contextual de Hogar",
      );
      assert.ok(
        activeMount.html.includes("Continuar a distribución") || activeMount.html.includes("Guardar cambios"),
        "Debe incluir la acción de distribución de gasto en Hogar",
      );
      assert.equal(
        activeMount.html.includes("Nuevo ingreso"),
        false,
        "En Hogar no se permite la creación de ingresos",
      );
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. Regresión Personal: acción "Nuevo" abre el composer Personal
    // ─────────────────────────────────────────────────────────────────────────────
    test("WA-HOU-INT-002: [Regresión Personal] DashboardShell en Personal monta el selector 'Nuevo', al activarlo abre el composer Personal", () => {
      resetAllStores();

      useAuthStore.setState({
        status: "authenticated",
        user: {
          uid: "user-test-a",
          displayName: "Felipe",
          email: "felipe@test.com",
        } as any,
      });

      useMplusPersonalStore.setState({
        profile: { householdId: null, status: "active" } as any,
        status: "success",
        movements: [],
      });

      useAppContextStore.getState().setActiveContext("personal");

      // 1. Montar DashboardShell en Personal
      const personalMount = inspectShell("/dashboard", React.createElement("div", null, "Personal View"));

      // Localizar FinanceDropdown que encapsula la acción "Nuevo"
      const financeDropdown = findElement(personalMount.tree, (n) => n.type === FinanceDropdown);
      assert.ok(
        financeDropdown,
        "Debe localizarse el FinanceDropdown en las acciones del TopBar Personal",
      );
      assert.ok(
        Array.isArray(financeDropdown.props.items),
        "FinanceDropdown debe contener items de acción",
      );

      const expenseItem = financeDropdown.props.items.find(
        (it: any) => it.label === "Nuevo gasto"
      );
      assert.ok(expenseItem, "Debe existir el item 'Nuevo gasto' en FinanceDropdown");
      assert.equal(typeof expenseItem.onClick, "function");

      // 2. Activar la acción real "Nuevo gasto"
      expenseItem.onClick();

      let composerMode = useMplusComposerStore.getState().mode;
      assert.equal(composerMode.kind, "create");
      assert.equal((composerMode as any).target, "personal");
      assert.equal((composerMode as any).type, "expense");

      let activeMount = inspectShell("/dashboard");
      assert.ok(activeMount.html.includes('role="dialog"'), "Debe renderizar diálogo");
      assert.ok(activeMount.html.includes("Gasto"), "Debe mostrar selector con opción Gasto");
      assert.ok(activeMount.html.includes("Ingreso"), "Debe mostrar selector con opción Ingreso");
      assert.equal(
        activeMount.html.includes("Nuevo gasto en Hogar"),
        false,
        "El composer Personal NO debe mostrar 'Nuevo gasto en Hogar'",
      );

      // 3. Activar la acción real "Nuevo ingreso"
      const incomeItem = financeDropdown.props.items.find(
        (it: any) => it.label === "Nuevo ingreso"
      );
      assert.ok(incomeItem, "Debe existir el item 'Nuevo ingreso' en FinanceDropdown");
      incomeItem.onClick();

      composerMode = useMplusComposerStore.getState().mode;
      assert.equal(composerMode.kind, "create");
      assert.equal((composerMode as any).type, "income");

      activeMount = inspectShell("/dashboard");
      assert.ok(
        activeMount.html.includes("Registrar una entrada de dinero") || activeMount.html.includes("Ingreso"),
        "Debe mostrar formulario de ingreso",
      );
      assert.equal(
        activeMount.html.includes("Nuevo gasto en Hogar"),
        false,
        "El composer Personal de ingreso NO debe mostrar 'Nuevo gasto en Hogar'",
      );
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Cruce Personal ↔ Hogar: composer abierto se cierra y no reaparece con estado anterior
    // ─────────────────────────────────────────────────────────────────────────────
    test("WA-HOU-INT-003: [Frontera y Aislamiento] Cruce Personal ↔ Hogar en DashboardShell: el composer abierto se cierra y no reaparece con estado del contexto anterior", () => {
      resetAllStores();
      setupOperativeHousehold();

      // Caso A: Abrir composer en Hogar mediante botón real
      const initialHogar = inspectShell("/household");
      const btnHogar = findElement(
        initialHogar.tree,
        (n) => n.type === HouseholdButton && (n.props["aria-label"] === "Nuevo gasto en Hogar" || n.props.children?.includes?.("Nuevo gasto"))
      );
      assert.ok(btnHogar, "Botón Nuevo gasto en Hogar debe existir");
      btnHogar.props.onClick();

      assert.equal(useMplusComposerStore.getState().mode.kind, "create");
      assert.equal((useMplusComposerStore.getState().mode as any).target, "household");

      let hogarMount = inspectShell("/household");
      assert.ok(
        hogarMount.html.includes('role="dialog"') && hogarMount.html.includes("Nuevo gasto en Hogar"),
        "En Hogar debe estar abierto el diálogo con role='dialog' y título 'Nuevo gasto en Hogar'",
      );

      // Cambiar a Personal
      useAppContextStore.getState().setActiveContext("personal");
      assert.equal(
        useMplusComposerStore.getState().mode.kind,
        "closed",
        "Al cruzar de Hogar a Personal el store debe cerrar el composer",
      );

      let personalMount = inspectShell("/dashboard");
      assert.equal(
        personalMount.html.includes('role="dialog"'),
        false,
        "En Personal tras cruzar no debe haber ningún diálogo abierto",
      );
      assert.equal(
        personalMount.html.includes("Nuevo gasto en Hogar"),
        false,
        "No debe haber residuo de diálogo 'Nuevo gasto en Hogar' en Personal",
      );

      // Caso B: Abrir composer en Personal
      const personalActions = findElement(personalMount.tree, (n) => n.type === FinanceDropdown);
      const expenseItem = personalActions.props.items.find((it: any) => it.label === "Nuevo gasto");
      expenseItem.onClick();

      assert.equal(useMplusComposerStore.getState().mode.kind, "create");
      assert.equal((useMplusComposerStore.getState().mode as any).target, "personal");

      personalMount = inspectShell("/dashboard");
      assert.ok(
        personalMount.html.includes('role="dialog"') && personalMount.html.includes("Gasto"),
        "En Personal debe estar abierto el diálogo de Personal",
      );

      // Cambiar a Hogar
      useAppContextStore.getState().setActiveContext("household");
      assert.equal(
        useMplusComposerStore.getState().mode.kind,
        "closed",
        "Al cruzar de Personal a Hogar el store debe cerrar el composer",
      );

      hogarMount = inspectShell("/household");
      assert.equal(
        hogarMount.html.includes('role="dialog"'),
        false,
        "En Hogar tras cruzar no debe haber ningún diálogo abierto",
      );
      assert.equal(
        useMplusComposerStore.getState().mode.kind,
        "closed",
        "El modo del composer debe permanecer en 'closed' tras el cruce",
      );
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. Exclusividad de selectores de período en runtime de DashboardShell
    // ─────────────────────────────────────────────────────────────────────────────
    test("WA-HOU-INT-004: [Exclusividad de Período en Runtime] PeriodPickerDialog es exclusivo de Personal y HouseholdPeriodPickerDialog de Hogar en la jerarquía real de componentes", () => {
      resetAllStores();

      // 4a. En contexto Personal
      useAuthStore.setState({
        status: "authenticated",
        user: { uid: "user-test-a", displayName: "Felipe" } as any,
      });
      useMplusPersonalStore.setState({
        profile: { householdId: null, status: "active" } as any,
        status: "success",
        movements: [],
      });
      useAppContextStore.getState().setActiveContext("personal");

      const personalMount = inspectShell("/dashboard", React.createElement("div", null, "P"));

      // Comprobar presencia de PeriodPickerDialog y AUSENCIA de HouseholdPeriodPickerDialog en el árbol real
      const personalPicker = findChildByType(personalMount.tree, PeriodPickerDialog);
      const householdPickerInPersonal = findChildByType(personalMount.tree, HouseholdPeriodPickerDialog);

      assert.ok(
        personalPicker !== null,
        "En Personal, DashboardShell DEBE montar PeriodPickerDialog",
      );
      assert.equal(
        householdPickerInPersonal,
        null,
        "En Personal, DashboardShell NO DEBE montar HouseholdPeriodPickerDialog",
      );

      // 4b. En contexto Hogar
      setupOperativeHousehold();
      const householdMount = inspectShell("/household", React.createElement("div", null, "H"));

      const householdPicker = findChildByType(householdMount.tree, HouseholdPeriodPickerDialog);
      const personalPickerInHousehold = findChildByType(householdMount.tree, PeriodPickerDialog);

      assert.ok(
        householdPicker !== null,
        "En Hogar, DashboardShell DEBE montar HouseholdPeriodPickerDialog",
      );
      assert.equal(
        personalPickerInHousehold,
        null,
        "En Hogar, DashboardShell NO DEBE montar PeriodPickerDialog",
      );

      // 4c. Apertura y renderizado de marcado en ambos contextos
      // En Personal con picker abierto:
      useAppContextStore.getState().setActiveContext("personal");
      useAppContextStore.getState().openPeriodPicker();
      assert.equal(useAppContextStore.getState().periodPickerOpen, true);

      const personalPickerMount = inspectShell("/dashboard");
      assert.ok(
        personalPickerMount.html.includes("Elegir período"),
        "El picker personal abierto debe renderizarse en el HTML de DashboardShell",
      );
      assert.equal(
        personalPickerMount.html.includes("var(--hh-surface-elevated)"),
        false,
        "El picker personal NO debe usar tokens ni componentes de Hogar",
      );

      // En Hogar con picker abierto:
      useAppContextStore.getState().setActiveContext("household");
      // Al cambiar de contexto se cierra automáticamente
      assert.equal(
        useAppContextStore.getState().periodPickerOpen,
        false,
        "El picker de período debe cerrarse automáticamente al cambiar de contexto",
      );

      // Reabrir en Hogar:
      useAppContextStore.getState().openPeriodPicker();
      assert.equal(useAppContextStore.getState().periodPickerOpen, true);

      const householdPickerMount = inspectShell("/household");
      assert.ok(
        householdPickerMount.html.includes("Elegir período"),
        "El picker de hogar abierto debe renderizarse en el HTML de DashboardShell",
      );
      assert.ok(
        householdPickerMount.html.includes("var(--hh-border)") ||
          householdPickerMount.html.includes("var(--hh-surface-elevated)"),
        "El picker de hogar montado debe utilizar estilos y tokens de Hogar (--hh-*)",
      );
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. Verificación de key={activeContext} en MovementComposerDialog
    // ─────────────────────────────────────────────────────────────────────────────
    test("WA-HOU-INT-005: [Key de Aislamiento] DashboardShell mantiene MovementComposerDialog con key={activeContext} para ambos contextos", () => {
      // En Personal
      useAppContextStore.getState().setActiveContext("personal");
      const personalMount = inspectShell("/dashboard");
      const personalComposer = findChildByType(personalMount.tree, MovementComposerDialog);
      assert.ok(personalComposer, "MovementComposerDialog debe estar montado en Personal");
      assert.equal(
        personalComposer.key,
        "personal",
        "MovementComposerDialog en Personal debe tener key='personal'",
      );

      // En Hogar
      setupOperativeHousehold();
      const householdMount = inspectShell("/household");
      const householdComposer = findChildByType(householdMount.tree, MovementComposerDialog);
      assert.ok(householdComposer, "MovementComposerDialog debe estar montado en Hogar");
      assert.equal(
        householdComposer.key,
        "household",
        "MovementComposerDialog en Hogar debe tener key='household'",
      );
    });
  } finally {
    React.useSyncExternalStore = originalSyncExternalStore;
    resetAllStores();
  }

  console.log(`\nTests for household-composer-mounting: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

// Ejecución directa si se invoca con tsx
if (process.argv[1]?.endsWith("household-composer-mounting.test.ts")) {
  void runHouseholdComposerMountingTests();
}
