import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { countActiveHouseholdTimelineItems } from "../../src/features/household/lib/household-dashboard-view-model";
import type { MplusMovement, MplusHouseholdExpense } from "../../src/lib/mplus/models";

console.log("Running unit tests for mplus-sidebar-movements-badge.test.ts (ORQ-052)...");

const repoRoot = path.resolve(__dirname, "../..");
const sidebarSource = fs.readFileSync(
  path.resolve(repoRoot, "src/components/layout/sidebar.tsx"),
  "utf8",
);
const shellSource = fs.readFileSync(
  path.resolve(repoRoot, "src/components/layout/dashboard-shell.tsx"),
  "utf8",
);

// Helpers para crear mocks mínimos de MplusMovement y MplusHouseholdExpense
function mockMovement(overrides: Partial<MplusMovement> = {}): MplusMovement {
  return {
    id: "mov_1",
    schemaVersion: 1,
    ownerId: "user_a",
    type: "expense",
    title: "Gasto legacy compartido",
    amount: 50000,
    categoryId: "cat_1",
    accountId: "acc_1",
    note: "",
    occurredAtMillis: 1700000000000,
    lifecycleState: "active",
    trashedAtMillis: null,
    purgeAfterMillis: null,
    householdId: "hh_1",
    householdCategoryId: "cat_hh_1",
    origin: "personal",
    householdExpenseId: null,
    revision: 1,
    lastMutationId: "mut_1",
    createdAtMillis: 1700000000000,
    updatedAtMillis: 1700000000000,
    ...overrides,
  };
}

function mockHouseholdExpense(overrides: Partial<MplusHouseholdExpense> = {}): MplusHouseholdExpense {
  return {
    id: "exp_1",
    schemaVersion: 1,
    householdId: "hh_1",
    type: "expense",
    title: "Bateria moto",
    amount: 120000,
    note: "",
    occurredAtMillis: 1700000000000,
    householdCategoryId: "cat_hh_1",
    distributionMode: "equal",
    memberAId: "user_a",
    memberAAmount: 60000,
    memberBId: "user_b",
    memberBAmount: 60000,
    lifecycleState: "active",
    trashedAtMillis: null,
    purgeAfterMillis: null,
    createdBy: "user_a",
    updatedBy: "user_a",
    revision: 1,
    lastMutationId: "mut_1",
    createdAtMillis: 1700000000000,
    updatedAtMillis: 1700000000000,
    ...overrides,
  };
}

export function runSidebarMovementsBadgeTests() {
  let passed = 0;

  // 1. Caso: Hogar con solo un gasto directo muestra badge 1
  {
    const movements: MplusMovement[] = [];
    const expenses: MplusHouseholdExpense[] = [mockHouseholdExpense({ id: "exp_bateria", title: "Bateria moto" })];
    const count = countActiveHouseholdTimelineItems(movements, expenses);
    assert.strictEqual(count, 1, "Hogar con solo un gasto directo activo debe contar 1");
    passed++;
    console.log("  ✓ [ORQ-052-01] Hogar con solo un gasto directo activo cuenta 1");
  }

  // 2. Caso: Hogar con un legacy y un gasto directo muestra 2
  {
    const movements: MplusMovement[] = [mockMovement({ id: "mov_legacy_1" })];
    const expenses: MplusHouseholdExpense[] = [mockHouseholdExpense({ id: "exp_direct_1" })];
    const count = countActiveHouseholdTimelineItems(movements, expenses);
    assert.strictEqual(count, 2, "Hogar con un legacy y un gasto directo activo debe contar 2");
    passed++;
    console.log("  ✓ [ORQ-052-02] Hogar con un legacy y un gasto directo activo cuenta 2");
  }

  // 3. Caso: Hogar vacío no cuenta ningún elemento (0)
  {
    const movements: MplusMovement[] = [];
    const expenses: MplusHouseholdExpense[] = [];
    const count = countActiveHouseholdTimelineItems(movements, expenses);
    assert.strictEqual(count, 0, "Hogar sin movimientos ni gastos debe contar 0");
    passed++;
    console.log("  ✓ [ORQ-052-03] Hogar vacío cuenta 0");
  }

  // 4. Caso: Exclusión de papelera (no cuenta gastos ni movimientos trashed)
  {
    const movements: MplusMovement[] = [
      mockMovement({ id: "mov_active", lifecycleState: "active" }),
      mockMovement({ id: "mov_trashed", lifecycleState: "trashed" }),
    ];
    const expenses: MplusHouseholdExpense[] = [
      mockHouseholdExpense({ id: "exp_active", lifecycleState: "active" }),
      mockHouseholdExpense({ id: "exp_trashed", lifecycleState: "trashed" }),
    ];
    const count = countActiveHouseholdTimelineItems(movements, expenses);
    assert.strictEqual(count, 2, "Solo deben contarse elementos con lifecycleState === 'active'");
    passed++;
    console.log("  ✓ [ORQ-052-04] Elementos en papelera no se cuentan");
  }

  // 5. Caso: Verificación estructural en Sidebar.tsx para soportar /household/movements y ocultar con 0
  {
    assert.ok(
      sidebarSource.includes('/household/movements'),
      "Sidebar debe incluir la ruta '/household/movements' para mostrar el badge en Hogar",
    );
    assert.ok(
      sidebarSource.includes('movementCount > 0'),
      "Sidebar debe ocultar el badge cuando movementCount <= 0",
    );
    passed++;
    console.log("  ✓ [ORQ-052-05] Sidebar renderiza badge tanto en /movements como en /household/movements condicionado a movementCount > 0");
  }

  // 6. Caso: Verificación estructural en DashboardShell.tsx para cálculo contextual
  {
    assert.ok(
      shellSource.includes('countActiveHouseholdTimelineItems'),
      "DashboardShell debe usar countActiveHouseholdTimelineItems para el conteo en Hogar",
    );
    assert.ok(
      shellSource.includes('isHousehold'),
      "DashboardShell debe discriminar el conteo según isHousehold",
    );
    assert.match(
      shellSource,
      /movementCount:\s*mplusMovementCount,/,
      "DashboardShell debe seguir pasando movementCount: mplusMovementCount a AppShell",
    );
    passed++;
    console.log("  ✓ [ORQ-052-06] DashboardShell calcula mplusMovementCount según el contexto activo");
  }

  console.log(`\nTests for mplus-sidebar-movements-badge: ${passed} passed, 0 failed\n`);
}

runSidebarMovementsBadgeTests();
