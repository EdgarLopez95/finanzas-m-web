import assert from "node:assert/strict";

import {
  buildExpenseCategoryBreakdown,
  buildPersonalMovementRows,
  formatMovementGroupLabelEs,
} from "@/features/dashboard/lib/personal-view-model";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";
import type { Pocket } from "@/types/pocket";
import type { Transaction } from "@/types/transaction";

const categories: Category[] = [
  { id: "cat-food", ownerId: "u1", name: "Comida", icon: "utensils", type: "expense" },
  { id: "cat-transport", ownerId: "u1", name: "Transporte", icon: "car", type: "expense" },
  { id: "cat-salary", ownerId: "u1", name: "Salario", icon: "wallet", type: "income" },
];

const accounts: Account[] = [
  { id: "acc-main", ownerId: "u1", name: "Bancolombia", balance: 2500000, currency: "COP", institutionName: "Bancolombia", type: "bank", updatedAt: null, includeInTotal: true, archived: false, iconKey: "bank", iconType: "generic", color: "" },
  { id: "acc-wallet", ownerId: "u1", name: "Nequi", balance: 480000, currency: "COP", institutionName: "Nequi", type: "wallet", updatedAt: null, includeInTotal: true, archived: false, iconKey: "wallet", iconType: "generic", color: "" },
];

const pockets: Pocket[] = [
  { id: "pocket-1", accountId: "acc-main", name: "Mercado", balance: 250000 },
];

const transactions: Transaction[] = [
  {
    id: "tx-expense-1",
    ownerId: "u1",
    title: "",
    notes: "",
    amount: 620000,
    type: "expense",
    accountId: "acc-main",
    pocketId: "pocket-1",
    targetAccountId: null,
    categoryId: "cat-food",
    createdAt: new Date("2026-06-08T10:00:00"),
    date: new Date("2026-06-08T10:00:00"),
  },
  {
    id: "tx-expense-2",
    ownerId: "u1",
    title: "Taxi",
    notes: "Aeropuerto",
    amount: 410000,
    type: "expense",
    accountId: "acc-wallet",
    targetAccountId: null,
    categoryId: "cat-transport",
    createdAt: new Date("2026-06-07T10:00:00"),
    date: new Date("2026-06-07T10:00:00"),
  },
  {
    id: "tx-income",
    ownerId: "u1",
    title: "Nomina",
    notes: "",
    amount: 3200000,
    type: "income",
    accountId: "acc-main",
    targetAccountId: null,
    categoryId: "cat-salary",
    countsAsRealIncome: true,
    createdAt: new Date("2026-06-08T08:00:00"),
    date: new Date("2026-06-08T08:00:00"),
  },
  {
    id: "tx-transfer",
    ownerId: "u1",
    title: "",
    notes: "",
    amount: 150000,
    type: "transfer",
    accountId: "acc-main",
    targetAccountId: "acc-wallet",
    categoryId: "",
    createdAt: new Date("2026-06-06T08:00:00"),
    date: new Date("2026-06-06T08:00:00"),
  },
  {
    id: "tx-income-transit",
    ownerId: "u1",
    title: "Prestamo",
    notes: "",
    amount: 500000,
    type: "income",
    accountId: "acc-main",
    targetAccountId: null,
    categoryId: "cat-salary",
    countsAsRealIncome: false,
    createdAt: new Date("2026-06-08T08:00:00"),
    date: new Date("2026-06-08T08:00:00"),
  },
  {
    id: "tx-household",
    ownerId: "u1",
    title: "Gasto compartido",
    notes: "",
    amount: 25000,
    type: "expense",
    accountId: "acc-main",
    targetAccountId: null,
    categoryId: "",
    isHousehold: true,
    createdAt: new Date("2026-06-08T08:00:00"),
    date: new Date("2026-06-08T08:00:00"),
  },
  {
    id: "tx-deleted-pocket",
    ownerId: "u1",
    title: "",
    notes: "",
    amount: 1000,
    type: "transfer",
    accountId: "acc-main",
    pocketId: "pocket-deleted",
    targetAccountId: "acc-main",
    targetPocketId: "target-deleted",
    categoryId: "",
    createdAt: new Date("2026-06-08T08:00:00"),
    date: new Date("2026-06-08T08:00:00"),
  },
];

