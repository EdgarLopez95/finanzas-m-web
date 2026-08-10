import { collection, getDocs, query, where, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toSafeString, toDateOrNull } from "@/lib/firebase/firestore-parsers";
import type { Category, CategoryType } from "@/types/category";

const safeCategoryType = (value: unknown): CategoryType => {
  if (value === "income" || value === "expense" || value === "transfer") {
    return value;
  }

  return "other";
};

export const mapCategoryDoc = (docItem: QueryDocumentSnapshot<DocumentData>, ownerId: string): Category => {
  const data = docItem.data();
  const iconKey = data.iconKey ? toSafeString(data.iconKey) : undefined;
  
  return {
    id: docItem.id,
    ownerId,
    name: toSafeString(data.name, "Categoría"),
    icon: toSafeString(iconKey ?? data.icon),
    type: safeCategoryType(data.kind ?? data.type),
    iconKey,
    color: data.color ? toSafeString(data.color) : undefined,
    parentId: data.parentId ?? null,
    archived: Boolean(data.archived),
    seedKey: typeof data.seedKey === "string" ? data.seedKey : null,
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : null,
    createdAt: toDateOrNull(data.createdAt),
  };
};

export const readPersonalCategories = async (ownerId: string): Promise<Category[]> => {
  const db = getFirebaseDb();
  // Fetch all categories for this owner to support both kinds in the forms
  const q = query(collection(db, "categories"), where("ownerId", "==", ownerId));
  const snapshot = await getDocs(q);

  const categories = snapshot.docs.map((docItem) => mapCategoryDoc(docItem, ownerId));

  // Devuelve TODAS las categorías (incluyendo archivadas) para que los movimientos
  // históricos sigan resolviendo nombre/icono/color. Los formularios de creación/edición
  // filtran !archived en el cliente.
  return categories;
};