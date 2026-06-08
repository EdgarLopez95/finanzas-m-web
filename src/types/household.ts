export type Household = {
  id: string;
  name: string;
  memberIds: string[];
  memberCount: number;
};

export type HouseholdEvent = {
  id: string;
  householdId: string;
  title: string;
  notes: string;
  amount: number;
  categoryId: string;
  status: string;
  isActive: boolean;
  createdAt: Date | null;
};

export type HouseholdCategory = {
  id: string;
  householdId: string;
  name: string;
};

export type HouseholdDebt = {
  id: string;
  householdId: string;
  title: string;
  amount: number;
  status: string;
  createdAt: Date | null;
};

export type HouseholdIncomeEntry = {
  id: string;
  householdId: string;
  title: string;
  amount: number;
  status: string;
  createdAt: Date | null;
};
