import { collection, doc, runTransaction, serverTimestamp, Timestamp, Transaction } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  applyExpenseSourceDelta,
  assertExpenseSourceHasEnoughBalance,
  loadExpenseSourceState,
} from "@/lib/finance/expense-source";
import { assertValidTransactionAmount } from "@/lib/finance/transaction-validation";
import { assertSufficientOwnFunds } from "@/lib/finance/own-funds-gate";
import type { CreateExpenseInput } from "@/types/transaction";
import { readThirdPartyLocationSnapshot } from "./read-third-party-location-snapshot";
import { projectThirdPartyHeldAtLocation } from "@/lib/finance/third-party-location";

export const createPersonalExpense = async (
  payload: CreateExpenseInput,
  deps?: {
    getFirebaseDbFn?: typeof getFirebaseDb;
    docFn?: typeof doc;
    collectionFn?: typeof collection;
    getDocFn?: typeof import("firebase/firestore").getDoc;
    runTransactionFn?: typeof runTransaction;
    getDocsFn?: typeof import("firebase/firestore").getDocs;
    queryFn?: typeof import("firebase/firestore").query;
    whereFn?: typeof import("firebase/firestore").where;
  }
): Promise<void> => {
  assertValidTransactionAmount(payload.amount);
  const db = deps?.getFirebaseDbFn?.() || getFirebaseDb();

  // Enrutador OCC: Si consume terceros, delega al orquestador OCC atómico.
  if (payload.consumesThirdPartyFunds) {
    const { createPersonalExpenseOcc } = await import("./create-personal-expense-occ");
    const _doc = deps?.docFn || doc;
    const _collection = deps?.collectionFn || collection;
    const operationId = _doc(_collection(db, "transactions")).id;
    return createPersonalExpenseOcc({
      ownerId: payload.ownerId,
      operationId,
      amount: payload.amount,
      accountId: payload.accountId,
      pocketId: payload.pocketId ?? null,
      categoryId: payload.categoryId,
      date: payload.date,
      description: payload.description,
    }, deps);
  }

  // 1. Asegurar el ledger OCC antes de iniciar el gasto propio (P0-B.1)
  const { ensureThirdPartyLocationLedger } = await import("./ensure-third-party-location-ledger");
  await ensureThirdPartyLocationLedger(payload.ownerId, { db, ref: deps?.docFn as never, run: deps?.runTransactionFn as never });

  const CONFLICT_MSG = "La versión del ledger cambió; se requiere reproyección.";
  const EXHAUSTED_MSG = "Los datos cambiaron en otro dispositivo. Intenta nuevamente.";
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const _getDoc = deps?.getDocFn || (await import("firebase/firestore")).getDoc;
    const _firestoreDoc = deps?.docFn || (await import("firebase/firestore")).doc;
    const ledgerSnap = await _getDoc(_firestoreDoc(db, "third_party_fund_location_ledger", payload.ownerId));
    
    if (!ledgerSnap.exists()) throw new Error("El ledger OCC no ha sido inicializado.");
    
    const expectedVersion = ledgerSnap.data().version as number;
    const expectedLastOperationId = (ledgerSnap.data().lastOperationId as string | null) ?? null;

    // Pre-cargar snapshot para proteger los fondos no propios retenidos
    const snapshot = await readThirdPartyLocationSnapshot(payload.ownerId, deps);
    const heldAtLocation = projectThirdPartyHeldAtLocation(
      { accountId: payload.accountId, pocketId: payload.pocketId ?? null },
      snapshot.entries,
      snapshot.moves,
      snapshot.consumptions,
    );

    try {
      const _runTransaction = deps?.runTransactionFn || runTransaction;
      const _doc = deps?.docFn || doc;
      await _runTransaction(db, async (transaction: Transaction) => {
        // ==========================================
        // FASE DE LECTURA DENTRO DE LA TRANSACCION
        // ==========================================
        const ledgerRef = _doc(db, "third_party_fund_location_ledger", payload.ownerId);
        
        const expenseSource = await loadExpenseSourceState({
          accountId: payload.accountId,
          db,
          ownerId: payload.ownerId,
          pocketId: payload.pocketId,
          transaction,
        });

        const categoryRef = _doc(db, "categories", payload.categoryId);
        
        const [txLedgerSnap, categorySnap] = await Promise.all([
          transaction.get(ledgerRef),
          transaction.get(categoryRef)
        ]);

        if (!txLedgerSnap.exists()) {
          throw new Error("El ledger OCC no ha sido inicializado.");
        }
        
        const txLedgerData = txLedgerSnap.data();
        const txLastOperationId = (txLedgerData.lastOperationId as string | null) ?? null;

        // Validar si el ledger avanzó externamente
        if (
          txLedgerData.ownerId !== payload.ownerId || 
          txLedgerData.version !== expectedVersion ||
          txLastOperationId !== expectedLastOperationId
        ) {
          throw new Error(CONFLICT_MSG);
        }

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

        // ==========================================
        // FASE DE VALIDACION Y CALCULO
        // ==========================================
        assertExpenseSourceHasEnoughBalance(expenseSource, payload.amount);

        // G5 — un gasto propio jamás consume dinero no propio. La barrera y su
        // copy salen del gate canónico (`own-funds-gate`), el mismo que ya usó
        // el formulario para pintar el panel de composición: el usuario no ve
        // dos explicaciones distintas del mismo rechazo.
        assertSufficientOwnFunds({
          physicalBalance: expenseSource.availableBalance,
          thirdPartyHeld: heldAtLocation,
          amount: payload.amount,
        });

        // ==========================================
        // FASE DE ESCRITURA
        // ==========================================
        const _collection = deps?.collectionFn || collection;
        const transactionRef = _doc(_collection(db, "transactions"));

        transaction.set(transactionRef, {
          ownerId: payload.ownerId,
          type: "expense",
          amount: payload.amount,
          accountId: payload.accountId,
          pocketId: payload.pocketId ?? null,
          categoryId: payload.categoryId,
          date: Timestamp.fromDate(payload.date),
          description: payload.description?.trim() ?? "",
          createdAt: serverTimestamp(),
          source: "manual",
          status: "confirmed",
          isHousehold: false,
          householdId: null,
          consumesThirdPartyFunds: false,
        });

        applyExpenseSourceDelta({
          amountDelta: -payload.amount,
          source: expenseSource,
          transaction,
        });
      });
      // Si la transacción tuvo éxito, retornamos.
      return;
    } catch (err: unknown) {
      if (err instanceof Error && err.message === CONFLICT_MSG) {
        if (attempt < MAX_ATTEMPTS - 1) {
          continue;
        }
        throw new Error(EXHAUSTED_MSG);
      }
      throw err;
    }
  }

  // Fallback de seguridad (teóricamente inalcanzable por el throw en max attempts)
  throw new Error(EXHAUSTED_MSG);
};
