import assert from "node:assert/strict";

import { recomputePersonalDerivedFields } from "../../src/stores/personal-data-store";
import type { Account } from "../../src/types/account";
import type { Category } from "../../src/types/category";
import type { Pocket } from "../../src/types/pocket";
import type { Transaction } from "../../src/types/transaction";
import type { ThirdPartyFundEntry, ThirdPartyFundConsumption } from "../../src/types/third-party-funds";

console.log("Running unit tests for personal-derived-recompute.test.ts...");

const rawAccounts: Account[] = [
  {
    id: "acc-1",
    ownerId: "u1",
    name: "Ahorros",
    balance: 1000,
    currency: "COP",
    institutionName: "Banco",
    type: "general",
    updatedAt: null,
    includeInTotal: true,
    archived: false,
    iconKey: "bank",
    iconType: "generic",
    color: "",
  },
  {
    id: "acc-archived",
    ownerId: "u1",
    name: "Archivada",
    balance: 5000,
    currency: "COP",
    institutionName: "Banco",
    type: "general",
    updatedAt: null,
    includeInTotal: true,
    archived: true,
    iconKey: "bank",
    iconType: "generic",
    color: "",
  },
  {
    id: "acc-excl",
    ownerId: "u1",
    name: "Excluida",
    balance: 300,
    currency: "COP",
    institutionName: "Banco",
    type: "general",
    updatedAt: null,
    includeInTotal: false,
    archived: false,
    iconKey: "bank",
    iconType: "generic",
    color: "",
  },
];

const pockets: Pocket[] = [
  { id: "p-1", accountId: "acc-1", name: "Bolsillo 1", balance: 250 },
  { id: "p-2", accountId: "acc-archived", name: "Bolsillo Archivada", balance: 1000 },
];

const now = new Date();
const currentMonthTransactions: Transaction[] = [
  {
    id: "tx-inc-1",
    ownerId: "u1",
    title: "Sueldo",
    notes: "",
    amount: 1500,
    type: "income",
    accountId: "acc-1",
    targetAccountId: null,
    pocketId: null,
    targetPocketId: null,
    categoryId: "cat-salary",
    countsAsRealIncome: true,
    createdAt: now,
    date: now,
  },
  {
    id: "tx-inc-not-real",
    ownerId: "u1",
    title: "Transferencia interna",
    notes: "",
    amount: 2000,
    type: "income",
    accountId: "acc-1",
    targetAccountId: null,
    pocketId: null,
    targetPocketId: null,
    categoryId: "cat-salary",
    countsAsRealIncome: false,
    createdAt: now,
    date: now,
  },
  {
    id: "tx-exp-1",
    ownerId: "u1",
    title: "Comida",
    notes: "",
    amount: 400,
    type: "expense",
    accountId: "acc-1",
    targetAccountId: null,
    pocketId: null,
    targetPocketId: null,
    categoryId: "cat-food",
    createdAt: now,
    date: now,
  },
  {
    id: "tx-exp-archived",
    ownerId: "u1",
    title: "Comida 2",
    notes: "",
    amount: 900,
    type: "expense",
    accountId: "acc-archived", // belongs to archived account
    targetAccountId: null,
    pocketId: null,
    targetPocketId: null,
    categoryId: "cat-food",
    createdAt: now,
    date: now,
  },
];

const thirdPartyEntries: ThirdPartyFundEntry[] = [
  {
    id: "entry-1",
    ownerId: "u1",
    sourceIncomeTransactionId: "tx-inc-1",
    originalAmount: 1000,
    status: "open",
    createdAt: now,
    updatedAt: now,
  },
];

const thirdPartyConsumptions: ThirdPartyFundConsumption[] = [
  {
    id: "con-1",
    ownerId: "u1",
    entryId: "entry-1",
    consumerExpenseTransactionId: "tx-exp-1",
    amount: 300,
    createdAt: now,
    updatedAt: now,
  },
];

const initialData = {
  accounts: [],
  archivedAccounts: [],
  pockets,
  categories: [],
  transactions: currentMonthTransactions,
  allTransactions: currentMonthTransactions,
  totalNoPropioPendiente: 0,
  hasThirdPartyInconsistency: false,
  ingresosRealesMes: 0,
  gastosMes: 0,
  thirdPartyEntries,
  thirdPartyConsumptions,
};

