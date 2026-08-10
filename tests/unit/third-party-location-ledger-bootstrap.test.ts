import assert from "node:assert/strict";
import { ensureThirdPartyLocationLedger } from "../../src/features/transactions/services/ensure-third-party-location-ledger";

const writes: Record<string, unknown>[] = [];
async function run() {
await ensureThirdPartyLocationLedger("u1", {
  db: {}, ref: (_db, ...path) => ({ path: path.join("/") }),
  run: async (_db, fn) => fn({ get: async () => ({ exists: () => false, data: () => ({}) }), set: (_ref, data) => writes.push(data) }),
  timestamp: () => "now",
});
assert.deepEqual(writes, [{ ownerId: "u1", version: 0, lastOperationId: null, updatedAt: "now" }]);
console.log("All third-party-location-ledger-bootstrap tests passed.");
}
run().catch((error) => { console.error(error); process.exit(1); });

