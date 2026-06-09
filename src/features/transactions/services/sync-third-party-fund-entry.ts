import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type Transaction as FirestoreTransaction,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { assertOriginalAmountCoversConsumedAmount } from "@/lib/finance/third-party-funds";
import type { ThirdPartyFundEntryStatus } from "@/types/third-party-funds";

type ExistingThirdPartyFundEntry = {
  ref: DocumentReference;
  ownerId: string;
  sourceIncomeTransactionId: string;
  status: ThirdPartyFundEntryStatus;
};

type SyncThirdPartyFundEntryInput = {
  db: Firestore;
  transaction: FirestoreTransaction;
  ownerId: string;
  sourceIncomeTransactionId: string;
  originalAmount: number;
  shouldTrack: boolean;
  existingEntry?: ExistingThirdPartyFundEntry | null;
  preReadProjectionSnap: DocumentSnapshot | null;
  consumedAmount?: number;
};

const toSafeString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const toSafeStatus = (value: unknown): ThirdPartyFundEntryStatus => {
  return value === "consumed" || value === "cancelled" ? value : "open";
};

export const findThirdPartyFundEntryBySourceTransactionId = async (
  ownerId: string,
  sourceIncomeTransactionId: string
): Promise<ExistingThirdPartyFundEntry | null> => {
  const db = getFirebaseDb();
  const snapshot = await getDocs(
    query(
      collection(db, "third_party_fund_entries"),
      where("ownerId", "==", ownerId),
      where("sourceIncomeTransactionId", "==", sourceIncomeTransactionId),
      limit(2)
    )
  );

  if (snapshot.docs.length > 1) {
    throw new Error("Se encontraron multiples entries privadas para el mismo ingreso no real.");
  }

  const docSnap = snapshot.docs[0];
  if (!docSnap) {
    return null;
  }

  const data = docSnap.data();
  const entryOwnerId = toSafeString(data.ownerId);
  const entrySourceIncomeTransactionId = toSafeString(data.sourceIncomeTransactionId);

  if (!entryOwnerId || !entrySourceIncomeTransactionId) {
    throw new Error("La entry privada del ingreso no real esta malformada.");
  }

  return {
    ref: docSnap.ref,
    ownerId: entryOwnerId,
    sourceIncomeTransactionId: entrySourceIncomeTransactionId,
    status: toSafeStatus(data.status),
  };
};

export const syncThirdPartyFundEntryInTransaction = async ({
  db,
  transaction,
  ownerId,
  sourceIncomeTransactionId,
  originalAmount,
  shouldTrack,
  existingEntry = null,
  preReadProjectionSnap,
  consumedAmount,
}: SyncThirdPartyFundEntryInput): Promise<void> => {
  if (!shouldTrack) {
    if (!existingEntry || existingEntry.status === "cancelled") {
      return;
    }

    transaction.update(existingEntry.ref, {
      status: "cancelled",
      updatedAt: serverTimestamp(),
    });
    return;
  }

  if (existingEntry) {
    if (typeof consumedAmount === "number") {
      assertOriginalAmountCoversConsumedAmount(originalAmount, consumedAmount);
    }

    const nextStatus: ThirdPartyFundEntryStatus = existingEntry.status === "consumed" ? "consumed" : "open";

    transaction.update(existingEntry.ref, {
      originalAmount,
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  if (!preReadProjectionSnap) {
    throw new Error("Se requiere el preReadProjectionSnap para sincronizar fondos de terceros.");
  }

  const projectionRef = doc(db, "third_party_fund_entries", sourceIncomeTransactionId);

  if (preReadProjectionSnap.exists()) {
    const projectionData = preReadProjectionSnap.data();
    const projectionOwnerId = toSafeString(projectionData.ownerId);
    const projectionSourceIncomeTransactionId = toSafeString(projectionData.sourceIncomeTransactionId);

    if (projectionOwnerId !== ownerId || projectionSourceIncomeTransactionId !== sourceIncomeTransactionId) {
      throw new Error("Ya existe una entry privada incompatible para este ingreso no real.");
    }

    if (typeof consumedAmount === "number") {
      assertOriginalAmountCoversConsumedAmount(originalAmount, consumedAmount);
    }

    const nextStatus: ThirdPartyFundEntryStatus = toSafeStatus(projectionData.status) === "consumed" ? "consumed" : "open";

    transaction.update(projectionRef, {
      originalAmount,
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  transaction.set(projectionRef, {
    ownerId,
    sourceIncomeTransactionId,
    originalAmount,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};
