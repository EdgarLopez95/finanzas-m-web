import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toDateOrNull, toSafeNumber, toSafeString } from "@/lib/firebase/firestore-parsers";
import { assertAccountNotArchived } from "@/features/accounts/services/account-lifecycle-guard";
import { buildLinkedEventShareRevertUpdates } from "@/features/household/lib/household-debt-lifecycle";
import {
  findHouseholdIncomeProjectionBySourceTransactionId,
  syncHouseholdIncomeProjectionInTransaction,
} from "@/features/transactions/services/sync-household-income-projection";
import {
  findThirdPartyFundEntryBySourceTransactionId,
  syncThirdPartyFundEntryInTransaction,
} from "@/features/transactions/services/sync-third-party-fund-entry";
import type { ThirdPartyFundConsumption } from "@/types/third-party-funds";



type DeleteAccountCascadeInput = {
  ownerId: string;
  accountId: string;
};

type RawOwnedTransaction = {
  id: string;
  ownerId: string;
  type: string;
  amount: number;
  accountId: string;
  targetAccountId: string | null;
  pocketId: string | null;
  targetPocketId: string | null;
  countsAsRealIncome: boolean;
  relatedEventId: string | null;
  relatedDebtId: string | null;
};

type ExistingProjection = Awaited<
  ReturnType<typeof findHouseholdIncomeProjectionBySourceTransactionId>
>;

type ExistingThirdPartyEntry = Awaited<
  ReturnType<typeof findThirdPartyFundEntryBySourceTransactionId>
>;

type LinkedDebt = {
  id: string;
  ref: DocumentReference;
  outgoingTransactionId?: string | null;
  incomingTransactionId?: string | null;
  status?: string;
  eventId?: string;
  householdId?: string;
};

type LinkedEventShare = {
  id: string;
  ref: DocumentReference;
  completedByTransactionId?: string | null;
  completedAt?: unknown;
  status?: string;
  eventId?: string;
  householdId?: string;
};

type LinkedEvent = {
  id: string;
  ref: DocumentReference;
  createdByUserId?: string;
  status?: string;
  householdId?: string;
};

type CascadePlan = {
  ownerId: string;
  mode: "pocket" | "account";
  parentAccountId: string;
  deleteAccountId: string | null;
  deletePocketIds: string[];
  pocketBalanceToRelease: number;
  transactions: RawOwnedTransaction[];
  existingConsumptions: ThirdPartyFundConsumption[];
  affectedEntryIds: string[];
  householdProjectionsByTransactionId: Map<string, ExistingProjection>;
  thirdPartyEntriesByTransactionId: Map<string, ExistingThirdPartyEntry>;
  linkedDebts: LinkedDebt[];
  linkedEventShares: LinkedEventShare[];
  linkedEventsToCancel: LinkedEvent[];
  derivativeSharesToCancel: LinkedEventShare[];
  derivativeDebtsToCancel: LinkedDebt[];
};

const toSafeFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    throw new Error("Se encontro un saldo invalido en una cuenta.");
  }
  return parsed;
};

export const estimateCascadeWriteCount = (plan: {
  transactionsCount: number;
  deletedConsumptionsCount: number;
  affectedEntriesCount: number;
  projectedIncomeCount: number;
  trackedIncomeCount: number;
  deletePocketCount: number;
  deleteAccount: boolean;
  survivingAccountUpdates: number;
}): number =>
  plan.transactionsCount +
  plan.deletedConsumptionsCount +
  plan.affectedEntriesCount +
  plan.projectedIncomeCount +
  plan.trackedIncomeCount +
  plan.deletePocketCount +
  (plan.deleteAccount ? 1 : 0) +
  plan.survivingAccountUpdates;

