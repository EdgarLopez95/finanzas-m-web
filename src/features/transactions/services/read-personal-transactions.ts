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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type: TransactionType,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  categoryName?: string
): string => {
  if (explicitTitle.trim().length > 0) {
    return explicitTitle;
  }

  return "null";
};

export const readAllPersonalTransactions = async (ownerId: string): Promise<Transaction[]> => {
  const db = getFirebaseDb();
  const q = query(collection(db, "transactions"), where("ownerId", "==", ownerId));
  const snapshot = await getDocs(q);

  const mapped = snapshot.docs.map((docItem) => {
    const data = docItem.data();
    const type = safeTransactionType(data.type);

    return {
      id: docItem.id,
      ownerId,
      title: toSafeString(data.title ?? data.name ?? data.description),
      notes: toSafeString(data.notes ?? data.description),
      amount: toSafeNumber(data.amount),
      type,
      accountId: toSafeString(data.accountId),
      targetAccountId: toSafeString(data.targetAccountId) || null,
      pocketId: toSafeString(data.pocketId) || null,
      targetPocketId: toSafeString(data.targetPocketId) || null,
      categoryId: toSafeString(data.categoryId),
      countsAsRealIncome: type === "income" ? (typeof data.countsAsRealIncome === "boolean" ? data.countsAsRealIncome : true) : undefined,
      relatedDebtId: toSafeString(data.relatedDebtId) || null,
      relatedEventId: toSafeString(data.relatedEventId) || null,
      createdAt: toDateOrNull(data.createdAt ?? data.date),
      date: toDateOrNull(data.date ?? data.createdAt),
    } satisfies Transaction;
  });

  return mapped.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
};

export const readPersonalTransactions = async (ownerId: string, limitCount = 8): Promise<Transaction[]> => {
  const all = await readAllPersonalTransactions(ownerId);
  return all.slice(0, limitCount);
};
