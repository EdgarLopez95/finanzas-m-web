import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, Timestamp, where, type DocumentReference, type DocumentData } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { assertValidTransactionAmount } from "@/lib/finance/transaction-validation";

import {
  applyExpenseSourceDelta,
  assertExpenseSourceHasEnoughBalance,
  loadExpenseSourceState,
  type ExpenseSourceState,
} from "@/lib/finance/expense-source";
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
import { isTechnicalTransaction } from "./../lib/technical-transactions";

const toSafeFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    throw new Error("Se encontro un saldo invalido en una cuenta.");
  }
  return parsed;
};

const isSameExpenseSource = (
  left: { accountId: string; pocketId: string | null },
  right: { accountId: string; pocketId: string | null },
): boolean => left.accountId === right.accountId && left.pocketId === right.pocketId;

export const updatePersonalTransaction = async (
  payload: UpdatePersonalTransactionInput,
  deps?: {
    getFirebaseDbFn?: typeof getFirebaseDb;
    runTransactionFn?: typeof runTransaction;
    docFn?: typeof doc;
    getDocsFn?: typeof getDocs;
    queryFn?: typeof query;
    collectionFn?: typeof collection;
    whereFn?: typeof where;
    getDocFn?: typeof getDoc;
  }
): Promise<void> => {
  assertValidTransactionAmount(payload.amount);
  const db = deps?.getFirebaseDbFn?.() || getFirebaseDb();
  
  const _getDoc = deps?.getDocFn || getDoc;
  const _doc = deps?.docFn || doc;

  const preMovementSnap = await _getDoc(_doc(db, "transactions", payload.transactionId));
  if (!preMovementSnap.exists()) {
    throw new Error("El movimiento no existe.");
  }
  const preMovementData = preMovementSnap.data();
  const requestedThirdPartyConsumption =
    payload.type === "expense" && payload.consumesThirdPartyFunds === true;
  if (preMovementData.consumesThirdPartyFunds === true || requestedThirdPartyConsumption) {
    throw new Error("No se puede editar un gasto no propio (son inmutables).");
  }
  // G3 — un transfer que movió dinero no propio dejó una operación de
  // ubicación en el ledger OCC; editarlo exigiría reproyectarla (no existe).
  if (preMovementData.movesThirdPartyFunds === true) {
    throw new Error("No se puede editar una transferencia de dinero no propio (son inmutables).");
  }

  const nextCountsAsRealIncome = payload.type === "income" ? payload.countsAsRealIncome ?? true : true;
  const existingHouseholdProjection =
    payload.type === "income"
      ? await findHouseholdIncomeProjectionBySourceTransactionId(payload.ownerId, payload.transactionId)
      : null;
  const existingThirdPartyEntry =
    payload.type === "income"
      ? await findThirdPartyFundEntryBySourceTransactionId(payload.ownerId, payload.transactionId)
      : null;


  let existingIncomeEntryConsumptions: { ref: DocumentReference; id: string; entryId: string; amount: number; ownerId: string }[] = [];

  if (payload.type === "income" && nextCountsAsRealIncome === false) {
    const trackedEntryId = existingThirdPartyEntry?.ref.id ?? payload.transactionId;
    
    if (trackedEntryId) {
      const _getDocs = deps?.getDocsFn || getDocs;
      const _query = deps?.queryFn || query;
      const _collection = deps?.collectionFn || collection;
      const _where = deps?.whereFn || where;

      // We must revert ALL consumptions mapped to this third_party_fund_entries
      const snapshot = await _getDocs(
        _query(_collection(db, "third_party_fund_consumptions"), _where("ownerId", "==", payload.ownerId))
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
  }

  // --- TRANSACTION START ---
  const _runTransaction = deps?.runTransactionFn || runTransaction;

  return await _runTransaction(db, async (transaction) => {
    // ==========================================
    // FASE DE LECTURA (Todos los gets al inicio)
    // ==========================================
    
    // 1. Lectura del movimiento
    const movementRef = _doc(db, "transactions", payload.transactionId);
    const movementSnap = await transaction.get(movementRef);

    if (!movementSnap.exists()) {
      throw new Error("El movimiento no existe.");
    }
    const movementData = movementSnap.data();
    if (movementData.ownerId !== payload.ownerId) {
      throw new Error("No tienes permiso para editar este movimiento.");
    }

    if (isTechnicalTransaction(movementData.title)) {
      throw new Error("No puedes editar un movimiento técnico.");
    }
    const previousType = movementData.type;
    if (previousType !== payload.type) {
      throw new Error("No se puede cambiar el tipo de movimiento en esta version.");
    }
    if (movementData.consumesThirdPartyFunds === true) {
      throw new Error("No se puede editar un gasto no propio (son inmutables).");
    }

    // G3 — mismo chequeo con el doc releído dentro de la transacción.
    if (movementData.movesThirdPartyFunds === true) {
      throw new Error("No se puede editar una transferencia de dinero no propio (son inmutables).");
    }

    const previousAmount = toSafeFiniteNumber(movementData.amount);
    const previousAccountId = String(movementData.accountId ?? "");
    const previousTargetAccountId = movementData.targetAccountId ? String(movementData.targetAccountId) : null;
    const previousPocketId = movementData.pocketId ? String(movementData.pocketId) : null;

    if (!previousAccountId) {
      throw new Error("El movimiento anterior no tiene cuenta valida.");
    }

    // 2. Determinar y leer todas las cuentas afectadas
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
        throw new Error("Solo puedes editar movimientos de cuentas propias.");
      }
      accountSnaps.set(id, accountData);
    };
    await loadAccountState(previousAccountId);
    await loadAccountState(payload.accountId);
    if (previousTargetAccountId) {
      await loadAccountState(previousTargetAccountId);
    }
    if (payload.type === "transfer" && payload.targetAccountId) {
      await loadAccountState(payload.targetAccountId);
    }

    // 3. Leer categoria si aplica
    let categorySnap = null;
    if (payload.type === "expense" || payload.type === "income") {
      const categoryRef = _doc(db, "categories", payload.categoryId);
      categorySnap = await transaction.get(categoryRef);
    }

    // 4. Resolucion de Household (si es income)
    let activeHouseholdId: string | null = null;
    if (payload.type === "income") {
      const userRef = _doc(db, "users", payload.ownerId);
      const userSnap = await transaction.get(userRef);
      if (userSnap.exists()) {
        const activeHouseholdIdRaw = typeof userSnap.data().activeHouseholdId === "string"
          ? userSnap.data().activeHouseholdId.trim()
          : "";
        if (activeHouseholdIdRaw) {
          const householdRef = _doc(db, "households", activeHouseholdIdRaw);
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
      const projectionRef = _doc(db, "third_party_fund_entries", payload.transactionId);
      preReadProjectionSnap = await transaction.get(projectionRef);
    }

    // 5.A. Leer/bloquear consumos asociados al entry privado del income (si aplica)
    const incomeEntryConsumptionsSnaps = new Map<string, DocumentData>();
    if (payload.type === "income" && nextCountsAsRealIncome === false) {
      for (const con of existingIncomeEntryConsumptions) {
        const conRef = _doc(db, "third_party_fund_consumptions", con.id);
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



    // ==========================================
    // FASE DE VALIDACION Y CALCULO
    // ==========================================
    if (payload.type === "transfer" && payload.accountId === payload.targetAccountId && (payload.pocketId ?? null) === (payload.targetPocketId ?? null)) {

      throw new Error("El origen y destino de la transferencia no pueden ser idénticos.");
    }

    const accountDelta = new Map<string, number>();
    const addDelta = (accountId: string, delta: number) => {
      accountDelta.set(accountId, (accountDelta.get(accountId) ?? 0) + delta);
    };

    let previousExpenseSource = null;
    let nextExpenseSource = null;
    let containerDeltas: Map<string, { state: ExpenseSourceState; delta: number }> | null = null;

    if (payload.type === "expense") {
      previousExpenseSource = await loadExpenseSourceState({
        accountId: previousAccountId,
        db,
        ownerId: payload.ownerId,
        pocketId: previousPocketId,
        transaction,
      });
      nextExpenseSource = await loadExpenseSourceState({
        accountId: payload.accountId,
        db,
        ownerId: payload.ownerId,
        pocketId: payload.pocketId,
        transaction,
      });
      const nextSourceForValidation = isSameExpenseSource(previousExpenseSource, nextExpenseSource)
        ? {
            ...nextExpenseSource,
            availableBalance: nextExpenseSource.availableBalance + previousAmount,
          }
        : nextExpenseSource;
      assertExpenseSourceHasEnoughBalance(nextSourceForValidation, payload.amount);
    } else if (payload.type === "income") {
      // WA-PER-001: si hay bolsillo (antes o después), el ingreso se mueve por contenedor
      // (bolsillo/disponible) usando expense-source; si no, se mantiene el ajuste por cuenta.
      const incomeNextPocketId = payload.pocketId ?? null;
      if (previousPocketId || incomeNextPocketId) {
        previousExpenseSource = await loadExpenseSourceState({
          accountId: previousAccountId,
          db,
          ownerId: payload.ownerId,
          pocketId: previousPocketId,
          transaction,
        });
        nextExpenseSource = await loadExpenseSourceState({
          accountId: payload.accountId,
          db,
          ownerId: payload.ownerId,
          pocketId: incomeNextPocketId,
          transaction,
        });
      } else {
        addDelta(previousAccountId, -previousAmount);
        addDelta(payload.accountId, payload.amount);
      }
    } else {
      const prevSource = await loadExpenseSourceState({
        accountId: previousAccountId,
        db,
        ownerId: payload.ownerId,
        pocketId: previousPocketId,
        transaction,
      });

      const previousTargetPocketId = movementData.targetPocketId ? String(movementData.targetPocketId) : null;
      const prevTarget = previousTargetAccountId
        ? await loadExpenseSourceState({
            accountId: previousTargetAccountId,
            db,
            ownerId: payload.ownerId,
            pocketId: previousTargetPocketId,
            transaction,
          })
        : null;

      const nextSource = await loadExpenseSourceState({
        accountId: payload.accountId,
        db,
        ownerId: payload.ownerId,
        pocketId: payload.pocketId,
        transaction,
      });

      const nextTarget = payload.targetAccountId
        ? await loadExpenseSourceState({
            accountId: payload.targetAccountId,
            db,
            ownerId: payload.ownerId,
            pocketId: payload.targetPocketId,
            transaction,
          })
        : null;

      containerDeltas = new Map<string, { state: ExpenseSourceState; delta: number }>();

      const addContainerDelta = (state: ExpenseSourceState, amountVal: number) => {
        const key = `${state.accountId}:${state.pocketId || "available"}`;
        const existing = containerDeltas!.get(key);
        if (existing) {
          existing.delta += amountVal;
        } else {
          containerDeltas!.set(key, { state, delta: amountVal });
        }
      };

      // 1. Revert previous transfer
      addContainerDelta(prevSource, previousAmount);
      if (prevTarget) {
        addContainerDelta(prevTarget, -previousAmount);
      }

      // 2. Apply new transfer
      addContainerDelta(nextSource, -payload.amount);
      if (nextTarget) {
        addContainerDelta(nextTarget, payload.amount);
      }

      // 3. Validate new balances won't go negative
      for (const [, item] of containerDeltas) {
        const finalBalance = item.state.availableBalance + item.delta;
        if (finalBalance < 0) {
          throw new Error(
            item.state.pocketId
              ? `Saldo insuficiente en el bolsillo "${item.state.pocketData?.name || item.state.pocketId}".`
              : `Saldo disponible insuficiente en la cuenta "${item.state.accountData?.name || item.state.accountId}".`
          );
        }
      }
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

    if (payload.type === "expense" && previousExpenseSource && nextExpenseSource) {
      if (isSameExpenseSource(previousExpenseSource, nextExpenseSource)) {
        const netDelta = previousAmount - payload.amount;
        applyExpenseSourceDelta({
          amountDelta: netDelta,
          source: nextExpenseSource,
          transaction,
        });
      } else {
        // Revert previous source
        applyExpenseSourceDelta({
          amountDelta: previousAmount,
          source: previousExpenseSource,
          transaction,
        });
        // Apply new source
        applyExpenseSourceDelta({
          amountDelta: -payload.amount,
          source: nextExpenseSource,
          transaction,
        });
      }
    } else if (payload.type === "income" && previousExpenseSource && nextExpenseSource) {
      // Ingreso con bolsillo: revertir suma previa y aplicar la nueva en el contenedor correcto.
      if (isSameExpenseSource(previousExpenseSource, nextExpenseSource)) {
        applyExpenseSourceDelta({
          amountDelta: payload.amount - previousAmount,
          source: nextExpenseSource,
          transaction,
        });
      } else {
        applyExpenseSourceDelta({
          amountDelta: -previousAmount,
          source: previousExpenseSource,
          transaction,
        });
        applyExpenseSourceDelta({
          amountDelta: payload.amount,
          source: nextExpenseSource,
          transaction,
        });
      }
    } else if (payload.type === "transfer" && containerDeltas) {
      for (const [, item] of containerDeltas) {
        if (item.delta === 0) continue;
        if (item.state.pocketId && item.state.refs.pocketRef) {
          transaction.update(item.state.refs.pocketRef, {
            balance: item.state.availableBalance + item.delta,
            updatedAt: serverTimestamp(),
          });
        } else {
          transaction.update(item.state.refs.accountRef, {
            currentBalance: item.state.availableBalance + item.delta,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } else {
      for (const [accountId, delta] of accountDelta) {
        if (delta === 0) {
          continue;
        }
        const snapshot = accountSnaps.get(accountId);
        if (!snapshot) {
          throw new Error("No se pudo resolver una cuenta para actualizar saldo.");
        }
        const balance = toSafeFiniteNumber(snapshot.currentBalance ?? snapshot.balance);
        const accountRef = _doc(db, "accounts", accountId);
        transaction.update(accountRef, {
          currentBalance: balance + delta,
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
        pocketId: payload.pocketId ?? null,
        targetAccountId: payload.targetAccountId,
        targetPocketId: payload.targetPocketId ?? null,
        categoryId: null,
      });
      return;
    }

    transaction.update(movementRef, {
      ...baseUpdate,
      categoryId: payload.categoryId,
      pocketId: payload.type === "expense" || payload.type === "income" ? payload.pocketId ?? null : null,
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
