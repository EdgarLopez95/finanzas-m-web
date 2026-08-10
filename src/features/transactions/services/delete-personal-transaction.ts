import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  applyExpenseSourceDelta,
  loadExpenseSourceState,
} from "@/lib/finance/expense-source";
import { splitConsumptionsForExpenseTransaction } from "@/lib/finance/third-party-funds";
import { toDateOrNull, toSafeNumber, toSafeString } from "@/lib/firebase/firestore-parsers";
import { resolveShareRevertStatusOnTransactionDelete } from "@/features/household/lib/household-debt-lifecycle";
import {
  findHouseholdIncomeProjectionBySourceTransactionId,
  syncHouseholdIncomeProjectionInTransaction,
} from "@/features/transactions/services/sync-household-income-projection";
import {
  findThirdPartyFundEntryBySourceTransactionId,
  syncThirdPartyFundEntryInTransaction,
} from "@/features/transactions/services/sync-third-party-fund-entry";
import type { ThirdPartyFundConsumption } from "@/types/third-party-funds";


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

export const deletePersonalTransaction = async (
  payload: DeletePersonalTransactionInput,
  deps?: {
    getFirebaseDbFn?: typeof getFirebaseDb;
    runTransactionFn?: typeof runTransaction;
    docFn?: typeof doc;
    getDocsFn?: typeof getDocs;
    getDocFn?: typeof getDoc;
    queryFn?: typeof query;
    collectionFn?: typeof collection;
    whereFn?: typeof where;
    findHouseholdIncomeProjectionFn?: typeof findHouseholdIncomeProjectionBySourceTransactionId;
    findThirdPartyFundEntryFn?: typeof findThirdPartyFundEntryBySourceTransactionId;
  }
): Promise<void> => {
  const db = deps?.getFirebaseDbFn?.() || getFirebaseDb();
  
  const _getDoc = deps?.getDocFn || getDoc;
  const _doc = deps?.docFn || doc;

  const preMovementSnap = await _getDoc(_doc(db, "transactions", payload.transactionId));
  if (!preMovementSnap.exists()) {
    throw new Error("El movimiento no existe.");
  }
  const preMovementData = preMovementSnap.data();
  if (preMovementData.consumesThirdPartyFunds === true) {
    throw new Error("No puedes eliminar un gasto no propio (son inmutables).");
  }
  // G3 — un transfer que movió dinero no propio dejó una operación de
  // ubicación en el ledger OCC; borrarlo exigiría revertirla (no existe).
  if (preMovementData.movesThirdPartyFunds === true) {
    throw new Error("No puedes eliminar una transferencia de dinero no propio (son inmutables).");
  }

  const _findHousehold = deps?.findHouseholdIncomeProjectionFn || findHouseholdIncomeProjectionBySourceTransactionId;
  const _findThirdParty = deps?.findThirdPartyFundEntryFn || findThirdPartyFundEntryBySourceTransactionId;

  const existingHouseholdProjection = await _findHousehold(
    payload.ownerId,
    payload.transactionId
  );
  const existingThirdPartyEntry = await _findThirdParty(
    payload.ownerId,
    payload.transactionId
  );

  const _getDocs = deps?.getDocsFn || getDocs;
  const _query = deps?.queryFn || query;
  const _collection = deps?.collectionFn || collection;
  const _where = deps?.whereFn || where;

  // Pre-lookup dedicado para delete: leer los consumos reales del owner sin pasar
  // por el helper de disponibilidad, que existe para calculo de pendingAmount.
  const allConsumptionsSnapshot = await _getDocs(
    _query(_collection(db, "third_party_fund_consumptions"), _where("ownerId", "==", payload.ownerId))
  );
  const allConsumptions: ThirdPartyFundConsumption[] = allConsumptionsSnapshot.docs.map((docItem) => {
    const data = docItem.data();
    return {
      id: docItem.id,
      ownerId: toSafeString(data.ownerId),
      entryId: toSafeString(data.entryId),
      consumerExpenseTransactionId: toSafeString(data.consumerExpenseTransactionId),
      amount: toSafeNumber(data.amount),
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  });
  const { existingConsumptions, otherKnownConsumptions, affectedEntryIds } =
    splitConsumptionsForExpenseTransaction(allConsumptions, payload.transactionId);

  // WA-HOG-002: si esta tx completó una responsabilidad de Hogar (share) o declaró/confirmó una
  // deuda, al borrarla hay que revertir el artefacto vinculado. La cascada de cuentas/bolsillos ya
  // lo hace (delete-personal-entity-cascade.ts); aquí lo replicamos para el borrado individual.
  // Solo consultamos household_* si la tx referencia un evento/deuda, para no penalizar borrados normales.
  let linkedSharesToRevert: { id: string; ref: DocumentReference; eventId: string }[] = [];
  let linkedDebtsToRevert: {
    id: string;
    ref: DocumentReference;
    outgoingTransactionId: string | null;
    incomingTransactionId: string | null;
  }[] = [];
  const hasHouseholdLink = Boolean(
    preMovementData && (preMovementData.relatedEventId || preMovementData.relatedDebtId)
  );

  if (hasHouseholdLink) {
    const userSnap = await _getDoc(_doc(db, "users", payload.ownerId));
    const activeHouseholdId = userSnap.exists() ? toSafeString(userSnap.data()?.activeHouseholdId) : "";

    if (activeHouseholdId) {
      // Se consulta por householdId (única forma permitida por las rules) y se filtra en memoria
      // por la referencia a esta transacción, evitando índices compuestos adicionales.
      const [sharesSnap, debtsSnap] = await Promise.all([
        getDocs(query(collection(db, "household_event_shares"), where("householdId", "==", activeHouseholdId))),
        getDocs(query(collection(db, "household_debts"), where("householdId", "==", activeHouseholdId))),
      ]);

      linkedSharesToRevert = sharesSnap.docs
        .filter((docItem) => toSafeString(docItem.data().completedByTransactionId) === payload.transactionId)
        .map((docItem) => ({ id: docItem.id, ref: docItem.ref, eventId: toSafeString(docItem.data().eventId) }));

      linkedDebtsToRevert = debtsSnap.docs
        .filter((docItem) => {
          const data = docItem.data();
          return (
            toSafeString(data.outgoingTransactionId) === payload.transactionId ||
            toSafeString(data.incomingTransactionId) === payload.transactionId
          );
        })
        .map((docItem) => {
          const data = docItem.data();
          return {
            id: docItem.id,
            ref: docItem.ref,
            outgoingTransactionId: toSafeString(data.outgoingTransactionId) || null,
            incomingTransactionId: toSafeString(data.incomingTransactionId) || null,
          };
        });
    }
  }

  const _runTransaction = deps?.runTransactionFn || runTransaction;

  await _runTransaction(db, async (transaction) => {
    // ==========================================
    // FASE DE LECTURA (Todos los gets al inicio)
    // ==========================================
    
    // 1. Lectura del movimiento a borrar
    const movementRef = _doc(db, "transactions", payload.transactionId);
    const movementSnap = await transaction.get(movementRef);

    if (!movementSnap.exists()) {
      throw new Error("El movimiento no existe.");
    }

    const movementData = movementSnap.data();
    if (movementData.ownerId !== payload.ownerId) {
      throw new Error("No tienes permiso para eliminar este movimiento.");
    }


    const type = String(movementData.type ?? "");
    const consumesThirdPartyFunds = movementData.consumesThirdPartyFunds === true;

    if (consumesThirdPartyFunds) {
      throw new Error("No puedes eliminar un gasto no propio (son inmutables).");
    }

    // G3 — mismo chequeo con el doc releído dentro de la transacción.
    if (movementData.movesThirdPartyFunds === true) {
      throw new Error("No puedes eliminar una transferencia de dinero no propio (son inmutables).");
    }

    const countsAsRealIncome = type === "income" ? movementData.countsAsRealIncome !== false : true;
    const amount = toSafeFiniteNumber(movementData.amount);
    const accountId = String(movementData.accountId ?? "");
    const targetAccountId = movementData.targetAccountId ? String(movementData.targetAccountId) : null;
    const pocketId = movementData.pocketId ? String(movementData.pocketId) : null;
    const targetPocketId = movementData.targetPocketId ? String(movementData.targetPocketId) : null;

    if (!accountId) {
      throw new Error("El movimiento no tiene cuenta valida.");
    }

    // 2. Resolver y leer cuentas afectadas
    const accountIds = new Set<string>();
    const accountSnaps = new Map<string, DocumentData>();
    const loadAccountState = async (id: string) => {
      if (accountIds.has(id)) {
        return;
      }
      accountIds.add(id);
      const accountRef = _doc(db, "accounts", id);
      const snap = await transaction.get(accountRef);
      if (!snap.exists()) {
        throw new Error("Una cuenta asociada al movimiento no existe.");
      }
      const accountData = snap.data();
      if (accountData.ownerId !== payload.ownerId) {
        throw new Error("Solo puedes eliminar movimientos de cuentas propias.");
      }
      accountSnaps.set(id, accountData);
    };
    await loadAccountState(accountId);
    if (type === "transfer" && targetAccountId) {
      await loadAccountState(targetAccountId);
    }

    // 3. Resolver y leer entries y consumos afectados si es un gasto con consumos
    const entrySnaps = new Map<string, DocumentData>();
    for (const entryId of affectedEntryIds) {
      if (!entryId) continue;
      const entryRef = _doc(db, "third_party_fund_entries", entryId);
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
      const conRef = _doc(db, "third_party_fund_consumptions", con.id);
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
      const conRef = _doc(db, "third_party_fund_consumptions", con.id);
      const conSnap = await transaction.get(conRef);
      if (conSnap.exists()) {
        const conData = conSnap.data();
        otherConsumptionsSnaps.set(con.id, conData);
      }
    }

    // 6. Lectura/bloqueo de shares y deudas de Hogar vinculadas a esta tx (WA-HOG-002)
    for (const share of linkedSharesToRevert) {
      await transaction.get(share.ref);
    }
    for (const debt of linkedDebtsToRevert) {
      await transaction.get(debt.ref);
    }

    // 6b. Leer el status del evento padre de cada share a revertir: paridad Android
    // (HouseholdEventRepository.kt:707-735) exige saber si el evento sigue activo o ya
    // fue cancelado para decidir a qué status vuelve el share (WA-HOG-002).
    const parentEventStatusByEventId = new Map<string, string>();
    for (const share of linkedSharesToRevert) {
      if (!share.eventId || parentEventStatusByEventId.has(share.eventId)) continue;
      const eventSnap = await transaction.get(_doc(db, "household_events", share.eventId));
      parentEventStatusByEventId.set(share.eventId, eventSnap.exists() ? toSafeString(eventSnap.data()?.status) : "active");
    }

    // ==========================================
    // FASE DE VALIDACION Y CALCULO
    // ==========================================
    const accountDelta = new Map<string, number>();
    const addDelta = (id: string, delta: number) => {
      accountDelta.set(id, (accountDelta.get(id) ?? 0) + delta);
    };
    let previousExpenseSource = null;
    let targetExpenseSource = null;

    if (type === "expense") {
      previousExpenseSource = await loadExpenseSourceState({
        accountId,
        db,
        ownerId: payload.ownerId,
        pocketId,
        transaction,
      });
    } else if (type === "income") {
      // WA-PER-001: si el ingreso fue a un bolsillo, revertir el bolsillo; si no, la cuenta.
      if (pocketId) {
        previousExpenseSource = await loadExpenseSourceState({
          accountId,
          db,
          ownerId: payload.ownerId,
          pocketId,
          transaction,
        });
      } else {
        addDelta(accountId, -amount);
      }
    } else if (type === "transfer") {
      if (!targetAccountId) {
        throw new Error("La transferencia no tiene cuenta destino valida.");
      }
      previousExpenseSource = await loadExpenseSourceState({
        accountId,
        db,
        ownerId: payload.ownerId,
        pocketId,
        transaction,
      });
      targetExpenseSource = await loadExpenseSourceState({
        accountId: targetAccountId,
        db,
        ownerId: payload.ownerId,
        pocketId: targetPocketId,
        transaction,
      });
      if (targetExpenseSource.availableBalance < amount) {
        throw new Error(
          targetExpenseSource.pocketId
            ? `Saldo insuficiente en el bolsillo destino "${targetExpenseSource.pocketData?.name || targetExpenseSource.pocketId}" para revertir la transferencia.`
            : `Saldo disponible insuficiente en la cuenta destino "${targetExpenseSource.accountData?.name || targetExpenseSource.accountId}" para revertir la transferencia.`
        );
      }
    } else {
      throw new Error("Este tipo de movimiento no se puede eliminar en WEB-V4B.");
    }

    // ==========================================
    // FASE DE ESCRITURA (Todos los updates/sets/deletes después de gets)
    // ==========================================
    
    // 1. Escribir saldos de cuenta
    if (type === "expense" && previousExpenseSource) {
      applyExpenseSourceDelta({
        amountDelta: amount,
        source: previousExpenseSource,
        transaction,
      });
    } else if (type === "income" && previousExpenseSource) {
      // Revertir el ingreso que había sumado al bolsillo.
      applyExpenseSourceDelta({
        amountDelta: -amount,
        source: previousExpenseSource,
        transaction,
      });
    } else if (type === "transfer" && previousExpenseSource && targetExpenseSource) {
      applyExpenseSourceDelta({
        amountDelta: amount,
        source: previousExpenseSource,
        transaction,
      });
      applyExpenseSourceDelta({
        amountDelta: -amount,
        source: targetExpenseSource,
        transaction,
      });
    } else {
      for (const [id, delta] of accountDelta) {
        if (delta === 0) continue;
        const accountData = accountSnaps.get(id);
        if (!accountData) {
          throw new Error("No se pudo resolver una cuenta para actualizar saldo.");
        }
        const balance = toSafeFiniteNumber(accountData.currentBalance ?? accountData.balance);
        const accountRef = _doc(db, "accounts", id);
        transaction.update(accountRef, {
          currentBalance: balance + delta,
          updatedAt: serverTimestamp(),
        });
      }
    }

    // 2. Eliminar consumos y revertir status de entries
    if (type === "expense" && existingConsumptions.length > 0) {
      // Eliminar consumos
      for (const con of existingConsumptions) {
        const conRef = _doc(db, "third_party_fund_consumptions", con.id);
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
        const entryRef = _doc(db, "third_party_fund_entries", entryId);
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

    // 4. Revertir artefactos de Hogar vinculados a esta tx (WA-HOG-002)
    // Shares completadas por esta tx → pending_completion si el evento padre sigue activo,
    // o cancelled si el evento padre ya fue cancelado (paridad Android, decisión 1 de rules).
    for (const share of linkedSharesToRevert) {
      const parentStatus = parentEventStatusByEventId.get(share.eventId) ?? "active";
      transaction.update(share.ref, {
        completedByTransactionId: null,
        completedAt: null,
        status: resolveShareRevertStatusOnTransactionDelete(parentStatus),
        updatedAt: serverTimestamp(),
      });
    }

    // Deudas pagadas/declaradas por esta tx → se desvincula la referencia y se recalcula el estado.
    for (const debt of linkedDebtsToRevert) {
      const updateData: DocumentData = { updatedAt: serverTimestamp() };
      let nextOutgoing = debt.outgoingTransactionId;
      let nextIncoming = debt.incomingTransactionId;

      if (debt.outgoingTransactionId === payload.transactionId) {
        updateData.outgoingTransactionId = null;
        nextOutgoing = null;
      }
      if (debt.incomingTransactionId === payload.transactionId) {
        updateData.incomingTransactionId = null;
        nextIncoming = null;
      }

      if (!nextOutgoing && !nextIncoming) {
        updateData.status = "pending";
      } else if (nextOutgoing && !nextIncoming) {
        updateData.status = "payment_declared";
      } else {
        updateData.status = "pending";
      }

      transaction.update(debt.ref, updateData);
    }

    // 5. Borrar movimiento
    transaction.delete(movementRef);
  });
};