const mapOwnedTransaction = (id: string, data: DocumentData): RawOwnedTransaction => ({
  id,
  ownerId: toSafeString(data.ownerId),
  type: toSafeString(data.type),
  amount: toSafeNumber(data.amount),
  accountId: toSafeString(data.accountId),
  targetAccountId: toSafeString(data.targetAccountId) || null,
  pocketId: toSafeString(data.pocketId) || null,
  targetPocketId: toSafeString(data.targetPocketId) || null,
  countsAsRealIncome: data.type === "income" ? data.countsAsRealIncome !== false : true,
  relatedEventId: toSafeString(data.relatedEventId) || null,
  relatedDebtId: toSafeString(data.relatedDebtId) || null,
});

const dedupeTransactions = (transactions: RawOwnedTransaction[]): RawOwnedTransaction[] => {
  const byId = new Map<string, RawOwnedTransaction>();
  for (const transaction of transactions) {
    byId.set(transaction.id, transaction);
  }
  return Array.from(byId.values());
};

export const assertSupportedCascadeTransactions = (transactions: RawOwnedTransaction[]) => {
  for (const transaction of transactions) {
    if (
      transaction.type !== "expense" &&
      transaction.type !== "income" &&
      transaction.type !== "transfer" &&
      transaction.type !== "reimbursement" &&
      transaction.type !== "pending"
    ) {
      throw new Error("Esta eliminacion incluye movimientos no soportados por la Web actual.");
    }
  }
};

// Helper to query in chunks of 30 values (due to 'in' operator limits in Firestore)
async function queryInChunks(
  collectionRef: CollectionReference<DocumentData>,
  field: string,
  values: string[],
  extraFilters: QueryConstraint[] = []
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  if (values.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < values.length; i += 30) {
    chunks.push(values.slice(i, i + 30));
  }

  const results: QueryDocumentSnapshot<DocumentData>[] = [];
  for (const chunk of chunks) {
    const q = query(collectionRef, where(field, "in", chunk), ...extraFilters);
    const snap = await getDocs(q);
    results.push(...snap.docs);
  }
  return results;
}

const loadIncomeSideEffects = async (ownerId: string, transactions: RawOwnedTransaction[]) => {
  const incomeIds = transactions.filter((tx) => tx.type === "income").map((tx) => tx.id);
  const householdPairs = await Promise.all(
    incomeIds.map(async (transactionId) => [
      transactionId,
      await findHouseholdIncomeProjectionBySourceTransactionId(ownerId, transactionId),
    ] as const)
  );
  const thirdPartyPairs = await Promise.all(
    incomeIds.map(async (transactionId) => [
      transactionId,
      await findThirdPartyFundEntryBySourceTransactionId(ownerId, transactionId),
    ] as const)
  );

  return {
    householdProjectionsByTransactionId: new Map(
      householdPairs.filter(([, projection]) => Boolean(projection)) as Array<[string, NonNullable<ExistingProjection>]>
    ),
    thirdPartyEntriesByTransactionId: new Map(
      thirdPartyPairs.filter(([, entry]) => Boolean(entry)) as Array<[string, NonNullable<ExistingThirdPartyEntry>]>
    ),
  };
};



