import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  groupHouseholdMovementsByDay,
} from "../../src/features/household/lib/household-dashboard-view-model";
import {
  applyMovementFilters,
  buildMplusMovementRows,
  EMPTY_MOVEMENT_FILTERS,
  groupRowsByDay,
} from "../../src/features/movements/lib/personal-month-view-model";
import { startOfDayMillis } from "../../src/lib/mplus/bogota-date";
import type {
  MplusMovement,
  MplusPersonalAccount,
  MplusPersonalCategory,
} from "../../src/lib/mplus/models";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runMovementsExperienceParityTests = () => {
  console.log("Running unit tests for movements-experience-parity.test.ts...");
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

  const day = (d: number) => startOfDayMillis({ year: 2026, month: 8, day: d });

  const makePersonalCategory = (
    id: string,
    type: "income" | "expense",
    name: string,
  ): MplusPersonalCategory => ({
    id,
    schemaVersion: 1,
    ownerId: "uid-1",
    type,
    name,
    iconKey: type === "expense" ? "groceries" : "salary",
    color: "#22C55E",
    state: "active",
    seedKey: null,
    sortOrder: 0,
    revision: 1,
    lastMutationId: "11111111-1111-4111-8111-111111111111",
    createdAtMillis: day(1),
    updatedAtMillis: day(1),
  });

  const makePersonalAccount = (id: string, name: string): MplusPersonalAccount => ({
    id,
    schemaVersion: 1,
    ownerId: "uid-1",
    name,
    type: "bank",
    iconType: "bank_logo",
    iconKey: "bancolombia",
    color: "#2563EB",
    state: "active",
    referenceCount: 1,
    lastReferenceMovementId: null,
    revision: 1,
    lastMutationId: "22222222-2222-4222-8222-222222222222",
    createdAtMillis: day(1),
    updatedAtMillis: day(1),
  });

  const makeMovement = (overrides: Partial<MplusMovement> & { id: string }): MplusMovement => ({
    schemaVersion: 1,
    ownerId: "uid-1",
    type: "expense",
    title: "Movimiento",
    amount: 1000,
    categoryId: "cat-gasto",
    accountId: "acc-1",
    note: "",
    occurredAtMillis: day(10),
    lifecycleState: "active",
    trashedAtMillis: null,
    purgeAfterMillis: null,
    householdId: null,
    householdCategoryId: null,
    revision: 1,
    lastMutationId: "33333333-3333-4333-8333-333333333333",
    createdAtMillis: day(10),
    updatedAtMillis: day(10),
    ...overrides,
  });

  // --- Bloque 1: Experiencia Personal ---

  test("WA-MOV-PER-001: Agrupación y orden descendente por fecha en modelo de vista Personal", () => {
    const categories = [makePersonalCategory("cat-gasto", "expense", "Mercado")];
    const accounts = [makePersonalAccount("acc-1", "Bancolombia")];

    const movements = [
      makeMovement({ id: "m1", occurredAtMillis: day(12), title: "Día 12" }),
      makeMovement({ id: "m2", occurredAtMillis: day(12), title: "Día 12 segundo" }),
      makeMovement({ id: "m3", occurredAtMillis: day(10), title: "Día 10" }),
      makeMovement({ id: "m4", occurredAtMillis: day(8), title: "Día 8" }),
    ];

    const rows = buildMplusMovementRows(movements, categories, accounts, new Date(day(12)));
    const groups = groupRowsByDay(rows);

    assert.equal(groups.length, 3);
    assert.equal(groups[0].rows.length, 2);
    assert.equal(groups[0].label, "Hoy");
    assert.equal(groups[1].rows.length, 1);
    assert.equal(groups[2].rows.length, 1);
  });

  test("WA-MOV-PER-002: Indicador compartido 'Cuenta en Hogar' o 'Solo personal' sin revelar IDs técnicos", () => {
    const categories = [makePersonalCategory("cat-gasto", "expense", "Mercado")];
    const accounts = [makePersonalAccount("acc-1", "Bancolombia")];

    const movements = [
      makeMovement({ id: "m-privado", householdId: null }),
      makeMovement({ id: "m-compartido", householdId: "household-secret-uuid-1234" }),
    ];

    const rows = buildMplusMovementRows(movements, categories, accounts);
    assert.equal(rows[0].isShared, false);
    assert.equal(rows[1].isShared, true);

    const source = readSource("src/components/finance/personal-transaction-row.tsx");
    assert.ok(source.includes("Cuenta en Hogar"), "Debe formatear 'Cuenta en Hogar'");
    assert.ok(source.includes("Solo personal"), "Debe formatear 'Solo personal'");
    assert.equal(
      source.includes("householdId"),
      false,
      "No debe exponer IDs técnicos de householdId en la fila",
    );
  });

  test("WA-MOV-PER-003: [Estructural] Filas activas son clicables para abrir detalle con foco visible y aria-label", () => {
    const source = readSource("src/components/finance/personal-transaction-row.tsx");
    assert.ok(source.includes("aria-label={`Ver detalle de ${row.title}`}"), "Aria label accesible");
    assert.ok(source.includes("focus-visible:ring-2"), "Foco visible para navegación accesible");
    assert.ok(source.includes("onSelect"), "Soporte de prop onSelect para activar el detalle");
  });

  test("WA-MOV-PER-004: [Estructural] Papelera no abre el detalle y preserva acciones de restauración y purga", () => {
    const source = readSource("src/features/movements/components/movements-view.tsx");
    assert.ok(
      source.includes("onSelect={mode === \"active\" ? () => setSelectedMovement(movement) : undefined}"),
      "Papelera desactiva onSelect",
    );
    assert.ok(source.includes("TrashRowActions"), "Preserva acciones de papelera");
    assert.ok(source.includes("purgeCountdownLabel"), "Preserva etiqueta de vencimiento");
  });

  test("WA-MOV-PER-005: [Estructural] Personal conserva componentes Finance* y tokens --fm-*", () => {
    const source = readSource("src/features/movements/components/movements-view.tsx");
    assert.ok(source.includes("FinanceCard"), "Usa FinanceCard");
    assert.ok(source.includes("FinanceButton"), "Usa FinanceButton");
    assert.ok(source.includes("PersonalTransactionRow"), "Usa PersonalTransactionRow");
    assert.equal(source.includes("HouseholdCard"), false, "No usa HouseholdCard en Personal");
    assert.equal(source.includes("--hh-"), false, "No usa tokens --hh-* en Personal");
  });

  // --- Bloque 2: Experiencia Hogar ---

  test("WA-MOV-HOU-001: groupHouseholdMovementsByDay ordena descendentemente y agrupa por día", () => {
    const movements = [
      makeMovement({ id: "h1", occurredAtMillis: day(5), title: "Día 5" }),
      makeMovement({ id: "h2", occurredAtMillis: day(15), title: "Día 15 A" }),
      makeMovement({ id: "h3", occurredAtMillis: day(15), title: "Día 15 B" }),
      makeMovement({ id: "h4", occurredAtMillis: day(14), title: "Día 14" }),
    ];

    const groups = groupHouseholdMovementsByDay(movements, new Date(day(15)));

    assert.equal(groups.length, 3);
    assert.equal(groups[0].label, "Hoy");
    assert.equal(groups[0].movements.length, 2);
    assert.equal(groups[1].label, "Ayer");
    assert.equal(groups[1].movements.length, 1);
    assert.equal(groups[2].movements.length, 1);
  });

  test("WA-MOV-HOU-002: Conservación de filtros de Hogar (búsqueda, miembro, tipo, categoría Hogar con Por clasificar, cuenta)", () => {
    const source = readSource("src/features/household/components/mplus-household-movements-view.tsx");
    assert.ok(source.includes("selectedMemberId"), "Conserva filtro de Miembro");
    assert.ok(source.includes("selectedType"), "Conserva filtro de Tipo");
    assert.ok(source.includes("selectedCategoryId"), "Conserva filtro de Categoría Hogar");
    assert.ok(source.includes("unclassified"), "Conserva opción 'Por clasificar'");
    assert.ok(source.includes("selectedAccountId"), "Conserva filtro de Cuenta origen");
    assert.ok(source.includes("searchQuery"), "Conserva búsqueda por título");
  });

  test("WA-MOV-HOU-003: [Estructural] MplusHouseholdMovementsView renderiza Card 1 (Filtros) + Card 2 (Historial agrupado por día)", () => {
    const source = readSource("src/features/household/components/mplus-household-movements-view.tsx");
    assert.ok(source.includes("groupHouseholdMovementsByDay"), "Usa groupHouseholdMovementsByDay");
    assert.ok(source.includes("groupedMovements.map"), "Mapea los grupos de día");
    assert.ok(source.includes("aria-label={`Ver detalle de ${movement.title}`}"), "Fila accesible");
    assert.ok(source.includes("min-h-[44px]"), "Área táctil mínima de 44px");
    assert.ok(source.includes("ChevronRight"), "Affordance sutil de detalle");
  });

  test("WA-MOV-HOU-004: [Estructural] Detalle de Hogar con HouseholdDialog y flujo de reclasificación", () => {
    const source = readSource("src/features/household/components/mplus-household-movements-view.tsx");
    assert.ok(source.includes("HouseholdDialog"), "Usa HouseholdDialog");
    assert.ok(source.includes("correctPartnerMovementCategory"), "Preserva servicio de reclasificación");
    assert.ok(source.includes("handleStartReclassify"), "Preserva apertura de reclasificación");
    assert.ok(source.includes("handleSaveReclassify"), "Preserva guardado de reclasificación");
  });

  test("WA-MOV-HOU-005: [Estructural] Hogar conserva componentes Household* y tokens --hh-*", () => {
    const source = readSource("src/features/household/components/mplus-household-movements-view.tsx");
    assert.ok(source.includes("HouseholdCard"), "Usa HouseholdCard");
    assert.ok(source.includes("HouseholdAmount"), "Usa HouseholdAmount");
    assert.ok(source.includes("HouseholdDialog"), "Usa HouseholdDialog");
    assert.ok(source.includes("--hh-"), "Usa tokens --hh-*");
    assert.equal(source.includes("FinanceCard"), false, "No usa FinanceCard en Hogar");
    assert.equal(source.includes("--fm-"), false, "No usa tokens --fm-* en Hogar");
  });

  // --- Bloque 3: Paridad de Experiencia ---

  test("WA-MOV-PAR-001: Ambas rutas implementan la misma composición de 2 Cards y grupos por fecha", () => {
    const perSource = readSource("src/features/movements/components/movements-view.tsx");
    const houSource = readSource("src/features/household/components/mplus-household-movements-view.tsx");

    // Ambas tienen buscador
    assert.ok(perSource.includes("Search"), "Personal tiene Search");
    assert.ok(houSource.includes("Search"), "Hogar tiene Search");

    // Ambas tienen botones de tipo
    assert.ok(perSource.includes("Ingresos"), "Personal tiene Ingresos");
    assert.ok(perSource.includes("Gastos"), "Personal tiene Gastos");
    assert.ok(houSource.includes("Ingresos"), "Hogar tiene Ingresos");
    assert.ok(houSource.includes("Gastos"), "Hogar tiene Gastos");

    // Ambas tienen botón limpiar con badge
    assert.ok(perSource.includes("Limpiar"), "Personal tiene Limpiar");
    assert.ok(houSource.includes("Limpiar"), "Hogar tiene Limpiar");

    // Ambas tienen fecha agrupada con tracking mayúscula
    assert.ok(perSource.includes("tracking-[0.22em]"), "Personal tiene tracking de fecha");
    assert.ok(houSource.includes("tracking-[0.22em]"), "Hogar tiene tracking de fecha");
  });

  test("WA-MOV-PAR-002: Ninguna ruta conserva la preferencia retirada de ocultar saldos", () => {
    const perSource = readSource("src/components/finance/personal-transaction-row.tsx");
    const houSource = readSource("src/features/household/components/mplus-household-movements-view.tsx");

    // "Ocultar saldos al abrir" se retiró del producto: las dos rutas muestran
    // los montos siempre y no arrastran la prop ni el store de preferencias.
    assert.equal(perSource.includes("masked"), false, "PersonalTransactionRow no conserva masked");
    assert.equal(houSource.includes("masked"), false, "Hogar no conserva masked");
    assert.equal(
      perSource.includes("useUiPreferencesStore") || houSource.includes("useUiPreferencesStore"),
      false,
      "ninguna ruta puede leer el store de preferencias retirado",
    );
  });

  console.log(`\nTests for movements-experience-parity: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runMovementsExperienceParityTests();
