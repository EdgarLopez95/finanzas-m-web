import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { resolveInitialDrawerFocus } from "../../src/lib/a11y/dialog-focus";

console.log("Running unit tests for mobile-shell-responsive.test.ts...");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

/** Helper para crear elementos simulados de prueba conductual de foco */
type MockElement = {
  tagName: string;
  attributes: Record<string, string>;
  disabled?: boolean;
  focused?: boolean;
  children?: MockElement[];
  focus: () => void;
  hasAttribute: (name: string) => boolean;
  getAttribute: (name: string) => string | null;
  querySelector: <T = unknown>(selector: string) => T | null;
  querySelectorAll: <T = unknown>(selector: string) => T[];
};

const createMockElement = (
  tagName: string,
  attributes: Record<string, string> = {},
  disabled = false,
  children: MockElement[] = [],
): MockElement => {
  const elem: MockElement = {
    tagName: tagName.toUpperCase(),
    attributes,
    disabled,
    focused: false,
    children,
    focus() {
      elem.focused = true;
    },
    hasAttribute(name: string) {
      return name in elem.attributes;
    },
    getAttribute(name: string) {
      return elem.attributes[name] ?? null;
    },
    querySelector<T = unknown>(selector: string): T | null {
      if (selector === 'button[aria-label="Cerrar menú de navegación"]') {
        const found = elem.querySelectorAll<MockElement>("button").find(
          (b) => b.getAttribute("aria-label") === "Cerrar menú de navegación",
        );
        return (found ?? null) as unknown as T;
      }
      return null;
    },
    querySelectorAll<T = unknown>(selector: string): T[] {
      const results: MockElement[] = [];
      const collect = (node: MockElement) => {
        for (const child of node.children ?? []) {
          // Coincidencia con selector de focusables
          const tag = child.tagName.toLowerCase();
          const matches =
            (selector.includes("button") && tag === "button") ||
            (selector.includes("a[href]") && tag === "a" && child.hasAttribute("href")) ||
            (selector.includes("input") && tag === "input") ||
            (selector.includes('[tabindex]:not([tabindex="-1"])') && child.hasAttribute("tabindex") && child.getAttribute("tabindex") !== "-1");

          if (matches) {
            results.push(child);
          }
          collect(child);
        }
      };
      collect(elem);
      return results as unknown as T[];
    },
  };
  return elem;
};

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

  test("WA-MOB-SHELL-001: AppShell oculta el sidebar fijo en móvil y usa grid responsivo en lg", () => {
    const appShellSource = readSource("components/layout/app-shell.tsx");

    assert.ok(
      appShellSource.includes('data-shell-sidebar className="hidden lg:block lg:sticky lg:top-0 lg:h-screen"'),
      "El sidebar de escritorio debe tener 'hidden lg:block' para no ocupar el inicio en móvil",
    );
    assert.ok(
      appShellSource.includes("lg:grid lg:grid-cols-[264px_minmax(0,1fr)]"),
      "El layout debe aplicar la rejilla de 2 columnas solo en breakpoints de escritorio (lg)",
    );
  });

  test("WA-MOB-SHELL-002: AppShell implementa drawer móvil accesible con backdrop y focus trap", () => {
    const appShellSource = readSource("components/layout/app-shell.tsx");

    assert.ok(
      appShellSource.includes('role="dialog"'),
      "El drawer móvil debe tener role='dialog'",
    );
    assert.ok(
      appShellSource.includes('aria-modal="true"'),
      "El drawer móvil debe tener aria-modal='true'",
    );
    assert.ok(
      appShellSource.includes('id="mobile-navigation"'),
      "El drawer móvil debe tener id='mobile-navigation'",
    );
    assert.ok(
      appShellSource.includes("useFocusTrap(mobileDrawerRef, mobileNavOpen"),
      "El drawer móvil debe atrapar el foco y responder a Escape con useFocusTrap",
    );
    assert.ok(
      appShellSource.includes('document.body.style.overflow = "hidden"'),
      "Debe bloquear el scroll del body mientras el menú móvil esté abierto",
    );
  });

  test("WA-MOB-SHELL-003: TopBar incluye botón de menú móvil visible solo en < lg con atributos a11y", () => {
    const topBarSource = readSource("components/layout/top-bar.tsx");

    assert.ok(
      topBarSource.includes("onMenuClick"),
      "TopBar debe aceptar callback onMenuClick",
    );
    assert.ok(
      topBarSource.includes("aria-controls=\"mobile-navigation\""),
      "El botón de menú debe estar asociado con aria-controls='mobile-navigation'",
    );
    assert.ok(
      topBarSource.includes("aria-expanded={isMenuOpen}"),
      "El botón de menú debe reflejar el estado con aria-expanded",
    );
    assert.ok(
      topBarSource.includes("lg:hidden"),
      "El botón de menú debe estar oculto en escritorio (lg:hidden)",
    );
    assert.ok(
      topBarSource.includes("styles.menuButton"),
      "El botón de menú debe usar estilos por contexto (Personal / Hogar)",
    );
  });

  test("WA-MOB-SHELL-004: Sidebar soporta modo móvil con botón de cierre accesible y callbacks de navegación", () => {
    const sidebarSource = readSource("components/layout/sidebar.tsx");

    assert.ok(
      sidebarSource.includes("isMobile?: boolean"),
      "SidebarProps debe aceptar isMobile",
    );
    assert.ok(
      sidebarSource.includes("onClose?: () => void"),
      "SidebarProps debe aceptar onClose",
    );
    assert.ok(
      sidebarSource.includes("onNavigate?: () => void"),
      "SidebarProps debe aceptar onNavigate",
    );
    assert.ok(
      sidebarSource.includes('aria-label="Cerrar menú de navegación"'),
      "El botón de cerrar debe tener aria-label accesible",
    );
    assert.ok(
      sidebarSource.includes("onNavigate?.()"),
      "Los enlaces y el conmutador de contexto deben invocar onNavigate al ser presionados",
    );
    assert.ok(
      sidebarSource.includes("overflow-y-auto"),
      "El sidebar debe permitir scroll vertical para pantallas pequeñas",
    );
  });

  test("WA-MOB-SHELL-005: TopBar y Sidebar mantienen discriminación visual estricta entre Personal y Hogar", () => {
    const topBarSource = readSource("components/layout/top-bar.tsx");
    const sidebarSource = readSource("components/layout/sidebar.tsx");

    assert.ok(
      topBarSource.includes("PERSONAL_TOP_BAR_STYLES") && topBarSource.includes("HOUSEHOLD_TOP_BAR_STYLES"),
      "TopBar debe mantener paletas separadas",
    );
    assert.ok(
      sidebarSource.includes("PERSONAL_SIDEBAR_STYLES") && sidebarSource.includes("HOUSEHOLD_SIDEBAR_STYLES"),
      "Sidebar debe mantener paletas separadas",
    );
  });

  test("WA-MOB-SHELL-006: [Conductual] resolveInitialDrawerFocus sitúa foco inmediatamente en botón de cierre", () => {
    const closeBtn = createMockElement("button", { "aria-label": "Cerrar menú de navegación" });
    const navLink1 = createMockElement("a", { href: "/dashboard" });
    const navLink2 = createMockElement("a", { href: "/movements" });
    const container = createMockElement("div", {}, false, [closeBtn, navLink1, navLink2]);

    const target = resolveInitialDrawerFocus(container as unknown as HTMLElement);
    assert.strictEqual(target, closeBtn as unknown as HTMLElement, "Debe priorizar el botón de cierre");

    target?.focus();
    assert.strictEqual(closeBtn.focused, true, "Debe invocar focus() en el botón de cierre");
  });

  test("WA-MOB-SHELL-007: [Conductual] resolveInitialDrawerFocus usa fallback al primer control focusable si no hay botón de cierre", () => {
    const navLink1 = createMockElement("a", { href: "/dashboard" });
    const navLink2 = createMockElement("a", { href: "/movements" });
    const container = createMockElement("div", {}, false, [navLink1, navLink2]);

    const target = resolveInitialDrawerFocus(container as unknown as HTMLElement);
    assert.strictEqual(target, navLink1 as unknown as HTMLElement, "Debe caer al primer control útil");

    target?.focus();
    assert.strictEqual(navLink1.focused, true, "Debe invocar focus() en el primer enlace");
  });

  test("WA-MOB-SHELL-008: [Integración] AppShell activa resolveInitialDrawerFocus al abrirse el drawer móvil", () => {
    const appShellSource = readSource("components/layout/app-shell.tsx");

    assert.ok(
      appShellSource.includes("resolveInitialDrawerFocus(container)"),
      "AppShell debe resolver el foco inicial al abrir el drawer móvil",
    );
    assert.ok(
      appShellSource.includes("initialElement?.focus()"),
      "AppShell debe aplicar el foco al elemento resuelto",
    );
  });

  console.log(`\nTests for mobile-shell-responsive: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
