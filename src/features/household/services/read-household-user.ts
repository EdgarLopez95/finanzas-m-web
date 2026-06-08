import { doc, getDoc } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toSafeString } from "@/lib/firebase/firestore-parsers";

const toFirestoreError = (error: unknown, label: string): Error => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "permission-denied"
  ) {
    return new Error(`permission-denied en ${label}`);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(`No se pudo leer ${label}.`);
};

export const readActiveHouseholdId = async (uid: string): Promise<string | null> => {
  const db = getFirebaseDb();

  try {
    const snapshot = await getDoc(doc(db, "users", uid));
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return toSafeString(data.activeHouseholdId) || null;
  } catch (error) {
    throw toFirestoreError(error, "users");
  }
};
