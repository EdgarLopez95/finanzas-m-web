export type TransactionType = "income" | "expense" | "transfer" | "reimbursement" | "pending";

export type Transaction = {
  id: string;
  ownerId: string;
  title: string;
  notes: string;
  amount: number;
  type: TransactionType;
  accountId: string;
  targetAccountId: string | null;
  pocketId?: string | null;
  targetPocketId?: string | null;
  categoryId: string;
  countsAsRealIncome?: boolean;
  relatedDebtId?: string | null;
  relatedEventId?: string | null;
  createdAt: Date | null;
  date?: Date | null;
};

export type CreateExpenseInput = {
  ownerId: string;
  amount: number;
  accountId: string;
  categoryId: string;
  date: Date;
  description?: string;
  consumesThirdPartyFunds?: boolean;
  thirdPartyConsumeAmount?: number;
};

export type CreateIncomeInput = {
  ownerId: string;
  amount: number;
  accountId: string;
  categoryId: string;
  countsAsRealIncome?: boolean;
  date: Date;
  description?: string;
};

export type CreateTransferInput = {
  ownerId: string;
  amount: number;
  accountId: string;
  targetAccountId: string;
  date: Date;
  description?: string;
};

type UpdateTransactionBaseInput = {
  ownerId: string;
  transactionId: string;
  amount: number;
  accountId: string;
  date: Date;
  description?: string;
};

export type UpdateExpenseInput = UpdateTransactionBaseInput & {
  type: "expense";
  categoryId: string;
  consumesThirdPartyFunds?: boolean;
  thirdPartyConsumeAmount?: number;
};

export type UpdateIncomeInput = UpdateTransactionBaseInput & {
  type: "income";
  categoryId: string;
  countsAsRealIncome?: boolean;
};

export type UpdateTransferInput = UpdateTransactionBaseInput & {
  type: "transfer";
  targetAccountId: string;
};

export type UpdatePersonalTransactionInput =
  | UpdateExpenseInput
  | UpdateIncomeInput
  | UpdateTransferInput;
