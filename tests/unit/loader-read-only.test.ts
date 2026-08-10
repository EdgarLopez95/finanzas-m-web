/**
 * WEB-AUD-001 — Tests for transaction classification by account status.
 *
 * These tests validate that the personal data loader classifies transactions
 * correctly based on account status (active, archived, nonexistent) and that
 * no Firestore write operations occur during data loading.
 */
import assert from "node:assert/strict";

import { classifyTransactionsByAccount } from "../../src/stores/personal-data-store";
import type { Account } from "../../src/types/account";
import type { Transaction } from "../../src/types/transaction";

console.log("Running unit tests for loader-read-only.test.ts...");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeAccount = (overrides: Partial<Account> & { id: string }): Account => ({
  ownerId: "u1",
  name: "Cuenta",
  balance: 1000,
  currency: "COP",
  institutionName: "Banco",
  type: "general",
  updatedAt: null,
  includeInTotal: true,
  archived: false,
  iconKey: "bank",
  iconType: "generic",
  color: "",
  ...overrides,
});

const makeTx = (overrides: Partial<Transaction> & { id: string; accountId: string }): Transaction => ({
  ownerId: "u1",
  title: "Movimiento",
  notes: "",
  amount: 500,
  type: "expense",
  targetAccountId: null,
  pocketId: null,
  targetPocketId: null,
  categoryId: "cat-1",
  createdAt: new Date(),
  date: new Date(),
  ...overrides,
});

const activeAccount = makeAccount({ id: "acc-active" });
const archivedAccount = makeAccount({ id: "acc-archived", archived: true });

const txActive = makeTx({ id: "tx-1", accountId: "acc-active" });
const txArchived = makeTx({ id: "tx-2", accountId: "acc-archived" });
const txOrphan = makeTx({ id: "tx-3", accountId: "acc-nonexistent" });

// ── Test 1: Active account + transaction ──────────────────────────────────────

{
  const result = classifyTransactionsByAccount(
    [txActive],
    [activeAccount],
  );

  assert.equal(result.activeTransactions.length, 1, "T1: tx of active account must be in activeTransactions");
  assert.equal(result.activeTransactions[0].id, "tx-1", "T1: correct tx in activeTransactions");
  assert.equal(result.orphanedTransactions.length, 0, "T1: no orphans expected");
  console.log("  ✓ T1: Active account + transaction → classified as active");
}

// ── Test 2: Archived account + transaction ────────────────────────────────────

{
  const result = classifyTransactionsByAccount(
    [txArchived],
    [activeAccount, archivedAccount],
  );

  // Archived-account transactions are NOT active (excluded from dashboard/calcs)
  // but they are NOT orphans either — the account exists, it's just archived.
  assert.equal(result.activeTransactions.length, 0, "T2: archived account tx must NOT be in activeTransactions");
  assert.equal(result.orphanedTransactions.length, 0, "T2: archived account tx must NOT be classified as orphan");
  console.log("  ✓ T2: Archived account + transaction → not active, not orphan, preserved");
}

// ── Test 3: Nonexistent account + transaction (orphan) ────────────────────────

{
  const result = classifyTransactionsByAccount(
    [txOrphan],
    [activeAccount, archivedAccount],
  );

  assert.equal(result.activeTransactions.length, 0, "T3: orphan tx must NOT be in activeTransactions");
  assert.equal(result.orphanedTransactions.length, 1, "T3: orphan tx must be classified as orphaned");
  assert.equal(result.orphanedTransactions[0].id, "tx-3", "T3: correct orphan tx");
  console.log("  ✓ T3: Nonexistent account + transaction → classified as orphan, preserved in input");
}

// ── Test 4: Mixed scenario ────────────────────────────────────────────────────

{
  const result = classifyTransactionsByAccount(
    [txActive, txArchived, txOrphan],
    [activeAccount, archivedAccount],
  );

  assert.equal(result.activeTransactions.length, 1, "T4: only active-account tx in activeTransactions");
  assert.equal(result.activeTransactions[0].id, "tx-1", "T4: correct active tx");
  assert.equal(result.orphanedTransactions.length, 1, "T4: only truly orphaned tx in orphanedTransactions");
  assert.equal(result.orphanedTransactions[0].id, "tx-3", "T4: correct orphan tx");
  console.log("  ✓ T4: Mixed scenario — correct classification");
}

// ── Test 5: classifyTransactionsByAccount is a pure function (no side effects) ──

{
  const inputTxs = [txActive, txArchived, txOrphan];
  const inputAccounts = [activeAccount, archivedAccount];

  // Capture originals
  const txsBefore = JSON.stringify(inputTxs);
  const accountsBefore = JSON.stringify(inputAccounts);

  classifyTransactionsByAccount(inputTxs, inputAccounts);

  // Inputs must not be mutated
  assert.equal(JSON.stringify(inputTxs), txsBefore, "T5: input transactions must not be mutated");
  assert.equal(JSON.stringify(inputAccounts), accountsBefore, "T5: input accounts must not be mutated");
  console.log("  ✓ T5: Function is pure — no mutation of inputs");
}

// ── Test 6: Empty inputs ──────────────────────────────────────────────────────

{
  const result = classifyTransactionsByAccount([], []);
  assert.equal(result.activeTransactions.length, 0, "T6: no txs → no active");
  assert.equal(result.orphanedTransactions.length, 0, "T6: no txs → no orphans");
  console.log("  ✓ T6: Empty inputs → empty outputs");
}

// ── Test 7: Structural source-contract test — personal-data-store source read-only check ──
// Note: This structural source-contract test reads the actual source file of
// personal-data-store.ts to verify that no Firestore write APIs (deleteDoc,
// setDoc, updateDoc, addDoc, writeBatch, runTransaction) are imported or invoked
// anywhere in the file. This contract test is used instead of a full Firestore
// mock/seam infrastructure to avoid unnaturally expanding the scope of WEB-AUD-001.

import fs from "node:fs";
import path from "node:path";

{
  const storeFilePath = path.join(__dirname, "../../src/stores/personal-data-store.ts");
  const storeSource = fs.readFileSync(storeFilePath, "utf8");

  const forbiddenWriteApis = [
    "deleteDoc",
    "setDoc",
    "updateDoc",
    "addDoc",
    "writeBatch",
    "runTransaction",
  ];

  for (const writeApi of forbiddenWriteApis) {
    const hasForbiddenApi = new RegExp(`\\b${writeApi}\\b`).test(storeSource);
    assert.ok(
      !hasForbiddenApi,
      `T7 [Source Contract]: personal-data-store.ts must not contain or import Firestore write API '${writeApi}'`,
    );
  }
  console.log("  ✓ T7: Structural source contract — personal-data-store source contains 0 Firestore write APIs");
}

console.log("All loader-read-only unit tests passed successfully!");

