export type CategoryType = "income" | "expense" | "transfer" | "other";

export type Category = {
  id: string;
  ownerId: string;
  name: string;
  icon: string;
  type: CategoryType;
};
