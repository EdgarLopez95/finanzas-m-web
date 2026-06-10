import { collection, addDoc, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { expenseIconCatalog, incomeIconCatalog } from "@/lib/categories/category-icons";

export interface CreateCategoryParams {
  ownerId: string;
  name: string;
  kind: "expense" | "income";
  iconKey: string;
  color: string;
}

export const createCategory = async (params: CreateCategoryParams): Promise<string> => {
  const nameTrim = params.name.trim();
  if (!nameTrim) {
    throw new Error("El nombre de la categoría es obligatorio.");
  }
  if (!params.ownerId) {
    throw new Error("El ID del propietario es obligatorio.");
  }
  if (params.kind !== "expense" && params.kind !== "income") {
    throw new Error("El tipo (kind) de categoría debe ser 'expense' o 'income'.");
  }

  // Validate iconKey exists in respective catalog
  const catalog = params.kind === "income" ? incomeIconCatalog : expenseIconCatalog;
  if (!catalog[params.iconKey]) {
    throw new Error(`El ícono '${params.iconKey}' no pertenece al catálogo de ${params.kind}.`);
  }

  // Validate color format (basic hex validation)
  if (!/^#[0-9A-Fa-f]{6}$/.test(params.color)) {
    throw new Error("El color debe tener un formato hexadecimal válido (ej. #EF4444).");
  }

  const db = getFirebaseDb();
  
  const docRef = await addDoc(collection(db, "categories"), {
    ownerId: params.ownerId,
    name: nameTrim,
    parentId: null,
    kind: params.kind,
    iconKey: params.iconKey,
    color: params.color,
    archived: false,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
};
