import { collection, getDocs, query, where } from "firebase/firestore";

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

export const readHouseholdIncomeEntries = async (householdId: string): Promise<HouseholdIncomeEntry[]> => {
  const db = getFirebaseDb();

  try {
    const snapshot = await getDocs(
      query(collection(db, "household_income_entries"), where("householdId", "==", householdId))
    );

    return snapshot.docs.map((docItem) => {
      const data = docItem.data();

      return {
        id: docItem.id,
        householdId,
        title: toSafeString(data.title ?? data.name ?? data.description, "Ingreso compartido"),
        amount: toSafeNumber(data.amount),
        status: toSafeString(data.status, "active"),
        createdAt: toDateOrNull(data.createdAt ?? data.date ?? data.entryDate),
      } satisfies HouseholdIncomeEntry;
    });
  } catch (error) {
    throw toFirestoreError(error, "household_income_entries");
  }
};
