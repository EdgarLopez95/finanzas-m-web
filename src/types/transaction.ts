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
  isHousehold?: boolean;
  relatedDebtId?: string | null;
  relatedEventId?: string | null;
  reimbursementDirection?: "incoming" | "outgoing" | null;
  consumesThirdPartyFunds?: boolean;
  /** G3 — transfer que movió dinero no propio entre ubicaciones (ledger OCC): inmutable. */
  movesThirdPartyFunds?: boolean;
  createdAt: Date | null;
  date?: Date | null;
};

export type CreateExpenseInput = {
  ownerId: string;
  amount: number;
  accountId: string;
  pocketId?: string | null;
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
  pocketId?: string | null;
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
  pocketId?: string | null;
  targetPocketId?: string | null;
  date: Date;
  description?: string;
  /** Si true, registra la atribución del dinero no propio entre ubicaciones (OCC). */
  movesThirdPartyFunds?: boolean;
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
  pocketId?: string | null;
  consumesThirdPartyFunds?: boolean;
  thirdPartyConsumeAmount?: number;
};

export type UpdateIncomeInput = UpdateTransactionBaseInput & {
  type: "income";
  categoryId: string;
  pocketId?: string | null;
  countsAsRealIncome?: boolean;
};

export type UpdateTransferInput = UpdateTransactionBaseInput & {
  type: "transfer";
  targetAccountId: string;
  pocketId?: string | null;
  targetPocketId?: string | null;
};


export type UpdatePersonalTransactionInput =
  | UpdateExpenseInput
  | UpdateIncomeInput
  | UpdateTransferInput;
