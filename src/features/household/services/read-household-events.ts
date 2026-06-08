import { collection, getDocs, query, where } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toDateOrNull, toSafeNumber, toSafeString } from "@/lib/firebase/firestore-parsers";
import type { HouseholdEvent } from "@/types/household";

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

const isActiveStatus = (value: unknown): boolean => {
  const status = toSafeString(value).toLowerCase();
  if (!status) {
    return true;
  }

  return !["deleted", "cancelled", "canceled", "archived", "inactive"].includes(status);
};

export const readHouseholdEvents = async (householdId: string): Promise<HouseholdEvent[]> => {
  const db = getFirebaseDb();

  try {
    const snapshot = await getDocs(
      query(collection(db, "household_events"), where("householdId", "==", householdId))
    );

    return snapshot.docs.map((docItem) => {
      const data = docItem.data();

      return {
        id: docItem.id,
        householdId,
        title: toSafeString(data.title ?? data.name ?? data.description, "Evento del hogar"),
        notes: toSafeString(data.notes ?? data.description),
        amount: toSafeNumber(data.amount),
        categoryId: toSafeString(data.categoryId),
        status: toSafeString(data.status, "active"),
        isActive: isActiveStatus(data.status),
        createdAt: toDateOrNull(data.createdAt ?? data.date ?? data.eventDate),
      } satisfies HouseholdEvent;
    });
  } catch (error) {
    throw toFirestoreError(error, "household_events");
  }
};
