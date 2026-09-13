/**
 * Tests unitarios: cronología unificada de Hogar → Movimientos
 *
 * HT-001 Solo gasto originado en Hogar → visible en timeline
 * HT-002 Mezcla legacy + gasto fuente ordenada por fecha desc
 * HT-003 Sin duplicación
 * HT-004 Filtro búsqueda
 * HT-005 Filtro miembro: usa createdBy
 * HT-006 Filtro tipo expense: pasa
 * HT-007 Filtro tipo income: no pasa
 * HT-008 Filtro categoría por ID
 * HT-009 Filtro categoría unclassified
 * HT-010 Filtro cuenta unassigned: pasa
 * HT-011 Filtro cuenta específica: no pasa
 * HT-012 Discriminador kind correcto
 * HT-013 Gastos en papelera excluidos
 * HT-014 groupHouseholdTimelineByDay agrupa correctamente
 */

import assert from "node:assert/strict";
import {
  buildHouseholdTimeline,
  groupHouseholdTimelineByDay,
} from "../../src/features/household/lib/household-dashboard-view-model.js";
import type { HouseholdTimelineFilters } from "../../src/features/household/lib/household-dashboard-view-model.js";
import type { MplusMovement, MplusHouseholdExpense } from "../../src/lib/mplus/models.js";

const UID_A = "userA";
const UID_B = "userB";
const HH_ID = "hh001";
const CAT_VEHICLE = "cat_vehicle";

const ALL_FILTERS: HouseholdTimelineFilters = {
  search: "",
  type: "all",
  memberId: "all",
  categoryId: "all",
  accountId: "all",
};

function makeMovement(
  overrides: Partial<MplusMovement> & Pick<MplusMovement, "id" | "occurredAtMillis">,
): MplusMovement {
  return {
    schemaVersion: 1,
    ownerId: UID_A,
    type: "expense",
    title: "Gasto Legacy",
    amount: 50000,
    categoryId: null,
    accountId: "acc001",
    note: "",
    lifecycleState: "active",
    trashedAtMillis: null,
    purgeAfterMillis: null,
    householdId: HH_ID,
    householdCategoryId: CAT_VEHICLE,
    origin: "personal",
    householdExpenseId: null,
    revision: 1,
    lastMutationId: "m1",
    createdAtMillis: 1000,
    updatedAtMillis: 1000,
    ...overrides,
  };
}

function makeHouseholdExpense(
  overrides: Partial<MplusHouseholdExpense> & Pick<MplusHouseholdExpense, "id" | "occurredAtMillis">,
): MplusHouseholdExpense {
  return {
    schemaVersion: 1,
    householdId: HH_ID,
    type: "expense",
    title: "Gasto Hogar",
    amount: 120000,
    note: "",
    householdCategoryId: CAT_VEHICLE,
    distributionMode: "equal",
    memberAId: UID_A,
    memberAAmount: 60000,
    memberBId: UID_B,
    memberBAmount: 60000,
    lifecycleState: "active",
    trashedAtMillis: null,
    purgeAfterMillis: null,
    createdBy: UID_A,
    updatedBy: UID_A,
    revision: 1,
    lastMutationId: "he1",
    createdAtMillis: 2000,
    updatedAtMillis: 2000,
    ...overrides,
  };
}

