import assert from "node:assert/strict";
import { buildThirdPartyLocationSnapshot } from "../../src/features/transactions/services/read-third-party-location-snapshot";

const snapshot = buildThirdPartyLocationSnapshot({
  entries: [{ id: "e1", ownerId: "u1", sourceIncomeTransactionId: "income1", originalAmount: 100, status: "open", createdAtMillis: 1 }],
  transactions: new Map([["income1", { accountId: "a", pocketId: null }]]),
  operations: [], consumptions: [],
});
assert.deepEqual(snapshot.entries[0].location, { accountId: "a", pocketId: null });
assert.deepEqual(snapshot.moves, []);
console.log("All third-party-location-snapshot tests passed.");
