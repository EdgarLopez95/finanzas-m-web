import { collection, getDocs, query, where, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toDateOrNull, toSafeNumber, toSafeString } from "@/lib/firebase/firestore-parsers";
import type { HouseholdEventShare } from "@/types/household";

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

const isPaidStatus = (value: unknown): boolean => {
  const s = toSafeString(value).toLowerCase();
  return s === "paid" || s === "pagado" || s === "resolved" || s === "completed";
};

export const mapHouseholdEventShareDoc = (
  docItem: QueryDocumentSnapshot<DocumentData>,
  householdId: string
): HouseholdEventShare => {
  const data = docItem.data();

  return {
    id: docItem.id,
    householdId,
    eventId: toSafeString(data.eventId ?? data.householdEventId),
    memberUserId: toSafeString(data.memberUserId ?? data.userId ?? data.uid),
    amount: toSafeNumber(data.responsibilityAmount ?? data.amount ?? data.shareAmount),
    percentage: typeof data.percentage === "number" ? data.percentage : null,
    status: toSafeString(data.status, "pending"),
    isPaid: isPaidStatus(data.status),
    completedAt: toDateOrNull(data.completedAt),
    completedByTransactionId: typeof data.completedByTransactionId === "string" ? data.completedByTransactionId : null,
    createdAt: toDateOrNull(data.createdAt ?? data.date),
    updatedAt: toDateOrNull(data.updatedAt),
  };
};

export const readHouseholdEventShares = async (householdId: string): Promise<HouseholdEventShare[]> => {
  const db = getFirebaseDb();

  try {
    const snapshot = await getDocs(
      query(collection(db, "household_event_shares"), where("householdId", "==", householdId))
    );

    return snapshot.docs.map((docItem) => mapHouseholdEventShareDoc(docItem, householdId));
  } catch (error) {
    throw toFirestoreError(error, "household_event_shares");
  }
};
