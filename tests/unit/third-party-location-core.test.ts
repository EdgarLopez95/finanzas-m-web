import assert from "node:assert/strict";

import {
  allocateThirdPartyLocationFifo,
  projectThirdPartyHeldAtLocation,
  type ThirdPartyLocationEntry,
} from "../../src/lib/finance/third-party-location";

console.log("Running third-party-location-core tests...");

const entries: ThirdPartyLocationEntry[] = [
  { entryId: "later", createdAtMillis: 20, originalAmount: 60, location: { accountId: "a", pocketId: null } },
  { entryId: "first", createdAtMillis: 10, originalAmount: 70, location: { accountId: "a", pocketId: null } },
];

assert.deepEqual(allocateThirdPartyLocationFifo(100, entries), [
  { entryId: "first", amount: 70 },
  { entryId: "later", amount: 30 },
]);
assert.throws(() => allocateThirdPartyLocationFifo(131, entries), /suficiente/i);
assert.throws(() => allocateThirdPartyLocationFifo(0, entries), /inválido/i);

const held = projectThirdPartyHeldAtLocation({ accountId: "b", pocketId: "p1" }, entries, [
  { entryId: "first", from: { accountId: "a", pocketId: null }, to: { accountId: "b", pocketId: "p1" }, amount: 25 },
], []);
assert.equal(held, 25);

console.log("All third-party-location-core tests passed.");
