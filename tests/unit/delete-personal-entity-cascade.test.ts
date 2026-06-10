import assert from "node:assert/strict";

import { estimateCascadeWriteCount } from "@/features/accounts/services/delete-personal-entity-cascade";

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

console.log("OK delete-personal-entity-cascade");
