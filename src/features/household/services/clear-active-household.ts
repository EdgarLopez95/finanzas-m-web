import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

/**
 * Desvincula el hogar activo del perfil del usuario (users/{uid}.activeHouseholdId = null).
 */
export const clearActiveHousehold = async (uid: string): Promise<void> => {
  if (!uid) {
    throw new Error("El UID es obligatorio.");
  }
  const db = getFirebaseDb();
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    activeHouseholdId: null,
    updatedAt: serverTimestamp(),
  });
};
