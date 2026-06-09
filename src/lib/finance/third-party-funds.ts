import type { ThirdPartyFundConsumption, ThirdPartyFundEntry } from "@/types/third-party-funds";

export type ConsumptionsByEntryId = Map<string, ThirdPartyFundConsumption[]>;

export const groupConsumptionsByEntryId = (
  consumptions: ThirdPartyFundConsumption[]
): ConsumptionsByEntryId => {
  const grouped: ConsumptionsByEntryId = new Map();

  for (const consumption of consumptions) {
    const existing = grouped.get(consumption.entryId);

    if (existing) {
      existing.push(consumption);
      continue;
    }

    grouped.set(consumption.entryId, [consumption]);
  }

  return grouped;
};

export const getEntryConsumedAmount = (
  entryId: string,
  groupedConsumptions: ConsumptionsByEntryId
): number => {
  const consumptions = groupedConsumptions.get(entryId) ?? [];

  return consumptions.reduce((total, consumption) => total + consumption.amount, 0);
};

export const getEntryPendingAmount = (
  entry: ThirdPartyFundEntry,
  groupedConsumptions: ConsumptionsByEntryId
): number => {
  return entry.originalAmount - getEntryConsumedAmount(entry.id, groupedConsumptions);
};

export const getTotalThirdPartyPending = (
  entries: ThirdPartyFundEntry[],
  groupedConsumptions: ConsumptionsByEntryId
): number => {
  let total = 0;

  for (const entry of entries) {
    if (entry.status === "cancelled") {
      continue;
    }

    const pendingAmount = getEntryPendingAmount(entry, groupedConsumptions);

    if (pendingAmount > 0) {
      total += pendingAmount;
    }
  }

  return total;
};

export const assertOriginalAmountCoversConsumedAmount = (
  originalAmount: number,
  consumedAmount: number
): void => {
  if (originalAmount < consumedAmount) {
    throw new Error(
      "No puedes reducir este ingreso no real por debajo de lo ya consumido. Ajusta primero los gastos que usan ese dinero."
    );
  }
};

export const splitConsumptionsForExpenseTransaction = (
  consumptions: ThirdPartyFundConsumption[],
  expenseTransactionId: string
): {
  existingConsumptions: ThirdPartyFundConsumption[];
  otherKnownConsumptions: ThirdPartyFundConsumption[];
  affectedEntryIds: string[];
} => {
  const existingConsumptions = consumptions.filter(
    (consumption) => consumption.consumerExpenseTransactionId === expenseTransactionId
  );

  const affectedEntryIds = Array.from(new Set(existingConsumptions.map((consumption) => consumption.entryId))).filter(
    (entryId) => entryId.length > 0
  );

  const otherKnownConsumptions = consumptions.filter(
    (consumption) =>
      affectedEntryIds.includes(consumption.entryId) &&
      consumption.consumerExpenseTransactionId !== expenseTransactionId
  );

  return {
    existingConsumptions,
    otherKnownConsumptions,
    affectedEntryIds,
  };
};
