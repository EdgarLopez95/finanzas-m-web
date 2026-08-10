import assert from "node:assert/strict";

import {
  estimateCascadeWriteCount,
  assertSupportedCascadeTransactions,
} from "@/features/accounts/services/delete-personal-entity-cascade";

const smallCascadeWrites = estimateCascadeWriteCount({
  transactionsCount: 4,
  deletedConsumptionsCount: 2,
  affectedEntriesCount: 2,
  projectedIncomeCount: 1,
  trackedIncomeCount: 1,
  deletePocketCount: 1,
  deleteAccount: false,
  survivingAccountUpdates: 2,
});

assert.equal(
  smallCascadeWrites,
  13,
  "la estimacion debe sumar movimientos, consumos, entries, cancelaciones, deletes y updates sobrevivientes"
);

const accountCascadeWrites = estimateCascadeWriteCount({
  transactionsCount: 12,
  deletedConsumptionsCount: 6,
  affectedEntriesCount: 4,
  projectedIncomeCount: 2,
  trackedIncomeCount: 3,
  deletePocketCount: 3,
  deleteAccount: true,
  survivingAccountUpdates: 1,
});

assert.equal(accountCascadeWrites, 32, "la estimacion debe incluir el delete final de la cuenta");

// Test assertSupportedCascadeTransactions
// 1. Supported types should NOT throw
assert.doesNotThrow(() => {
  assertSupportedCascadeTransactions([
    { id: "t1", ownerId: "u1", type: "expense", amount: 100, accountId: "a1", targetAccountId: null, pocketId: null, targetPocketId: null, countsAsRealIncome: true, relatedEventId: null, relatedDebtId: null },
    { id: "t2", ownerId: "u1", type: "income", amount: 200, accountId: "a1", targetAccountId: null, pocketId: null, targetPocketId: null, countsAsRealIncome: true, relatedEventId: null, relatedDebtId: null },
    { id: "t3", ownerId: "u1", type: "transfer", amount: 300, accountId: "a1", targetAccountId: "a2", pocketId: null, targetPocketId: null, countsAsRealIncome: true, relatedEventId: null, relatedDebtId: null },
    { id: "t4", ownerId: "u1", type: "reimbursement", amount: 400, accountId: "a1", targetAccountId: null, pocketId: null, targetPocketId: null, countsAsRealIncome: true, relatedEventId: null, relatedDebtId: null },
    { id: "t5", ownerId: "u1", type: "pending", amount: 500, accountId: "a1", targetAccountId: null, pocketId: null, targetPocketId: null, countsAsRealIncome: true, relatedEventId: null, relatedDebtId: null },
  ]);
}, "Supported transaction types should not throw an error");

// 2. Unsupported type should throw
assert.throws(() => {
  assertSupportedCascadeTransactions([
    { id: "t1", ownerId: "u1", type: "invalid_type", amount: 100, accountId: "a1", targetAccountId: null, pocketId: null, targetPocketId: null, countsAsRealIncome: true, relatedEventId: null, relatedDebtId: null },
  ]);
}, /movimientos no soportados/, "Unsupported transaction types must throw an error");

console.log("OK delete-personal-entity-cascade");
