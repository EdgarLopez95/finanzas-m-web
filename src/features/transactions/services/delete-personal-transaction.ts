import { doc, runTransaction, serverTimestamp, type DocumentData } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  findHouseholdIncomeProjectionBySourceTransactionId,
  syncHouseholdIncomeProjectionInTransaction,
} from "@/features/transactions/services/sync-household-income-projection";
import {
  findThirdPartyFundEntryBySourceTransactionId,
  syncThirdPartyFundEntryInTransaction,
} from "@/features/transactions/services/sync-third-party-fund-entry";
import { readAvailableThirdPartyFunds } from "./read-available-third-party-funds";

type DeletePersonalTransactionInput = {
  ownerId: string;
  transactionId: string;
};

const toSafeFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    throw new Error("Se encontro un saldo invalido en una cuenta.");
  }
  return parsed;
};

export const deletePersonalTransaction = async (payload: DeletePersonalTransactionInput): Promise<void> => {
  const db = getFirebaseDb();
  const existingHouseholdProjection = await findHouseholdIncomeProjectionBySourceTransactionId(
    payload.ownerId,
    payload.transactionId
  );
  const existingThirdPartyEntry = await findThirdPartyFundEntryBySourceTransactionId(
    payload.ownerId,
    payload.transactionId
  );

  // 1. Pre-lookup consumptions for this transaction using readAvailableThirdPartyFunds
  const { allConsumptions } = await readAvailableThirdPartyFunds(payload.ownerId, payload.transactionId);
  const existingConsumptions = allConsumptions.filter(
    (c) => c.consumerExpenseTransactionId === payload.transactionId
  );

  const affectedEntryIds = Array.from(new Set(existingConsumptions.map((c) => c.entryId)));
  
  // Consumos conocidos de otros gastos para las entries afectadas
  const otherKnownConsumptions = allConsumptions.filter(
    (c) => affectedEntryIds.includes(c.entryId) && c.consumerExpenseTransactionId !== payload.transactionId
  );

  await runTransaction(db, async (transaction) => {
    // ==========================================
    // FASE DE LECTURA (Todos los gets al inicio)
    // ==========================================
    
    // 1. Lectura del movimiento a borrar
    const movementRef = doc(db, "transactions", payload.transactionId);
    const movementSnap = await transaction.get(movementRef);

    if (!movementSnap.exists()) {
      throw new Error("El movimiento no existe.");
    }

    const movementData = movementSnap.data();
    if (movementData.ownerId !== payload.ownerId) {
      throw new Error("No tienes permiso para eliminar este movimiento.");
    }

    const type = String(movementData.type ?? "");
    const countsAsRealIncome = type === "income" ? movementData.countsAsRealIncome !== false : true;
    const amount = toSafeFiniteNumber(movementData.amount);
    const accountId = String(movementData.accountId ?? "");
    const targetAccountId = movementData.targetAccountId ? String(movementData.targetAccountId) : null;

    if (!accountId) {
      throw new Error("El movimiento no tiene cuenta valida.");
    }

    // 2. Resolver y leer cuentas afectadas
    const accountIds = new Set<string>();
    accountIds.add(accountId);
    if (type === "transfer" && targetAccountId) {
      accountIds.add(targetAccountId);
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
        throw new Error("Solo puedes eliminar movimientos de cuentas propias.");
      }
      accountSnaps.set(id, accountData);
    }

    // 3. Resolver y leer entries y consumos afectados si es un gasto con consumos
    const entrySnaps = new Map<string, DocumentData>();
    for (const entryId of affectedEntryIds) {
      if (!entryId) continue;
      const entryRef = doc(db, "third_party_fund_entries", entryId);
      const snap = await transaction.get(entryRef);
      if (!snap.exists()) {
        throw new Error("Una de las entries de dinero no propio no existe.");
      }
      const entryData = snap.data();
      if (entryData.ownerId !== payload.ownerId) {
        throw new Error("No tienes permiso sobre esta entry de dinero no propio.");
      }
      entrySnaps.set(entryId, entryData);
    }

    // 4. Lectura/bloqueo de consumos del gasto actual
    const existingConsumptionsSnaps = new Map<string, DocumentData>();
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

    // 5. Lectura/bloqueo de consumos de otros gastos asociados a las entries afectadas (para concurrencia)
    const otherConsumptionsSnaps = new Map<string, DocumentData>();
    for (const con of otherKnownConsumptions) {
      const conRef = doc(db, "third_party_fund_consumptions", con.id);
      const conSnap = await transaction.get(conRef);
      if (conSnap.exists()) {
        const conData = conSnap.data();
        otherConsumptionsSnaps.set(con.id, conData);
      }
    }

    // ==========================================
    // FASE DE VALIDACION Y CALCULO
    // ==========================================
    const accountDelta = new Map<string, number>();
    const addDelta = (id: string, delta: number) => {
      accountDelta.set(id, (accountDelta.get(id) ?? 0) + delta);
    };

    if (type === "expense") {
      addDelta(accountId, amount);
    } else if (type === "income") {
      addDelta(accountId, -amount);
    } else if (type === "transfer") {
      if (!targetAccountId) {
        throw new Error("La transferencia no tiene cuenta destino valida.");
      }
      addDelta(accountId, amount);
      addDelta(targetAccountId, -amount);
    } else {
      throw new Error("Este tipo de movimiento no se puede eliminar en WEB-V4B.");
    }

    // ==========================================
    // FASE DE ESCRITURA (Todos los updates/sets/deletes después de gets)
    // ==========================================
    
    // 1. Escribir saldos de cuenta
    for (const [id, delta] of accountDelta) {
      if (delta === 0) continue;
      const accountData = accountSnaps.get(id);
      if (!accountData) {
        throw new Error("No se pudo resolver una cuenta para actualizar saldo.");
      }
      const balance = toSafeFiniteNumber(accountData.currentBalance ?? accountData.balance);
      const accountRef = doc(db, "accounts", id);
      transaction.update(accountRef, {
        currentBalance: balance + delta,
        updatedAt: serverTimestamp(),
      });
    }

    // 2. Eliminar consumos y revertir status de entries
    if (type === "expense" && existingConsumptions.length > 0) {
      // Eliminar consumos
      for (const con of existingConsumptions) {
        const conRef = doc(db, "third_party_fund_consumptions", con.id);
        transaction.delete(conRef);
      }

      // Revertir status
      for (const entryId of affectedEntryIds) {
        if (!entryId) continue;
        const entryData = entrySnaps.get(entryId);
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

        const pendingAfter = entryData.originalAmount - sumOtherConsumptions;

        if (pendingAfter < 0) {
          throw new Error("Inconsistencia: saldo de dinero no propio insuficiente al revertir consumos.");
        }

        const nextStatus = pendingAfter <= 0 ? "consumed" : "open";
        const entryRef = doc(db, "third_party_fund_entries", entryId);
        transaction.update(entryRef, {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      }
    }

    // 3. Sync helpers (solo modifican status a cancelled, no hacen gets)
    if (type === "income" && existingHouseholdProjection) {
      await syncHouseholdIncomeProjectionInTransaction({
        db,
        transaction,
        ownerId: payload.ownerId,
        sourceTransactionId: payload.transactionId,
        amount,
        entryDate: new Date(),
        shouldProject: false,
        existingProjection: existingHouseholdProjection,
        activeHouseholdId: null,
      });
    }

    if (type === "income" && countsAsRealIncome === false) {
      await syncThirdPartyFundEntryInTransaction({
        db,
        transaction,
        ownerId: payload.ownerId,
        sourceIncomeTransactionId: payload.transactionId,
        originalAmount: amount,
        shouldTrack: false,
        existingEntry: existingThirdPartyEntry,
        preReadProjectionSnap: null,
      });
    }

    // 4. Borrar movimiento
    transaction.delete(movementRef);
  });
};
