import assert from "node:assert/strict";

import type { ThirdPartyFundConsumption } from "@/types/third-party-funds";
import { splitConsumptionsForExpenseTransaction } from "@/lib/finance/third-party-funds";

const consumptions: ThirdPartyFundConsumption[] = [
  {
    id: "con-1",
    ownerId: "owner-1",
    entryId: "entry-a",
    consumerExpenseTransactionId: "expense-1",
    amount: 20_000,
    createdAt: null,
    updatedAt: null,
  },
  {
    id: "con-2",
    ownerId: "owner-1",
    entryId: "entry-a",
    consumerExpenseTransactionId: "expense-2",
    amount: 10_000,
    createdAt: null,
    updatedAt: null,
  },
  {
    id: "con-3",
    ownerId: "owner-1",
    entryId: "entry-b",
    consumerExpenseTransactionId: "expense-1",
    amount: 5_000,
    createdAt: null,
    updatedAt: null,
  },
  {
    id: "con-4",
    ownerId: "owner-1",
    entryId: "entry-c",
    consumerExpenseTransactionId: "expense-3",
    amount: 7_000,
    createdAt: null,
    updatedAt: null,
  },
];

const result = splitConsumptionsForExpenseTransaction(consumptions, "expense-1");

assert.deepEqual(
  result.existingConsumptions.map((consumption) => consumption.id),
  ["con-1", "con-3"],
  "debe identificar exactamente los consumptions del gasto que se va a borrar"
);

assert.deepEqual(
  result.affectedEntryIds,
  ["entry-a", "entry-b"],
  "debe identificar las entries afectadas por ese gasto"
);

assert.deepEqual(
  result.otherKnownConsumptions.map((consumption) => consumption.id),
  ["con-2"],
  "debe conservar solo otros consumptions relevantes para recalcular las entries afectadas"
);

console.log("OK third-party-fund-delete-context");
