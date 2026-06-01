export type Transaction = {
  id: string;
  accountId: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  date: string;
};
