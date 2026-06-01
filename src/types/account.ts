export type Account = {
  id: string;
  ownerId: string;
  name: string;
  balance: number;
  currency: string;
  institutionName: string;
  type: string;
  updatedAt: Date | null;
};
