import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  createPersonalDataStore,
  computeOverallStatus,
  createInitialDatasets,
  PocketFanoutController,
  canSubmitPersonalData,
  type PersonalDatasetKey,
  type PersonalAsyncContext,
  type PocketBarrierContext,
  type PersonalDataServices,
} from "@/stores/personal-data-store";

import {
  PersonalSubscriptionSessionController,
  type SubscriptionSessionState,
} from "@/features/dashboard/hooks/use-personal-data-subscriptions";

console.log("Running instrumental unit tests for personal-data-status.test.ts...");

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function runTests() {
  // --- SECCIÓN A: PRUEBAS DE SUSCRIPTION SESSION CONTROLLER ---

  // Test Session 1: Dos start() para el mismo contexto -> setupCalls === 1
  {
    const session = new PersonalSubscriptionSessionController();
    const ctx: PersonalAsyncContext = { ownerId: "u1", generation: 1 };
    let setupCalls = 0;

    session.start(ctx, () => {
      setupCalls++;
    });
    assert.strictEqual(setupCalls, 1);
    assert.strictEqual(session.getState(), "active");

    const secondResult = session.start(ctx, () => {
      setupCalls++;
    });
    assert.strictEqual(secondResult, false, "Second start for same context must return false");
    assert.strictEqual(setupCalls, 1, "Setup must not be executed twice for active session with same context");
    console.log("  ✓ Test Session 1: Dos start() para el mismo contexto -> setupCalls = 1");
  }

  // Test Session 2 & 3: setup falla parcialmente -> rollback -> retry del mismo contexto funciona
  {
    const session = new PersonalSubscriptionSessionController();
    const ctx: PersonalAsyncContext = { ownerId: "u1", generation: 1 };
    let cleanup1Executed = false;
    let cleanup2Executed = false;

    // First attempt fails halfway
    assert.throws(
      () => {
        session.start(ctx, (registerCleanup) => {
          registerCleanup(() => {
            cleanup1Executed = true;
          });
          registerCleanup(() => {
            cleanup2Executed = true;
          });
          throw new Error("Simulated query failure during listener setup");
        });
      },
      /Simulated query failure/,
      "Exception during setup must be thrown",
    );

    assert.strictEqual(cleanup1Executed, true, "Cleanup 1 must be executed on rollback");
    assert.strictEqual(cleanup2Executed, true, "Cleanup 2 must be executed on rollback");
    assert.strictEqual(session.getState(), "idle", "Session state must roll back to idle on exception");
    assert.strictEqual(session.getContext(), null, "Session context must be cleared on rollback");

    // Immediate retry for SAME context after failure works!
    let secondAttemptSetupCalls = 0;
    const retryResult = session.start(ctx, () => {
      secondAttemptSetupCalls++;
    });

    assert.strictEqual(retryResult, true, "Start after failure must succeed");
    assert.strictEqual(secondAttemptSetupCalls, 1, "Setup must be executed on retry after failure");
    assert.strictEqual(session.getState(), "active", "Session state must become active");
    console.log("  ✓ Test Session 2 & 3: setup falla -> rollback -> retry del mismo contexto funciona");
  }

  // Test Session 4 & 5: stop() limpia la sesión y permite reiniciar el mismo contexto
  {
    const session = new PersonalSubscriptionSessionController();
    const ctx: PersonalAsyncContext = { ownerId: "u1", generation: 1 };
    let cleanedUp = false;

    session.start(ctx, (registerCleanup) => {
      registerCleanup(() => {
        cleanedUp = true;
      });
    });

    assert.strictEqual(session.getState(), "active");
    session.stop();
    assert.strictEqual(cleanedUp, true);
    assert.strictEqual(session.getState(), "idle");

    // Idempotent second stop
    session.stop();
    assert.strictEqual(session.getState(), "idle");

    // Restart same context after stop
    let restartedCalls = 0;
    session.start(ctx, () => {
      restartedCalls++;
    });
    assert.strictEqual(restartedCalls, 1);
    assert.strictEqual(session.getState(), "active");
    console.log("  ✓ Test Session 4 & 5: stop() limpia sesión e iniciar el mismo contexto funciona");
  }

  // Test Session 6: Un contexto nuevo reemplaza al anterior sin listeners duplicados
  {
    const session = new PersonalSubscriptionSessionController();
    const ctx1: PersonalAsyncContext = { ownerId: "u1", generation: 1 };
    const ctx2: PersonalAsyncContext = { ownerId: "u2", generation: 2 };
    let ctx1Cleaned = false;
    let ctx2Calls = 0;

    session.start(ctx1, (registerCleanup) => {
      registerCleanup(() => {
        ctx1Cleaned = true;
      });
    });

    session.start(ctx2, () => {
      ctx2Calls++;
    });

    assert.strictEqual(ctx1Cleaned, true, "Previous context cleanups must run when new context starts");
    assert.strictEqual(ctx2Calls, 1);
    assert.strictEqual(session.getContext()?.ownerId, "u2");
    console.log("  ✓ Test Session 6: Nuevo contexto reemplaza al anterior sin duplicados");
  }


  // --- SECCIÓN B: PRUEBAS DEL LOADER INSTRUMENTADO ---

  // Test Loader 1: Accounts falla en primera carga -> accountsCalls = 1, pocketsCalls = 0, pockets.status != ready
  {
    let accountsCalls = 0;
    let pocketsCalls = 0;

    const store = createPersonalDataStore({
      readAccounts: async () => {
        accountsCalls++;
        throw new Error("Accounts DB offline");
      },
      readPockets: async () => {
        pocketsCalls++;
        return [];
      },
      readCategories: async () => [],
      readTransactions: async () => [],
      readThirdPartyEntries: async () => [],
      readThirdPartyConsumptions: async () => [],
    });

    await store.getState().load("user1");

    const state = store.getState();
    assert.strictEqual(accountsCalls, 1, "readAccounts must be called once");
    assert.strictEqual(pocketsCalls, 0, "readPockets must NOT be called when accounts fail");
    assert.notStrictEqual(state.datasets.pockets.status, "ready", "Pockets status must not be ready");
    assert.strictEqual(state.status, "error", "Overall status must be error");
    console.log("  ✓ Test Loader 1: Accounts falla en 1ra carga -> accountsCalls = 1, pocketsCalls = 0, pockets status != ready");
  }

  // Test Loader 2: Accounts falla durante retry -> pocketsCalls durante retry = 0, pockets anteriores conservados, status = stale
  {
    let accountsShouldFail = false;
    let accountsCalls = 0;
    let pocketsCalls = 0;

    const store = createPersonalDataStore({
      readAccounts: async () => {
        accountsCalls++;
        if (accountsShouldFail) {
          throw new Error("Accounts DB error during retry");
        }
        return [{ id: "acc1", name: "Cuenta 1", balance: 1000, archived: false } as any];
      },
      readPockets: async () => {
        pocketsCalls++;
        return [{ id: "p1", accountId: "acc1", name: "Bolsillo 1", balance: 200 }];
      },
      readCategories: async () => [],
      readTransactions: async () => [],
      readThirdPartyEntries: async () => [],
      readThirdPartyConsumptions: async () => [],
    });

    // 1st successful load
    await store.getState().load("user1");
    assert.strictEqual(store.getState().data.pockets.length, 1);
    assert.strictEqual(store.getState().datasets.pockets.status, "ready");
    assert.strictEqual(pocketsCalls, 1);

    // Reconfigure accounts to fail and execute retry()
    accountsShouldFail = true;
    const pocketsCallsBeforeRetry = pocketsCalls;

    await store.getState().retry();

    const state = store.getState();
    assert.strictEqual(pocketsCalls - pocketsCallsBeforeRetry, 0, "pocketsCalls during retry must be 0 when accounts fail");
    assert.strictEqual(state.data.pockets.length, 1, "Previous pockets data must be retained");
    assert.strictEqual(state.datasets.pockets.status, "stale", "Pockets status must be stale");
    console.log("  ✓ Test Loader 2: Accounts falla en retry -> pocketsCalls = 0, pockets conservados, status = stale");
  }

  // Test Loader 3: Accounts exitoso y vacío -> pocketsCalls = 1, hasValue = true, pockets.status = ready
  {
    let accountsCalls = 0;
    let pocketsCalls = 0;

    const store = createPersonalDataStore({
      readAccounts: async () => {
        accountsCalls++;
        return []; // 0 active accounts
      },
      readPockets: async (ids) => {
        pocketsCalls++;
        return [];
      },
      readCategories: async () => [],
      readTransactions: async () => [],
      readThirdPartyEntries: async () => [],
      readThirdPartyConsumptions: async () => [],
    });

    await store.getState().load("user1");

    const state = store.getState();
    assert.strictEqual(accountsCalls, 1);
    assert.strictEqual(pocketsCalls, 1, "pocketsCalls must be 1 even for empty active accounts");
    assert.strictEqual(state.datasets.pockets.hasValue, true, "hasValue must be true for valid empty pockets");
    assert.strictEqual(state.datasets.pockets.status, "ready", "pockets.status must be ready");
    console.log("  ✓ Test Loader 3: Accounts exitoso y vacío -> pocketsCalls = 1, hasValue = true, status = ready");
  }

  // Test Loader 4: Dos retries simultáneos -> load executions = 1, accountsCalls = 1, listenerSetupCalls = 1, 1 sola generación efectiva
  {
    let accountsCalls = 0;
    let listenerSetupCalls = 0;
    const deferredAccounts = createDeferred<any[]>();

    const store = createPersonalDataStore({
      readAccounts: async () => {
        accountsCalls++;
        return await deferredAccounts.promise;
      },
      readPockets: async () => [],
      readCategories: async () => [],
      readTransactions: async () => [],
      readThirdPartyEntries: async () => [],
      readThirdPartyConsumptions: async () => [],
      startSubscriptions: () => {
        listenerSetupCalls++;
      },
    });

    // Set store ownerId
    store.setState({ ownerId: "user1", generation: 1, status: "success" });

    // Execute two simultaneous retries
    const p1 = store.getState().retry();
    const p2 = store.getState().retry();

    const genDuringFlight = store.getState().generation;

    // Resolve in-flight accounts promise
    deferredAccounts.resolve([{ id: "a1", name: "A1", balance: 500, archived: false }]);

    await Promise.all([p1, p2]);

    const state = store.getState();
    assert.strictEqual(accountsCalls, 1, "accountsCalls must be exactly 1 for simultaneous retries");
    assert.strictEqual(listenerSetupCalls, 1, "listenerSetupCalls must be exactly 1 for simultaneous retries");
    assert.strictEqual(state.generation, genDuringFlight, "Both retries must share the single effective generation");
    console.log("  ✓ Test Loader 4: Dos retries simultáneos -> load executions = 1, accountsCalls = 1, listenerSetupCalls = 1");
  }

  // Test Loader 5: Snapshot posterior a reset/logout -> descartado
  {
    const store = createPersonalDataStore({
      readAccounts: async () => [],
      readPockets: async () => [],
      readCategories: async () => [],
      readTransactions: async () => [],
      readThirdPartyEntries: async () => [],
      readThirdPartyConsumptions: async () => [],
    });

    await store.getState().load("userA");
    const ctxA: PersonalAsyncContext = { ownerId: "userA", generation: store.getState().generation };

    store.getState().reset(); // state.ownerId becomes null

    store.getState().applyPersonalSnapshot({ accounts: [{ id: "a1", name: "A1", balance: 10, archived: false } as any] }, "accounts", ctxA);

    assert.strictEqual(store.getState().ownerId, null);
    assert.strictEqual(store.getState().rawAccounts.length, 0, "Snapshot after reset must be discarded");
    console.log("  ✓ Test Loader 5: Snapshot posterior a reset/logout -> descartado");
  }

  // Test Loader 6: Fan-out [A, B] -> cambio [A, B] a [B, C] -> callback antiguo de B rechazado
  {
    const controller = new PocketFanoutController();
    const sessionCtx: PersonalAsyncContext = { ownerId: "u1", generation: 10 };

    const barrier1Ctx = controller.reset(["accA", "accB"], sessionCtx);
    controller.onAccountSnapshot("accA", [{ id: "pA", accountId: "accA", name: "PA", balance: 100 }], barrier1Ctx);

    // Active accounts list changes to [B, C] -> barrierId increments
    const barrier2Ctx = controller.reset(["accB", "accC"], sessionCtx);
    assert.ok(barrier2Ctx.barrierId > barrier1Ctx.barrierId, "Barrier ID must increment on reset");

    // Late callback from old listener B (barrier 1)
    const lateOldSnapB = controller.onAccountSnapshot("accB", [{ id: "pB_old", accountId: "accB", name: "PB Old", balance: 50 }], barrier1Ctx);
    assert.strictEqual(lateOldSnapB, null, "Late callback from barrier 1 must be rejected");

    // New listener for B (barrier 2) emits
    const snapBNew = controller.onAccountSnapshot("accB", [{ id: "pB_new", accountId: "accB", name: "PB New", balance: 150 }], barrier2Ctx);
    assert.strictEqual(snapBNew, null, "Barrier 2 waiting for C");

    // New listener for C (barrier 2) emits
    const snapCNew = controller.onAccountSnapshot("accC", [{ id: "pC", accountId: "accC", name: "PC", balance: 300 }], barrier2Ctx);
    assert.notStrictEqual(snapCNew, null, "Barrier 2 complete when new B and C emit");
    assert.strictEqual(snapCNew!.length, 2);
    assert.strictEqual(snapCNew![0].name, "PB New");
    assert.strictEqual(snapCNew![1].name, "PC");
    console.log("  ✓ Test Loader 6: Cambio [A, B] -> [B, C]: callback antiguo de B rechazado");
  }


  // --- SECCIÓN C: CONTRATO ESTRUCTURAL DE DIÁLOGOS HOGAR ---

  // Test Dialogs 1: Cada uno de los 3 archivos contiene !canSubmitPersonalData en handleSubmit Y en disabled
  {
    const dialogFiles = [
      "src/features/household/components/complete-share-dialog.tsx",
      "src/features/household/components/confirm-reception-dialog.tsx",
      "src/features/household/components/declare-payment-dialog.tsx",
    ];

    for (const relPath of dialogFiles) {
      const fullPath = path.join(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, "utf-8");

      // Verify handleSubmit body guard
      const handleSubmitMatch = content.match(/const handleSubmit[\s\S]*?\{([\s\S]*?)\};/);
      assert.ok(handleSubmitMatch, `${relPath} must contain a handleSubmit function`);
      assert.ok(
        handleSubmitMatch[1].includes("!canSubmitPersonalData("),
        `${relPath} handleSubmit body must include !canSubmitPersonalData(personalStatus) check`,
      );

      // Verify submit button disabled prop
      const submitButtonMatch = content.match(/<FinanceButton[\s\S]*?type="submit"[\s\S]*?>/);
      assert.ok(submitButtonMatch, `${relPath} must contain a type="submit" FinanceButton`);
      assert.ok(
        submitButtonMatch[0].includes("!canSubmitPersonalData("),
        `${relPath} submit button disabled prop must include !canSubmitPersonalData(personalStatus)`,
      );
    }
    console.log("  ✓ Test Dialogs 1: Contrato de los 3 diálogos Hogar (!canSubmitPersonalData en handleSubmit Y en disabled) verificado");
  }

  console.log("All personal-data-status instrumental unit tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failure in personal-data-status.test.ts:", err);
  process.exit(1);
});
