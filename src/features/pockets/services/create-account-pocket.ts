import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";

export type CreatePocketInput = {
  accountId: string;
  ownerId: string;
  name: string;
  balance: number;
};

export const createAccountPocket = async (payload: CreatePocketInput): Promise<void> => {
  const db = getFirebaseDb();
  const balance = Number(payload.balance);

  if (!payload.name.trim()) {
    throw new Error("El nombre del bolsillo es obligatorio.");
  }
  if (!Number.isFinite(balance) || balance < 0) {
    throw new Error("El monto inicial del bolsillo debe ser mayor o igual a cero.");
  }

  await runTransaction(db, async (transaction) => {
    const accountRef = doc(db, "accounts", payload.accountId);
    const accountSnap = await transaction.get(accountRef);

    if (!accountSnap.exists()) {
      throw new Error("La cuenta seleccionada no existe.");
    }

    const accountData = accountSnap.data();
    if (accountData.ownerId !== payload.ownerId) {
      throw new Error("No tienes permiso para modificar esta cuenta.");
    }

    const currentBalanceRaw = accountData.currentBalance ?? accountData.balance;
    const currentBalance = typeof currentBalanceRaw === "number" ? currentBalanceRaw : Number(currentBalanceRaw ?? 0);

    if (balance > currentBalance) {
      throw new Error(`Saldo disponible insuficiente ($ ${currentBalance.toLocaleString("es-CO")}) para asignar al bolsillo.`);
    }

    const nextBalance = currentBalance - balance;

    // Crear el bolsillo bajo la colección pockets de la cuenta
    const pocketRef = doc(collection(db, "accounts", payload.accountId, "pockets"));
    transaction.set(pocketRef, {
      name: payload.name.trim(),
      balance: balance,
      createdAt: serverTimestamp(),
    });

    // Descontar del saldo disponible de la cuenta
    transaction.update(accountRef, {
      currentBalance: nextBalance,
      updatedAt: serverTimestamp(),
    });
  });
};
