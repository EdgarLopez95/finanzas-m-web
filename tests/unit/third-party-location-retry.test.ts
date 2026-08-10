import assert from "node:assert/strict";
import { executeThirdPartyLocationCommitWithRetry } from "../../src/features/transactions/services/execute-third-party-location-commit-with-retry";
async function run() {
let plans = 0;
let commits = 0;
const result = await executeThirdPartyLocationCommitWithRetry(async () => ({ version: plans++, lines: [plans] }), async (plan) => { commits++; if (plan.version === 0) throw new Error("La versión del ledger cambió; se requiere reproyección."); });
assert.equal(result.version, 1);
assert.equal(commits, 2);
console.log("All third-party-location-retry tests passed.");
}
run().catch((error) => { console.error(error); process.exit(1); });

