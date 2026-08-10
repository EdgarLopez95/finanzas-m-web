import { doc, runTransaction, serverTimestamp, Timestamp, type Firestore, type DocumentData, Transaction } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { assertAccountNotArchived } from "@/features/accounts/services/account-lifecycle-guard";
import { allocateThirdPartyLocationFifo } from "@/lib/finance/third-party-location";
import { readThirdPartyLocationSnapshot } from "./read-third-party-location-snapshot";
import type { ThirdPartyLedgerState } from "./create-third-party-location-transfer";

export type CreatePersonalExpenseOccInput = {
  ownerId: string;
  operationId: string; // Used for both operation and transaction
  amount: number;
  accountId: string;
  pocketId: string | null;
  categoryId: string;
  date: Date;
  description?: string;
};

const CONFLICT_MSG = "La versión del ledger cambió; se requiere reproyección.";
const EXHAUSTED_MSG = "Los datos cambiaron en otro dispositivo. Intenta nuevamente.";
const MAX_ATTEMPTS = 3;

export const createPersonalExpenseOcc = async (
  input: CreatePersonalExpenseOccInput,
  deps?: {
    getFirebaseDbFn?: typeof getFirebaseDb;
    runTransactionFn?: typeof runTransaction;
    docFn?: typeof doc;
    getDocsFn?: typeof import("firebase/firestore").getDocs;
    queryFn?: typeof import("firebase/firestore").query;
    collectionFn?: typeof import("firebase/firestore").collection;
    whereFn?: typeof import("firebase/firestore").where;
    getDocFn?: typeof import("firebase/firestore").getDoc;
  }
): Promise<void> => {
  const { ensureThirdPartyLocationLedger } = await import("./ensure-third-party-location-ledger");
  await ensureThirdPartyLocationLedger(input.ownerId, { db: deps?.getFirebaseDbFn?.(), ref: deps?.docFn as never, run: deps?.runTransactionFn as never });


  const {
    ownerId,
    operationId,
    amount,
    accountId,
    pocketId,
    categoryId,
    date,
    description = "",
  } = input;

  if (!ownerId.trim()) throw new Error("El propietario es obligatorio.");
  if (!operationId.trim()) throw new Error("El operationId es obligatorio.");
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("El monto debe ser positivo.");

  const database = deps?.getFirebaseDbFn?.() || getFirebaseDb();

  const readLedger = async (id: string): Promise<ThirdPartyLedgerState> => {
    const _getDoc = deps?.getDocFn || (await import("firebase/firestore")).getDoc;
    const _doc = deps?.docFn || (await import("firebase/firestore")).doc;
    const snap = await _getDoc(
      _doc(database as Firestore, "third_party_fund_location_ledger", id),
    );
    if (!snap.exists()) throw new Error("El ledger OCC no ha sido inicializado.");
    const data = snap.data();
    return {
      ownerId: data.ownerId as string,
      version: data.version as number,
      lastOperationId: (data.lastOperationId as string | null) ?? null,
    };
  };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const [ledger, snapshot] = await Promise.all([
      readLedger(ownerId),
      readThirdPartyLocationSnapshot(ownerId, deps),
    ]);

    const expectedVersion = ledger.version;

    let fifoLines: Array<{ entryId: string; amount: number }>;
    try {
      fifoLines = allocateThirdPartyLocationFifo(
        amount,
        snapshot.entries,
        snapshot.moves,
        snapshot.consumptions,
        { accountId, pocketId },
      );
    } catch (bizError) {
      throw bizError;
    }

    // Identificar consumos existentes en el snapshot para calcular pendingAfter
    const affectedEntryIds = fifoLines.map((p) => p.entryId);
    const otherKnownConsumptions = snapshot.consumptions.filter((c) => affectedEntryIds.includes(c.entryId));

    try {
      const _runTransaction = deps?.runTransactionFn || runTransaction;
      await _runTransaction(database as Firestore, async (tx: Transaction) => {
        // 1. Lecturas
        const sourceRef = doc(database as Firestore, "accounts", accountId);
        const sourcePocketRef = pocketId
          ? doc(database as Firestore, "accounts", accountId, "pockets", pocketId)
          : null;
        const ledgerRef = doc(database as Firestore, "third_party_fund_location_ledger", ownerId);
        const categoryRef = doc(database as Firestore, "categories", categoryId);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reads: Promise<any>[] = [
          tx.get(sourceRef),
          tx.get(ledgerRef),
          tx.get(categoryRef),
        ];

        if (sourcePocketRef) {
          reads.push(tx.get(sourcePocketRef));
        }

        const entryRefs = affectedEntryIds.map(id => doc(database as Firestore, "third_party_fund_entries", id));
        entryRefs.forEach(ref => reads.push(tx.get(ref)));

        const snaps = await Promise.all(reads);

        const sourceSnap = snaps[0];
        const ledgerSnap = snaps[1];
        const categorySnap = snaps[2];
        const sourcePocketSnap = sourcePocketRef ? snaps[3] : null;

        const entrySnapsOffset = sourcePocketRef ? 4 : 3;
        const entrySnaps = snaps.slice(entrySnapsOffset);

        if (!sourceSnap.exists()) throw new Error("La cuenta origen no existe.");
        if (sourcePocketRef && (!sourcePocketSnap || !sourcePocketSnap.exists())) throw new Error("El bolsillo origen no existe.");
        if (!ledgerSnap.exists()) throw new Error("El ledger OCC no ha sido inicializado.");
        if (!categorySnap.exists()) throw new Error("La categoria seleccionada no existe.");

        const sourceData = sourceSnap.data();
        const ledgerData = ledgerSnap.data();
        const categoryData = categorySnap.data();

        if (sourceData.ownerId !== ownerId) throw new Error("Solo puedes registrar gastos en cuentas propias.");
        assertAccountNotArchived(sourceData);

        const categoryKind = categoryData.kind ?? categoryData.type;
        if (categoryKind !== "expense") throw new Error("La categoria debe ser de tipo gasto.");

        if (ledgerData.ownerId !== ownerId || ledgerData.version !== expectedVersion) {
          throw new Error(CONFLICT_MSG);
        }

        const entryDataMap = new Map<string, DocumentData>();
        entrySnaps.forEach((snap, idx) => {
          if (!snap.exists()) throw new Error("Una de las entries de dinero no propio no existe.");
          const data = snap.data();
          if (data.status === "cancelled") throw new Error("No se puede consumir de una entry cancelada.");
          entryDataMap.set(affectedEntryIds[idx], data);
        });

        // 2. Saldos Físicos
        const rawSourceBalance = sourcePocketSnap
          ? sourcePocketSnap.data().balance
          : (sourceData.currentBalance ?? sourceData.balance);
        const sourcePhysical = typeof rawSourceBalance === "number" ? rawSourceBalance : Number(rawSourceBalance ?? 0);

        if (!Number.isFinite(sourcePhysical)) throw new Error("El saldo del origen es inválido.");

        if (amount > sourcePhysical) {
          throw new Error(`Saldo físico insuficiente en el origen (disponible: ${sourcePhysical.toLocaleString("es-CO")}).`);
        }

        // 3. Escrituras
        if (sourcePocketRef && sourcePocketSnap) {
          tx.update(sourcePocketRef, { balance: sourcePhysical - amount, updatedAt: serverTimestamp() });
        } else {
          tx.update(sourceRef, { currentBalance: sourcePhysical - amount, updatedAt: serverTimestamp() });
        }

        for (const plan of fifoLines) {
          const entryData = entryDataMap.get(plan.entryId);
          const entryRef = doc(database as Firestore, "third_party_fund_entries", plan.entryId);
          
          if (!entryData) throw new Error("No se encontraron datos de entry de dinero no propio.");

          let sumOtherConsumptions = 0;
          for (const con of otherKnownConsumptions) {
            if (con.entryId === plan.entryId) {
              sumOtherConsumptions += con.amount;
            }
          }

          const pendingAfter = entryData.originalAmount - sumOtherConsumptions - plan.amount;
          if (pendingAfter < 0) {
            throw new Error(CONFLICT_MSG); 
          }

          const nextStatus = pendingAfter <= 0 ? "consumed" : "open";
          tx.update(entryRef, {
            status: nextStatus,
            updatedAt: serverTimestamp(),
          });

          const consumptionId = `${operationId}__${plan.entryId}`;
          const consumptionRef = doc(database as Firestore, "third_party_fund_consumptions", consumptionId);
          tx.set(consumptionRef, {
            ownerId,
            entryId: plan.entryId,
            consumerExpenseTransactionId: operationId,
            amount: plan.amount,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        const txRef = doc(database as Firestore, "transactions", operationId);
        tx.set(txRef, {
          ownerId,
          type: "expense",
          amount,
          accountId,
          pocketId,
          categoryId,
          date: Timestamp.fromDate(date),
          description: description.trim(),
          createdAt: serverTimestamp(),
          source: "manual",
          status: "confirmed",
          isHousehold: false,
          householdId: null,
          consumesThirdPartyFunds: true,
          thirdPartyConsumeAmount: amount, // Consumo total
        });

        const opRef = doc(database as Firestore, "third_party_fund_location_operations", operationId);
        tx.set(opRef, {
          id: operationId,
          ownerId,
          sourceTransactionId: operationId,
          sourceKind: "expense_consume",
          fromAccountId: accountId,
          fromPocketId: pocketId,
          toAccountId: null,
          toPocketId: null,
          totalAmount: amount,
          lines: fifoLines,
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        tx.update(ledgerRef, {
          version: expectedVersion + 1,
          lastOperationId: operationId,
          updatedAt: serverTimestamp(),
        });
      });

      return;
    } catch (error) {
      if (error instanceof Error && error.message === CONFLICT_MSG && attempt < MAX_ATTEMPTS - 1) {
        continue;
      }
      if (error instanceof Error && error.message === CONFLICT_MSG) {
        throw new Error(EXHAUSTED_MSG);
      }
      throw error;
    }
  }

  throw new Error(EXHAUSTED_MSG);
};
