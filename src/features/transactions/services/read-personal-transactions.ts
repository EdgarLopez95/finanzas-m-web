import { collection, getDocs, query, where } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toDateOrNull, toSafeNumber, toSafeString } from "@/lib/firebase/firestore-parsers";
import type { Transaction, TransactionType } from "@/types/transaction";

const safeTransactionType = (value: unknown): TransactionType => {
  if (
    value === "income" ||
    value === "expense" ||
    value === "transfer" ||
    value === "reimbursement" ||
    value === "pending"
  ) {
    return value;
  }

  return "pending";
};

export const buildTransactionFallbackTitle = (
  explicitTitle: string,
  type: TransactionType,
  categoryName?: string
): string => {
  if (explicitTitle.trim().length > 0) {
    return explicitTitle;
  }

  const typeLabelMap: Record<TransactionType, string> = {
    income: "Ingreso",
    expense: "Gasto",
    transfer: "Transferencia",
    reimbursement: "Reembolso",
    pending: "Pendiente",
  };

  return categoryName ? `${typeLabelMap[type]} · ${categoryName}` : typeLabelMap[type];
};

export const readPersonalTransactions = async (ownerId: string, limitCount = 8): Promise<Transaction[]> => {
  const db = getFirebaseDb();
  const q = query(collection(db, "transactions"), where("ownerId", "==", ownerId));
  const snapshot = await getDocs(q);

  const mapped = snapshot.docs.map((docItem) => {
    const data = docItem.data();

    return {
      id: docItem.id,
      ownerId,
      title: toSafeString(data.title ?? data.name ?? data.description),
      notes: toSafeString(data.notes ?? data.description),
      amount: toSafeNumber(data.amount),
      type: safeTransactionType(data.type),
      accountId: toSafeString(data.accountId),
      categoryId: toSafeString(data.categoryId),
      createdAt: toDateOrNull(data.createdAt ?? data.date),
    } satisfies Transaction;
  });

  return mapped
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, limitCount);
};