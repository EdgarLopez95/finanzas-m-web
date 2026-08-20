import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

console.log("Running unit tests for personal-shell-navigation.test.ts...");

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

  test("WA-PER-NAV-001: La navegación Personal M+ usa navegación reducida de 3 ítems (DEC-020)", () => {
    const navSource = readSource("components/layout/navigation.ts");

    assert.ok(navSource.includes('href: "/dashboard"'), "Debe incluir /dashboard");
    assert.ok(navSource.includes('href: "/movements"'), "Debe incluir /movements");
    assert.ok(navSource.includes('href: "/settings"'), "Debe incluir /settings");
  });

  test("WA-PER-NAV-002: La acción 'Nuevo' permanece disponible globalmente bajo contexto Personal", () => {
    const shellSource = readSource("components/layout/dashboard-shell.tsx");

    const hasConditionalNuevo = shellSource.includes('{(view === "home" || view === "movements") &&');
    const hasFinanceDropdown = shellSource.includes("<FinanceDropdown");

    assert.ok(hasFinanceDropdown, "El dropdown 'Nuevo' (FinanceDropdown) debe existir en el Shell");
    assert.ok(!hasConditionalNuevo, "El botón 'Nuevo' no debe estar restringido a Inicio/Movimientos en Web. Debe ser global en Personal.");
  });

  console.log(`\nTests for personal-shell-navigation: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
