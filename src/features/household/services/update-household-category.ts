import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { VALID_EXPENSE_ICON_KEYS } from "./create-household-category";

export type UpdateHouseholdCategoryInput = {
  categoryId: string;
  name: string;
  iconKey: string;
  color: string;
};

export const updateHouseholdCategory = async (input: UpdateHouseholdCategoryInput): Promise<void> => {
  const nameTrim = input.name.trim();
  if (!nameTrim) throw new Error("El nombre de la categoría es obligatorio.");
  if (!input.categoryId) throw new Error("El ID de la categoría es obligatorio.");
  if (!input.iconKey || !VALID_EXPENSE_ICON_KEYS.has(input.iconKey)) {
    throw new Error(`El ícono '${input.iconKey}' no es válido.`);
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(input.color)) throw new Error("El color debe ser hexadecimal válido (ej. #EF4444).");

  const db = getFirebaseDb();
  await updateDoc(doc(db, "household_categories", input.categoryId), {
    name: nameTrim,
    iconKey: input.iconKey,
    color: input.color,
    updatedAt: serverTimestamp(),
  });
};
