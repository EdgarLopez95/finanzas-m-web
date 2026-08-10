import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

/**
 * Restaura (unarchive) una categoría Hogar archivada. Paridad Android:
 * `HouseholdCategoryManagementScreen.kt` ("Reabrir categoría",
 * `viewModel.unarchiveCategory(...)`) — Android no tiene borrado duro de
 * categorías Hogar, solo archivar/restaurar. Misma Rule de `update` que
 * `archiveHouseholdCategory` (whitelist de campos por miembro, sin
 * restricción de owner).
 */
export const unarchiveHouseholdCategory = async (categoryId: string): Promise<void> => {
  if (!categoryId) throw new Error("El ID de la categoría es obligatorio.");
  const db = getFirebaseDb();
  await updateDoc(doc(db, "household_categories", categoryId), {
    archived: false,
    updatedAt: serverTimestamp(),
  });
};
