import assert from "node:assert/strict";
import { createPersonalTransfer } from "../../src/features/transactions/services/create-personal-transfer";

console.log("Running unit tests for create-personal-transfer.test.ts...");

type FakeDocRef = { __path: string; id: string };
const makeDocFn = () => (db: unknown, ...segments: unknown[]) => {
  const flatSegments = segments.flat().map(String);
  return { __path: flatSegments.join("/"), id: flatSegments[flatSegments.length - 1] };
};
const collectionFn = (db: unknown, ...segments: unknown[]) => segments.flat().map(String);
const emptyOwnershipSnapshot = async () => ({ entries: [], moves: [], consumptions: [] });

type FakeTransaction = {
  get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  set: (ref: unknown, data: Record<string, unknown>) => void;
  update: (ref: unknown, data: Record<string, unknown>) => void;
};

function makeFakeTransactionEnv(docsByPath: Map<string, Record<string, unknown>>) {
  const setCalls: Array<{ path: string; data: Record<string, unknown> }> = [];
  const updateCalls: Array<{ path: string; data: Record<string, unknown> }> = [];

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
  };

  return { transaction, setCalls, updateCalls };
}

async function runCreatePersonalTransferTests() {
  // Test 1: Disponible → Bolsillo
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "u1", archived: false, currentBalance: 100_000 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { balance: 10_000, name: "Ahorro" });
    const { transaction, updateCalls, setCalls } = makeFakeTransactionEnv(docsByPath);

    await createPersonalTransfer(
      {
        ownerId: "u1",
        accountId: "acc-1",
        pocketId: null,
        targetAccountId: "acc-1",
        targetPocketId: "pocket-1",
        amount: 20_000,
        date: new Date("2023-01-01T12:00:00Z"),
      },
      {
        getFirebaseDbFn: () => ({}),
                docFn: makeDocFn(),
                collectionFn,
        runTransactionFn: (_d, fn) => fn(transaction),
        readThirdPartyLocationSnapshotFn: emptyOwnershipSnapshot,
      }
    );

    assert.equal(updateCalls.length, 2);
    const sourceUpdate = updateCalls.find(u => u.path === "accounts/acc-1");
    const targetUpdate = updateCalls.find(u => u.path === "accounts/acc-1/pockets/pocket-1");
    
    assert.equal(sourceUpdate?.data.currentBalance, 80_000);
    assert.equal(targetUpdate?.data.balance, 30_000);
    
    assert.equal(setCalls.length, 1);
    assert.equal(setCalls[0].data.type, "transfer");
    assert.equal(setCalls[0].data.amount, 20_000);
  }

  // Test 2: Bolsillo → Disponible
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "u1", archived: false, currentBalance: 100_000 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { balance: 50_000, name: "Ahorro" });
    const { transaction, updateCalls } = makeFakeTransactionEnv(docsByPath);

    await createPersonalTransfer(
      {
        ownerId: "u1",
        accountId: "acc-1",
        pocketId: "pocket-1",
        targetAccountId: "acc-1",
        targetPocketId: null,
        amount: 50_000,
        date: new Date("2023-01-01T12:00:00Z"),
      },
      {
        getFirebaseDbFn: () => ({}),
                docFn: makeDocFn(),
        collectionFn,
        runTransactionFn: (_d, fn) => fn(transaction),
        readThirdPartyLocationSnapshotFn: emptyOwnershipSnapshot,
      }
    );

    const sourceUpdate = updateCalls.find(u => u.path === "accounts/acc-1/pockets/pocket-1");
    const targetUpdate = updateCalls.find(u => u.path === "accounts/acc-1");
    
    assert.equal(sourceUpdate?.data.balance, 0);
    assert.equal(targetUpdate?.data.currentBalance, 150_000);
  }

  // Test 3: Bolsillo → Bolsillo
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "u1", archived: false, currentBalance: 100_000 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { balance: 50_000, name: "Ahorro 1" });
    docsByPath.set("accounts/acc-1/pockets/pocket-2", { balance: 0, name: "Ahorro 2" });
    const { transaction, updateCalls } = makeFakeTransactionEnv(docsByPath);

    await createPersonalTransfer(
      {
        ownerId: "u1",
        accountId: "acc-1",
        pocketId: "pocket-1",
        targetAccountId: "acc-1",
        targetPocketId: "pocket-2",
        amount: 25_000,
        date: new Date("2023-01-01T12:00:00Z"),
      },
      {
        getFirebaseDbFn: () => ({}),
                docFn: makeDocFn(),
        collectionFn,
        runTransactionFn: (_d, fn) => fn(transaction),
        readThirdPartyLocationSnapshotFn: emptyOwnershipSnapshot,
      }
    );

    const sourceUpdate = updateCalls.find(u => u.path === "accounts/acc-1/pockets/pocket-1");
    const targetUpdate = updateCalls.find(u => u.path === "accounts/acc-1/pockets/pocket-2");
    
    assert.equal(sourceUpdate?.data.balance, 25_000);
    assert.equal(targetUpdate?.data.balance, 25_000);
  }

  // Test 4: Cuenta A → Cuenta B
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "u1", archived: false, currentBalance: 100_000 });
    docsByPath.set("accounts/acc-2", { ownerId: "u1", archived: false, currentBalance: 50_000 });
    const { transaction, updateCalls } = makeFakeTransactionEnv(docsByPath);

    await createPersonalTransfer(
      {
        ownerId: "u1",
        accountId: "acc-1",
        pocketId: null,
        targetAccountId: "acc-2",
        targetPocketId: null,
        amount: 100_000,
        date: new Date("2023-01-01T12:00:00Z"),
      },
      {
        getFirebaseDbFn: () => ({}),
                docFn: makeDocFn(),
        collectionFn,
        runTransactionFn: (_d, fn) => fn(transaction),
        readThirdPartyLocationSnapshotFn: emptyOwnershipSnapshot,
      }
    );

    const sourceUpdate = updateCalls.find(u => u.path === "accounts/acc-1");
    const targetUpdate = updateCalls.find(u => u.path === "accounts/acc-2");
    
    assert.equal(sourceUpdate?.data.currentBalance, 0);
    assert.equal(targetUpdate?.data.currentBalance, 150_000);
  }

  // Test 5: Origen = destino -> rechazo
  {
    let rejected = false;
    try {
      await createPersonalTransfer(
        {
          ownerId: "u1",
          accountId: "acc-1",
          pocketId: "pocket-1",
          targetAccountId: "acc-1",
          targetPocketId: "pocket-1",
          amount: 50_000,
          date: new Date("2023-01-01T12:00:00Z"),
        },
        {
          getFirebaseDbFn: () => ({}),
                  docFn: makeDocFn(),
          collectionFn,
          runTransactionFn: async () => {},
          readThirdPartyLocationSnapshotFn: emptyOwnershipSnapshot,
        }
      );
    } catch (e) {
      rejected = true;
      assert.match((e as Error).message, /idénticos/i);
    }
    assert.equal(rejected, true);
  }

  // Test 6: Saldo insuficiente -> cero escrituras
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "u1", archived: false, currentBalance: 10_000 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { balance: 0 });
    const { transaction, updateCalls, setCalls } = makeFakeTransactionEnv(docsByPath);

    let rejected = false;
    try {
      await createPersonalTransfer(
        {
          ownerId: "u1",
          accountId: "acc-1",
          pocketId: null,
          targetAccountId: "acc-1",
          targetPocketId: "pocket-1",
          amount: 50_000,
          date: new Date("2023-01-01T12:00:00Z"),
        },
        {
          getFirebaseDbFn: () => ({}),
                  docFn: makeDocFn(),
          collectionFn,
          runTransactionFn: (_d, fn) => fn(transaction),
          readThirdPartyLocationSnapshotFn: emptyOwnershipSnapshot,
        }
      );
    } catch (e) {
      rejected = true;
      assert.match((e as Error).message, /insuficiente/i);
    }
    assert.equal(rejected, true);
    assert.equal(updateCalls.length, 0);
    assert.equal(setCalls.length, 0);
  }

  // Test 7: Cuenta archivada -> rechazo
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "u1", archived: true, currentBalance: 100_000 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { balance: 0 });
    const { transaction } = makeFakeTransactionEnv(docsByPath);

    let rejected = false;
    try {
      await createPersonalTransfer(
        {
          ownerId: "u1",
          accountId: "acc-1",
          pocketId: null,
          targetAccountId: "acc-1",
          targetPocketId: "pocket-1",
          amount: 10_000,
          date: new Date("2023-01-01T12:00:00Z"),
        },
        {
          getFirebaseDbFn: () => ({}),
                  docFn: makeDocFn(),
          collectionFn,
          runTransactionFn: (_d, fn) => fn(transaction),
          readThirdPartyLocationSnapshotFn: emptyOwnershipSnapshot,
        }
      );
    } catch (e) {
      rejected = true;
      assert.match((e as Error).message, /cerrada/i);
    }
    assert.equal(rejected, true);
  }

  // Test 8: una transferencia normal nunca puede sacar dinero no propio.
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "u1", archived: false, currentBalance: 0 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { balance: 100_000, name: "Mixto" });
    docsByPath.set("accounts/acc-2", { ownerId: "u1", archived: false, currentBalance: 0 });
    const { transaction, updateCalls, setCalls } = makeFakeTransactionEnv(docsByPath);

    let rejected = false;
    try {
      await createPersonalTransfer(
        {
          ownerId: "u1",
          accountId: "acc-1",
          pocketId: "pocket-1",
          targetAccountId: "acc-2",
          targetPocketId: null,
          amount: 60_001,
          date: new Date("2023-01-01T12:00:00Z"),
        },
        {
          getFirebaseDbFn: () => ({}),
          docFn: makeDocFn(),
          collectionFn,
          runTransactionFn: (_d, fn) => fn(transaction),
          // 100.000 físicos - 40.000 no propios = 60.000 propios.
          readThirdPartyLocationSnapshotFn: async () => ({
            entries: [{ entryId: "entry-1", createdAtMillis: 1, originalAmount: 40_000, location: { accountId: "acc-1", pocketId: "pocket-1" } }],
            moves: [],
            consumptions: [],
          }),
        },
      );
    } catch (error) {
      rejected = true;
      // G5 — copy canónico del gate, compartido con el panel de composición.
      assert.match((error as Error).message, /pero solo .* es tu dinero/i);
    }
    assert.equal(rejected, true, "no puede mover más de Mi dinero");
    assert.equal(updateCalls.length, 0, "el rechazo no mueve saldos");
    assert.equal(setCalls.length, 0, "el rechazo no escribe historial");
  }

  console.log("All create-personal-transfer unit tests passed successfully!");
}

runCreatePersonalTransferTests().catch((err) => {
  console.error("Test failure in create-personal-transfer.test.ts:", err);
  process.exit(1);
});
