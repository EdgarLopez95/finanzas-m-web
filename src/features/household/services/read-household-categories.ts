import { collection, getDocs, query, where } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toSafeString } from "@/lib/firebase/firestore-parsers";
import type { HouseholdCategory } from "@/types/household";

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

export const readHouseholdCategories = async (householdId: string): Promise<HouseholdCategory[]> => {
  const db = getFirebaseDb();

  try {
    const snapshot = await getDocs(
      query(collection(db, "household_categories"), where("householdId", "==", householdId))
    );

    return snapshot.docs.map((docItem) => {
      const data = docItem.data();

      return {
        id: docItem.id,
        householdId,
        name: toSafeString(data.name, "Categoria de hogar"),
      } satisfies HouseholdCategory;
    });
  } catch (error) {
    throw toFirestoreError(error, "household_categories");
  }
};
