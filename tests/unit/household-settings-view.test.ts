import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runHouseholdSettingsTests = () => {
  console.log("Running unit tests for household-settings-view.test.ts...");
  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => void) => {
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

  const readSource = (relativePath: string): string =>
    readFileSync(path.join(__dirname, "..", "..", relativePath), "utf8");

  // ─── 1. Card Superior (Hero unificado) ──────────────────────────────────────
  test("WA-HOU-SET-001: [Estructural] Card superior usa 2 columnas en desktop y se apila en móvil", () => {
    const source = readSource("src/features/household/components/mplus-household-settings-view.tsx");

    // Grid con división en 2 columnas para lg y apilada en móvil
    assert.ok(
      source.includes("lg:grid-cols-") || source.includes("grid gap-8 lg:grid-cols-"),
      "Debe usar grid responsive con columnas en desktop (lg)",
    );
    assert.ok(
      source.includes("border-t") && source.includes("lg:border-l") && source.includes("lg:border-t-0"),
      "Debe incluir divisor horizontal en móvil y vertical en desktop (lg)",
    );
  });

  test("WA-HOU-SET-002: [Identidad y Privacidad] Muestra cuenta e integrantes sin revelar balances ni cuentas privadas", () => {
    const source = readSource("src/features/household/components/mplus-household-settings-view.tsx");

    // Identidad personal
    assert.ok(source.includes("Tu cuenta"), "Debe incluir cabecera 'Tu cuenta'");
    assert.ok(source.includes("Miembro del hogar"), "Debe incluir contexto 'Miembro del hogar'");
    assert.ok(source.includes("ProfileAvatar"), "Debe renderizar ProfileAvatar para el usuario e integrantes");

    // Integrantes del hogar
    assert.ok(source.includes("Hogar compartido"), "Debe incluir cabecera 'Hogar compartido'");
    assert.ok(source.includes("members.length"), "Debe mostrar conteo de miembros");

    // Privacidad financiera
    assert.ok(
      !source.includes("balance") && !source.includes("accountId") && !source.includes("pocketId"),
      "No debe exponer balances o cuentas privadas de otros miembros",
    );
  });

  // ─── 2. Grilla de Ajustes: Preferencias y Organización ────────────────────────
  test("WA-HOU-SET-003: [Estructural] Grilla de 2 columnas para Preferencias y Organización", () => {
    const source = readSource("src/features/household/components/mplus-household-settings-view.tsx");

    assert.ok(
      source.includes("grid items-stretch gap-6 md:grid-cols-2"),
      "Debe renderizar grid responsive de 2 columnas en desktop (md:grid-cols-2)",
    );
    assert.ok(source.includes('title="Preferencias"'), "Debe incluir card de Preferencias");
    assert.ok(source.includes('title="Organización"'), "Debe incluir card de Organización");
  });

  test("WA-HOU-SET-004: [Organización] Contiene categorías de gasto, integrantes y administración vinculada", () => {
    const source = readSource("src/features/household/components/mplus-household-settings-view.tsx");

    // Categorías
    assert.ok(source.includes("Categorías de gasto del hogar"), "Debe incluir fila de categorías");
    assert.ok(source.includes("/household/categories"), "Debe navegar a /household/categories");

    // Integrantes e invitación
    assert.ok(source.includes("Integrantes e invitaciones"), "Debe incluir fila de integrantes");
    assert.ok(source.includes("/settings"), "Debe vincular a Ajustes Personal para gestión");

    // Administrar el hogar
    assert.ok(source.includes("Administrar el hogar"), "Debe incluir fila de administración");
  });

  test("WA-HOU-SET-005: [Preferencias] Contiene información útil de privacidad y moneda sin toggles falsos", () => {
    const source = readSource("src/features/household/components/mplus-household-settings-view.tsx");

    assert.ok(
      source.includes("Privacidad y modo incógnito"),
      "Debe explicar la visibilidad global de saldos",
    );
    assert.ok(
      source.includes("Notificaciones de gastos"),
      "Debe informar sobre notificaciones móviles",
    );
    assert.ok(source.includes("Moneda del hogar"), "Debe informar la moneda COP");
    assert.ok(!source.includes("Toggle"), "No debe tener toggles falsos o no funcionales");
  });

  // ─── 3. Accesibilidad y Tokens ───────────────────────────────────────────────
  test("WA-HOU-SET-006: [Accesibilidad] Botones semánticos con área táctil >= 44px y foco visible", () => {
    const source = readSource("src/features/household/components/mplus-household-settings-view.tsx");

    assert.ok(
      source.includes("min-h-[44px]"),
      "Las filas interactivas deben garantizar área táctil mínima de 44px",
    );
    assert.ok(
      source.includes("focus-visible:ring-[var(--hh-focus-ring)]"),
      "Debe usar anillo de foco visible con token de Hogar",
    );
    assert.ok(
      source.includes('aria-hidden="true"'),
      "Iconos decorativos deben tener aria-hidden",
    );
  });

  test("WA-HOU-SET-007: [Aislamiento de Tokens] Usa exclusivamente tokens --hh-* y no --fm-*", () => {
    const source = readSource("src/features/household/components/mplus-household-settings-view.tsx");

    assert.ok(source.includes("--hh-"), "Debe usar tokens de Hogar (--hh-*)");
    assert.ok(!source.includes("--fm-"), "No debe usar tokens de Personal (--fm-*) en Ajustes Hogar");
  });

  test("WA-HOU-SET-008: [Integridad] Ajustes Personal no fue modificado indebidamente", () => {
    const personalSource = readSource("src/features/settings/components/mplus-settings-view.tsx");
    const blocksSource = readSource("src/components/finance/settings-blocks.tsx");

    assert.ok(
      personalSource.includes("MplusHouseholdLifecycleCard"),
      "Ajustes Personal conserva su lifecycle card",
    );
    assert.ok(
      blocksSource.includes("SettingsPreferencesCard"),
      "settings-blocks conserva SettingsPreferencesCard",
    );
  });

  console.log(`\nTests for household-settings-view: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runHouseholdSettingsTests();
}
