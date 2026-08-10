import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "dummy";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "dummy";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "dummy";
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "dummy";
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "dummy";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "dummy";

(global as any).window = {};

import { DocumentData, getFirestore } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import fs from "node:fs";
import path from "node:path";

const app = initializeApp({
  apiKey: "dummy",
  projectId: "dummy",
});
const dummyDb = getFirestore(app);

function makeFakeTransactionEnv(docsByPath: Map<string, any>) {
  const setCalls: any[] = [];
  const updateCalls: any[] = [];
  const deleteCalls: any[] = [];

  const transaction = {
    get: async (ref: any) => {
      const data = docsByPath.get(ref.path || ref.__path);
      return {
        exists: () => data !== undefined,
        data: () => data,
      };
    },
    set: (ref: any, data: any) => {
      setCalls.push({ path: ref.path || ref.__path, data });
    },
    update: (ref: any, data: any) => {
      updateCalls.push({ path: ref.path || ref.__path, data });
    },
    delete: (ref: any) => {
      deleteCalls.push({ path: ref.path || ref.__path });
    },
  };

  return { transaction, setCalls, updateCalls, deleteCalls };
}

async function runTests() {
  const { isTechnicalTransaction } = await import("@/features/transactions/lib/technical-transactions");
  const { updatePersonalTransaction } = await import("../../src/features/transactions/services/update-personal-transaction");
  const { deletePersonalTransaction } = await import("../../src/features/transactions/services/delete-personal-transaction");

  console.log("Running technical transactions unit tests...");

  // 1. Central Helper Tests
  assert.strictEqual(isTechnicalTransaction("Saldo inicial"), true);
  assert.strictEqual(isTechnicalTransaction("Ajuste manual de saldo"), true);
  assert.strictEqual(isTechnicalTransaction("Cierre de bolsillo"), true);
  assert.strictEqual(isTechnicalTransaction("Transferencia"), false);
  assert.strictEqual(isTechnicalTransaction("Mercado"), false);
  assert.strictEqual(isTechnicalTransaction(""), false);
  assert.strictEqual(isTechnicalTransaction(null), false);
  assert.strictEqual(isTechnicalTransaction(undefined), false);
  console.log("  ✓ isTechnicalTransaction behavior verified");

  const technicalTitles = ["Saldo inicial", "Ajuste manual de saldo", "Cierre de bolsillo"];

  // 2. updatePersonalTransaction (Technical rejection)
  for (const title of technicalTitles) {
    const docsByPath = new Map();
    docsByPath.set("transactions/tx1", {
      id: "tx1",
      ownerId: "user1",
      title: title,
      type: "transfer",
    });

    const env = makeFakeTransactionEnv(docsByPath);

    await assert.rejects(
      async () => {
        await updatePersonalTransaction(
          {
            ownerId: "user1",
            transactionId: "tx1",
            type: "transfer",
            amount: 100,
            accountId: "acc1",
            date: new Date(),
            targetAccountId: "acc2",
          },
          {
            getFirebaseDbFn: () => dummyDb,
            runTransactionFn: async (_db: any, fn: any) => fn(env.transaction as any),
            getDocFn: async (ref: any) => ({ exists: () => true, data: () => docsByPath.get(ref.path || ref.__path) }) as any,
            docFn: ((_db: any, col: string, id: string) => ({ path: `${col}/${id}`, __path: `${col}/${id}` })) as any,
          } as any
        );
      },
      /No puedes editar un movimiento técnico/,
      `Must reject editing technical transaction with title '${title}'`
    );

    assert.strictEqual(env.setCalls.length, 0);
    assert.strictEqual(env.updateCalls.length, 0);
    assert.strictEqual(env.deleteCalls.length, 0);
  }
  console.log("  ✓ updatePersonalTransaction rejects editing technical transactions (0 writes)");

  // 3. deletePersonalTransaction (Technical allowance)
  for (const title of technicalTitles) {
    const docsByPath = new Map();
    docsByPath.set("transactions/tx1", {
      id: "tx1",
      ownerId: "user1",
      title: title,
      type: "income",
      accountId: "acc1",
      amount: 100,
    });
    docsByPath.set("accounts/acc1", {
      currentBalance: 1000,
      ownerId: "user1",
    });

    const env = makeFakeTransactionEnv(docsByPath);

    await deletePersonalTransaction(
      {
        ownerId: "user1",
        transactionId: "tx1",
      },
      {
        getFirebaseDbFn: () => dummyDb,
        runTransactionFn: async (_db: any, fn: any) => fn(env.transaction as any),
        getDocFn: async (ref: any) => ({ exists: () => true, data: () => docsByPath.get(ref.path || ref.__path) }) as any,
        docFn: ((_db: any, col: string, id: string) => ({ path: `${col}/${id}`, __path: `${col}/${id}` })) as any,
        getDocsFn: async () => ({ docs: [], empty: true }) as any,
        findHouseholdIncomeProjectionFn: async () => null,
        findThirdPartyFundEntryFn: async () => null,
      } as any
    );

    assert.ok(env.deleteCalls.length > 0, "Technical transaction should produce delete writes when deleted");
    const txDelete = env.deleteCalls.find(c => c.path === "transactions/tx1");
    assert.ok(txDelete, "Should have deleted the transaction document");
  }
  console.log("  ✓ deletePersonalTransaction allows deleting technical transactions");

  // 4. updatePersonalTransaction (Normal non-regression)
  {
    const docsByPath = new Map();
    docsByPath.set("transactions/tx_normal", {
      id: "tx_normal",
      ownerId: "user1",
      title: "Transferencia",
      type: "transfer",
      amount: 50,
      accountId: "acc1",
      targetAccountId: "acc2",
    });
    docsByPath.set("accounts/acc1", {
      currentBalance: 1000,
      ownerId: "user1",
    });
    docsByPath.set("accounts/acc2", {
      currentBalance: 500,
      ownerId: "user1",
    });

    const env = makeFakeTransactionEnv(docsByPath);

    try {
      await updatePersonalTransaction(
        {
          ownerId: "user1",
          transactionId: "tx_normal",
          type: "transfer",
          amount: 200,
          accountId: "acc1",
          date: new Date(),
          targetAccountId: "acc2",
        },
        {
          getFirebaseDbFn: () => dummyDb,
          runTransactionFn: async (_db: any, fn: any) => fn(env.transaction as any),
          getDocFn: async (ref: any) => ({ exists: () => true, data: () => docsByPath.get(ref.path || ref.__path) }) as any,
          docFn: ((_db: any, col: string, id: string) => ({ path: `${col}/${id}`, __path: `${col}/${id}` })) as any,
          getDocsFn: async () => ({ docs: [], empty: true }) as any,
          findHouseholdIncomeProjectionFn: async () => null,
          findThirdPartyFundEntryFn: async () => null,
        } as any
      );
    } catch (e: any) {
      console.log("updatePersonalTransaction normal failed with:", e);
      throw e;
    }

    assert.ok(env.updateCalls.length > 0, "Normal transfer should produce writes when updated");
    const txUpdate = env.updateCalls.find(c => c.path === "transactions/tx_normal");
    assert.ok(txUpdate, "Should have updated the transaction document");
    console.log("  ✓ updatePersonalTransaction allows updating normal transactions");
  }

  // 5. deletePersonalTransaction (Normal non-regression)
  {
    const docsByPath = new Map();
    docsByPath.set("transactions/tx_normal", {
      id: "tx_normal",
      ownerId: "user1",
      title: "Transferencia",
      type: "transfer",
      amount: 50,
      accountId: "acc1",
      targetAccountId: "acc2",
    });
    docsByPath.set("accounts/acc1", {
      currentBalance: 1000,
      ownerId: "user1",
    });
    docsByPath.set("accounts/acc2", {
      currentBalance: 500,
      ownerId: "user1",
    });

    const env = makeFakeTransactionEnv(docsByPath);

    await deletePersonalTransaction(
      {
        ownerId: "user1",
        transactionId: "tx_normal",
      },
      {
        getFirebaseDbFn: () => dummyDb,
        runTransactionFn: async (_db: any, fn: any) => fn(env.transaction as any),
        getDocFn: async (ref: any) => ({ exists: () => true, data: () => docsByPath.get(ref.path || ref.__path) }) as any,
        getDocsFn: async () => ({ docs: [], empty: true }) as any,
        findHouseholdIncomeProjectionFn: async () => null,
        findThirdPartyFundEntryFn: async () => null,
      } as any
    );

    assert.ok(env.deleteCalls.length > 0, "Normal transfer should produce delete writes when deleted");
    const txDelete = env.deleteCalls.find(c => c.path === "transactions/tx_normal");
    assert.ok(txDelete, "Should have deleted the transaction document");
    console.log("  ✓ deletePersonalTransaction allows deleting normal transactions");
  }

  // 6. UI Structural check
  const viewsPath = path.join(process.cwd(), "src/features/dashboard/components/personal-views.tsx");
  const dialogPath = path.join(process.cwd(), "src/features/transactions/components/movement-detail-dialog.tsx");

  if (fs.existsSync(viewsPath)) {
    const content = fs.readFileSync(viewsPath, "utf-8");
    assert.ok(content.includes("isTechnicalTransaction("), "personal-views.tsx must use isTechnicalTransaction");
    assert.ok(!content.includes(`==="Saldo inicial"`), "personal-views.tsx must not use literal 'Saldo inicial'");
    console.log("  ✓ personal-views.tsx structurally correct");
  }

  if (fs.existsSync(dialogPath)) {
    const content = fs.readFileSync(dialogPath, "utf-8");
    assert.ok(content.includes("isTechnicalTransaction("), "movement-detail-dialog.tsx must use isTechnicalTransaction");
    assert.ok(!content.includes(`==="Saldo inicial"`), "movement-detail-dialog.tsx must not use literal 'Saldo inicial'");
    console.log("  ✓ movement-detail-dialog.tsx structurally correct");
  }

  console.log("All technical transactions unit tests passed successfully!\n");
}

export const runTechnicalTransactionsUnitTests = runTests;

if (require.main === module) {
  runTests().catch((err) => {
    console.error(err.stack || err);
    process.exit(1);
  });
}
