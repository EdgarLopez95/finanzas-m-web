import assert from "node:assert/strict";

import { updateAccountPocket } from "../../src/features/pockets/services/update-account-pocket";

console.log("Running unit tests for update-pocket-logic.test.ts...");

type FakeDocRef = { __path: string; id: string };
const makeDocFn = () => (db: unknown, ...segments: unknown[]) => {
  const flatSegments = segments.flat().map(String);
  return { __path: flatSegments.join("/"), id: flatSegments[flatSegments.length - 1] };
};
const collectionFn = (db: unknown, ...segments: unknown[]) => segments.flat().map(String);

type FakeTransaction = {
  get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  set: (ref: unknown, data: Record<string, unknown>) => void;
  update: (ref: unknown, data: Record<string, unknown>) => void;
  delete: (ref: unknown) => void;
};

function makeFakeTransactionEnv(docsByPath: Map<string, Record<string, unknown>>) {
  const setCalls: Array<{ path: string; data: Record<string, unknown> }> = [];
  const updateCalls: Array<{ path: string; data: Record<string, unknown> }> = [];
  const deleteCalls: string[] = [];

  const transaction: FakeTransaction = {
    get: async (ref) => {
      const key = (ref as FakeDocRef).__path;
      const data = docsByPath.get(key);
      return { exists: () => data !== undefined, data: () => data ?? {} };
    },
    set: (ref, data) => {
      setCalls.push({ path: (ref as FakeDocRef).__path, data });
    },
    update: (ref, data) => {
      updateCalls.push({ path: (ref as FakeDocRef).__path, data });
    },
    delete: (ref) => {
      deleteCalls.push((ref as FakeDocRef).__path);
    },
  };

  return { transaction, setCalls, updateCalls, deleteCalls };
}

async function runUpdatePocketLogicTests() {
  // Test 1: Renombrar bolsillo
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "u1", archived: false, currentBalance: 990000 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { accountId: "acc-1", name: "Viejo", balance: 10000 });
    const { transaction, updateCalls, setCalls } = makeFakeTransactionEnv(docsByPath);

    await updateAccountPocket(
      {
        accountId: "acc-1",
        pocketId: "pocket-1",
        ownerId: "u1",
        name: "Nuevo nombre",
      },
      {
        getFirebaseDbFn: () => ({}),
        docFn: makeDocFn(),
        runTransactionFn: (_d, fn) => fn(transaction),
      },
    );

    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].path, "accounts/acc-1/pockets/pocket-1");
    assert.equal(updateCalls[0].data.name, "Nuevo nombre");
    assert.ok(updateCalls[0].data.updatedAt !== undefined);
    assert.equal(updateCalls[0].data.balance, undefined, "No se debe escribir sobre balance");

    assert.equal(setCalls.length, 0, "No debe crear ninguna transacción técnica");
  }

  // Test 2: Nombre vacio -> error
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "u1", archived: false, currentBalance: 990000 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { accountId: "acc-1", name: "Viejo", balance: 10000 });
    const { transaction } = makeFakeTransactionEnv(docsByPath);

    let rejected = false;
    try {
      await updateAccountPocket(
        {
          accountId: "acc-1",
          pocketId: "pocket-1",
          ownerId: "u1",
          name: "   ",
        },
        {
          getFirebaseDbFn: () => ({}),
          docFn: makeDocFn(),
          runTransactionFn: (_d, fn) => fn(transaction),
        },
      );
    } catch (error) {
      rejected = true;
      assert.match((error as Error).message, /nombre.*obligatorio/);
    }
    assert.equal(rejected, true);
  }

  console.log("All update-pocket-logic unit tests passed successfully!");
}

runUpdatePocketLogicTests().catch((err) => {
  console.error("Test failure in update-pocket-logic.test.ts:", err);
  process.exit(1);
});
