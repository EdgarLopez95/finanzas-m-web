import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

export const archiveHouseholdCategory = async (categoryId: string): Promise<void> => {
  if (!categoryId) throw new Error("El ID de la categoría es obligatorio.");
  const db = getFirebaseDb();
  await updateDoc(doc(db, "household_categories", categoryId), {
    archived: true,
    updatedAt: serverTimestamp(),
  });
};
