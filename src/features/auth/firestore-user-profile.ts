import type { FirestoreUser } from "./types";

type FirebaseProfileSource = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

export const buildFirestoreUserProfile = (
  user: FirebaseProfileSource,
  createdAt: unknown,
): FirestoreUser => ({
  uid: user.uid,
  displayName: user.displayName ?? "Usuario Finanzas M+",
  photoUrl: user.photoURL ?? null,
  createdAt,
  defaultCurrency: "COP",
  activeHouseholdId: null,
});
