export type TransactionType = "income" | "expense" | "transfer" | "reimbursement" | "pending";

export type Transaction = {
  id: string;
  ownerId: string;
  title: string;
  notes: string;
  amount: number;
  type: TransactionType;
  accountId: string;
  categoryId: string;
  createdAt: Date | null;
};
