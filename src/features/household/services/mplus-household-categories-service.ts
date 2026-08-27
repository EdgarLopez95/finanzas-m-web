import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  writeBatch,
  type Transaction,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  householdExpenseCategoryFromFirestore,
  householdExpenseCategoryToFirestore,
  millisToTimestamp,
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
import { HOUSEHOLD_EXPENSE_SEED, householdSeedCategoryId } from "@/lib/mplus/seeds";

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

/**
 * Suscripción en tiempo real a las categorías de gasto del Hogar (`households/{householdId}/expenseCategories`).
 */
export const subscribeMplusHouseholdExpenseCategories = (
  householdId: string,
  onUpdate: (categories: MplusHouseholdExpenseCategory[]) => void,
  onError?: (error: Error) => void,
  db = getFirebaseDb(),
): (() => void) => {
  return onSnapshot(
    collection(db, MPLUS_PATHS.households, householdId, MPLUS_PATHS.expenseCategories),
    (snap) => {
      const cats = snap.docs
        .map((d) => householdExpenseCategoryFromFirestore(d.id, d.data()))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      onUpdate(cats);
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
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

/**
 * Siembra el catálogo de gasto de Hogar v1 (contrato §13.1) si falta.
 *
 * Se llama al detectar que el Hogar está `active`, NO al crearlo: las Rules
 * (`expenseCategories`, línea 1155) exigen `currentUserIsActiveMember` y
 * `household.status == 'active'`, y ninguna de las dos se cumple dentro del
 * batch que crea un Hogar `waiting`. Es la misma decisión que Android toma en
 * `MplusHouseholdCategoryRepository.ensureSeed`.
 *
 * Idempotente: lee lo que ya hay y solo crea lo que falta, así que es seguro
 * llamarla en cada carga y desde los dos miembros a la vez. Los IDs son
 * deterministas (`seed_hh_expense_{seedKey}`), de modo que dos clientes
 * sembrando en paralelo escriben los MISMOS documentos.
 */
export const ensureHouseholdExpenseSeed = async (params: {
  householdId: string;
  createdBy: string;
  nowMillis?: number;
}): Promise<readonly string[]> => {
  const { householdId, createdBy } = params;
  const now = params.nowMillis ?? Date.now();
  const db = getFirebaseDb();

  const existing = await readMplusHouseholdExpenseCategories(householdId);
  const existingIds = new Set(existing.map((category) => category.id));

  const missing = HOUSEHOLD_EXPENSE_SEED.filter(
    (seed) => !existingIds.has(householdSeedCategoryId(seed)),
  );
  if (missing.length === 0) {
    return [];
  }

  const batch = writeBatch(db);
  const createdIds: string[] = [];
  const mutationId = newMutationId();

  for (const seed of missing) {
    const categoryId = householdSeedCategoryId(seed);
    batch.set(doc(db, ...householdExpenseCategoryDocPath(householdId, categoryId)), {
      schemaVersion: 1,
      householdId,
      type: "expense",
      name: seed.name,
      iconKey: seed.iconKey,
      color: seed.color,
      state: "active",
      seedKey: seed.seedKey,
      sortOrder: seed.sortOrder,
      createdBy,
      revision: 1,
      lastMutationId: mutationId,
      createdAt: millisToTimestamp(now),
      updatedAt: millisToTimestamp(now),
    });
    createdIds.push(categoryId);
  }

  await batch.commit();
  return createdIds;
};