export async function runMplusHouseholdTimelineTests(): Promise<void> {
  // HT-001 — Solo gasto originado en Hogar → visible en timeline
  {
    const expense = makeHouseholdExpense({ id: "exp001", occurredAtMillis: 2_000_000 });
    const rows = buildHouseholdTimeline([], [expense], ALL_FILTERS);
    assert.equal(rows.length, 1, "HT-001: debe haber 1 fila");
    assert.equal(rows[0].kind, "household_expense", "HT-001: kind correcto");
    if (rows[0].kind === "household_expense") {
      assert.equal(rows[0].expense.id, "exp001", "HT-001: ID correcto");
    }
  }

  // HT-002 — Mezcla legacy + gasto fuente ordenada por fecha desc
  {
    const mov = makeMovement({ id: "mov001", occurredAtMillis: 1_000_000 });
    const exp = makeHouseholdExpense({ id: "exp001", occurredAtMillis: 2_000_000 });
    const rows = buildHouseholdTimeline([mov], [exp], ALL_FILTERS);
    assert.equal(rows.length, 2, "HT-002: 2 filas");
    assert.equal(rows[0].kind, "household_expense", "HT-002: gasto Hogar primero");
    assert.equal(rows[1].kind, "legacy", "HT-002: legacy segundo");
  }

  // HT-003 — Sin duplicación
  {
    const mov = makeMovement({ id: "shared_id", occurredAtMillis: 1_000_000 });
    const exp = makeHouseholdExpense({ id: "shared_id", occurredAtMillis: 1_000_000 });
    const rows = buildHouseholdTimeline([mov], [exp], ALL_FILTERS);
    assert.equal(rows.length, 2, "HT-003: 2 filas distintas");
    const kinds = rows.map((r) => r.kind);
    assert.ok(kinds.includes("legacy"), "HT-003: incluye legacy");
    assert.ok(kinds.includes("household_expense"), "HT-003: incluye household_expense");
  }

  // HT-004 — Filtro búsqueda
  {
    const exp = makeHouseholdExpense({ id: "exp001", occurredAtMillis: 2_000_000, title: "Gasolina Carro" });
    const rows = buildHouseholdTimeline([], [exp], { ...ALL_FILTERS, search: "gasolin" });
    assert.equal(rows.length, 1, "HT-004: coincide búsqueda");
    const noMatch = buildHouseholdTimeline([], [exp], { ...ALL_FILTERS, search: "supermercado" });
    assert.equal(noMatch.length, 0, "HT-004: no coincide búsqueda ajena");
  }

  // HT-005 — Filtro miembro: usa createdBy
  {
    const expA = makeHouseholdExpense({ id: "exp_a", occurredAtMillis: 1_000_000, createdBy: UID_A });
    const expB = makeHouseholdExpense({ id: "exp_b", occurredAtMillis: 2_000_000, createdBy: UID_B });
    const rowsA = buildHouseholdTimeline([], [expA, expB], { ...ALL_FILTERS, memberId: UID_A });
    assert.equal(rowsA.length, 1, "HT-005: solo el de A");
    if (rowsA[0].kind === "household_expense") {
      assert.equal(rowsA[0].expense.id, "exp_a", "HT-005: ID A");
    }
    const rowsB = buildHouseholdTimeline([], [expA, expB], { ...ALL_FILTERS, memberId: UID_B });
    assert.equal(rowsB.length, 1, "HT-005: solo el de B");
  }

  // HT-006 — Filtro tipo expense: pasa
  {
    const exp = makeHouseholdExpense({ id: "exp001", occurredAtMillis: 1_000_000 });
    const rows = buildHouseholdTimeline([], [exp], { ...ALL_FILTERS, type: "expense" });
    assert.equal(rows.length, 1, "HT-006: pasa filtro expense");
  }

  // HT-007 — Filtro tipo income: no pasa
  {
    const exp = makeHouseholdExpense({ id: "exp001", occurredAtMillis: 1_000_000 });
    const rows = buildHouseholdTimeline([], [exp], { ...ALL_FILTERS, type: "income" });
    assert.equal(rows.length, 0, "HT-007: no pasa filtro income");
  }

  // HT-008 — Filtro categoría por ID
  {
    const expV = makeHouseholdExpense({ id: "exp_v", occurredAtMillis: 1_000_000, householdCategoryId: CAT_VEHICLE });
    const expF = makeHouseholdExpense({ id: "exp_f", occurredAtMillis: 2_000_000, householdCategoryId: "cat_food" });
    const rows = buildHouseholdTimeline([], [expV, expF], { ...ALL_FILTERS, categoryId: CAT_VEHICLE });
    assert.equal(rows.length, 1, "HT-008: solo Vehículo");
    if (rows[0].kind === "household_expense") {
      assert.equal(rows[0].expense.id, "exp_v", "HT-008: ID correcto");
    }
  }

  // HT-009 — Filtro categoría unclassified
  {
    const expU = makeHouseholdExpense({ id: "exp_u", occurredAtMillis: 1_000_000, householdCategoryId: null });
    const expC = makeHouseholdExpense({ id: "exp_c", occurredAtMillis: 2_000_000, householdCategoryId: CAT_VEHICLE });
    const rows = buildHouseholdTimeline([], [expU, expC], { ...ALL_FILTERS, categoryId: "unclassified" });
    assert.equal(rows.length, 1, "HT-009: solo el no clasificado");
    if (rows[0].kind === "household_expense") {
      assert.equal(rows[0].expense.id, "exp_u", "HT-009: ID correcto");
    }
  }

  // HT-010 — Filtro cuenta unassigned: pasa
  {
    const exp = makeHouseholdExpense({ id: "exp001", occurredAtMillis: 1_000_000 });
    const rows = buildHouseholdTimeline([], [exp], { ...ALL_FILTERS, accountId: "unassigned" });
    assert.equal(rows.length, 1, "HT-010: pasa filtro unassigned");
  }

  // HT-011 — Filtro cuenta específica: no pasa
  {
    const exp = makeHouseholdExpense({ id: "exp001", occurredAtMillis: 1_000_000 });
    const rows = buildHouseholdTimeline([], [exp], { ...ALL_FILTERS, accountId: "acc_specific" });
    assert.equal(rows.length, 0, "HT-011: no pasa cuenta específica");
  }

  // HT-012 — Discriminador kind correcto
  {
    const mov = makeMovement({ id: "mov001", occurredAtMillis: 1_000_000 });
    const exp = makeHouseholdExpense({ id: "exp001", occurredAtMillis: 2_000_000 });
    const rows = buildHouseholdTimeline([mov], [exp], ALL_FILTERS);
    const legacyRow = rows.find((r) => r.kind === "legacy");
    const expRow = rows.find((r) => r.kind === "household_expense");
    assert.ok(legacyRow !== undefined, "HT-012: fila legacy existe");
    assert.ok(expRow !== undefined, "HT-012: fila household_expense existe");
    if (legacyRow && legacyRow.kind === "legacy") {
      assert.equal(legacyRow.movement.id, "mov001", "HT-012: movement.id");
    }
    if (expRow && expRow.kind === "household_expense") {
      assert.equal(expRow.expense.id, "exp001", "HT-012: expense.id");
    }
  }

  // HT-013 — Gastos en papelera excluidos
  {
    const expTrashed = makeHouseholdExpense({ id: "exp_trash", occurredAtMillis: 1_000_000, lifecycleState: "trashed" });
    const rows = buildHouseholdTimeline([], [expTrashed], ALL_FILTERS);
    assert.equal(rows.length, 0, "HT-013: papelera excluida");
  }

  // HT-014 — groupHouseholdTimelineByDay agrupa correctamente
  {
    const DAY = new Date("2026-09-04").getTime();
    const exp1 = makeHouseholdExpense({ id: "exp1", occurredAtMillis: DAY + 20_000 });
    const exp2 = makeHouseholdExpense({ id: "exp2", occurredAtMillis: DAY + 10_000 });
    const mov1 = makeMovement({ id: "mov1", occurredAtMillis: DAY + 5_000 });
    const rows = buildHouseholdTimeline([mov1], [exp1, exp2], ALL_FILTERS);
    const groups = groupHouseholdTimelineByDay(rows);
    assert.equal(groups.length, 1, "HT-014: mismo grupo de día");
    assert.equal(groups[0].rows.length, 3, "HT-014: 3 filas");
  }

  // HT-015 — Dentro del mismo día, lo creado más recientemente aparece primero.
  {
    const DAY = new Date("2026-09-04").getTime();
    const older = makeHouseholdExpense({
      id: "exp_older",
      title: "Creado primero",
      occurredAtMillis: DAY,
      createdAtMillis: DAY + 1_000,
    });
    const newer = makeHouseholdExpense({
      id: "exp_newer",
      title: "Creado después",
      occurredAtMillis: DAY,
      createdAtMillis: DAY + 2_000,
    });

    const rows = buildHouseholdTimeline([], [older, newer], ALL_FILTERS);
    assert.equal(rows[0].kind, "household_expense", "HT-015: primera fila es gasto Hogar");
    if (rows[0].kind === "household_expense") {
      assert.equal(rows[0].expense.id, "exp_newer", "HT-015: el último creado aparece primero");
    }
  }

  console.log("OK mplus-household-timeline (HT-001..HT-015)");
}
