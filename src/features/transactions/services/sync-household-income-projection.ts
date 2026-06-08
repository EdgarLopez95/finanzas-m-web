import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentReference,
  type Firestore,
  type Transaction as FirestoreTransaction,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

const HOUSEHOLD_INCOME_FALLBACK_DESCRIPTION = "Ingreso al hogar";

type ExistingHouseholdIncomeProjection = {
  ref: DocumentReference;
  householdId: string;
  sourceOwnerId: string;
  sourceTransactionId: string;
  status: string;
};

type SyncHouseholdIncomeProjectionInput = {
  db: Firestore;
  transaction: FirestoreTransaction;
  ownerId: string;
  sourceTransactionId: string;
  amount: number;
  entryDate: Date;
  description?: string;
  shouldProject: boolean;
  existingProjection?: ExistingHouseholdIncomeProjection | null;
  activeHouseholdId: string | null;
};

const toSafeString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const buildSafeVisibleDescription = (description?: string): string => {
  const normalized = description?.replace(/\s+/g, " ").trim() ?? "";

  if (!normalized) {
    return HOUSEHOLD_INCOME_FALLBACK_DESCRIPTION;
  }

  if (normalized.length > 80 || /[\r\n\t]/.test(normalized)) {
    return HOUSEHOLD_INCOME_FALLBACK_DESCRIPTION;
  }

  return normalized;
};

export const resolveEligibleHouseholdId = async (
  db: Firestore,
  transaction: FirestoreTransaction,
  ownerId: string
): Promise<string | null> => {
  const userRef = doc(db, "users", ownerId);
  const userSnap = await transaction.get(userRef);

  if (!userSnap.exists()) {
    return null;
  }

  const activeHouseholdId = toSafeString(userSnap.data().activeHouseholdId);
  if (!activeHouseholdId) {
    return null;
  }

  const householdRef = doc(db, "households", activeHouseholdId);
  const householdSnap = await transaction.get(householdRef);

  if (!householdSnap.exists()) {
    return null;
  }

  const memberIds = Array.isArray(householdSnap.data().memberIds) ? householdSnap.data().memberIds : [];
  return memberIds.includes(ownerId) ? activeHouseholdId : null;
};

export const findHouseholdIncomeProjectionBySourceTransactionId = async (
  ownerId: string,
  sourceTransactionId: string
): Promise<ExistingHouseholdIncomeProjection | null> => {
  const db = getFirebaseDb();
  const snapshot = await getDocs(
    query(
      collection(db, "household_income_entries"),
      where("sourceOwnerId", "==", ownerId),
      where("sourceTransactionId", "==", sourceTransactionId),
      limit(2)
    )
  );

  if (snapshot.docs.length > 1) {
    throw new Error("Se encontraron multiples proyecciones de hogar para el mismo ingreso.");
  }

  const docSnap = snapshot.docs[0];
  if (!docSnap) {
    return null;
  }

  const data = docSnap.data();
  const householdId = toSafeString(data.householdId);
  const sourceOwnerId = toSafeString(data.sourceOwnerId);
  const transactionId = toSafeString(data.sourceTransactionId);

  if (!householdId || !sourceOwnerId || !transactionId) {
    throw new Error("La proyeccion de hogar del ingreso esta malformada.");
  }

  return {
    ref: docSnap.ref,
    householdId,
    sourceOwnerId,
    sourceTransactionId: transactionId,
    status: toSafeString(data.status) || "active",
  };
};

export const syncHouseholdIncomeProjectionInTransaction = async ({
  db,
  transaction,
  ownerId,
  sourceTransactionId,
  amount,
  entryDate,
  description,
  shouldProject,
  existingProjection = null,
  activeHouseholdId,
}: SyncHouseholdIncomeProjectionInput): Promise<void> => {
  if (!shouldProject) {
    if (!existingProjection || existingProjection.status === "cancelled") {
      return;
    }

    transaction.update(existingProjection.ref, {
      status: "cancelled",
      updatedAt: serverTimestamp(),
    });
    return;
  }

  if (!activeHouseholdId) {
    if (!existingProjection || existingProjection.status === "cancelled") {
      return;
    }

    transaction.update(existingProjection.ref, {
      status: "cancelled",
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const visibleDescription = buildSafeVisibleDescription(description);

  if (existingProjection) {
    if (existingProjection.householdId !== activeHouseholdId) {
      throw new Error("No se puede mover la proyeccion de un ingreso entre hogares en esta version.");
    }

    transaction.update(existingProjection.ref, {
      visibleDescription,
      amount,
      entryDate: Timestamp.fromDate(entryDate),
      status: "active",
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const projectionRef = doc(collection(db, "household_income_entries"));

  transaction.set(projectionRef, {
    householdId: activeHouseholdId,
    sourceOwnerId: ownerId,
    sourceTransactionId,
    visibleDescription,
    amount,
    entryDate: Timestamp.fromDate(entryDate),
    kind: "real_income",
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};
