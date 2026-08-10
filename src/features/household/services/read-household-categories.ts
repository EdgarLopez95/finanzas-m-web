import { collection, getDocs, query, where, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toSafeString, toDateOrNull } from "@/lib/firebase/firestore-parsers";
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

export const mapHouseholdCategoryDoc = (
  docItem: QueryDocumentSnapshot<DocumentData>,
  householdId: string
): HouseholdCategory => {
  const data = docItem.data();

  return {
    id: docItem.id,
    householdId,
    name: toSafeString(data.name, "Categoría de hogar"),
    iconKey: toSafeString(data.iconKey ?? data.icon),
    color: toSafeString(data.color),
    archived: typeof data.archived === "boolean" ? data.archived : false,
    parentId: typeof data.parentId === "string" ? data.parentId : null,
    seedKey: typeof data.seedKey === "string" ? data.seedKey : null,
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : null,
    createdAt: toDateOrNull(data.createdAt),
  };
};

export const readHouseholdCategories = async (householdId: string): Promise<HouseholdCategory[]> => {
  const db = getFirebaseDb();

  try {
    const snapshot = await getDocs(
      query(collection(db, "household_categories"), where("householdId", "==", householdId))
    );

    return snapshot.docs.map((docItem) => mapHouseholdCategoryDoc(docItem, householdId));
  } catch (error) {
    throw toFirestoreError(error, "household_categories");
  }
};
