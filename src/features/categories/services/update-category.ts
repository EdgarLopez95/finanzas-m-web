import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { isValidIconKey, isValidCategoryColor } from "@/lib/categories/category-icons";

export interface UpdateCategoryParams {
  ownerId: string;
  categoryId: string;
  name: string;
  kind: "expense" | "income";
  iconKey: string;
  color: string;
}

export const updateCategory = async (params: UpdateCategoryParams): Promise<void> => {
  const nameTrim = params.name.trim();
  if (!nameTrim) throw new Error("El nombre de la categoría es obligatorio.");
  if (!params.ownerId) throw new Error("El ID del propietario es obligatorio.");

  if (!isValidIconKey(params.iconKey, params.kind)) {
    throw new Error(`El ícono '${params.iconKey}' no pertenece al catálogo de ${params.kind}.`);
  }
  if (!isValidCategoryColor(params.color)) {
    throw new Error("El color debe tener un formato hexadecimal válido (ej. #EF4444).");
  }

  const db = getFirebaseDb();
  await updateDoc(doc(db, "categories", params.categoryId), {
    name: nameTrim,
    iconKey: params.iconKey,
    color: params.color,
    updatedAt: serverTimestamp(),
  });
};
