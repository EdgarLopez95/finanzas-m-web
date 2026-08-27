import assert from "node:assert/strict";
import fs, { readFileSync } from "node:fs";
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

  test("WA-PER-NAV-001: La navegación Personal M+ contiene Inicio, Movimientos, Gastos por categoría y Ajustes", () => {
    const navSource = readSource("components/layout/navigation.ts");

    assert.ok(navSource.includes('href: "/dashboard"'), "Debe incluir /dashboard");
    assert.ok(navSource.includes('href: "/movements"'), "Debe incluir /movements");
    assert.ok(navSource.includes('href: "/categories"'), "Debe incluir /categories");
    assert.ok(navSource.includes('label: "Gastos por categoría"'), "Debe incluir label Gastos por categoría");
    assert.ok(navSource.includes('href: "/settings"'), "Debe incluir /settings");

    // Verificar orden: dashboard -> movements -> categories -> settings
    const idxDashboard = navSource.indexOf('href: "/dashboard"');
    const idxMovements = navSource.indexOf('href: "/movements"');
    const idxCategories = navSource.indexOf('href: "/categories"');
    const idxSettings = navSource.indexOf('href: "/settings"');

    assert.ok(idxDashboard < idxMovements, "Inicio debe ir antes de Movimientos");
    assert.ok(idxMovements < idxCategories, "Movimientos debe ir antes de Categorías");
    assert.ok(idxCategories < idxSettings, "Categorías debe ir antes de Ajustes");
  });

  test("WA-PER-NAV-002: La acción 'Nuevo' permanece disponible globalmente bajo contexto Personal", () => {
    const shellSource = readSource("components/layout/dashboard-shell.tsx");

    const hasConditionalNuevo = shellSource.includes('{(view === "home" || view === "movements") &&');
    const hasFinanceDropdown = shellSource.includes("<FinanceDropdown");

    assert.ok(hasFinanceDropdown, "El dropdown 'Nuevo' (FinanceDropdown) debe existir en el Shell");
    assert.ok(!hasConditionalNuevo, "El botón 'Nuevo' no debe estar restringido a Inicio/Movimientos en Web. Debe ser global en Personal.");
  });

  test("WA-PER-NAV-003: [Estructural] El dropdown 'Nuevo' de Personal usa menú rico de 292px con trigger dorado y preserva Hogar intacto", () => {
    const shellSource = readSource("components/layout/dashboard-shell.tsx");

    // 1. Configuración de menú rico y ancho de 292px
    assert.ok(
      shellSource.includes('itemLayout="rich"'),
      "El dropdown de Personal debe usar itemLayout='rich'",
    );
    assert.ok(
      shellSource.includes('menuWidth={292}'),
      "El dropdown de Personal debe tener menuWidth={292}",
    );
    assert.ok(
      shellSource.includes('menuClassName="w-[292px]"'),
      "El dropdown de Personal debe tener menuClassName='w-[292px]'",
    );
    assert.ok(
      shellSource.includes('align="right"'),
      "El dropdown de Personal debe estar alineado a la derecha (align='right')",
    );

    // 2. Trigger con fondo dorado (--fm-pending), texto oscuro y sombra cálida
    assert.ok(
      shellSource.includes("bg-[var(--fm-pending)]"),
      "El trigger debe usar el token dorado var(--fm-pending)",
    );
    assert.ok(
      shellSource.includes("text-[var(--fm-ink)]"),
      "El trigger debe usar texto oscuro var(--fm-ink)",
    );
    assert.ok(
      shellSource.includes("shadow-[0_16px_36px_rgb(228_179_99/0.24)]"),
      "El trigger debe incluir la sombra cálida dorada",
    );

    // 3. Ítems con iconos y descripciones ricas
    assert.ok(
      shellSource.includes("Registrar una salida de dinero"),
      "Debe incluir la descripción del gasto",
    );
    assert.ok(
      shellSource.includes("Registrar una entrada de dinero"),
      "Debe incluir la descripción del ingreso",
    );
    assert.ok(
      shellSource.includes("<ArrowDownLeft"),
      "Debe incluir el icono ArrowDownLeft para gastos",
    );
    assert.ok(
      shellSource.includes("<ArrowUpRight"),
      "Debe incluir el icono ArrowUpRight para ingresos",
    );

    // 4. Aislamiento: Hogar conserva sus tokens --hh-* y no monta botón de creación de movimiento
    assert.ok(
      shellSource.includes("var(--hh-border)"),
      "Hogar debe conservar sus tokens --hh-*",
    );
    assert.ok(
      !shellSource.includes("openCreateExpense"),
      "Hogar no debe exponer handler de creación de gasto en el shell",
    );
  });

  console.log(`\nTests for personal-shell-navigation: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();

// ─── Retroalimentación inmediata al cambiar de sección ───────────────────────
//
// Reportado en QA: "le doy click y parece que no hace nada". Sin un `loading.tsx`
// en el segmento, el App Router deja la pantalla ANTERIOR congelada hasta que la
// sección destino puede renderizar. Con él, la sección cambia al instante y el
// esqueleto ocupa el sitio mientras llega el resto.
//
// En desarrollo eso se nota mucho más, porque el código de cada sección pesa
// megabytes sin minificar; pero el hueco existe igual en producción ante
// cualquier latencia.

{
  const loadingFiles = [
    // Personal: esqueleto con los tokens del ambiente Personal.
    {
      file: "src/app/(dashboard)/loading.tsx",
      shimmer: "FinanceShimmer",
      why: "las secciones Personales necesitan su propio esqueleto de navegación",
    },
    // Hogar: el esqueleto debe verse del color del ambiente compartido. Uno con
    // el tono equivocado se lee como un parpadeo de contexto.
    {
      file: "src/app/(dashboard)/household/loading.tsx",
      shimmer: "HouseholdShimmer",
      why: "el ambiente Hogar necesita su esqueleto con tokens --hh-*",
    },
  ];

  for (const { file, shimmer, why } of loadingFiles) {
    const full = path.join(__dirname, "..", "..", file);
    assert.ok(fs.existsSync(full), `${file} debe existir: ${why}`);

    const source = fs.readFileSync(full, "utf-8");
    assert.ok(source.includes(shimmer), `${file} debe usar ${shimmer}`);
    // Accesible: quien no ve la pantalla también debe enterarse de que carga.
    assert.ok(
      source.includes('aria-busy="true"'),
      `${file} debe anunciarse como ocupado para lectores de pantalla`,
    );
  }
}

console.log("OK personal-shell-navigation (estados de carga de navegación)");
