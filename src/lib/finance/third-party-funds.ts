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
