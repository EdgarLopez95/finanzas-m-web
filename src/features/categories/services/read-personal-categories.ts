import { collection, getDocs, query, where } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toSafeString } from "@/lib/firebase/firestore-parsers";
import type { Category, CategoryType } from "@/types/category";

const safeCategoryType = (value: unknown): CategoryType => {
  if (value === "income" || value === "expense" || value === "transfer") {
    return value;
  }

  return "other";
};

export const readPersonalCategories = async (ownerId: string): Promise<Category[]> => {
  const db = getFirebaseDb();
  // Fetch all categories for this owner to support both kinds in the forms
  const q = query(collection(db, "categories"), where("ownerId", "==", ownerId));
  const snapshot = await getDocs(q);

  const categories = snapshot.docs.map((docItem) => {
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
    };
  });

  // Filter out archived categories and return
  return categories.filter((c) => !c.archived);
};