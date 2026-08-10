import { collection, getDocs, query, where, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

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

export const mapHouseholdDebtDoc = (
  docItem: QueryDocumentSnapshot<DocumentData>,
  householdId: string
): HouseholdDebt => {
  const data = docItem.data();

  return {
    id: docItem.id,
    householdId,
    eventId: toSafeString(data.eventId ?? data.householdEventId),
    title: toSafeString(data.title ?? data.name ?? data.description, "Pendiente"),
    fromUserId: toSafeString(data.fromUserId ?? data.debtorId ?? data.userId),
    toUserId: toSafeString(data.toUserId ?? data.creditorId),
    amount: toSafeNumber(data.amount ?? data.pendingAmount ?? data.balance),
    status: toSafeString(data.status, "pending"),
    outgoingTransactionId: typeof data.outgoingTransactionId === "string" ? data.outgoingTransactionId : null,
    incomingTransactionId: typeof data.incomingTransactionId === "string" ? data.incomingTransactionId : null,
    paymentDeclaredAt: toDateOrNull(data.paymentDeclaredAt),
    paidAt: toDateOrNull(data.paidAt),
    createdAt: toDateOrNull(data.createdAt ?? data.date ?? data.dueDate),
    updatedAt: toDateOrNull(data.updatedAt),
  };
};

export const readHouseholdDebts = async (householdId: string): Promise<HouseholdDebt[]> => {
  const db = getFirebaseDb();

  try {
    const snapshot = await getDocs(
      query(collection(db, "household_debts"), where("householdId", "==", householdId))
    );

    return snapshot.docs.map((docItem) => mapHouseholdDebtDoc(docItem, householdId));
  } catch (error) {
    throw toFirestoreError(error, "household_debts");
  }
};
