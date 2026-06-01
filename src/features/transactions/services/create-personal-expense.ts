import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where, Timestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import type { CreateExpenseInput } from "@/types/transaction";

export const createPersonalExpense = async (payload: CreateExpenseInput): Promise<void> => {
  const db = getFirebaseDb();

  await runTransaction(db, async (transaction) => {
    const accountRef = doc(db, "accounts", payload.accountId);
    const accountSnap = await transaction.get(accountRef);

    if (!accountSnap.exists()) {
      throw new Error("La cuenta seleccionada no existe.");
    }

    const accountData = accountSnap.data();

    if (accountData.ownerId !== payload.ownerId) {
      throw new Error("No tienes permiso para usar esta cuenta.");
    }

    const currentBalanceRaw = accountData.currentBalance ?? accountData.balance;
    const currentBalance = typeof currentBalanceRaw === "number" ? currentBalanceRaw : Number(currentBalanceRaw ?? 0);

    if (!Number.isFinite(currentBalance)) {
      throw new Error("La cuenta tiene un saldo invalido.");
    }

    const nextBalance = currentBalance - payload.amount;

    const categoryQ = query(
      collection(db, "categories"),
      where("ownerId", "==", payload.ownerId),
      where("__name__", "==", payload.categoryId)
    );
    const categorySnap = await getDocs(categoryQ);
    const categoryDoc = categorySnap.docs[0];

    if (!categoryDoc) {
      throw new Error("La categoria seleccionada no existe.");
    }

    const categoryData = categoryDoc.data();
    const categoryKind = categoryData.kind ?? categoryData.type;

    if (categoryKind !== "expense") {
      throw new Error("La categoria debe ser de tipo gasto.");
    }

    const transactionRef = doc(collection(db, "transactions"));

    transaction.set(transactionRef, {
      ownerId: payload.ownerId,
      type: "expense",
      amount: payload.amount,
      accountId: payload.accountId,
      categoryId: payload.categoryId,
      date: Timestamp.fromDate(payload.date),
      description: payload.description?.trim() ?? "",
      createdAt: serverTimestamp(),
      source: "manual",
      status: "confirmed",
      isHousehold: false,
      householdId: null,
    });

    transaction.update(accountRef, {
      currentBalance: nextBalance,
      updatedAt: serverTimestamp(),
    });
  });
};