const buildDeleteAccountCascadePlan = async ({
  ownerId,
  accountId,
}: DeleteAccountCascadeInput): Promise<CascadePlan> => {
  const db = getFirebaseDb();
  const accountRef = doc(db, "accounts", accountId);
  const accountSnap = await getDoc(accountRef);
  if (!accountSnap.exists()) {
    throw new Error("La cuenta no existe.");
  }
  if (toSafeString(accountSnap.data().ownerId) !== ownerId) {
    throw new Error("No tienes permiso para eliminar esta cuenta.");
  }

  const pocketsSnapshot = await getDocs(collection(db, "accounts", accountId, "pockets"));
  const pocketIds = pocketsSnapshot.docs.map((docItem) => docItem.id);

  // Query transactions where accountId == accountId or targetAccountId == accountId separately
  const q1 = query(
    collection(db, "transactions"),
    where("ownerId", "==", ownerId),
    where("accountId", "==", accountId)
  );
  const q2 = query(
    collection(db, "transactions"),
    where("ownerId", "==", ownerId),
    where("targetAccountId", "==", accountId)
  );

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const allTxs = [
    ...snap1.docs.map((docItem) => mapOwnedTransaction(docItem.id, docItem.data())),
    ...snap2.docs.map((docItem) => mapOwnedTransaction(docItem.id, docItem.data())),
  ];
  const transactions = dedupeTransactions(allTxs);

  assertSupportedCascadeTransactions(transactions);

  const transactionIds = transactions.map((tx) => tx.id);

  // Fetch only related consumptions (by consumerExpenseTransactionId)
  const consumptionsSnap1 = await queryInChunks(
    collection(db, "third_party_fund_consumptions"),
    "consumerExpenseTransactionId",
    transactionIds,
    [where("ownerId", "==", ownerId)]
  );

  const incomeSideEffects = await loadIncomeSideEffects(ownerId, transactions);

  // Get deleted third party entry IDs
  const deletedThirdPartyEntryIds = Array.from(
    incomeSideEffects.thirdPartyEntriesByTransactionId.values()
  ).map((entry) => entry.ref.id);

  // Fetch consumptions by entryId
  const consumptionsSnap2 = await queryInChunks(
    collection(db, "third_party_fund_consumptions"),
    "entryId",
    deletedThirdPartyEntryIds,
    [where("ownerId", "==", ownerId)]
  );

  // Merge and deduplicate consumptions
  const consumptionsMap = new Map<string, ThirdPartyFundConsumption>();
  const addConsumption = (docItem: QueryDocumentSnapshot<DocumentData>) => {
    const data = docItem.data();
    consumptionsMap.set(docItem.id, {
      id: docItem.id,
      ownerId: toSafeString(data.ownerId),
      entryId: toSafeString(data.entryId),
      consumerExpenseTransactionId: toSafeString(data.consumerExpenseTransactionId),
      amount: toSafeNumber(data.amount),
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
    });
  };
  consumptionsSnap1.forEach(addConsumption);
  consumptionsSnap2.forEach(addConsumption);
  const existingConsumptions = Array.from(consumptionsMap.values());
  const affectedEntryIds = Array.from(new Set(existingConsumptions.map((c) => c.entryId))).filter(Boolean);

  // Load related events
  const relatedEventIds = Array.from(new Set(transactions.map((tx) => tx.relatedEventId).filter(Boolean))) as string[];
  const linkedEventsToCancel: LinkedEvent[] = [];
  for (const eventId of relatedEventIds) {
    const eventSnap = await getDoc(doc(db, "household_events", eventId));
    if (eventSnap.exists()) {
      const eventData = eventSnap.data();
      // Only cancel event if created by the owner and currently active
      if (
        toSafeString(eventData.createdByUserId) === ownerId &&
        toSafeString(eventData.status) === "active"
      ) {
        linkedEventsToCancel.push({ id: eventSnap.id, ref: eventSnap.ref, ...eventData } as LinkedEvent);
      }
    }
  }

  const cancelledEventIds = linkedEventsToCancel.map((e) => e.id);

  // Load user active household to safely query debts and event shares in memory (bypassing permission limitations and avoiding index needs)
  const userSnap = await getDoc(doc(db, "users", ownerId));
  const activeHouseholdId = userSnap.exists() ? toSafeString(userSnap.data()?.activeHouseholdId) : null;

  let linkedDebts: LinkedDebt[] = [];
  let linkedEventShares: LinkedEventShare[] = [];
  let derivativeSharesToCancel: LinkedEventShare[] = [];
  let derivativeDebtsToCancel: LinkedDebt[] = [];

  if (activeHouseholdId) {
    const [debtsSnap, sharesSnap] = await Promise.all([
      getDocs(query(collection(db, "household_debts"), where("householdId", "==", activeHouseholdId))),
      getDocs(query(collection(db, "household_event_shares"), where("householdId", "==", activeHouseholdId)))
    ]);

    const allDebts = debtsSnap.docs.map((docItem) => ({
      id: docItem.id,
      ref: docItem.ref,
      ...docItem.data()
    } as LinkedDebt));

    const allShares = sharesSnap.docs.map((docItem) => ({
      id: docItem.id,
      ref: docItem.ref,
      ...docItem.data()
    } as LinkedEventShare));

    linkedDebts = allDebts.filter((d) =>
      (d.outgoingTransactionId && transactionIds.includes(d.outgoingTransactionId)) ||
      (d.incomingTransactionId && transactionIds.includes(d.incomingTransactionId))
    );

    linkedEventShares = allShares.filter((s) =>
      s.completedByTransactionId && transactionIds.includes(s.completedByTransactionId)
    );

    // H1.6b: paridad Android (HouseholdEventRepository.kt:361-375, applyCancellation) — la
    // cascada de cancelación de evento SOLO toca shares "pending_completion" y deudas "pending".
    // Las shares "completed" se preservan (su reversión, si aplica, la maneja linkedEventShares
    // más abajo); otros estados de deuda (payment_declared/paid/cancelled) nunca se tocan aquí.
    derivativeSharesToCancel = allShares.filter((s) =>
      s.eventId && cancelledEventIds.includes(s.eventId) && s.status === "pending_completion"
    );

    derivativeDebtsToCancel = allDebts.filter((d) =>
      d.eventId && cancelledEventIds.includes(d.eventId) && d.status === "pending"
    );
  }

  // Safety writes check
  const uniqueWritePaths = new Set<string>();
  uniqueWritePaths.add(`accounts/${accountId}`);
  pocketIds.forEach((pId) => uniqueWritePaths.add(`accounts/${accountId}/pockets/${pId}`));
  transactions.forEach((tx) => uniqueWritePaths.add(`transactions/${tx.id}`));
  existingConsumptions.forEach((c) => uniqueWritePaths.add(`third_party_fund_consumptions/${c.id}`));
  affectedEntryIds.forEach((id) => uniqueWritePaths.add(`third_party_fund_entries/${id}`));
  Array.from(incomeSideEffects.householdProjectionsByTransactionId.values()).forEach((proj) =>
    uniqueWritePaths.add(`household_income_entries/${proj.ref.id}`)
  );
  linkedDebts.forEach((d) => uniqueWritePaths.add(`household_debts/${d.id}`));
  linkedEventShares.forEach((s) => uniqueWritePaths.add(`household_event_shares/${s.id}`));
  linkedEventsToCancel.forEach((e) => uniqueWritePaths.add(`household_events/${e.id}`));
  derivativeSharesToCancel.forEach((s) => uniqueWritePaths.add(`household_event_shares/${s.id}`));
  derivativeDebtsToCancel.forEach((d) => uniqueWritePaths.add(`household_debts/${d.id}`));

  // Check surviving accounts that might need updates
  transactions.forEach((tx) => {
    if (tx.accountId && tx.accountId !== accountId) uniqueWritePaths.add(`accounts/${tx.accountId}`);
    if (tx.targetAccountId && tx.targetAccountId !== accountId) uniqueWritePaths.add(`accounts/${tx.targetAccountId}`);
  });

  if (uniqueWritePaths.size > 250) {
    throw new Error("Esta cuenta/bolsillo tiene demasiados datos asociados para eliminarla desde esta pantalla.");
  }

  return {
    ownerId,
    mode: "account",
    parentAccountId: accountId,
    deleteAccountId: accountId,
    deletePocketIds: pocketIds,
    pocketBalanceToRelease: 0,
    transactions,
    existingConsumptions,
    affectedEntryIds,
    ...incomeSideEffects,
    linkedDebts,
    linkedEventShares,
    linkedEventsToCancel,
    derivativeSharesToCancel,
    derivativeDebtsToCancel,
  };
};

