import { collection, addDoc, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { expenseIconOptions, EXPENSE_ICON_KEY_LEGACY_ALIASES } from "@/lib/categories/category-icons";

/**
 * Hogar reutiliza EXCLUSIVAMENTE el catálogo de gasto compartido
 * (`src/lib/categories/category-icons.ts`) — no mantiene su propia lista de
 * claves. Incluye los alias legacy (p. ej. "shopping-bag") para no romper
 * categorías ya persistidas con claves anteriores al catálogo canónico.
 */
export const VALID_EXPENSE_ICON_KEYS = new Set([
  ...expenseIconOptions.map((option) => option.iconKey),
  ...EXPENSE_ICON_KEY_LEGACY_ALIASES,
]);

export type CreateHouseholdCategoryInput = {
  householdId: string;
  createdByUserId: string;
  name: string;
  iconKey: string;
  color: string;
  parentId?: string | null;
};

export const createHouseholdCategory = async (input: CreateHouseholdCategoryInput): Promise<string> => {
  const nameTrim = input.name.trim();
  if (!nameTrim) throw new Error("El nombre de la categoría es obligatorio.");
  if (!input.householdId) throw new Error("El ID del hogar es obligatorio.");
  if (!input.createdByUserId) throw new Error("El ID del creador es obligatorio.");
  if (!input.iconKey || !VALID_EXPENSE_ICON_KEYS.has(input.iconKey)) {
    throw new Error(`El ícono '${input.iconKey}' no es válido.`);
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(input.color)) throw new Error("El color debe ser hexadecimal válido (ej. #EF4444).");

  const db = getFirebaseDb();
  const docRef = await addDoc(collection(db, "household_categories"), {
    householdId: input.householdId,
    createdByUserId: input.createdByUserId,
    name: nameTrim,
    kind: "expense",
    iconKey: input.iconKey,
    color: input.color,
    parentId: input.parentId ?? null,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
};
