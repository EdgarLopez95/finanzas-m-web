export type ThirdPartyFundEntryStatus = "open" | "consumed" | "cancelled";

export type ThirdPartyFundEntry = {
  id: string;
  ownerId: string;
  sourceIncomeTransactionId: string;
  originalAmount: number;
  status: ThirdPartyFundEntryStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type ThirdPartyFundConsumption = {
  id: string;
  ownerId: string;
  entryId: string;
  consumerExpenseTransactionId: string;
  amount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
};
