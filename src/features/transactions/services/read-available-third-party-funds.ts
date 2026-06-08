import { collection, getDocs, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { toDateOrNull, toSafeNumber, toSafeString } from "@/lib/firebase/firestore-parsers";
import type { ThirdPartyFundEntry, ThirdPartyFundConsumption } from "@/types/third-party-funds";
import { groupConsumptionsByEntryId, getEntryPendingAmount } from "@/lib/finance/third-party-funds";

export type AvailableThirdPartyFund = {
  entry: ThirdPartyFundEntry;
  pendingAmount: number;
};

export const readAvailableThirdPartyFunds = async (
  ownerId: string,
  excludeExpenseTransactionId?: string
): Promise<{
  availableFunds: AvailableThirdPartyFund[];
  totalAvailable: number;
  allConsumptions: ThirdPartyFundConsumption[];
}> => {
  const db = getFirebaseDb();

  // 1. Fetch entries with status open or consumed
  const entriesQuery = query(
    collection(db, "third_party_fund_entries"),
    where("ownerId", "==", ownerId),
    where("status", "in", ["open", "consumed"])
  );
  const entriesSnap = await getDocs(entriesQuery);
  const entries: ThirdPartyFundEntry[] = entriesSnap.docs.map((docItem) => {
    const data = docItem.data();
    return {
      id: docItem.id,
      ownerId: toSafeString(data.ownerId),
      sourceIncomeTransactionId: toSafeString(data.sourceIncomeTransactionId),
      originalAmount: toSafeNumber(data.originalAmount),
      status: (data.status as ThirdPartyFundEntry["status"]) || "open",
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  });

  // 2. Fetch all consumptions for the owner
  const consumptionsQuery = query(
    collection(db, "third_party_fund_consumptions"),
    where("ownerId", "==", ownerId)
  );
  const consumptionsSnap = await getDocs(consumptionsQuery);
  const consumptions: ThirdPartyFundConsumption[] = consumptionsSnap.docs.map((docItem) => {
    const data = docItem.data();
    return {
      id: docItem.id,
      ownerId: toSafeString(data.ownerId),
      entryId: toSafeString(data.entryId),
      consumerExpenseTransactionId: toSafeString(data.consumerExpenseTransactionId),
      amount: toSafeNumber(data.amount),
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  });

  // 3. Exclude consumptions associated with a specific expense transaction being edited
  const filteredConsumptions = excludeExpenseTransactionId
    ? consumptions.filter((c) => c.consumerExpenseTransactionId !== excludeExpenseTransactionId)
    : consumptions;

  const grouped = groupConsumptionsByEntryId(filteredConsumptions);

  // 4. Calculate pending amount for each entry (excluding cancelled ones)
  const availableFunds: AvailableThirdPartyFund[] = [];
  let totalAvailable = 0;

  for (const entry of entries) {
    if (entry.status === "cancelled") {
      continue;
    }
    const pendingAmount = getEntryPendingAmount(entry, grouped);
    if (pendingAmount > 0) {
      availableFunds.push({
        entry,
        pendingAmount,
      });
      totalAvailable += pendingAmount;
    }
  }

  // 5. Sort by createdAt ascending (FIFO) with stable fallbacks
  availableFunds.sort((a, b) => {
    const timeA = a.entry.createdAt?.getTime() ?? 0;
    const timeB = b.entry.createdAt?.getTime() ?? 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    const updateA = a.entry.updatedAt?.getTime() ?? 0;
    const updateB = b.entry.updatedAt?.getTime() ?? 0;
    if (updateA !== updateB) {
      return updateA - updateB;
    }
    return a.entry.id.localeCompare(b.entry.id);
  });

  return {
    availableFunds,
    totalAvailable,
    allConsumptions: consumptions,
  };
};
