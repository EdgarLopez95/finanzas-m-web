import { collection, getDocs, query, where, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toDateOrNull, toSafeNumber, toSafeString } from "@/lib/firebase/firestore-parsers";
import type { Transaction, TransactionType } from "@/types/transaction";

const safeReimbursementDirection = (value: unknown): "incoming" | "outgoing" | null => {
  if (value === "incoming" || value === "outgoing") {
    return value;
  }
  return null;
};

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
  const trimmed = explicitTitle.trim();
  if (trimmed.length > 0 && trimmed.toLowerCase() !== "null" && trimmed.toLowerCase() !== "undefined") {
    return explicitTitle;
  }

  if (type === "transfer") {
    return "Transferencia";
  }

  if (categoryName && categoryName.trim().length > 0) {
    return categoryName;
  }

  if (type === "income") {
    return "Ingreso";
  }

  if (type === "expense") {
    return "Gasto";
  }

  if (type === "reimbursement") {
    return "Reembolso";
  }

  return "Movimiento";
};

export const mapTransactionDoc = (docItem: QueryDocumentSnapshot<DocumentData>, ownerId: string): Transaction => {
  const data = docItem.data();
  const type = safeTransactionType(data.type);

  let rawTitle = "";
  let displaySource: "title" | "name" | "description" | "none" = "none";
  
  if (data.title !== undefined && data.title !== null && String(data.title).trim() !== "") {
    rawTitle = toSafeString(data.title);
    displaySource = "title";
  } else if (data.name !== undefined && data.name !== null && String(data.name).trim() !== "") {
    rawTitle = toSafeString(data.name);
    displaySource = "name";
  } else if (data.description !== undefined && data.description !== null && String(data.description).trim() !== "") {
    rawTitle = toSafeString(data.description);
    displaySource = "description";
  }

  let title = rawTitle;
  let notes = "";
  if (data.notes !== undefined && data.notes !== null && String(data.notes).trim() !== "") {
    notes = toSafeString(data.notes);
  } else if (displaySource !== "description" && data.description !== undefined && data.description !== null) {
    notes = toSafeString(data.description);
  }

  if (title.includes("|")) {
    const parts = title.split("|");
    const concept = parts[0]?.trim() || "";
    const note = parts.slice(1).join("|").trim();
    title = concept;
    if (note.length > 0) {
      const normNotes = notes.toLowerCase().trim();
      const normNote = note.toLowerCase().trim();
      if (normNotes.length > 0) {
        if (!normNotes.includes(normNote)) {
          notes = `${notes} - ${note}`;
        }
      } else {
        notes = note;
      }
    }
  }

  return {
    id: docItem.id,
    ownerId,
    title,
    notes,
    amount: toSafeNumber(data.amount),
    type,
    accountId: toSafeString(data.accountId),
    targetAccountId: toSafeString(data.targetAccountId) || null,
    pocketId: toSafeString(data.pocketId) || null,
    targetPocketId: toSafeString(data.targetPocketId) || null,
    categoryId: toSafeString(data.categoryId),
    countsAsRealIncome: type === "income" ? (typeof data.countsAsRealIncome === "boolean" ? data.countsAsRealIncome : true) : undefined,
    isHousehold: typeof data.isHousehold === "boolean" ? data.isHousehold : false,
    relatedDebtId: toSafeString(data.relatedDebtId) || null,
    relatedEventId: toSafeString(data.relatedEventId) || null,
    reimbursementDirection: safeReimbursementDirection(data.reimbursementDirection),
    // G3 — banderas de dinero no propio. Sin mapearlas, la UI ofrecía
    // Editar/Eliminar sobre gasto Otro y transfer no propio (que los servicios
    // rechazan). Solo `=== true`: nunca un truthy accidental.
    consumesThirdPartyFunds: data.consumesThirdPartyFunds === true,
    movesThirdPartyFunds: data.movesThirdPartyFunds === true,
    createdAt: toDateOrNull(data.createdAt ?? data.date),
    date: toDateOrNull(data.date ?? data.createdAt),
  } satisfies Transaction;
};

export const readAllPersonalTransactions = async (ownerId: string): Promise<Transaction[]> => {
  const db = getFirebaseDb();
  const q = query(collection(db, "transactions"), where("ownerId", "==", ownerId));
  const snapshot = await getDocs(q);

  const mapped = snapshot.docs.map((docItem) => mapTransactionDoc(docItem, ownerId));

  return mapped.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
};

export const readPersonalTransactions = async (ownerId: string, limitCount = 8): Promise<Transaction[]> => {
  const all = await readAllPersonalTransactions(ownerId);
  return all.slice(0, limitCount);
};
