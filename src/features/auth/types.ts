export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthUser = {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
};

export type FirestoreUser = {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
  createdAt: unknown;
  defaultCurrency: "COP";
  activeHouseholdId: string | null;
};