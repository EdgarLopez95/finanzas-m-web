import assert from "node:assert/strict";

import {
  EMPTY_MOVEMENT_FILTERS,
  applyMovementFilters,
  buildCategoryBreakdown,
  buildMplusMovementRows,
  buildPersonalMonthKpis,
  daysUntilPurge,
  groupRowsByDay,
  purgeCountdownLabel,
} from "../../src/features/movements/lib/personal-month-view-model";
import { PURGE_WINDOW_MILLIS, startOfDayMillis } from "../../src/lib/mplus/bogota-date";
import { MPLUS_MONTHLY_CALC_FIXTURE } from "../../src/lib/mplus/fixtures";
import type {
  MplusMovement,
  MplusPersonalAccount,
  MplusPersonalCategory,
} from "../../src/lib/mplus/models";

/**
 * Modelo de vista del mes Personal (contrato §25 y matriz W2).
 *
 * Comprueba que las cifras del tablero salen del nucleo compartido y que la
 * fila conserva la gramatica visual de la Web base, degradando con etiquetas
 * neutras cuando falta una categoria o una cuenta en vez de inventar datos.
 */

export const runMplusPersonalMonthViewModelTests = (): void => {
  const day = (d: number) => startOfDayMillis({ year: 2026, month: 8, day: d });

  const category = (
    id: string,
    type: "income" | "expense",
    name: string,
    overrides: Partial<MplusPersonalCategory> = {},
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
    ...overrides,
  });

  const account = (id: string, name: string): MplusPersonalAccount => ({
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

  const movement = (overrides: Partial<MplusMovement> & { id: string }): MplusMovement => ({
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

  const categories = [
    category("cat-gasto", "expense", "Mercado"),
    category("cat-casa", "expense", "Arriendo", { iconKey: "housing", color: "#6C8E7F" }),
    category("cat-sueldo", "income", "Salario", { color: "#EAB308" }),
  ];
  const accounts = [account("acc-1", "Bancolombia")];

  // --- KPIs: mismos numeros que el fixture compartido del contrato §25 ---
  {
    const movements = MPLUS_MONTHLY_CALC_FIXTURE.movements.map((entry, index) =>
      movement({
        id: `fix-${index}`,
        type: entry.type,
        amount: entry.amount,
        categoryId: entry.categoryId,
        householdCategoryId: entry.householdCategoryId,
        householdId: entry.householdCategoryId === null ? null : "h-1",
      }),
    );

    const kpis = buildPersonalMonthKpis(movements);
    assert.equal(kpis.income, MPLUS_MONTHLY_CALC_FIXTURE.expected.totalIncome);
    assert.equal(kpis.expense, MPLUS_MONTHLY_CALC_FIXTURE.expected.totalExpense);
    assert.equal(kpis.difference, MPLUS_MONTHLY_CALC_FIXTURE.expected.difference);
  }

  // --- la diferencia puede ser negativa: no se recorta a cero ---
  {
    const kpis = buildPersonalMonthKpis([
      movement({ id: "a", type: "income", amount: 100_000, categoryId: "cat-sueldo" }),
      movement({ id: "b", type: "expense", amount: 250_000 }),
    ]);
    assert.equal(kpis.difference, -150_000);
  }

  // --- desglose de gasto: ordenado, con porcentaje entero, sin ceros ---
  {
    const breakdown = buildCategoryBreakdown(
      [
        movement({ id: "a", amount: 300_000, categoryId: "cat-casa" }),
        movement({ id: "b", amount: 100_000, categoryId: "cat-gasto" }),
        movement({ id: "c", type: "income", amount: 900_000, categoryId: "cat-sueldo" }),
      ],
      categories,
      "expense",
    );

    assert.equal(breakdown.length, 2, "el ingreso no entra en el desglose de gasto");
    assert.equal(breakdown[0].categoryId, "cat-casa", "ordenado de mayor a menor");
    assert.equal(breakdown[0].amount, 300_000);
    assert.equal(breakdown[0].share, 75);
    assert.equal(breakdown[1].share, 25);
    assert.equal(breakdown[0].name, "Arriendo");
    assert.equal(breakdown[0].color, "#6C8E7F");
  }

  // --- desglose de ingreso: vista secundaria de la matriz W2 ---
  {
    const breakdown = buildCategoryBreakdown(
      [
        movement({ id: "a", type: "income", amount: 500_000, categoryId: "cat-sueldo" }),
        movement({ id: "b", amount: 100_000, categoryId: "cat-gasto" }),
      ],
      categories,
      "income",
    );
    assert.equal(breakdown.length, 1);
    assert.equal(breakdown[0].categoryId, "cat-sueldo");
    assert.equal(breakdown[0].share, 100);
  }

  // --- categoria ausente: etiqueta neutra, nunca se inventa otra ---
  {
    const breakdown = buildCategoryBreakdown(
      [movement({ id: "a", categoryId: "cat-borrada" })],
      categories,
      "expense",
    );
    assert.equal(breakdown[0].name, "Categoria eliminada");
  }

  // --- filas: subtitulo, etiquetas y campos retirados ---
  {
    const rows = buildMplusMovementRows(
      [
        movement({ id: "a", title: "Mercado semanal" }),
        movement({ id: "b", title: "Con nota", note: "  quincena  " }),
        movement({ id: "c", title: "Sin cuenta", accountId: null }),
        movement({ id: "d", title: "Cuenta borrada", accountId: "acc-fantasma" }),
        movement({ id: "e", title: "Compartido", householdId: "h-1" }),
      ],
      categories,
      accounts,
      new Date(day(10)),
    );

    assert.equal(rows[0].subtitle, "Mercado - Bancolombia");
    assert.equal(rows[1].subtitle, "quincena", "la nota manda y llega recortada");
    assert.equal(rows[2].subtitle, "Mercado", "sin cuenta el subtitulo no la menciona");
    assert.equal(rows[2].accountName, null);
    assert.equal(rows[3].accountName, "Cuenta eliminada");
    assert.equal(rows[4].isShared, true);
    assert.equal(rows[0].isShared, false);
    assert.equal(rows[0].groupLabel, "Hoy");
    assert.equal(rows[0].revision, 1, "la fila lleva la revision para poder editar con OCC");

    // El modelo M+ no tiene bolsillo, titularidad ni cuenta destino.
    const keys = Object.keys(rows[0]);
    for (const retired of ["pocketId", "pocketName", "targetAccountName", "countsAsRealIncome"]) {
      assert.equal(keys.includes(retired), false, `${retired} no pertenece al contrato v1`);
    }
  }

  // --- agrupacion por dia conservando el orden de entrada ---
  {
    const rows = buildMplusMovementRows(
      [
        movement({ id: "a", occurredAtMillis: day(10) }),
        movement({ id: "b", occurredAtMillis: day(10) }),
        movement({ id: "c", occurredAtMillis: day(9) }),
      ],
      categories,
      accounts,
      new Date(day(10)),
    );
    const groups = groupRowsByDay(rows);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].rows.length, 2);
    assert.equal(groups[1].rows.length, 1);
  }

  // --- filtros combinables sobre el mes ya cargado (contrato §19.1) ---
  {
    const rows = buildMplusMovementRows(
      [
        movement({ id: "a", title: "Mercado semanal", categoryId: "cat-gasto" }),
        movement({ id: "b", title: "Arriendo agosto", categoryId: "cat-casa" }),
        movement({ id: "c", title: "Salario", type: "income", categoryId: "cat-sueldo" }),
        movement({ id: "d", title: "Mercado sin cuenta", accountId: null }),
      ],
      categories,
      accounts,
    );

    assert.equal(applyMovementFilters(rows, EMPTY_MOVEMENT_FILTERS).length, 4);
    assert.equal(
      applyMovementFilters(rows, { ...EMPTY_MOVEMENT_FILTERS, type: "income" }).length,
      1,
    );
    assert.equal(
      applyMovementFilters(rows, { ...EMPTY_MOVEMENT_FILTERS, categoryId: "cat-casa" }).length,
      1,
    );
    assert.equal(
      applyMovementFilters(rows, { ...EMPTY_MOVEMENT_FILTERS, accountId: "none" }).length,
      1,
      "'sin cuenta' es un filtro propio",
    );
    assert.equal(
      applyMovementFilters(rows, { ...EMPTY_MOVEMENT_FILTERS, search: "mercado" }).length,
      2,
      "la busqueda por titulo ignora mayusculas",
    );
    // Combinables: tipo + busqueda.
    assert.equal(
      applyMovementFilters(rows, {
        ...EMPTY_MOVEMENT_FILTERS,
        type: "expense",
        search: "arriendo",
      }).length,
      1,
    );
  }

  // --- vencimiento visible de la Papelera (contrato §9.5) ---
  {
    const now = day(20);
    assert.equal(daysUntilPurge(null, now), null);
    assert.equal(daysUntilPurge(now + PURGE_WINDOW_MILLIS, now), 30);
    assert.equal(daysUntilPurge(now - 1000, now), 0, "un vencido nunca cuenta negativo");
    assert.equal(purgeCountdownLabel(now + PURGE_WINDOW_MILLIS, now), "Quedan 30 dias");
    assert.equal(purgeCountdownLabel(now + 86_400_000, now), "Queda 1 dia");
    assert.equal(purgeCountdownLabel(now, now), "Se elimina hoy");
  }

  console.log("OK mplus-personal-month-view-model");
};

runMplusPersonalMonthViewModelTests();
