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
  const q = query(collection(db, "categories"), where("ownerId", "==", ownerId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) => {
    const data = docItem.data();

    return {
      id: docItem.id,
      ownerId,
      name: toSafeString(data.name, "Categoria"),
      icon: toSafeString(data.icon),
      type: safeCategoryType(data.type),
    };
  });
};
