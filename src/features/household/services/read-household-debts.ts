import { collection, getDocs, query, where } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toDateOrNull, toSafeNumber, toSafeString } from "@/lib/firebase/firestore-parsers";
import type { HouseholdDebt } from "@/types/household";

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

export const readHouseholdDebts = async (householdId: string): Promise<HouseholdDebt[]> => {
  const db = getFirebaseDb();

  try {
    const snapshot = await getDocs(
      query(collection(db, "household_debts"), where("householdId", "==", householdId))
    );

    return snapshot.docs.map((docItem) => {
      const data = docItem.data();

      return {
        id: docItem.id,
        householdId,
        title: toSafeString(data.title ?? data.name ?? data.description, "Pendiente"),
        amount: toSafeNumber(data.amount ?? data.pendingAmount ?? data.balance),
        status: toSafeString(data.status, "pending"),
        createdAt: toDateOrNull(data.createdAt ?? data.date ?? data.dueDate),
      } satisfies HouseholdDebt;
    });
  } catch (error) {
    throw toFirestoreError(error, "household_debts");
  }
};
