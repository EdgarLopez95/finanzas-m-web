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
      console.log(`  âœ“ ${name}`);
    } catch (error) {
      failed++;
      console.error(`  âœ— ${name}`);
      console.error(error);
    }
  };

  test("WA-PER-NAV-001: La navegaci\u00f3n Personal conserva las cinco rutas de escritorio", () => {
    // El roadmap dicta que Web puede aprovechar su espacio adicional y debe conservar 
    // las rutas directas a Cuentas y Categor\u00edas en la navegaci\u00f3n principal.
    const navSource = readSource("components/layout/navigation.ts");
    
    assert.ok(navSource.includes('href: "/dashboard"'), "Debe incluir /dashboard");
    assert.ok(navSource.includes('href: "/movements"'), "Debe incluir /movements");
    assert.ok(navSource.includes('href: "/accounts"'), "Debe incluir /accounts");
    assert.ok(navSource.includes('href: "/categories"'), "Debe incluir /categories");
    assert.ok(navSource.includes('href: "/settings"'), "Debe incluir /settings");
  });

  test("WA-PER-NAV-002: La acci\u00f3n 'Nuevo' permanece disponible globalmente bajo contexto Personal", () => {
    // Verificaci\u00f3n estructural para impedir regresi\u00f3n donde se oculte 'Nuevo' de forma condicionada
    // a las rutas de Personal (ej. s\u00f3lo /dashboard o /movements).
    const shellSource = readSource("components/layout/dashboard-shell.tsx");
    
    const hasConditionalNuevo = shellSource.includes('{(view === "home" || view === "movements") &&');
    const hasFinanceDropdown = shellSource.includes("<FinanceDropdown");

    assert.ok(hasFinanceDropdown, "El dropdown 'Nuevo' (FinanceDropdown) debe existir en el Shell");
    assert.ok(!hasConditionalNuevo, "El bot\u00f3n 'Nuevo' no debe estar restringido a Inicio/Movimientos en Web. Debe ser global en Personal.");
  });

  console.log(`\nTests for personal-shell-navigation: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
