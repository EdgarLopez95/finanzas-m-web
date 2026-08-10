import { collection, getDocs, query, where, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toDateOrNull, toSafeNumber, toSafeString } from "@/lib/firebase/firestore-parsers";
import type { HouseholdIncomeEntry } from "@/types/household";

const toFirestoreError = (error: unknown, label: string): Error => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "permission-denied"
  ) {
    return new Error(`permission-denied en ${label}`);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(`No se pudo leer ${label}.`);
};

export const mapHouseholdIncomeEntryDoc = (
  docItem: QueryDocumentSnapshot<DocumentData>,
  householdId: string
): HouseholdIncomeEntry => {
  const data = docItem.data();

  const createdAt = toDateOrNull(data.createdAt);
  const entryDate = toDateOrNull(data.entryDate ?? data.date) ?? createdAt;

  return {
    id: docItem.id,
    householdId,
    visibleDescription: toSafeString(
      data.visibleDescription ?? data.title ?? data.name ?? data.description,
      "Ingreso compartido"
    ),
    sourceOwnerId: toSafeString(data.sourceOwnerId ?? data.ownerId ?? data.userId),
    amount: toSafeNumber(data.amount),
    status: toSafeString(data.status, "active"),
    entryDate,
    createdAt,
  };
};

export const readHouseholdIncomeEntries = async (householdId: string): Promise<HouseholdIncomeEntry[]> => {
  const db = getFirebaseDb();

  try {
    const snapshot = await getDocs(
      query(collection(db, "household_income_entries"), where("householdId", "==", householdId))
    );

    return snapshot.docs
      .map((docItem) => mapHouseholdIncomeEntryDoc(docItem, householdId))
      .filter((entry) => entry.status !== "cancelled" && entry.status !== "cancelado");
  } catch (error) {
    throw toFirestoreError(error, "household_income_entries");
  }
};
