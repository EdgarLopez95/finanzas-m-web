import assert from "node:assert/strict";

import { closePersonalAccount } from "../../src/features/accounts/services/close-personal-account";
import { createAccountPocket } from "../../src/features/pockets/services/create-account-pocket";

console.log("Running unit tests for account-pocket-count-race.test.ts...");

type Ref = { path: string; id: string };
const docFn = (...args: unknown[]): Ref => {
  const parts = args.flat().filter((item): item is string => typeof item === "string");
  if (parts[parts.length - 1] === "pockets") {
    parts.push("pocket-new");
  }
  return { path: parts.join("/"), id: parts[parts.length - 1] };
};
const collectionFn = (...args: unknown[]) => args.flat().filter((item): item is string => typeof item === "string");

async function run() {
  // Create debe incrementar pocketCount en la misma txn que el bolsillo.
  {
    const docs = new Map<string, Record<string, unknown>>([
      ["accounts/acc-1", { ownerId: "u1", archived: false, currentBalance: 100_000, pocketCount: 0 }],
    ]);
    const updates: Record<string, unknown>[] = [];
    await createAccountPocket(
      { accountId: "acc-1", ownerId: "u1", name: "Ahorro", balance: 10_000 },
      {
        getFirebaseDbFn: () => ({}),
        docFn,
        collectionFn,
        getDocFn: async (ref) => {
          const data = docs.get((ref as Ref).path);
          return { exists: () => data !== undefined, data: () => data ?? {} };
        },
        // G2 — barrera propia lee el snapshot de ubicación antes de la
        // transacción; sin no propio en este fixture.
        readThirdPartyLocationSnapshotFn: async () => ({ entries: [], moves: [], consumptions: [] }),
        runTransactionFn: async (_db, fn) => {
          await fn({
            get: async (ref) => {
              const data = docs.get((ref as Ref).path);
              return { exists: () => data !== undefined, data: () => data ?? {} };
            },
            set: (ref, data) => {
              docs.set((ref as Ref).path, data);
            },
            update: (ref, data) => {
              const path = (ref as Ref).path;
              const next = { ...(docs.get(path) ?? {}), ...data };
              docs.set(path, next);
              updates.push(data);
            },
          });
        },
      },
    );
    assert.equal(docs.get("accounts/acc-1")?.pocketCount, 1, "create deja pocketCount=1");
    assert.equal(updates.some((u) => u.pocketCount === 1), true);
    console.log("  ✓ create incrementa pocketCount atómicamente");
  }

  // Close con pocketCount>0 dentro de la txn debe rechazar aunque getDocs diga vacío (simula carrera).
  {
    await assert.rejects(
      () =>
        closePersonalAccount(
          { ownerId: "u1", accountId: "acc-1" },
          {
            getFirebaseDbFn: () => ({}),
            docFn,
            collectionFn,
            getDocsFn: async () => ({ empty: true, size: 0 }),
            runTransactionFn: async (_db, fn) => {
              await fn({
                get: async () => ({
                  exists: () => true,
                  data: () => ({ ownerId: "u1", archived: false, pocketCount: 1 }),
                }),
                update: () => {
                  throw new Error("no debe escribir archive");
                },
              });
            },
          },
        ),
      /bolsillo/,
    );
    console.log("  ✓ close rechaza pocketCount>0 aunque getDocs esté vacío");
  }

  // Close con pocketCount=0 permite archivar.
  {
    let archived = false;
    await closePersonalAccount(
      { ownerId: "u1", accountId: "acc-1" },
      {
        getFirebaseDbFn: () => ({}),
        docFn,
        collectionFn,
        getDocsFn: async () => ({ empty: true, size: 0 }),
        runTransactionFn: async (_db, fn) => {
          await fn({
            get: async () => ({
              exists: () => true,
              data: () => ({ ownerId: "u1", archived: false, pocketCount: 0 }),
            }),
            update: (_ref, data) => {
              archived = data.archived === true;
            },
          });
        },
      },
    );
    assert.equal(archived, true);
    console.log("  ✓ close con pocketCount=0 archiva");
  }

  console.log("All account-pocket-count-race unit tests passed successfully!");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
