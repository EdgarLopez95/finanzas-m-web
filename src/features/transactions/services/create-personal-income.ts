import { collection, doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import type { CreateIncomeInput } from "@/types/transaction";

export const createPersonalIncome = async (payload: CreateIncomeInput): Promise<void> => {
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

    const nextBalance = currentBalance + payload.amount;

    const categoryRef = doc(db, "categories", payload.categoryId);
    const categorySnap = await transaction.get(categoryRef);

    if (!categorySnap.exists()) {
      throw new Error("La categoria seleccionada no existe.");
    }

    const categoryData = categorySnap.data();
    if (categoryData.ownerId !== payload.ownerId) {
      throw new Error("No tienes permiso para usar esta categoria.");
    }

    const categoryKind = categoryData.kind ?? categoryData.type;

    if (categoryKind !== "income") {
      throw new Error("La categoria debe ser de tipo ingreso.");
    }

    const transactionRef = doc(collection(db, "transactions"));

    transaction.set(transactionRef, {
      ownerId: payload.ownerId,
      type: "income",
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
      countsAsRealIncome: true,
    });

    transaction.update(accountRef, {
      currentBalance: nextBalance,
      updatedAt: serverTimestamp(),
    });
  });
};
