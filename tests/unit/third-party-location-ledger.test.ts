import assert from "node:assert/strict";
import { createThirdPartyLocationLedger, nextThirdPartyLocationLedger } from "../../src/lib/finance/third-party-location-ledger";

assert.deepEqual(createThirdPartyLocationLedger("u1"), { ownerId: "u1", version: 0, lastOperationId: null });
assert.deepEqual(nextThirdPartyLocationLedger({ ownerId: "u1", version: 4, lastOperationId: "old" }, "op-5"), { ownerId: "u1", version: 5, lastOperationId: "op-5" });
assert.throws(() => nextThirdPartyLocationLedger({ ownerId: "u1", version: -1, lastOperationId: null }, "op"), /inválida/i);
assert.throws(() => nextThirdPartyLocationLedger({ ownerId: "u1", version: 0, lastOperationId: null }, ""), /obligatorio/i);
console.log("All third-party-location-ledger tests passed.");
