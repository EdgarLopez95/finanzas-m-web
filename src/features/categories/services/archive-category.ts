import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

export const archiveCategory = async (categoryId: string): Promise<void> => {
  if (!categoryId) throw new Error("El ID de la categoría es obligatorio.");
  const db = getFirebaseDb();
  await updateDoc(doc(db, "categories", categoryId), {
    archived: true,
    updatedAt: serverTimestamp(),
  });
};
