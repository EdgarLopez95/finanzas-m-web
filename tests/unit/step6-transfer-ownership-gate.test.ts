import assert from "node:assert/strict";

import { createPersonalTransfer } from "../../src/features/transactions/services/create-personal-transfer";

type Ref = { path: string; id: string };

const docFn = (...args: unknown[]): Ref => {
  const parts = args.flat().filter((item): item is string => typeof item === "string");
  return { path: parts.join("/"), id: parts[parts.length - 1] };
};
const collectionFn = (...args: unknown[]) => args.flat().filter((item): item is string => typeof item === "string");
const mixedSnapshot = async () => ({
  entries: [{ entryId: "entry-1", createdAtMillis: 1, originalAmount: 40_000, location: { accountId: "acc-1", pocketId: "pocket-1" } }],
  moves: [],
  consumptions: [],
});

function environment() {
  const docs = new Map<string, Record<string, unknown>>([
    ["accounts/acc-1", { ownerId: "u1", archived: false, currentBalance: 0 }],
    ["accounts/acc-1/pockets/pocket-1", { balance: 100_000 }],
    ["accounts/acc-2", { ownerId: "u1", archived: false, currentBalance: 0 }],
  ]);
  const writes: string[] = [];
  return {
    writes,
    transaction: {
      get: async (ref: unknown) => {
        const data = docs.get((ref as Ref).path);
        return { exists: () => data !== undefined, data: () => data ?? {} };
      },
      set: (ref: unknown) => writes.push((ref as Ref).path),
      update: (ref: unknown) => writes.push((ref as Ref).path),
    },
  };
}

async function run() {
  console.log("Running ownership gate tests for normal transfers...");

  // 100.000 físicos - 40.000 no propios = 60.000 propios: el límite exacto pasa.
  {
    const env = environment();
    await createPersonalTransfer(
      { ownerId: "u1", accountId: "acc-1", pocketId: "pocket-1", targetAccountId: "acc-2", targetPocketId: null, amount: 60_000, date: new Date(0) },
      { getFirebaseDbFn: () => ({}), docFn, collectionFn, runTransactionFn: (_db, fn) => fn(env.transaction), readThirdPartyLocationSnapshotFn: mixedSnapshot },
    );
    assert.ok(env.writes.length > 0, "el monto propio exacto se confirma");
    console.log("  ✓ permite exactamente Mi dinero");
  }

  // Un peso por encima de Mi dinero no modifica ni saldos ni historial.
  {
    const env = environment();
    await assert.rejects(
      () => createPersonalTransfer(
        { ownerId: "u1", accountId: "acc-1", pocketId: "pocket-1", targetAccountId: "acc-2", targetPocketId: null, amount: 60_001, date: new Date(0) },
        { getFirebaseDbFn: () => ({}), docFn, collectionFn, runTransactionFn: (_db, fn) => fn(env.transaction), readThirdPartyLocationSnapshotFn: mixedSnapshot },
      ),
      // G5 — el transfer propio usa el gate canónico: mismo copy que el panel
      // de composición del formulario.
      /pero solo .* es tu dinero/i,
    );
    assert.deepEqual(env.writes, [], "el rechazo deja cero escrituras");
    console.log("  ✓ rechaza Mi dinero + 1 sin escrituras");
  }

  console.log("Normal transfer ownership gate tests passed successfully!");
}

run().catch((error) => {
  console.error("Test failure in step6-transfer-ownership-gate.test.ts:", error);
  process.exitCode = 1;
});