const breakdown = buildExpenseCategoryBreakdown(transactions, categories);

assert.equal(breakdown.length, 2, "solo debe incluir categorias con gastos");
assert.equal(breakdown[0].categoryId, "cat-food", "debe ordenar por monto descendente");
assert.equal(breakdown[0].amount, 620000, "debe sumar el total de la categoria");
assert.equal(breakdown[0].share, 60, "debe redondear el porcentaje de participacion");
assert.equal(breakdown[1].share, 40, "el resto de categorias debe completar el total");

assert.equal(
  formatMovementGroupLabelEs(new Date("2026-06-08T10:00:00"), new Date("2026-06-08T21:00:00")),
  "Hoy",
  "debe etiquetar movimientos del mismo dia como Hoy"
);
assert.equal(
  formatMovementGroupLabelEs(new Date("2026-06-07T10:00:00"), new Date("2026-06-08T21:00:00")),
  "Ayer",
  "debe etiquetar movimientos del dia anterior como Ayer"
);

const rows = buildPersonalMovementRows(
  transactions,
  categories,
  accounts,
  pockets,
  new Date("2026-06-08T21:00:00"),
);

const rowsById = new Map(rows.map((row) => [row.id, row]));

assert.equal(rowsById.get("tx-income")?.title, "Nomina", "debe conservar el titulo explicito cuando exista");
assert.equal(rowsById.get("tx-expense-1")?.title, "Comida", "debe retornar la categoria como fallback de titulo");
assert.equal(rowsById.get("tx-expense-1")?.groupLabel, "Hoy", "debe asignar la agrupacion relativa correcta");
assert.equal(rowsById.get("tx-expense-1")?.metadata, "Bolsillo: Mercado", "debe mostrar el bolsillo cuando el gasto sale de bolsillo");
assert.equal(rowsById.get("tx-expense-1")?.pocketName, "Mercado", "debe resolver el nombre del bolsillo");
assert.equal(rowsById.get("tx-expense-2")?.subtitle, "Aeropuerto", "debe priorizar la nota cuando exista");
assert.equal(rowsById.get("tx-transfer")?.metadata, "Destino: Nequi", "debe mostrar la cuenta destino en transferencias");
assert.equal(rowsById.get("tx-transfer")?.title, "Transferencia", "debe retornar 'Transferencia' como fallback de titulo");

// Fallback de bolsillo eliminado
assert.equal(rowsById.get("tx-deleted-pocket")?.pocketName, "Bolsillo eliminado", "debe usar fallback Bolsillo eliminado para origen eliminado");
assert.equal(rowsById.get("tx-deleted-pocket")?.targetPocketName, "Bolsillo eliminado", "debe usar fallback Bolsillo eliminado para destino eliminado");
assert.equal(rowsById.get("tx-deleted-pocket")?.metadata, "Destino: Bancolombia / Bolsillo eliminado", "metadata debe mostrar el fallback de destino");

// WA-PER-004: test countsAsRealIncome and isHousehold mapping
assert.equal(rowsById.get("tx-income")?.countsAsRealIncome, true, "debe ser ingreso real por defecto");
assert.equal(rowsById.get("tx-expense-1")?.countsAsRealIncome, true, "debe ser real por defecto para no-ingresos");
assert.equal(rowsById.get("tx-expense-1")?.isHousehold, false, "debe ser no-hogar por defecto");

assert.equal(rowsById.get("tx-income-transit")?.countsAsRealIncome, false, "debe mapear countsAsRealIncome false");
assert.equal(rowsById.get("tx-household")?.isHousehold, true, "debe mapear isHousehold true");

console.log("OK personal-view-model");
