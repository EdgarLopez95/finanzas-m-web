import { collection, doc, runTransaction, serverTimestamp, Timestamp, type DocumentData } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import type { CreateExpenseInput } from "@/types/transaction";
import type { ThirdPartyFundConsumption } from "@/types/third-party-funds";
import { readAvailableThirdPartyFunds } from "./read-available-third-party-funds";
import { generateUUID } from "@/lib/utils/uuid";

const toSafeFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    throw new Error("Monto no numerico o invalido.");
  }
  return parsed;
};

export const createPersonalExpense = async (payload: CreateExpenseInput): Promise<void> => {
  const db = getFirebaseDb();

  // 1. Pre-lookup available funds if consumption is requested
  const consumes = payload.consumesThirdPartyFunds ?? false;
  const consumeAmount = payload.thirdPartyConsumeAmount ?? 0;

  const consumptionPlan: { entryId: string; amount: number }[] = [];
  let preLookupConsumptions: ThirdPartyFundConsumption[] = [];

  if (consumes) {
    if (!Number.isFinite(consumeAmount) || consumeAmount <= 0) {
      throw new Error("El monto consumido debe ser mayor a cero.");
    }
    if (consumeAmount > payload.amount) {
      throw new Error("El monto consumido no puede superar el monto total del gasto.");
    }

    const { availableFunds, totalAvailable, allConsumptions } = await readAvailableThirdPartyFunds(payload.ownerId);
    preLookupConsumptions = allConsumptions;

    if (consumeAmount > totalAvailable) {
      throw new Error("El monto a consumir supera el dinero no propio disponible.");
    }

    let remainingToConsume = consumeAmount;
    for (const fund of availableFunds) {
      if (remainingToConsume <= 0) break;
      const consumeFromThisEntry = Math.min(fund.pendingAmount, remainingToConsume);
      consumptionPlan.push({
        entryId: fund.entry.id,
        amount: consumeFromThisEntry,
      });
      remainingToConsume -= consumeFromThisEntry;
    }

    if (remainingToConsume > 0) {
      throw new Error("El monto a consumir supera el dinero no propio disponible (inconsistencia de saldo).");
    }
  }

  // Identificar entries afectadas y consumos conocidos asociados para concurrencia
  const affectedEntryIds = consumptionPlan.map((p) => p.entryId);
  const otherKnownConsumptions = preLookupConsumptions.filter((c) => affectedEntryIds.includes(c.entryId));

  await runTransaction(db, async (transaction) => {
    // ==========================================
    // FASE DE LECTURA (Todos los gets al inicio)
    // ==========================================
    
    // 1. Lectura de Cuenta
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

    // 2. Lectura de Categoria
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

    if (categoryKind !== "expense") {
      throw new Error("La categoria debe ser de tipo gasto.");
    }

    // 3. Lock and validate entries in transaction
    const entryDataMap = new Map<string, DocumentData>();
    for (const plan of consumptionPlan) {
      const entryRef = doc(db, "third_party_fund_entries", plan.entryId);
      const entrySnap = await transaction.get(entryRef);

      if (!entrySnap.exists()) {
        throw new Error("Una de las entries de dinero no propio no existe.");
      }

      const entryData = entrySnap.data();
      if (entryData.ownerId !== payload.ownerId) {
        throw new Error("No tienes permiso sobre esta entry de dinero no propio.");
      }
      if (entryData.status === "cancelled") {
        throw new Error("No se puede consumir de una entry cancelada.");
      }

      entryDataMap.set(plan.entryId, entryData);
    }

    // 4. Leer/bloquear otros consumos asociados a las entries afectadas
    const otherConsumptionsSnaps = new Map<string, DocumentData>();
    for (const con of otherKnownConsumptions) {
      const conRef = doc(db, "third_party_fund_consumptions", con.id);
      const conSnap = await transaction.get(conRef);
      if (conSnap.exists()) {
        otherConsumptionsSnaps.set(con.id, conSnap.data());
      }
    }

    // ==========================================
    // FASE DE VALIDACION Y CALCULO
    // ==========================================
    // (Ya validado con las lecturas)

    // ==========================================
    // FASE DE ESCRITURA (Todos los updates/sets después de gets)
    // ==========================================
    
    // 1. Actualizar entries
    for (const plan of consumptionPlan) {
      const entryData = entryDataMap.get(plan.entryId);
      const entryRef = doc(db, "third_party_fund_entries", plan.entryId);

      if (!entryData) {
        throw new Error("No se encontraron datos de entry de dinero no propio en la transaccion.");
      }

      // Sumar consumos vigentes leídos dentro de la transacción
      let sumOtherConsumptions = 0;
      for (const con of otherKnownConsumptions) {
        if (con.entryId === plan.entryId) {
          const snapData = otherConsumptionsSnaps.get(con.id);
          if (snapData) {
            sumOtherConsumptions += toSafeFiniteNumber(snapData.amount);
          }
        }
      }

      const pendingAfter = entryData.originalAmount - sumOtherConsumptions - plan.amount;

      if (pendingAfter < 0) {
        throw new Error("El saldo disponible de dinero no propio cambio y ya no alcanza.");
      }

      const nextStatus = pendingAfter <= 0 ? "consumed" : "open";
      transaction.update(entryRef, {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    }

    // 2. Crear documento de gasto
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

    // 3. Crear documentos de consumo
    for (const plan of consumptionPlan) {
      const consumptionId = generateUUID();
      const consumptionRef = doc(db, "third_party_fund_consumptions", consumptionId);
      transaction.set(consumptionRef, {
        ownerId: payload.ownerId,
        entryId: plan.entryId,
        consumerExpenseTransactionId: transactionRef.id,
        amount: plan.amount,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 4. Descontar saldo de la cuenta
    transaction.update(accountRef, {
      currentBalance: nextBalance,
      updatedAt: serverTimestamp(),
    });
  });
};
