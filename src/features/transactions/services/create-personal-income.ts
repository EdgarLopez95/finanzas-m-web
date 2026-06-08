import { collection, doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { syncHouseholdIncomeProjectionInTransaction } from "@/features/transactions/services/sync-household-income-projection";
import {
  findThirdPartyFundEntryBySourceTransactionId,
  syncThirdPartyFundEntryInTransaction,
} from "@/features/transactions/services/sync-third-party-fund-entry";
import type { CreateIncomeInput } from "@/types/transaction";

export const createPersonalIncome = async (payload: CreateIncomeInput): Promise<void> => {
  const db = getFirebaseDb();
  const countsAsRealIncome = payload.countsAsRealIncome ?? true;
  const transactionRef = doc(collection(db, "transactions"));
  const existingThirdPartyEntry = countsAsRealIncome
    ? null
    : await findThirdPartyFundEntryBySourceTransactionId(payload.ownerId, transactionRef.id);

  await runTransaction(db, async (transaction) => {
    // FASE DE LECTURA (Todos los gets obligatoriamente al inicio)
    
    // 1. Lectura de Cuenta
    const accountRef = doc(db, "accounts", payload.accountId);
    const accountSnap = await transaction.get(accountRef);

    // 2. Lectura de Categoria
    const categoryRef = doc(db, "categories", payload.categoryId);
    const categorySnap = await transaction.get(categoryRef);

    // 3. Resolucion de Household (Lectura de User y Household)
    let activeHouseholdId: string | null = null;
    const userRef = doc(db, "users", payload.ownerId);
    const userSnap = await transaction.get(userRef);
    if (userSnap.exists()) {
      const activeHouseholdIdRaw = typeof userSnap.data().activeHouseholdId === "string"
        ? userSnap.data().activeHouseholdId.trim()
        : "";
      if (activeHouseholdIdRaw) {
        const householdRef = doc(db, "households", activeHouseholdIdRaw);
        const householdSnap = await transaction.get(householdRef);
        if (householdSnap.exists()) {
          const memberIds = Array.isArray(householdSnap.data().memberIds) ? householdSnap.data().memberIds : [];
          if (memberIds.includes(payload.ownerId)) {
            activeHouseholdId = activeHouseholdIdRaw;
          }
        }
      }
    }

    // 4. Pre-lectura de Ledger Privado (third_party_fund_entries)
    let preReadProjectionSnap = null;
    if (!countsAsRealIncome) {
      const projectionRef = doc(db, "third_party_fund_entries", transactionRef.id);
      preReadProjectionSnap = await transaction.get(projectionRef);
    }

    // FASE DE VALIDACION
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

    // FASE DE ESCRITURA (Todos los sets/updates despues de las lecturas)
    const nextBalance = currentBalance + payload.amount;

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
      countsAsRealIncome,
    });

    transaction.update(accountRef, {
      currentBalance: nextBalance,
      updatedAt: serverTimestamp(),
    });

    await syncHouseholdIncomeProjectionInTransaction({
      db,
      transaction,
      ownerId: payload.ownerId,
      sourceTransactionId: transactionRef.id,
      amount: payload.amount,
      entryDate: payload.date,
      description: payload.description,
      shouldProject: countsAsRealIncome,
      activeHouseholdId, // Evita gets internos
    });

    await syncThirdPartyFundEntryInTransaction({
      db,
      transaction,
      ownerId: payload.ownerId,
      sourceIncomeTransactionId: transactionRef.id,
      originalAmount: payload.amount,
      shouldTrack: countsAsRealIncome === false,
      existingEntry: existingThirdPartyEntry,
      preReadProjectionSnap, // Evita gets internos
    });
  });
};