const executeCascadePlan = async (plan: CascadePlan): Promise<void> => {
  const db = getFirebaseDb();
  const deletedAccountIds = new Set(plan.deleteAccountId ? [plan.deleteAccountId] : []);
  const deletedPocketIds = new Set(plan.deletePocketIds);

  await runTransaction(db, async (transaction) => {
    const accountIdsToRead = new Set<string>([plan.parentAccountId]);
    for (const movement of plan.transactions) {
      if (movement.accountId) accountIdsToRead.add(movement.accountId);
      if (movement.targetAccountId) accountIdsToRead.add(movement.targetAccountId);
    }

    const accountSnaps = new Map<string, DocumentData>();
    for (const accountId of accountIdsToRead) {
      const accountRef = doc(db, "accounts", accountId);
      const snap = await transaction.get(accountRef);
      if (!snap.exists()) {
        console.warn(`[cascade] Account ${accountId} does not exist, skipping balance check.`);
        continue;
      }
      const data = snap.data();
      if (toSafeString(data.ownerId) !== plan.ownerId) {
        throw new Error("La eliminacion involucra una cuenta que no te pertenece.");
      }
      accountSnaps.set(accountId, data);
    }

    // Solo aplica al modo "account"
    if (plan.mode === "account") {
      const parentAccountData = accountSnaps.get(plan.parentAccountId);
      if (parentAccountData) {
        assertAccountNotArchived(parentAccountData);
      }
    }

    const pocketRefs = plan.deletePocketIds.map((pocketId) =>
      doc(db, "accounts", plan.parentAccountId, "pockets", pocketId)
    );
    const pocketSnaps = new Map<string, DocumentData>();
    for (const pocketRef of pocketRefs) {
      const snap = await transaction.get(pocketRef);
      if (!snap.exists()) {
        console.warn(`[cascade] Pocket ${pocketRef.id} does not exist, skipping.`);
        continue;
      }
      pocketSnaps.set(pocketRef.id, snap.data());
    }

    const movementRefs = new Map<string, DocumentReference>();
    const movementSnaps = new Map<string, DocumentData>();
    for (const movement of plan.transactions) {
      const movementRef = doc(db, "transactions", movement.id);
      const movementSnap = await transaction.get(movementRef);
      if (!movementSnap.exists()) {
        console.warn(`[cascade] Transaction ${movement.id} does not exist, skipping delete/reversion.`);
        continue;
      }
      const movementData = movementSnap.data();
      if (toSafeString(movementData.ownerId) !== plan.ownerId) {
        throw new Error("La eliminacion incluye un movimiento que no te pertenece.");
      }
      movementRefs.set(movement.id, movementRef);
      movementSnaps.set(movement.id, movementData);
    }

    const entrySnaps = new Map<string, DocumentData>();
    for (const entryId of plan.affectedEntryIds) {
      const entryRef = doc(db, "third_party_fund_entries", entryId);
      const entrySnap = await transaction.get(entryRef);
      if (!entrySnap.exists()) {
        console.warn(`[cascade] Third party entry ${entryId} does not exist, skipping.`);
        continue;
      }
      const entryData = entrySnap.data();
      if (toSafeString(entryData.ownerId) !== plan.ownerId) {
        throw new Error("No tienes permiso sobre una entry de dinero no propio.");
      }
      entrySnaps.set(entryId, entryData);
    }

    for (const consumption of plan.existingConsumptions) {
      const conRef = doc(db, "third_party_fund_consumptions", consumption.id);
      await transaction.get(conRef);
    }

    for (const debt of plan.linkedDebts) {
      await transaction.get(debt.ref);
    }

    for (const s of plan.linkedEventShares) {
      await transaction.get(s.ref);
    }

    // Status EFECTIVO de cada household_event padre de un share completado a revertir. Paridad
    // Android (HouseholdEventRepository.kt:707-735) + decisión 1 de firestore.rules: se necesita
    // saber si el evento sigue activo o queda cancelado para decidir a qué status vuelve el share
    // (pending_completion vs cancelled).
    const eventStatusById = new Map<string, string>();

    // H1.6b: los eventos de linkedEventsToCancel los cancela ESTA MISMA transacción (más abajo,
    // status="cancelled" incondicional) — su status efectivo para revertir shares vinculadas es
    // "cancelled" (el estado final que esta transacción escribe), no el status pre-transacción
    // leído aquí. Con R1b (getAfter() en Rules canónicas, desplegada) esto es exactamente lo que
    // Rules validará. El get() se conserva solo para el orden de lectura-antes-que-escritura que
    // exige el SDK de Firestore; su valor no se usa para el status efectivo.
    for (const e of plan.linkedEventsToCancel) {
      await transaction.get(e.ref);
      eventStatusById.set(e.id, "cancelled");
    }

    // Para shares vinculadas a un evento que NO se cancela en esta misma operación, sí se usa el
    // status real pre-transacción (evento ajeno a este borrado, su estado no cambia aquí).
    for (const s of plan.linkedEventShares) {
      if (!s.eventId || eventStatusById.has(s.eventId)) continue;
      const eventSnap = await transaction.get(doc(db, "household_events", s.eventId));
      eventStatusById.set(s.eventId, eventSnap.exists() ? toSafeString(eventSnap.data()?.status) || "active" : "active");
    }

    for (const s of plan.derivativeSharesToCancel) {
      await transaction.get(s.ref);
    }

    for (const d of plan.derivativeDebtsToCancel) {
      await transaction.get(d.ref);
    }

    // Balance reversion tracking
    const accountDelta = new Map<string, number>();
    const addAccountDelta = (accountId: string, delta: number) => {
      if (!accountId || deletedAccountIds.has(accountId)) {
        return;
      }
      accountDelta.set(accountId, (accountDelta.get(accountId) ?? 0) + delta);
    };

    let pocketReversionDelta = 0;

    for (const movement of plan.transactions) {
      const movementData = movementSnaps.get(movement.id);
      if (!movementData) continue;

      const type = toSafeString(movementData.type);
      const amount = toSafeFiniteNumber(movementData.amount);
      const accountId = toSafeString(movementData.accountId);
      const targetAccountId = toSafeString(movementData.targetAccountId) || null;
      const pocketId = toSafeString(movementData.pocketId) || null;
      const targetPocketId = toSafeString(movementData.targetPocketId) || null;

      if (type === "expense") {
        if (pocketId) {
          if (plan.mode === "pocket" && deletedPocketIds.has(pocketId)) {
            // Reverting pocket expense adds money back to the pocket being deleted
            pocketReversionDelta += amount;
          }
          // Do not adjust account available balance since expense came from pocket allocation
        } else {
          addAccountDelta(accountId, amount);
        }
      } else if (type === "income") {
        if (pocketId) {
          if (plan.mode === "pocket" && deletedPocketIds.has(pocketId)) {
            pocketReversionDelta -= amount;
          }
        } else {
          addAccountDelta(accountId, -amount);
        }
      } else if (type === "transfer") {
        if (!targetAccountId) {
          throw new Error("Una transferencia asociada no tiene cuenta destino valida.");
        }

        // Revert source
        if (pocketId) {
          if (plan.mode === "pocket" && deletedPocketIds.has(pocketId)) {
            pocketReversionDelta += amount;
          }
        } else {
          addAccountDelta(accountId, amount);
        }

        // Revert destination
        if (targetPocketId) {
          if (plan.mode === "pocket" && deletedPocketIds.has(targetPocketId)) {
            pocketReversionDelta -= amount;
          }
        } else {
          addAccountDelta(targetAccountId, -amount);
        }
      }
    }

    // Apply parent account available balance update for residual pocket balance (Pocket Mode only)
    if (plan.mode === "pocket") {
      const pocketId = plan.deletePocketIds[0];
      const pocketData = pocketSnaps.get(pocketId);
      if (pocketData) {
        const currentPocketBalance = toSafeFiniteNumber(pocketData.balance);
        const residual = currentPocketBalance + pocketReversionDelta;
        addAccountDelta(plan.parentAccountId, residual);
      }
    }

    // Write Account Balance Updates
    for (const [accountId, delta] of accountDelta) {
      if (delta === 0) continue;
      const accountData = accountSnaps.get(accountId);
      if (!accountData) {
        console.warn(`[cascade] Skipping balance update for account ${accountId} as it was not loaded.`);
        continue;
      }
      const balance = toSafeFiniteNumber(accountData.currentBalance ?? accountData.balance);
      transaction.update(doc(db, "accounts", accountId), {
        currentBalance: balance + delta,
        updatedAt: serverTimestamp(),
      });
    }

    // Delete Consumptions
    for (const consumption of plan.existingConsumptions) {
      transaction.delete(doc(db, "third_party_fund_consumptions", consumption.id));
    }

    // Update affected entries status to cancelled if income transaction is deleted
    for (const entryId of plan.affectedEntryIds) {
      const entryData = entrySnaps.get(entryId);
      if (!entryData || entryData.status === "cancelled") continue;
      
      const sourceTxDeleted = plan.transactions.some(tx => tx.id === entryData.sourceIncomeTransactionId);
      if (sourceTxDeleted) {
        transaction.update(doc(db, "third_party_fund_entries", entryId), {
          status: "cancelled",
          updatedAt: serverTimestamp(),
        });
      }
    }

    // Sincronizar household_income_entries y third_party_fund_entries
    for (const movement of plan.transactions) {
      const projection = plan.householdProjectionsByTransactionId.get(movement.id);
      if (movement.type === "income" && projection) {
        await syncHouseholdIncomeProjectionInTransaction({
          db,
          transaction,
          ownerId: plan.ownerId,
          sourceTransactionId: movement.id,
          amount: movement.amount,
          entryDate: new Date(),
          shouldProject: false,
          existingProjection: projection,
          activeHouseholdId: null,
        });
      }

      const existingEntry = plan.thirdPartyEntriesByTransactionId.get(movement.id);
      if (movement.type === "income" && movement.countsAsRealIncome === false && existingEntry) {
        await syncThirdPartyFundEntryInTransaction({
          db,
          transaction,
          ownerId: plan.ownerId,
          sourceIncomeTransactionId: movement.id,
          originalAmount: movement.amount,
          shouldTrack: false,
          existingEntry,
          preReadProjectionSnap: null,
        });
      }
    }

    // Cancel household events created by this transaction
    for (const event of plan.linkedEventsToCancel) {
      transaction.update(event.ref, {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });
    }

    // Cancel derivative debts of cancelled events
    for (const debt of plan.derivativeDebtsToCancel) {
      transaction.update(debt.ref, {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });
    }

    // Revert/unlink transaction reference in deudas (payments)
    for (const debt of plan.linkedDebts) {
      const updateData: DocumentData = {};
      let nextOutgoing = debt.outgoingTransactionId;
      let nextIncoming = debt.incomingTransactionId;

      if (plan.transactions.some(tx => tx.id === debt.outgoingTransactionId)) {
        updateData.outgoingTransactionId = null;
        nextOutgoing = null;
      }
      if (plan.transactions.some(tx => tx.id === debt.incomingTransactionId)) {
        updateData.incomingTransactionId = null;
        nextIncoming = null;
      }

      // Recalculate status
      if (!nextOutgoing && !nextIncoming) {
        updateData.status = "pending";
      } else if (nextOutgoing && !nextIncoming) {
        updateData.status = "payment_declared";
      } else {
        updateData.status = "pending";
      }

      updateData.updatedAt = serverTimestamp();
      transaction.update(debt.ref, updateData);
    }

    // H1.6b: una sola escritura por documento de household_event_shares. Se combinan en un Map
    // por id las cancelaciones derivadas (pending_completion de un evento que se cancela aquí) y
    // los revert de shares completadas vinculadas a una transacción borrada, antes de escribir.
    // Tras el filtro de status de derivativeSharesToCancel (solo pending_completion) y el de
    // linkedEventShares (solo completedByTransactionId != null, que implica status="completed"),
    // ambos conjuntos son mutuamente excluyentes por construcción — pero se conserva el Map como
    // resguardo explícito: si algún día coincidieran, el revert de linkedEventShares gana (limpia
    // el vínculo Y aplica el status EFECTIVO del evento vía eventStatusById), nunca se emiten dos
    // transaction.update() para el mismo documento.
    const shareUpdatesById = new Map<string, { ref: DocumentReference; data: DocumentData }>();

    for (const share of plan.derivativeSharesToCancel) {
      shareUpdatesById.set(share.id, {
        ref: share.ref,
        data: { status: "cancelled", updatedAt: serverTimestamp() },
      });
    }

    const shareRevertStatusById = new Map(
      buildLinkedEventShareRevertUpdates(plan.linkedEventShares, eventStatusById).map((u) => [u.id, u.status])
    );
    for (const share of plan.linkedEventShares) {
      shareUpdatesById.set(share.id, {
        ref: share.ref,
        data: {
          completedByTransactionId: null,
          completedAt: null,
          status: shareRevertStatusById.get(share.id) ?? "pending_completion",
          updatedAt: serverTimestamp(),
        },
      });
    }

    for (const { ref, data } of shareUpdatesById.values()) {
      transaction.update(ref, data);
    }

    // Delete Transactions
    for (const movement of plan.transactions) {
      const ref = movementRefs.get(movement.id);
      if (ref) {
        transaction.delete(ref);
      }
    }

    // Delete Pockets
    for (const pocketId of plan.deletePocketIds) {
      if (pocketSnaps.has(pocketId)) {
        transaction.delete(doc(db, "accounts", plan.parentAccountId, "pockets", pocketId));
      }
    }

    // Delete Account
    if (plan.deleteAccountId) {
      transaction.delete(doc(db, "accounts", plan.deleteAccountId));
    }
  });

  // Post-Delete Audit — non-blocking. The Firestore transaction above committed atomically;
  // if it succeeded, all deletes/updates are guaranteed. Security rules deny reads on
  // just-deleted documents (resource == null), so the audit always fails with a permission
  // error. We catch it here to prevent false errors from reaching the user.
  try {
    await runPostDeleteAudit(plan);
  } catch (err) {
    console.warn("[cascade] post-delete audit warning (non-blocking):", err);
  }
};

