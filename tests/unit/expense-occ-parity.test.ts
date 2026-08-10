import { suite, test } from "node:test";
import assert from "node:assert/strict";

// Setup dummy env variables before imports
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "dummy";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "dummy";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "dummy";
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "dummy";
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "dummy";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "dummy";
(global as any).window = {};

import { getFirestore } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { CreateExpenseInput, UpdatePersonalTransactionInput } from "@/types/transaction";

const app = initializeApp({
  apiKey: "dummy",
  projectId: "dummy",
});
const dummyDb = getFirestore(app);

function makeFakeTransactionEnv(docsByPath: Map<string, any>, simulateConflict = false) {
  const setCalls: any[] = [];
  const updateCalls: any[] = [];
  const deleteCalls: any[] = [];
  const getDocCalls: any[] = [];
  const getDocsCalls: any[] = [];
  const queryCalls: any[] = [];

  const state = { runTransactionCallCount: 0 };

  const transaction = {
    get: async (ref: any) => {
      const data = docsByPath.get(ref.path || ref.__path);
      return {
        exists: () => data !== undefined,
        data: () => data,
        ref,
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

  const deps = {
    getFirebaseDbFn: () => dummyDb,
    runTransactionFn: async (_db: any, fn: any) => {
      state.runTransactionCallCount++;
      if (simulateConflict) {
        // Change the version in the mock data so it fails validation
        const ledger = docsByPath.get("third_party_fund_location_ledger/user1");
        if (ledger) {
          docsByPath.set("third_party_fund_location_ledger/user1", {
            ...ledger,
            version: ledger.version + 1,
          });
        }
      }
      return fn(transaction);
    },
    getDocFn: async (ref: any) => {
      getDocCalls.push(ref);
      return {
        exists: () => docsByPath.has(ref.path || ref.__path),
        data: () => docsByPath.get(ref.path || ref.__path),
        ref,
      };
    },
    getDocsFn: async (q: any) => {
      getDocsCalls.push(q);
      const coll = q.collection;
      const docs = Array.from(docsByPath.entries())
        .filter(([path]) => path.startsWith(coll + "/"))
        .map(([path, data]) => ({
          id: path.split("/")[1],
          data: () => data,
          ref: { path, id: path.split("/")[1] },
        }));
      return { docs };
    },
    docFn: ((_db: any, col: string, id: string) => {
      // Mock generated ID if id is missing
      const resolvedId = id || "generated_id";
      return { path: `${col}/${resolvedId}`, __path: `${col}/${resolvedId}`, id: resolvedId };
    }) as any,
    collectionFn: ((_db: any, col: string) => ({ collection: col })) as any,
    queryFn: (col: any, ...args: any[]) => {
      queryCalls.push({ col, args });
      return { collection: col.collection, args };
    },
    whereFn: (field: string, op: string, val: any) => ({ field, op, val }),
    findHouseholdIncomeProjectionFn: async () => null,
    findThirdPartyFundEntryFn: async () => null,
  };

  return { transaction, setCalls, updateCalls, deleteCalls, getDocCalls, getDocsCalls, queryCalls, deps, state };
}

suite("Gasto OCC Parity", () => {
  test("1. createPersonalExpense propio rechaza un monto que invade dinero de terceros reservado en la misma ubicación.", async () => {
    const { createPersonalExpense } = await import("../../src/features/transactions/services/create-personal-expense");

    const docs = new Map<string, any>();
    docs.set("third_party_fund_location_ledger/user1", { ownerId: "user1", version: 1, lastOperationId: null });
    docs.set("categories/cat1", { ownerId: "user1", kind: "expense", type: "expense" });
    docs.set("accounts/acc1", { ownerId: "user1", balance: 1000, type: "cash" });

    // Reservado = 1000, Disponible = 0. Queremos gastar 1.
    docs.set("third_party_fund_entries/entry1", { ownerId: "user1", status: "open", originalAmount: 1000, sourceIncomeTransactionId: "inc1" });
    docs.set("transactions/inc1", { ownerId: "user1", accountId: "acc1", type: "income" });

    const env = makeFakeTransactionEnv(docs);

    const payload: CreateExpenseInput = {
      ownerId: "user1", amount: 1, accountId: "acc1", categoryId: "cat1", date: new Date(), consumesThirdPartyFunds: false,
    };

    await assert.rejects(
      async () => createPersonalExpense(payload, env.deps as any),
      // G5 — el gasto propio usa el gate canónico: mismo copy que el panel de
      // composición del formulario (físico $ 1.000, propio $ 0).
      // Ojo: `formatCurrencyCop` separa el símbolo con U+00A0 (no un espacio
      // normal), por eso `\s` en vez de " " literal.
      /Tienes \$\s1\.000.*pero solo \$\s0 es tu dinero/
    );
  });

  test("1b. createPersonalExpense rechaza una composición imposible en vez de ocultarla como saldo propio cero.", async () => {
    const { createPersonalExpense } = await import("../../src/features/transactions/services/create-personal-expense");

    const docs = new Map<string, any>();
    docs.set("third_party_fund_location_ledger/user1", { ownerId: "user1", version: 1, lastOperationId: null });
    docs.set("categories/cat1", { ownerId: "user1", kind: "expense", type: "expense" });
    docs.set("accounts/acc1", { ownerId: "user1", balance: 1000, type: "cash" });
    // La proyección no puede retener más dinero ajeno que el físico del origen.
    docs.set("third_party_fund_entries/entry1", { ownerId: "user1", status: "open", originalAmount: 1500, sourceIncomeTransactionId: "inc1" });
    docs.set("transactions/inc1", { ownerId: "user1", accountId: "acc1", type: "income" });

    const env = makeFakeTransactionEnv(docs);
    const payload: CreateExpenseInput = {
      ownerId: "user1", amount: 1, accountId: "acc1", categoryId: "cat1", date: new Date(), consumesThirdPartyFunds: false,
    };

    await assert.rejects(
      async () => createPersonalExpense(payload, env.deps as any),
      /composición de dinero propio.*inconsistente/i,
    );
    assert.strictEqual(env.setCalls.length, 0);
    assert.strictEqual(env.updateCalls.length, 0);
  });

  test("2. Si el ledger cambia entre snapshot y transacción, createPersonalExpense reproyecta y reintenta.", async () => {
    const { createPersonalExpense } = await import("../../src/features/transactions/services/create-personal-expense");

    const docs = new Map<string, any>();
    docs.set("third_party_fund_location_ledger/user1", { ownerId: "user1", version: 1, lastOperationId: null });
    docs.set("categories/cat1", { ownerId: "user1", kind: "expense", type: "expense" });
    docs.set("accounts/acc1", { ownerId: "user1", balance: 1000, type: "cash" });

    // Conflict simulate = true. This will increment the version inside runTransaction, triggering CONFLICT_MSG.
    const env = makeFakeTransactionEnv(docs, true);

    const payload: CreateExpenseInput = {
      ownerId: "user1", amount: 100, accountId: "acc1", categoryId: "cat1", date: new Date(), consumesThirdPartyFunds: false,
    };

    await assert.rejects(
      async () => createPersonalExpense(payload, env.deps as any),
      /Los datos cambiaron en otro dispositivo. Intenta nuevamente./
    );
    // 1 call from ensureThirdPartyLocationLedger + 3 retries = 4
    assert.strictEqual(env.state.runTransactionCallCount, 4);
  });

  test("3. Tras tres conflictos, devuelve el mensaje recuperable y no deja escrituras.", async () => {
    // See test 2, which implicitly tests this. Let's explicitly check no writes.
    const { createPersonalExpense } = await import("../../src/features/transactions/services/create-personal-expense");

    const docs = new Map<string, any>();
    docs.set("third_party_fund_location_ledger/user1", { ownerId: "user1", version: 1, lastOperationId: null });
    docs.set("categories/cat1", { ownerId: "user1", kind: "expense", type: "expense" });
    docs.set("accounts/acc1", { ownerId: "user1", balance: 1000, type: "cash" });

    const env = makeFakeTransactionEnv(docs, true);

    const payload: CreateExpenseInput = {
      ownerId: "user1", amount: 100, accountId: "acc1", categoryId: "cat1", date: new Date(), consumesThirdPartyFunds: false,
    };

    await assert.rejects(
      async () => createPersonalExpense(payload, env.deps as any),
      /Los datos cambiaron en otro dispositivo. Intenta nuevamente./
    );
    // 1 call from ensureThirdPartyLocationLedger + 3 retries = 4
    assert.strictEqual(env.state.runTransactionCallCount, 4);
    assert.strictEqual(env.setCalls.length, 0);
  });

  test("4. createPersonalExpenseOcc ejecuta el paquete atómico real (saldo, tx histórica, operación, ledger, consumos, entries).", async () => {
    const { createPersonalExpense } = await import("../../src/features/transactions/services/create-personal-expense");

    const docs = new Map<string, any>();
    docs.set("third_party_fund_location_ledger/user1", { ownerId: "user1", version: 1, lastOperationId: null });
    docs.set("categories/cat1", { ownerId: "user1", kind: "expense", type: "expense" });
    docs.set("accounts/acc1", { ownerId: "user1", balance: 1000, type: "cash" });

    // Third party funds
    docs.set("third_party_fund_entries/entry1", { ownerId: "user1", status: "open", originalAmount: 1000, sourceIncomeTransactionId: "inc1" });
    docs.set("transactions/inc1", { ownerId: "user1", accountId: "acc1", type: "income" });

    const env = makeFakeTransactionEnv(docs);

    const payload: CreateExpenseInput = {
      ownerId: "user1", amount: 200, accountId: "acc1", categoryId: "cat1", date: new Date(), consumesThirdPartyFunds: true,
    };

    await createPersonalExpense(payload, env.deps as any);

    // Verify atomic writes
    const sets = env.setCalls;
    const updates = env.updateCalls;

    // We should have a transaction write
    assert.ok(sets.some(s => s.path.startsWith("transactions/")), "Missing transaction create");
    // We should have an operation write
    assert.ok(sets.some(s => s.path.startsWith("third_party_fund_location_operations/")), "Missing operation create");
    // We should have consumptions write
    assert.ok(sets.some(s => s.path.startsWith("third_party_fund_consumptions/")), "Missing consumption create");
    // We should have ledger update or set
    assert.ok(sets.some(s => s.path.startsWith("third_party_fund_location_ledger/")) || updates.some(s => s.path.startsWith("third_party_fund_location_ledger/")), "Missing ledger update");
    // We should have account balance update
    assert.ok(updates.some(s => s.path === "accounts/acc1"), "Missing account balance update");
    // We should have entry status update
    assert.ok(updates.some(s => s.path === "third_party_fund_entries/entry1"), "Missing entry update");
  });

  test("5. Fondos de terceros insuficientes: ningún write.", async () => {
    const { createPersonalExpense } = await import("../../src/features/transactions/services/create-personal-expense");

    const docs = new Map<string, any>();
    docs.set("third_party_fund_location_ledger/user1", { ownerId: "user1", version: 1, lastOperationId: null });
    docs.set("categories/cat1", { ownerId: "user1", kind: "expense", type: "expense" });
    docs.set("accounts/acc1", { ownerId: "user1", balance: 1000, type: "cash" });

    // Only 100 available to consume
    docs.set("third_party_fund_entries/entry1", { ownerId: "user1", status: "open", originalAmount: 100, sourceIncomeTransactionId: "inc1" });
    docs.set("transactions/inc1", { ownerId: "user1", accountId: "acc1", type: "income" });

    const env = makeFakeTransactionEnv(docs);

    const payload: CreateExpenseInput = {
      ownerId: "user1", amount: 200, accountId: "acc1", categoryId: "cat1", date: new Date(), consumesThirdPartyFunds: true,
    };

    await assert.rejects(
      async () => createPersonalExpense(payload, env.deps as any),
      /No hay dinero no propio suficiente en el origen./
    );

    assert.strictEqual(env.setCalls.length, 0);
    assert.strictEqual(env.updateCalls.length, 0);
  });

  test("6. updatePersonalTransaction rechaza realmente una transacción OCC antes de lecturas/escrituras irrelevantes.", async () => {
    const { updatePersonalTransaction } = await import("../../src/features/transactions/services/update-personal-transaction");

    const docs = new Map<string, any>();
    docs.set("transactions/tx1", { ownerId: "user1", type: "expense", consumesThirdPartyFunds: true });

    const env = makeFakeTransactionEnv(docs);

    const payload: UpdatePersonalTransactionInput = {
      ownerId: "user1", transactionId: "tx1", type: "expense", amount: 100, accountId: "acc1", categoryId: "cat1", date: new Date(), consumesThirdPartyFunds: true,
    };

    await assert.rejects(
      async () => updatePersonalTransaction(payload, env.deps as any),
      /No se puede editar un gasto no propio \(son inmutables\)./
    );
    assert.strictEqual(env.setCalls.length, 0);
    assert.strictEqual(env.updateCalls.length, 0);
    assert.strictEqual(env.getDocsCalls.length, 0, "No debe realizar queries a otras colecciones");
    assert.strictEqual(env.getDocCalls.length, 1, "Solo debe leer la transacción");
    assert.strictEqual(env.getDocCalls[0].path, "transactions/tx1");
  });

  test("7. deletePersonalTransaction rechaza realmente una transacción OCC antes de lecturas/escrituras irrelevantes.", async () => {
    const { deletePersonalTransaction } = await import("../../src/features/transactions/services/delete-personal-transaction");

    const docs = new Map<string, any>();
    docs.set("transactions/tx1", { ownerId: "user1", type: "expense", consumesThirdPartyFunds: true });

    const env = makeFakeTransactionEnv(docs);

    await assert.rejects(
      async () => deletePersonalTransaction({ ownerId: "user1", transactionId: "tx1" }, env.deps as any),
      /No puedes eliminar un gasto no propio \(son inmutables\)./
    );
    assert.strictEqual(env.setCalls.length, 0);
    assert.strictEqual(env.updateCalls.length, 0);
    assert.strictEqual(env.deleteCalls.length, 0);
    assert.strictEqual(env.getDocsCalls.length, 0, "No debe realizar queries a otras colecciones");
    assert.strictEqual(env.getDocCalls.length, 1, "Solo debe leer la transacción");
    assert.strictEqual(env.getDocCalls[0].path, "transactions/tx1");
  });

  test("7b. G3: updatePersonalTransaction rechaza un transfer que movió dinero no propio.", async () => {
    const { updatePersonalTransaction } = await import("../../src/features/transactions/services/update-personal-transaction");

    const docs = new Map<string, any>();
    docs.set("transactions/tx1", { ownerId: "user1", type: "transfer", movesThirdPartyFunds: true });

    const env = makeFakeTransactionEnv(docs);

    const payload: UpdatePersonalTransactionInput = {
      ownerId: "user1", transactionId: "tx1", type: "transfer", amount: 100, accountId: "acc1", targetAccountId: "acc2", date: new Date(),
    };

    await assert.rejects(
      async () => updatePersonalTransaction(payload, env.deps as any),
      /No se puede editar una transferencia de dinero no propio \(son inmutables\)./
    );
    assert.strictEqual(env.setCalls.length, 0);
    assert.strictEqual(env.updateCalls.length, 0);
    assert.strictEqual(env.getDocCalls.length, 1, "Solo debe leer la transacción");
  });

  test("7c. G3: deletePersonalTransaction rechaza un transfer que movió dinero no propio.", async () => {
    const { deletePersonalTransaction } = await import("../../src/features/transactions/services/delete-personal-transaction");

    const docs = new Map<string, any>();
    docs.set("transactions/tx1", { ownerId: "user1", type: "transfer", movesThirdPartyFunds: true });

    const env = makeFakeTransactionEnv(docs);

    await assert.rejects(
      async () => deletePersonalTransaction({ ownerId: "user1", transactionId: "tx1" }, env.deps as any),
      /No puedes eliminar una transferencia de dinero no propio \(son inmutables\)./
    );
    assert.strictEqual(env.setCalls.length, 0);
    assert.strictEqual(env.updateCalls.length, 0);
    assert.strictEqual(env.deleteCalls.length, 0);
    assert.strictEqual(env.getDocsCalls.length, 0, "No debe realizar queries a otras colecciones");
    assert.strictEqual(env.getDocCalls.length, 1, "Solo debe leer la transacción");
  });

  test("8. Una edición y eliminación normales siguen funcionando.", async () => {
    const { updatePersonalTransaction } = await import("../../src/features/transactions/services/update-personal-transaction");
    const { deletePersonalTransaction } = await import("../../src/features/transactions/services/delete-personal-transaction");

    const docs = new Map<string, any>();
    docs.set("transactions/tx1", { ownerId: "user1", type: "expense", amount: 50, accountId: "acc1", consumesThirdPartyFunds: false });
    docs.set("categories/cat1", { ownerId: "user1", kind: "expense", type: "expense" });
    docs.set("accounts/acc1", { ownerId: "user1", balance: 1000, type: "cash" });

    const env = makeFakeTransactionEnv(docs);

    const payload: UpdatePersonalTransactionInput = {
      ownerId: "user1", transactionId: "tx1", type: "expense", amount: 100, accountId: "acc1", categoryId: "cat1", date: new Date(), consumesThirdPartyFunds: false,
    };

    await updatePersonalTransaction(payload, env.deps as any);
    assert.ok(env.updateCalls.some(u => u.path === "transactions/tx1"));

    await deletePersonalTransaction({ ownerId: "user1", transactionId: "tx1" }, env.deps as any);
  });
});
