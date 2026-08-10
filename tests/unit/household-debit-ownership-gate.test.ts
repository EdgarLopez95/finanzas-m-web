import assert from "node:assert/strict";

import { completeHouseholdEventShare } from "../../src/features/household/services/complete-household-event-share";
import { declareDebtPayment } from "../../src/features/household/services/declare-debt-payment";
import type { ExpenseSourceState } from "../../src/lib/finance/expense-source";

console.log("Running ownership gate tests for household debits...");

type Ref = { path: string; id: string };

const docFn = (...args: unknown[]): Ref => {
  const parts = args.flat().filter((item): item is string => typeof item === "string");
  return { path: parts.join("/"), id: parts[parts.length - 1] };
};
const collectionFn = (...args: unknown[]) => args.flat().filter((item): item is string => typeof item === "string");

const mixedSnapshot = async () => ({
  entries: [
    {
      entryId: "entry-1",
      createdAtMillis: 1,
      originalAmount: 40_000,
      location: { accountId: "acc-1", pocketId: null as string | null },
    },
  ],
  moves: [],
  consumptions: [],
});

const expenseSource = (availableBalance: number): ExpenseSourceState =>
  ({
    accountId: "acc-1",
    pocketId: null,
    accountData: { ownerId: "u1", currentBalance: availableBalance },
    pocketData: null,
    availableBalance,
    refs: { accountRef: { id: "acc-1" } as never, pocketRef: null },
  }) as ExpenseSourceState;

function shareEnvironment(responsibilityAmount: number) {
  const writes: string[] = [];
  const docs = new Map<string, Record<string, unknown>>([
    [
      "household_event_shares/share-1",
      {
        memberUserId: "u1",
        status: "pending_completion",
        eventId: "evt-1",
        responsibilityAmount,
      },
    ],
    ["household_events/evt-1", { status: "active", title: "Mercado", householdId: "hh-1" }],
    ["categories/cat-1", { ownerId: "u1", kind: "expense" }],
  ]);

  return {
    writes,
    transaction: {
      get: async (ref: unknown) => {
        const data = docs.get((ref as Ref).path);
        return { exists: () => data !== undefined, data: () => data ?? {} };
      },
      set: (ref: unknown) => writes.push(`set:${(ref as Ref).path}`),
      update: (ref: unknown) => writes.push(`update:${(ref as Ref).path}`),
    },
  };
}

async function run() {
  // 100k físico − 40k retenido = 60k propio: 60_001 debe fallar sin escrituras.
  {
    const env = shareEnvironment(60_001);
    await assert.rejects(
      () =>
        completeHouseholdEventShare(
          {
            shareId: "share-1",
            ownerId: "u1",
            accountId: "acc-1",
            pocketId: null,
            categoryId: "cat-1",
            date: new Date(0),
          },
          {
            getFirebaseDbFn: () => ({}),
            docFn,
            collectionFn,
            runTransactionFn: (_db, fn) => fn(env.transaction),
            readThirdPartyLocationSnapshotFn: mixedSnapshot as never,
            loadExpenseSourceStateFn: async () => expenseSource(100_000),
            applyExpenseSourceDeltaFn: () => {
              env.writes.push("delta");
            },
          },
        ),
      // G4 — copy canónico compartido con el panel de composición del formulario.
      /pero solo .* es tu dinero/i,
    );
    assert.deepEqual(env.writes, [], "complete-share no escribe si el monto supera Mi dinero");
    console.log("  ✓ complete-share rechaza Mi dinero + 1 sin escrituras");
  }

  // Exactamente 60k propios debe confirmar.
  {
    const env = shareEnvironment(60_000);
    await completeHouseholdEventShare(
      {
        shareId: "share-1",
        ownerId: "u1",
        accountId: "acc-1",
        pocketId: null,
        categoryId: "cat-1",
        date: new Date(0),
      },
      {
        getFirebaseDbFn: () => ({}),
        docFn,
        collectionFn,
        runTransactionFn: (_db, fn) => fn(env.transaction),
        readThirdPartyLocationSnapshotFn: mixedSnapshot as never,
        loadExpenseSourceStateFn: async () => expenseSource(100_000),
        applyExpenseSourceDeltaFn: () => {
          env.writes.push("delta");
        },
      },
    );
    assert.ok(env.writes.length > 0, "complete-share confirma monto propio exacto");
    console.log("  ✓ complete-share permite exactamente Mi dinero");
  }

  {
    const writes: string[] = [];
    await assert.rejects(
      () =>
        declareDebtPayment(
          {
            debtId: "debt-1",
            ownerId: "u1",
            accountId: "acc-1",
            pocketId: null,
            date: new Date(0),
          },
          {
            getFirebaseDbFn: () => ({}),
            docFn,
            collectionFn,
            runTransactionFn: async (_db, fn) => {
              await fn({
                get: async (ref: unknown) => {
                  const path = (ref as Ref).path;
                  if (path.includes("household_debts")) {
                    return {
                      exists: () => true,
                      data: () => ({
                        fromUserId: "u1",
                        status: "pending",
                        amount: 60_001,
                        householdId: "hh-1",
                        eventId: "",
                      }),
                    };
                  }
                  return { exists: () => false, data: () => ({}) };
                },
                set: (ref: unknown) => writes.push(`set:${(ref as Ref).path}`),
                update: (ref: unknown) => writes.push(`update:${(ref as Ref).path}`),
              });
            },
            readThirdPartyLocationSnapshotFn: mixedSnapshot as never,
            loadExpenseSourceStateFn: async () => expenseSource(100_000),
            applyExpenseSourceDeltaFn: () => {
              writes.push("delta");
            },
          },
        ),
      // G4 — copy canónico compartido con el panel de composición del formulario.
      /pero solo .* es tu dinero/i,
    );
    assert.deepEqual(writes, [], "declare-debt no escribe si supera Mi dinero");
    console.log("  ✓ declare-debt rechaza Mi dinero + 1 sin escrituras");
  }

  console.log("Household debit ownership gate tests passed successfully!");
}

run().catch((error) => {
  console.error("Test failure in household-debit-ownership-gate.test.ts:", error);
  process.exitCode = 1;
});
