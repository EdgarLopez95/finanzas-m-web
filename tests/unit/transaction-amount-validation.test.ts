import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { assertValidTransactionAmount, TRANSACTION_AMOUNT_ERROR } from "@/lib/finance/transaction-validation";
import { createPersonalExpense } from "@/features/transactions/services/create-personal-expense";
import { createPersonalIncome } from "@/features/transactions/services/create-personal-income";
import { createPersonalTransfer } from "@/features/transactions/services/create-personal-transfer";
import { createPersonalExpenseWithHouseholdProjection } from "@/features/transactions/services/create-personal-expense-with-household-projection";
import { updatePersonalTransaction } from "@/features/transactions/services/update-personal-transaction";

const INVALID_AMOUNTS: Array<{ label: string; value: unknown }> = [
  { label: "0", value: 0 },
  { label: "-1", value: -1 },
  { label: "NaN", value: NaN },
  { label: "Infinity", value: Infinity },
  { label: "-Infinity", value: -Infinity },
  { label: 'string "100"', value: "100" as unknown as number },
  { label: "null", value: null as unknown as number },
];

console.log("Running unit tests for transaction-amount-validation.test.ts...");

const dummyDate = new Date();

async function runValidationTests() {
  // Direct helper unit tests
  assert.doesNotThrow(() => assertValidTransactionAmount(100), "Positive integer 100 should be allowed");
  assert.doesNotThrow(() => assertValidTransactionAmount(12.5), "Positive decimal 12.5 should be allowed");

  for (const item of INVALID_AMOUNTS) {
    assert.throws(
      () => assertValidTransactionAmount(item.value),
      (err: unknown) => err instanceof Error && err.message === TRANSACTION_AMOUNT_ERROR,
      `assertValidTransactionAmount must throw TRANSACTION_AMOUNT_ERROR for ${item.label}`,
    );
  }
  console.log("  ✓ Direct helper unit tests for assertValidTransactionAmount passed");

  const entrypoints: Array<{
    name: string;
    invoke: (amount: unknown) => Promise<void>;
  }> = [
    {
      name: "createPersonalExpense",
      invoke: (amount) =>
        createPersonalExpense({
          ownerId: "u1",
          amount: amount as number,
          accountId: "a1",
          categoryId: "c1",
          date: dummyDate,
        }),
    },
    {
      name: "createPersonalIncome",
      invoke: (amount) =>
        createPersonalIncome({
          ownerId: "u1",
          amount: amount as number,
          accountId: "a1",
          categoryId: "c1",
          date: dummyDate,
        }),
    },
    {
      name: "createPersonalTransfer",
      invoke: (amount) =>
        createPersonalTransfer({
          ownerId: "u1",
          amount: amount as number,
          accountId: "a1",
          targetAccountId: "a2",
          date: dummyDate,
        }),
    },
    {
      name: "createPersonalExpenseWithHouseholdProjection",
      invoke: (amount) =>
        createPersonalExpenseWithHouseholdProjection({
          ownerId: "u1",
          amount: amount as number,
          accountId: "a1",
          categoryId: "c1",
          date: dummyDate,
          householdId: "h1",
          householdCategoryId: "hc1",
          memberShares: [{ memberUserId: "u1", responsibilityAmount: amount as number }],
        }),
    },
    {
      name: "updatePersonalTransaction",
      invoke: (amount) =>
        updatePersonalTransaction({
          ownerId: "u1",
          transactionId: "t1",
          type: "expense",
          amount: amount as number,
          accountId: "a1",
          categoryId: "c1",
          date: dummyDate,
        }),
    },
  ];

  for (const ep of entrypoints) {
    for (const item of INVALID_AMOUNTS) {
      try {
        await ep.invoke(item.value);
        assert.fail(`${ep.name} accepted invalid amount ${item.label} without throwing!`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        assert.strictEqual(
          message,
          TRANSACTION_AMOUNT_ERROR,
          `${ep.name} with amount ${item.label} threw wrong error: "${message}", expected "${TRANSACTION_AMOUNT_ERROR}"`,
        );
      }
    }
    console.log(`  ✓ ${ep.name}: rejected all 7 invalid amount payloads with exact error`);
  }

  // Structural contract check: assertValidTransactionAmount(payload.amount); must be the FIRST instruction in each service
  const serviceFiles = [
    { name: "create-personal-expense.ts", relPath: "../../src/features/transactions/services/create-personal-expense.ts" },
    { name: "create-personal-income.ts", relPath: "../../src/features/transactions/services/create-personal-income.ts" },
    { name: "create-personal-transfer.ts", relPath: "../../src/features/transactions/services/create-personal-transfer.ts" },
    { name: "create-personal-expense-with-household-projection.ts", relPath: "../../src/features/transactions/services/create-personal-expense-with-household-projection.ts" },
    { name: "update-personal-transaction.ts", relPath: "../../src/features/transactions/services/update-personal-transaction.ts" },
  ];

  for (const sFile of serviceFiles) {
    const fullPath = path.join(__dirname, sFile.relPath);
    const content = fs.readFileSync(fullPath, "utf8");
    const callTarget = "assertValidTransactionAmount(payload.amount);";
    const guardCallIndex = content.indexOf(callTarget);

    assert.ok(
      guardCallIndex !== -1,
      `Service ${sFile.name} must call executable statement '${callTarget}'`,
    );

    const dbIndex = content.indexOf("getFirebaseDb(");
    assert.ok(
      dbIndex !== -1 && guardCallIndex < dbIndex,
      `Service ${sFile.name}: '${callTarget}' must be called BEFORE getFirebaseDb()`,
    );
  }
  console.log("  ✓ Structural contract: assertValidTransactionAmount(payload.amount) is invoked before getFirebaseDb in all 5 services");

  console.log("All transaction-amount-validation unit tests passed successfully!");
}

runValidationTests().catch((err) => {
  console.error("Test failure in transaction-amount-validation.test.ts:", err);
  process.exit(1);
});