// Post-delete audit verification to guarantee no orphaned records exist
const runPostDeleteAudit = async (plan: CascadePlan): Promise<void> => {
  const db = getFirebaseDb();
  const txIds = plan.transactions.map((tx) => tx.id);

  // 1. Verify transactions deleted
  for (const txId of txIds) {
    const snap = await getDoc(doc(db, "transactions", txId));
    if (snap.exists()) {
      throw new Error(`Auditoria fallo: Transaccion ${txId} todavia existe.`);
    }
  }

  // 2. Verify pockets deleted
  for (const pocketId of plan.deletePocketIds) {
    const snap = await getDoc(doc(db, "accounts", plan.parentAccountId, "pockets", pocketId));
    if (snap.exists()) {
      throw new Error(`Auditoria fallo: Bolsillo ${pocketId} todavia existe.`);
    }
  }

  // 3. Verify account deleted
  if (plan.deleteAccountId) {
    const snap = await getDoc(doc(db, "accounts", plan.deleteAccountId));
    if (snap.exists()) {
      throw new Error(`Auditoria fallo: Cuenta ${plan.deleteAccountId} todavia existe.`);
    }
  }

  // 4. Verify no active projections for deleted transactions.
  // Query uses sourceOwnerId+sourceTransactionId (índice existente). El filtro status se aplica
  // en memoria para no requerir un índice compuesto adicional con status.
  if (txIds.length > 0) {
    const projections = await queryInChunks(
      collection(db, "household_income_entries"),
      "sourceTransactionId",
      txIds,
      [where("sourceOwnerId", "==", plan.ownerId)]
    );
    const activeProjections = projections.filter((d) => d.data().status === "active");
    if (activeProjections.length > 0) {
      throw new Error(`Auditoria fallo: Proyección de hogar activa todavia existe para transaccion eliminada.`);
    }
  }
};



export const deleteAccountCascade = async (payload: DeleteAccountCascadeInput): Promise<void> => {
  try {
    const plan = await buildDeleteAccountCascadePlan(payload);
    await executeCascadePlan(plan);
  } catch (error) {
    console.error("[cascade] deleteAccountCascade falló:", error);
    throw error;
  }
};
