import { collection, doc, getDocs, query, runTransaction, serverTimestamp, Timestamp, where, type DocumentReference, type DocumentData } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { assertOriginalAmountCoversConsumedAmount } from "@/lib/finance/third-party-funds";
import {
  findHouseholdIncomeProjectionBySourceTransactionId,
  syncHouseholdIncomeProjectionInTransaction,
} from "@/features/transactions/services/sync-household-income-projection";
import {
  findThirdPartyFundEntryBySourceTransactionId,
  syncThirdPartyFundEntryInTransaction,
} from "@/features/transactions/services/sync-third-party-fund-entry";
import type { UpdatePersonalTransactionInput } from "@/types/transaction";
import type { ThirdPartyFundConsumption } from "@/types/third-party-funds";
import { readAvailableThirdPartyFunds } from "./read-available-third-party-funds";
import { generateUUID } from "@/lib/utils/uuid";

const toSafeFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    throw new Error("Se encontro un saldo invalido en una cuenta.");
  }
  return parsed;
};

export const updatePersonalTransaction = async (payload: UpdatePersonalTransactionInput): Promise<void> => {
  const db = getFirebaseDb();
  const nextCountsAsRealIncome = payload.type === "income" ? payload.countsAsRealIncome ?? true : true;
  const existingHouseholdProjection =
    payload.type === "income"
      ? await findHouseholdIncomeProjectionBySourceTransactionId(payload.ownerId, payload.transactionId)
      : null;
  const existingThirdPartyEntry =
    payload.type === "income"
      ? await findThirdPartyFundEntryBySourceTransactionId(payload.ownerId, payload.transactionId)
      : null;

  // 1. Pre-lookup third-party fund consumptions if type is expense
  let existingConsumptions: { ref: DocumentReference; id: string; entryId: string; amount: number; ownerId: string }[] = [];
  const consumptionPlan: { entryId: string; amount: number }[] = [];
  let preLookupConsumptions: ThirdPartyFundConsumption[] = [];
  let existingIncomeEntryConsumptions: { ref: DocumentReference; id: string; entryId: string; amount: number; ownerId: string }[] = [];

  if (payload.type === "expense") {
    const consumes = payload.consumesThirdPartyFunds ?? false;
    const consumeAmount = payload.thirdPartyConsumeAmount ?? 0;

    if (consumes) {
      if (!Number.isFinite(consumeAmount) || consumeAmount <= 0) {
        throw new Error("El monto consumido debe ser mayor a cero.");
      }
      if (consumeAmount > payload.amount) {
        throw new Error("El monto consumido no puede superar el monto total del gasto.");
      }
    }

    // Fetch existing consumptions for this transaction
    const snapshot = await getDocs(
      query(
        collection(db, "third_party_fund_consumptions"),
        where("ownerId", "==", payload.ownerId),
        where("consumerExpenseTransactionId", "==", payload.transactionId)
      )
    );
    existingConsumptions = snapshot.docs.map((docItem) => {
      const data = docItem.data();
      return {
        ref: docItem.ref,
        id: docItem.id,
        entryId: String(data.entryId ?? ""),
        amount: Number(data.amount ?? 0),
        ownerId: String(data.ownerId ?? ""),
      };
    });

    // Calculate availability excluding current transaction consumptions
    const { availableFunds, totalAvailable, allConsumptions } = await readAvailableThirdPartyFunds(
      payload.ownerId,
      payload.transactionId
    );
    preLookupConsumptions = allConsumptions;

    if (consumes) {
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
  }

  if (payload.type === "income" && nextCountsAsRealIncome === false) {
    const trackedEntryId = existingThirdPartyEntry?.ref.id ?? payload.transactionId;
    const snapshot = await getDocs(
      query(collection(db, "third_party_fund_consumptions"), where("ownerId", "==", payload.ownerId))
    );
    existingIncomeEntryConsumptions = snapshot.docs
      .map((docItem) => {
        const data = docItem.data();
        return {
          ref: docItem.ref,
          id: docItem.id,
          entryId: String(data.entryId ?? ""),
          amount: Number(data.amount ?? 0),
          ownerId: String(data.ownerId ?? ""),
        };
      })
      .filter((consumption) => consumption.entryId === trackedEntryId);
  }

  // Identificar entries afectadas
  const affectedEntryIds = payload.type === "expense"
    ? Array.from(new Set([...existingConsumptions.map((c) => c.entryId), ...consumptionPlan.map((p) => p.entryId)]))
    : [];

  // Consumos conocidos de otros gastos para las entries afectadas
  const otherKnownConsumptions = payload.type === "expense"
    ? preLookupConsumptions.filter(
        (c) => affectedEntryIds.includes(c.entryId) && c.consumerExpenseTransactionId !== payload.transactionId
      )
    : [];

  await runTransaction(db, async (transaction) => {
    // ==========================================
    // FASE DE LECTURA (Todos los gets al inicio)
    // ==========================================
    
    // 1. Lectura del movimiento
    const movementRef = doc(db, "transactions", payload.transactionId);
    const movementSnap = await transaction.get(movementRef);

    if (!movementSnap.exists()) {
      throw new Error("El movimiento no existe.");
    }
    const movementData = movementSnap.data();
    if (movementData.ownerId !== payload.ownerId) {
      throw new Error("No tienes permiso para editar este movimiento.");
    }
    const previousType = movementData.type;
    if (previousType !== payload.type) {
      throw new Error("No se puede cambiar el tipo de movimiento en esta version.");
    }

    const previousAmount = toSafeFiniteNumber(movementData.amount);
    const previousAccountId = String(movementData.accountId ?? "");
    const previousTargetAccountId = movementData.targetAccountId ? String(movementData.targetAccountId) : null;

    if (!previousAccountId) {
      throw new Error("El movimiento anterior no tiene cuenta valida.");
    }

    // 2. Determinar y leer todas las cuentas afectadas
    const accountIds = new Set<string>();
    accountIds.add(previousAccountId);
    accountIds.add(payload.accountId);
    if (previousTargetAccountId) {
      accountIds.add(previousTargetAccountId);
    }
    if (payload.type === "transfer" && payload.targetAccountId) {
      accountIds.add(payload.targetAccountId);
    }

    const accountSnaps = new Map<string, DocumentData>();
    for (const id of accountIds) {
      const accountRef = doc(db, "accounts", id);
      const snap = await transaction.get(accountRef);
      if (!snap.exists()) {
        throw new Error("Una cuenta asociada al movimiento no existe.");
      }
      const accountData = snap.data();
      if (accountData.ownerId !== payload.ownerId) {
        throw new Error("Solo puedes editar movimientos de cuentas propias.");
      }
      accountSnaps.set(id, accountData);
    }

    // 3. Leer categoria si aplica
    let categorySnap = null;
    if (payload.type === "expense" || payload.type === "income") {
      const categoryRef = doc(db, "categories", payload.categoryId);
      categorySnap = await transaction.get(categoryRef);
    }

    // 4. Resolucion de Household (si es income)
    let activeHouseholdId: string | null = null;
    if (payload.type === "income") {
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
    }

    // 5. Pre-lectura de Ledger Privado para sync (si es income)
    let preReadProjectionSnap = null;
    if (payload.type === "income" && nextCountsAsRealIncome === false) {
      const projectionRef = doc(db, "third_party_fund_entries", payload.transactionId);
      preReadProjectionSnap = await transaction.get(projectionRef);
    }

    // 5.A. Leer/bloquear consumos asociados al entry privado del income (si aplica)
    const incomeEntryConsumptionsSnaps = new Map<string, DocumentData>();
    if (payload.type === "income" && nextCountsAsRealIncome === false) {
      for (const con of existingIncomeEntryConsumptions) {
        const conRef = doc(db, "third_party_fund_consumptions", con.id);
        const conSnap = await transaction.get(conRef);
        if (conSnap.exists()) {
          const conData = conSnap.data();
          if (conData.ownerId !== payload.ownerId) {
            throw new Error("No tienes permiso para leer consumos de este ingreso no real.");
          }
          incomeEntryConsumptionsSnaps.set(con.id, conData);
        }
      }
    }

    // 6. Leer entries afectadas (si es expense)
    const entryDataMap = new Map<string, DocumentData>();
    for (const entryId of affectedEntryIds) {
      if (!entryId) continue;
      const entryRef = doc(db, "third_party_fund_entries", entryId);
      const entrySnap = await transaction.get(entryRef);
      if (!entrySnap.exists()) {
        throw new Error("Una de las entries de dinero no propio no existe.");
      }
      const entryData = entrySnap.data();
      if (entryData.ownerId !== payload.ownerId) {
        throw new Error("No tienes permiso sobre esta entry de dinero no propio.");
      }
      entryDataMap.set(entryId, entryData);
    }

    // 7. Leer/bloquear consumos previos del gasto actual (si es expense)
    const existingConsumptionsSnaps = new Map<string, DocumentData>();
    if (payload.type === "expense") {
      for (const con of existingConsumptions) {
        const conRef = doc(db, "third_party_fund_consumptions", con.id);
        const conSnap = await transaction.get(conRef);
        if (conSnap.exists()) {
          const conData = conSnap.data();
          if (conData.ownerId !== payload.ownerId) {
            throw new Error("No tienes permiso para borrar este consumo.");
          }
          existingConsumptionsSnaps.set(con.id, conData);
        }
      }
    }

    // 8. Leer/bloquear otros consumos de las entries afectadas para concurrencia (si es expense)
    const otherConsumptionsSnaps = new Map<string, DocumentData>();
    if (payload.type === "expense") {
      for (const con of otherKnownConsumptions) {
        const conRef = doc(db, "third_party_fund_consumptions", con.id);
        const conSnap = await transaction.get(conRef);
        if (conSnap.exists()) {
          const conData = conSnap.data();
          otherConsumptionsSnaps.set(con.id, conData);
        }
      }
    }

    // ==========================================
    // FASE DE VALIDACION Y CALCULO
    // ==========================================
    if (payload.amount <= 0) {
      throw new Error("El monto debe ser mayor a cero.");
    }

    if (payload.type === "transfer" && payload.accountId === payload.targetAccountId) {
      throw new Error("La cuenta origen y destino deben ser diferentes.");
    }

    const accountDelta = new Map<string, number>();
    const addDelta = (accountId: string, delta: number) => {
      accountDelta.set(accountId, (accountDelta.get(accountId) ?? 0) + delta);
    };

    if (payload.type === "expense") {
      addDelta(previousAccountId, previousAmount);
      addDelta(payload.accountId, -payload.amount);
    } else if (payload.type === "income") {
      addDelta(previousAccountId, -previousAmount);
      addDelta(payload.accountId, payload.amount);
    } else {
      if (!previousTargetAccountId) {
        throw new Error("La transferencia anterior no tiene cuenta destino valida.");
      }

      addDelta(previousAccountId, previousAmount);
      addDelta(previousTargetAccountId, -previousAmount);
      addDelta(payload.accountId, -payload.amount);
      addDelta(payload.targetAccountId, payload.amount);
    }

    if (categorySnap) {
      if (!categorySnap.exists()) {
        throw new Error("La categoria seleccionada no existe.");
      }
      const categoryData = categorySnap.data();
      if (categoryData.ownerId !== payload.ownerId) {
        throw new Error("No tienes permiso para usar esta categoria.");
      }
      const categoryKind = categoryData.kind ?? categoryData.type;
      if (categoryKind !== payload.type) {
        throw new Error(
          payload.type === "expense"
            ? "La categoria debe ser de tipo gasto."
            : "La categoria debe ser de tipo ingreso."
        );
      }
    }

    let consumedAmountForIncomeGuard = 0;
    if (payload.type === "income" && nextCountsAsRealIncome === false) {
      for (const con of existingIncomeEntryConsumptions) {
        const snapData = incomeEntryConsumptionsSnaps.get(con.id);
        if (snapData) {
          consumedAmountForIncomeGuard += toSafeFiniteNumber(snapData.amount);
        }
      }

      assertOriginalAmountCoversConsumedAmount(payload.amount, consumedAmountForIncomeGuard);
    }

    // ==========================================
    // FASE DE ESCRITURA (Todos los updates/sets después de gets)
    // ==========================================
    
    // 1. Escribir saldos de cuenta
    for (const [accountId, delta] of accountDelta) {
      if (delta === 0) {
        continue;
      }
      const snapshot = accountSnaps.get(accountId);
      if (!snapshot) {
        throw new Error("No se pudo resolver una cuenta para actualizar saldo.");
      }
      const balance = toSafeFiniteNumber(snapshot.currentBalance ?? snapshot.balance);
      const accountRef = doc(db, "accounts", accountId);
      transaction.update(accountRef, {
        currentBalance: balance + delta,
        updatedAt: serverTimestamp(),
      });
    }

    // 2. Gestionar consumos y entries de dinero no propio (si es expense)
    if (payload.type === "expense") {
      // Borrar consumos antiguos
      for (const con of existingConsumptions) {
        const conRef = doc(db, "third_party_fund_consumptions", con.id);
        transaction.delete(conRef);
      }

      // Crear consumos nuevos
      for (const plan of consumptionPlan) {
        const consumptionId = generateUUID();
        const consumptionRef = doc(db, "third_party_fund_consumptions", consumptionId);
        transaction.set(consumptionRef, {
          ownerId: payload.ownerId,
          entryId: plan.entryId,
          consumerExpenseTransactionId: payload.transactionId,
          amount: plan.amount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Re-evaluar y actualizar status de entries afectadas
      for (const entryId of affectedEntryIds) {
        if (!entryId) continue;
        const entryData = entryDataMap.get(entryId);
        if (!entryData || entryData.status === "cancelled") {
          continue;
        }

        // Sumar otros consumos vigentes leídos dentro de la transacción
        let sumOtherConsumptions = 0;
        for (const con of otherKnownConsumptions) {
          if (con.entryId === entryId) {
            const snapData = otherConsumptionsSnaps.get(con.id);
            if (snapData) {
              sumOtherConsumptions += toSafeFiniteNumber(snapData.amount);
            }
          }
        }

        const newAmountForEntry = consumptionPlan.find((p) => p.entryId === entryId)?.amount ?? 0;
        const pendingAfter = entryData.originalAmount - sumOtherConsumptions - newAmountForEntry;

        if (pendingAfter < 0) {
          throw new Error("Inconsistencia: saldo de dinero no propio insuficiente en una de las entries.");
        }

        const nextStatus = pendingAfter <= 0 ? "consumed" : "open";
        const entryRef = doc(db, "third_party_fund_entries", entryId);
        transaction.update(entryRef, {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      }
    }

    const baseUpdate = {
      amount: payload.amount,
      accountId: payload.accountId,
      date: Timestamp.fromDate(payload.date),
      description: payload.description?.trim() ?? "",
      updatedAt: serverTimestamp(),
    };

    if (payload.type === "transfer") {
      transaction.update(movementRef, {
        ...baseUpdate,
        targetAccountId: payload.targetAccountId,
        categoryId: null,
      });
      return;
    }

    transaction.update(movementRef, {
      ...baseUpdate,
      categoryId: payload.categoryId,
      targetAccountId: null,
      ...(payload.type === "income" ? { countsAsRealIncome: nextCountsAsRealIncome } : {}),
    });

    if (payload.type === "income") {
      await syncHouseholdIncomeProjectionInTransaction({
        db,
        transaction,
        ownerId: payload.ownerId,
        sourceTransactionId: payload.transactionId,
        amount: payload.amount,
        entryDate: payload.date,
        description: payload.description,
        shouldProject: nextCountsAsRealIncome,
        existingProjection: existingHouseholdProjection,
        activeHouseholdId,
      });

      await syncThirdPartyFundEntryInTransaction({
        db,
        transaction,
        ownerId: payload.ownerId,
        sourceIncomeTransactionId: payload.transactionId,
        originalAmount: payload.amount,
        shouldTrack: nextCountsAsRealIncome === false,
        existingEntry: existingThirdPartyEntry,
        preReadProjectionSnap,
        consumedAmount: consumedAmountForIncomeGuard,
      });
    }
  });
};
