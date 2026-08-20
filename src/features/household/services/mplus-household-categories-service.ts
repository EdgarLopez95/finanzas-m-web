import {
  collection,
  doc,
  getDocs,
  type Transaction,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  householdExpenseCategoryFromFirestore,
  householdExpenseCategoryToFirestore,
} from "@/lib/mplus/converters";
import { newMutationId, newUuid } from "@/lib/mplus/ids";
import type { MplusHouseholdExpenseCategory } from "@/lib/mplus/models";
import {
  runMplusMutation,
  type MplusMutationOutcome,
} from "@/lib/mplus/mutation-runner";
import {
  householdExpenseCategoryDocPath,
  MPLUS_PATHS,
} from "@/lib/mplus/paths";

export const readMplusHouseholdExpenseCategories = async (
  householdId: string,
): Promise<MplusHouseholdExpenseCategory[]> => {
  const db = getFirebaseDb();
  const catsRef = collection(
    db,
    MPLUS_PATHS.households,
    householdId,
    MPLUS_PATHS.expenseCategories,
  );
  const snap = await getDocs(catsRef);
  return snap.docs
    .map((d) => householdExpenseCategoryFromFirestore(d.id, d.data()))
    .sort((a, b) => a.sortOrder - b.sortOrder);
};

export const createHouseholdExpenseCategory = async (params: {
  householdId: string;
  creatorUid: string;
  name: string;
  iconKey: string;
  color: string;
  existingCount: number;
}): Promise<MplusMutationOutcome<MplusHouseholdExpenseCategory>> => {
  const { householdId, creatorUid, name, iconKey, color, existingCount } = params;
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 50) {
    return {
      kind: "rejected",
      code: "invalid-name",
      message: "El nombre de la categoría debe tener entre 1 y 50 caracteres.",
    };
  }

  const db = getFirebaseDb();
  const categoryId = newUuid();
  const mutationId = newMutationId();
  const now = Date.now();

  const categoryModel: MplusHouseholdExpenseCategory = {
    id: categoryId,
    schemaVersion: 1,
    householdId,
    name: trimmed,
    iconKey,
    color,
    state: "active",
    seedKey: null,
    sortOrder: existingCount,
    createdBy: creatorUid,
    revision: 1,
    lastMutationId: mutationId,
    createdAtMillis: now,
    updatedAtMillis: now,
  };

  const catRef = doc(db, ...householdExpenseCategoryDocPath(householdId, categoryId));

  return runMplusMutation<MplusHouseholdExpenseCategory>(db, {
    mutationId,
    occ: [],
    work: (tx: Transaction) => {
      tx.set(catRef, householdExpenseCategoryToFirestore(categoryModel));
      return categoryModel;
    },
  });
};

export const updateHouseholdExpenseCategory = async (params: {
  householdId: string;
  categoryId: string;
  name: string;
  iconKey: string;
  color: string;
  expectedRevision: number;
  existingCategory: MplusHouseholdExpenseCategory;
}): Promise<MplusMutationOutcome<MplusHouseholdExpenseCategory>> => {
  const { householdId, categoryId, name, iconKey, color, expectedRevision, existingCategory } = params;
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 50) {
    return {
      kind: "rejected",
      code: "invalid-name",
      message: "El nombre de la categoría debe tener entre 1 y 50 caracteres.",
    };
  }

  const db = getFirebaseDb();
  const mutationId = newMutationId();
  const now = Date.now();
  const catRef = doc(db, ...householdExpenseCategoryDocPath(householdId, categoryId));

  const updatedModel: MplusHouseholdExpenseCategory = {
    ...existingCategory,
    name: trimmed,
    iconKey,
    color,
    revision: expectedRevision + 1,
    lastMutationId: mutationId,
    updatedAtMillis: now,
  };

  return runMplusMutation<MplusHouseholdExpenseCategory>(db, {
    mutationId,
    occ: [
      { resource: "expenseCategories", id: categoryId, ref: catRef, baseRevision: expectedRevision },
    ],
    work: (tx: Transaction) => {
      tx.update(catRef, householdExpenseCategoryToFirestore(updatedModel));
      return updatedModel;
    },
  });
};

export const archiveHouseholdExpenseCategory = async (params: {
  householdId: string;
  categoryId: string;
  expectedRevision: number;
  existingCategory: MplusHouseholdExpenseCategory;
}): Promise<MplusMutationOutcome<MplusHouseholdExpenseCategory>> => {
  const { householdId, categoryId, expectedRevision, existingCategory } = params;
  const db = getFirebaseDb();
  const mutationId = newMutationId();
  const now = Date.now();
  const catRef = doc(db, ...householdExpenseCategoryDocPath(householdId, categoryId));

  const updatedModel: MplusHouseholdExpenseCategory = {
    ...existingCategory,
    state: "archived",
    revision: expectedRevision + 1,
    lastMutationId: mutationId,
    updatedAtMillis: now,
  };

  return runMplusMutation<MplusHouseholdExpenseCategory>(db, {
    mutationId,
    occ: [
      { resource: "expenseCategories", id: categoryId, ref: catRef, baseRevision: expectedRevision },
    ],
    work: (tx: Transaction) => {
      tx.update(catRef, householdExpenseCategoryToFirestore(updatedModel));
      return updatedModel;
    },
  });
};

export const reactivateHouseholdExpenseCategory = async (params: {
  householdId: string;
  categoryId: string;
  expectedRevision: number;
  existingCategory: MplusHouseholdExpenseCategory;
}): Promise<MplusMutationOutcome<MplusHouseholdExpenseCategory>> => {
  const { householdId, categoryId, expectedRevision, existingCategory } = params;
  const db = getFirebaseDb();
  const mutationId = newMutationId();
  const now = Date.now();
  const catRef = doc(db, ...householdExpenseCategoryDocPath(householdId, categoryId));

  const updatedModel: MplusHouseholdExpenseCategory = {
    ...existingCategory,
    state: "active",
    revision: expectedRevision + 1,
    lastMutationId: mutationId,
    updatedAtMillis: now,
  };

  return runMplusMutation<MplusHouseholdExpenseCategory>(db, {
    mutationId,
    occ: [
      { resource: "expenseCategories", id: categoryId, ref: catRef, baseRevision: expectedRevision },
    ],
    work: (tx: Transaction) => {
      tx.update(catRef, householdExpenseCategoryToFirestore(updatedModel));
      return updatedModel;
    },
  });
};
