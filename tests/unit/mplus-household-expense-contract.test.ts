import assert from "node:assert/strict";

import {
  householdExpenseFromFirestore,
  householdExpenseToFirestore,
  movementFromFirestore,
  movementToFirestore,
  type FirestoreData,
} from "../../src/lib/mplus/converters";
import { mplusHouseholdExpenseSchema, mplusMovementSchema } from "../../src/lib/mplus/schemas";
import type { MplusHouseholdExpense, MplusMovement } from "../../src/lib/mplus/models";

export const runMplusHouseholdExpenseContractTests = async (): Promise<void> => {
  const NOW = 1755600000000;
  const UUID = "11111111-1111-4111-8111-111111111111";

  const validEqualExpense: MplusHouseholdExpense = {
    id: "expense-1",
    schemaVersion: 1,
    householdId: "household-1",
    type: "expense",
    title: "Mercado D1",
    amount: 101,
    note: "Compra quincenal",
    occurredAtMillis: NOW,
    householdCategoryId: "cat-1",
    distributionMode: "equal",
    memberAId: "user-a",
    memberAAmount: 51,
    memberBId: "user-b",
    memberBAmount: 50,
    lifecycleState: "active",
    trashedAtMillis: null,
    purgeAfterMillis: null,
    createdBy: "user-a",
    updatedBy: "user-a",
    revision: 1,
    lastMutationId: UUID,
    createdAtMillis: NOW,
    updatedAtMillis: NOW,
  };

  // 1. Equal mode: A receives ceil(total/2), B receives floor(total/2)
  assert.doesNotThrow(() => mplusHouseholdExpenseSchema.parse(validEqualExpense));

  // Invalid equal distribution (not ceil/floor)
  assert.throws(() =>
    mplusHouseholdExpenseSchema.parse({
      ...validEqualExpense,
      memberAAmount: 50,
      memberBAmount: 51,
    }),
  );

  // 2. Custom mode: non-negative integers summing to total
  const validCustomExpense: MplusHouseholdExpense = {
    ...validEqualExpense,
    distributionMode: "custom",
    amount: 100,
    memberAAmount: 70,
    memberBAmount: 30,
  };
  assert.doesNotThrow(() => mplusHouseholdExpenseSchema.parse(validCustomExpense));

  // Invalid custom sum
  assert.throws(() =>
    mplusHouseholdExpenseSchema.parse({
      ...validCustomExpense,
      memberAAmount: 70,
      memberBAmount: 40,
    }),
  );

  // Negative amount in custom
  assert.throws(() =>
    mplusHouseholdExpenseSchema.parse({
      ...validCustomExpense,
      memberAAmount: -10,
      memberBAmount: 110,
    }),
  );

  // 3. Nullable householdCategoryId represents "Por clasificar"
  const unclassifiedExpense: MplusHouseholdExpense = {
    ...validEqualExpense,
    householdCategoryId: null,
  };
  assert.doesNotThrow(() => mplusHouseholdExpenseSchema.parse(unclassifiedExpense));

  // 4. Firestore serialization & deserialization round-trip
  const firestoreData = householdExpenseToFirestore(validEqualExpense);
  const reloaded = householdExpenseFromFirestore(validEqualExpense.id, firestoreData as FirestoreData);
  assert.deepEqual(reloaded, validEqualExpense);

  // 5. Derivative movement validation: categoryId nullable ONLY if origin === "household_expense"
  const participationDoc: MplusMovement = {
    id: "expense-1__user-a",
    schemaVersion: 1,
    ownerId: "user-a",
    type: "expense",
    title: "Mercado D1",
    amount: 51,
    categoryId: null,
    accountId: null,
    note: "Compra quincenal",
    occurredAtMillis: NOW,
    lifecycleState: "active",
    trashedAtMillis: null,
    purgeAfterMillis: null,
    householdId: null,
    householdCategoryId: null,
    revision: 1,
    lastMutationId: UUID,
    createdAtMillis: NOW,
    updatedAtMillis: NOW,
    origin: "household_expense",
    householdExpenseId: "expense-1",
  };

  assert.doesNotThrow(() => mplusMovementSchema.parse(participationDoc));

  // Personal origin cannot have categoryId: null
  assert.throws(() =>
    mplusMovementSchema.parse({
      ...participationDoc,
      origin: "personal",
    }),
  );

  // Household expense derivative cannot have accountId
  assert.throws(() =>
    mplusMovementSchema.parse({
      ...participationDoc,
      accountId: "account-1",
    }),
  );

  // Household expense derivative cannot have householdId
  assert.throws(() =>
    mplusMovementSchema.parse({
      ...participationDoc,
      householdId: "household-1",
    }),
  );

  // Derivative serialization round-trip
  const partFs = movementToFirestore(participationDoc);
  const partReloaded = movementFromFirestore(participationDoc.id, partFs as FirestoreData);
  assert.deepEqual(partReloaded, participationDoc);

  console.log("OK mplus-household-expense-contract");
};
