import { collection, doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import type { CreateTransferInput } from "@/types/transaction";

export const createPersonalTransfer = async (payload: CreateTransferInput): Promise<void> => {
  const db = getFirebaseDb();

  await runTransaction(db, async (transaction) => {
    if (payload.accountId === payload.targetAccountId) {
      throw new Error("La cuenta origen y destino deben ser diferentes.");
    }

    const sourceRef = doc(db, "accounts", payload.accountId);
    const targetRef = doc(db, "accounts", payload.targetAccountId);

    const [sourceSnap, targetSnap] = await Promise.all([
      transaction.get(sourceRef),
      transaction.get(targetRef),
    ]);

    if (!sourceSnap.exists()) {
      throw new Error("La cuenta origen no existe.");
    }

    if (!targetSnap.exists()) {
      throw new Error("La cuenta destino no existe.");
    }

    const sourceData = sourceSnap.data();
    const targetData = targetSnap.data();

    if (sourceData.ownerId !== payload.ownerId || targetData.ownerId !== payload.ownerId) {
      throw new Error("Solo puedes transferir entre cuentas propias.");
    }

    const sourceBalanceRaw = sourceData.currentBalance ?? sourceData.balance;
    const targetBalanceRaw = targetData.currentBalance ?? targetData.balance;

    const sourceBalance = typeof sourceBalanceRaw === "number" ? sourceBalanceRaw : Number(sourceBalanceRaw ?? 0);
    const targetBalance = typeof targetBalanceRaw === "number" ? targetBalanceRaw : Number(targetBalanceRaw ?? 0);

    if (!Number.isFinite(sourceBalance) || !Number.isFinite(targetBalance)) {
      throw new Error("Alguna cuenta tiene saldo invalido.");
    }

    const transactionRef = doc(collection(db, "transactions"));

    transaction.set(transactionRef, {
      ownerId: payload.ownerId,
      type: "transfer",
      amount: payload.amount,
      accountId: payload.accountId,
      targetAccountId: payload.targetAccountId,
      categoryId: null,
      date: Timestamp.fromDate(payload.date),
      description: payload.description?.trim() ?? "",
      createdAt: serverTimestamp(),
      source: "manual",
      status: "confirmed",
      isHousehold: false,
      householdId: null,
    });

    transaction.update(sourceRef, {
      currentBalance: sourceBalance - payload.amount,
      updatedAt: serverTimestamp(),
    });

    transaction.update(targetRef, {
      currentBalance: targetBalance + payload.amount,
      updatedAt: serverTimestamp(),
    });
  });
};