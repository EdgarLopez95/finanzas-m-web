import { collection, getDocs, query, where, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

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

export const mapHouseholdEventDoc = (
  docItem: QueryDocumentSnapshot<DocumentData>,
  householdId: string
): HouseholdEvent => {
  const data = docItem.data();

  const createdAt = toDateOrNull(data.createdAt);
  const eventDate = toDateOrNull(data.eventDate ?? data.date) ?? createdAt;
  const createdByUserId = toSafeString(data.createdByUserId ?? data.createdBy ?? data.userId);
  const paidByUserId = toSafeString(data.paidByUserId) || createdByUserId;
  const rawSettlementMode = toSafeString(data.settlementMode);
  const settlementMode = (rawSettlementMode === "invitation" || rawSettlementMode === "eachPaysOwn" || rawSettlementMode === "advancedByPayer")
    ? (rawSettlementMode as "invitation" | "eachPaysOwn" | "advancedByPayer")
    : "advancedByPayer";
  const sourceTransactionId = toSafeString(data.sourceTransactionId) || null;

  return {
    id: docItem.id,
    householdId,
    title: toSafeString(data.title ?? data.name ?? data.description, "Evento del hogar"),
    notes: toSafeString(data.description ?? data.notes),
    // totalAmount es el campo canónico en Firestore; amount como fallback legacy.
    amount: toSafeNumber(data.totalAmount ?? data.amount),
    // householdCategoryId es el campo canónico; categoryId como fallback legacy.
    categoryId: toSafeString(data.householdCategoryId ?? data.categoryId),
    createdByUserId,
    paidByUserId,
    settlementMode,
    sourceTransactionId,
    status: toSafeString(data.status, "active"),
    isActive: isActiveStatus(data.status),
    eventDate,
    createdAt,
  };
};

export const readHouseholdEvents = async (householdId: string): Promise<HouseholdEvent[]> => {
  const db = getFirebaseDb();

  try {
    const snapshot = await getDocs(
      query(collection(db, "household_events"), where("householdId", "==", householdId))
    );

    return snapshot.docs.map((docItem) => mapHouseholdEventDoc(docItem, householdId));
  } catch (error) {
    throw toFirestoreError(error, "household_events");
  }
};