const result = recomputePersonalDerivedFields(initialData, rawAccounts);

// Verification 1: Archived accounts must be filtered out
assert.equal(result.accounts.length, 2, "Debe filtrar las cuentas archivadas");
const acc1 = result.accounts.find((a) => a.id === "acc-1");
assert.ok(acc1, "Debe existir acc-1");
// Paso 1 (cierre): recomputePersonalDerivedFields NUNCA debe enriquecer
// account.balance sumándole los bolsillos — debe quedar como el Disponible
// crudo (1000) que entrega la fuente. El Total (1250) se deriva aparte,
// explícitamente, con calculateAccountPhysicalBalances donde se necesite.
assert.equal(acc1?.balance, 1000, "account.balance debe permanecer como Disponible crudo, sin sumarle los bolsillos");

// Verification 2: Transactions belonging to archived accounts must be filtered out
assert.equal(result.transactions.length, 3, "Debe filtrar transacciones asociadas a cuentas archivadas o inexistentes");
assert.ok(!result.transactions.some((t) => t.accountId === "acc-archived"), "No debe haber transacciones de acc-archived");

// Verification 2b (Paso 2): archivedAccounts expone exactamente las cuentas archivadas,
// separadas de `accounts` — necesario para el listado "Cuentas cerradas" y su detalle.
assert.equal(result.archivedAccounts.length, 1, "Debe exponer exactamente 1 cuenta archivada");
assert.equal(result.archivedAccounts[0]?.id, "acc-archived", "La cuenta archivada expuesta debe ser acc-archived");

// Verification 2c (Paso 2): allTransactions NO filtra por estado de cuenta — preserva el
// historial de una cuenta cerrada para su propio detalle (2.4/2.6.5).
assert.equal(
  result.allTransactions.length,
  currentMonthTransactions.length,
  "allTransactions debe conservar TODAS las transacciones, incluidas las de cuentas archivadas",
);
assert.ok(
  result.allTransactions.some((t) => t.accountId === "acc-archived"),
  "allTransactions debe incluir la transacción de la cuenta archivada (tx-exp-archived)",
);

// Verification 3: ingresosRealesMes and gastosMes calculations
// ingresosRealesMes = 1500 (countsAsRealIncome: true, excludes the 2000 tx)
assert.equal(result.ingresosRealesMes, 1500, "Debe calcular correctamente ingresosRealesMes");
// gastosMes = 400 (only the valid expense tx-exp-1, excluding tx-exp-archived)
assert.equal(result.gastosMes, 400, "Debe calcular correctamente gastosMes");

// Verification 4: totalNoPropioPendiente = 1000 (originalAmount) - 300 (consumption) = 700
assert.equal(result.totalNoPropioPendiente, 700, "Debe calcular correctamente el pendiente no propio");
assert.equal(result.hasThirdPartyInconsistency, false, "No debe haber inconsistencia");

// Verification 5: Inconsistency handling (negative pending amount)
const negativeConsumptions = [
  ...thirdPartyConsumptions,
  {
    id: "con-2",
    ownerId: "u1",
    entryId: "entry-1",
    consumerExpenseTransactionId: "tx-exp-1",
    amount: 800, // Total consumption 300 + 800 = 1100 > 1000 originalAmount -> pending = -100
    createdAt: now,
    updatedAt: now,
  },
];

const resultInconsistent = recomputePersonalDerivedFields(
  { ...initialData, thirdPartyConsumptions: negativeConsumptions },
  rawAccounts
);
assert.equal(resultInconsistent.hasThirdPartyInconsistency, true, "Debe marcar inconsistencia si el pendiente es negativo");

// Test: refresh() no-op when syncMode === "live"
import { usePersonalDataStore } from "../../src/stores/personal-data-store";
{
  usePersonalDataStore.getState().reset();
  usePersonalDataStore.setState({ status: "success", syncMode: "live", ownerId: "u1" });
  
  void usePersonalDataStore.getState().refresh();
  
  const state = usePersonalDataStore.getState();
  assert.equal(state.status, "success", "Status should remain success when refresh is called in live syncMode");
}

console.log("All personal-derived-recompute unit tests passed successfully!");
