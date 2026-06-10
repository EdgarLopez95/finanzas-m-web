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
import {
  findHouseholdIncomeProjectionBySourceTransactionId,
  syncHouseholdIncomeProjectionInTransaction,
} from "@/features/transactions/services/sync-household-income-projection";
import {
  findThirdPartyFundEntryBySourceTransactionId,
  syncThirdPartyFundEntryInTransaction,
} from "@/features/transactions/services/sync-third-party-fund-entry";
import type { ThirdPartyFundConsumption } from "@/types/third-party-funds";

type DeletePocketCascadeInput = {
  ownerId: string;
  pocketId: string;
};

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

const assertSupportedCascadeTransactions = (transactions: RawOwnedTransaction[]) => {
  for (const transaction of transactions) {
    if (
      transaction.type !== "expense" &&
      transaction.type !== "income" &&
      transaction.type !== "transfer"
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

const buildDeletePocketCascadePlan = async ({
  ownerId,
  pocketId,
}: DeletePocketCascadeInput): Promise<CascadePlan> => {
  const db = getFirebaseDb();
  const accountSnapshots = await getDocs(query(collection(db, "accounts"), where("ownerId", "==", ownerId)));

  let parentAccountId: string | null = null;
  let pocketBalanceToRelease = 0;

  for (const accountDoc of accountSnapshots.docs) {
    const pocketSnap = await getDocs(collection(db, "accounts", accountDoc.id, "pockets"));
    const matchingPocket = pocketSnap.docs.find((docItem) => docItem.id === pocketId);
    if (!matchingPocket) {
      continue;
    }
    parentAccountId = accountDoc.id;
    pocketBalanceToRelease = toSafeNumber(matchingPocket.data().balance);
    break;
  }

  if (!parentAccountId) {
    throw new Error("El bolsillo no existe o no pertenece a una cuenta propia.");
  }

  // Query transactions containing pocketId or targetPocketId separately to avoid large OR queries
  const q1 = query(
    collection(db, "transactions"),
    where("ownerId", "==", ownerId),
    where("pocketId", "==", pocketId)
  );
  const q2 = query(
    collection(db, "transactions"),
    where("ownerId", "==", ownerId),
    where("targetPocketId", "==", pocketId)
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

  // Fetch linked deudas and shares
  const debtsSnap1 = await queryInChunks(
    collection(db, "household_debts"),
    "outgoingTransactionId",
    transactionIds
  );
  const debtsSnap2 = await queryInChunks(
    collection(db, "household_debts"),
    "incomingTransactionId",
    transactionIds
  );
  const debtsMap = new Map<string, LinkedDebt>();
  debtsSnap1.forEach((docItem) => debtsMap.set(docItem.id, { id: docItem.id, ref: docItem.ref, ...docItem.data() } as LinkedDebt));
  debtsSnap2.forEach((docItem) => debtsMap.set(docItem.id, { id: docItem.id, ref: docItem.ref, ...docItem.data() } as LinkedDebt));
  const linkedDebts = Array.from(debtsMap.values());

  const sharesSnap = await queryInChunks(
    collection(db, "household_event_shares"),
    "completedByTransactionId",
    transactionIds
  );
  const linkedEventShares = sharesSnap.map((docItem): LinkedEventShare => ({ id: docItem.id, ref: docItem.ref, ...docItem.data() }));

  // Load related events
  const relatedEventIds = Array.from(new Set(transactions.map((tx) => tx.relatedEventId).filter(Boolean))) as string[];
  const linkedEventsToCancel: LinkedEvent[] = [];
  for (const eventId of relatedEventIds) {
    const eventSnap = await getDoc(doc(db, "household_events", eventId));
    if (eventSnap.exists()) {
      const eventData = eventSnap.data();
      // Only cancel event if created by the owner
      if (toSafeString(eventData.createdByUserId) === ownerId) {
        linkedEventsToCancel.push({ id: eventSnap.id, ref: eventSnap.ref, ...eventData } as LinkedEvent);
      }
    }
  }

  // Fetch derivative event shares and debts if events are cancelled
  const cancelledEventIds = linkedEventsToCancel.map((e) => e.id);
  const derivativeSharesSnap = await queryInChunks(
    collection(db, "household_event_shares"),
    "eventId",
    cancelledEventIds
  );
  const derivativeDebtsSnap = await queryInChunks(
    collection(db, "household_debts"),
    "eventId",
    cancelledEventIds
  );
  const derivativeSharesToCancel = derivativeSharesSnap.map((docItem): LinkedEventShare => ({ id: docItem.id, ref: docItem.ref, ...docItem.data() }));
  const derivativeDebtsToCancel = derivativeDebtsSnap.map((docItem): LinkedDebt => ({ id: docItem.id, ref: docItem.ref, ...docItem.data() }));

  // Safety writes check
  const uniqueWritePaths = new Set<string>();
  uniqueWritePaths.add(`accounts/${parentAccountId}/pockets/${pocketId}`);
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
    if (tx.accountId && tx.accountId !== parentAccountId) uniqueWritePaths.add(`accounts/${tx.accountId}`);
    if (tx.targetAccountId && tx.targetAccountId !== parentAccountId) uniqueWritePaths.add(`accounts/${tx.targetAccountId}`);
  });
  // Also parent account update is needed
  uniqueWritePaths.add(`accounts/${parentAccountId}`);

  if (uniqueWritePaths.size > 250) {
    throw new Error("Esta cuenta/bolsillo tiene demasiados datos asociados para eliminarla desde esta pantalla.");
  }

  return {
    ownerId,
    mode: "pocket",
    parentAccountId,
    deleteAccountId: null,
    deletePocketIds: [pocketId],
    pocketBalanceToRelease: pocketBalanceToRelease,
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

const buildDeleteAccountCascadePlan = async ({
  ownerId,
  accountId,
}: DeleteAccountCascadeInput): Promise<CascadePlan> => {
  const db = getFirebaseDb();
  const accountRef = doc(db, "accounts", accountId);
  const accountSnap = await runTransaction(db, async (transaction) => transaction.get(accountRef));
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

  // Fetch linked deudas and shares
  const debtsSnap1 = await queryInChunks(
    collection(db, "household_debts"),
    "outgoingTransactionId",
    transactionIds
  );
  const debtsSnap2 = await queryInChunks(
    collection(db, "household_debts"),
    "incomingTransactionId",
    transactionIds
  );
  const debtsMap = new Map<string, LinkedDebt>();
  debtsSnap1.forEach((docItem) => debtsMap.set(docItem.id, { id: docItem.id, ref: docItem.ref, ...docItem.data() } as LinkedDebt));
  debtsSnap2.forEach((docItem) => debtsMap.set(docItem.id, { id: docItem.id, ref: docItem.ref, ...docItem.data() } as LinkedDebt));
  const linkedDebts = Array.from(debtsMap.values());

  const sharesSnap = await queryInChunks(
    collection(db, "household_event_shares"),
    "completedByTransactionId",
    transactionIds
  );
  const linkedEventShares = sharesSnap.map((docItem): LinkedEventShare => ({ id: docItem.id, ref: docItem.ref, ...docItem.data() }));

  // Load related events
  const relatedEventIds = Array.from(new Set(transactions.map((tx) => tx.relatedEventId).filter(Boolean))) as string[];
  const linkedEventsToCancel: LinkedEvent[] = [];
  for (const eventId of relatedEventIds) {
    const eventSnap = await getDoc(doc(db, "household_events", eventId));
    if (eventSnap.exists()) {
      const eventData = eventSnap.data();
      // Only cancel event if created by the owner
      if (toSafeString(eventData.createdByUserId) === ownerId) {
        linkedEventsToCancel.push({ id: eventSnap.id, ref: eventSnap.ref, ...eventData } as LinkedEvent);
      }
    }
  }

  // Fetch derivative event shares and debts if events are cancelled
  const cancelledEventIds = linkedEventsToCancel.map((e) => e.id);
  const derivativeSharesSnap = await queryInChunks(
    collection(db, "household_event_shares"),
    "eventId",
    cancelledEventIds
  );
  const derivativeDebtsSnap = await queryInChunks(
    collection(db, "household_debts"),
    "eventId",
    cancelledEventIds
  );
  const derivativeSharesToCancel = derivativeSharesSnap.map((docItem): LinkedEventShare => ({ id: docItem.id, ref: docItem.ref, ...docItem.data() }));
  const derivativeDebtsToCancel = derivativeDebtsSnap.map((docItem): LinkedDebt => ({ id: docItem.id, ref: docItem.ref, ...docItem.data() }));

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
        throw new Error("Una cuenta asociada a la eliminacion no existe.");
      }
      const data = snap.data();
      if (toSafeString(data.ownerId) !== plan.ownerId) {
        throw new Error("La eliminacion involucra una cuenta que no te pertenece.");
      }
      accountSnaps.set(accountId, data);
    }

    const pocketRefs = plan.deletePocketIds.map((pocketId) =>
      doc(db, "accounts", plan.parentAccountId, "pockets", pocketId)
    );
    const pocketSnaps = new Map<string, DocumentData>();
    for (const pocketRef of pocketRefs) {
      const snap = await transaction.get(pocketRef);
      if (!snap.exists()) {
        throw new Error("Uno de los bolsillos ya no existe.");
      }
      pocketSnaps.set(pocketRef.id, snap.data());
    }

    const movementRefs = new Map<string, DocumentReference>();
    const movementSnaps = new Map<string, DocumentData>();
    for (const movement of plan.transactions) {
      const movementRef = doc(db, "transactions", movement.id);
      const movementSnap = await transaction.get(movementRef);
      if (!movementSnap.exists()) {
        throw new Error("Uno de los movimientos ya no existe.");
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
        throw new Error("Una de las entries de dinero no propio no existe.");
      }
      const entryData = entrySnap.data();
      if (toSafeString(entryData.ownerId) !== plan.ownerId) {
        throw new Error("No tienes permiso sobre una entry de dinero no propio.");
      }
      entrySnaps.set(entryId, entryData);
    }

    // Lock consumptions
    for (const consumption of plan.existingConsumptions) {
      const conRef = doc(db, "third_party_fund_consumptions", consumption.id);
      await transaction.get(conRef);
    }

    // Lock deudas and event shares
    for (const debt of plan.linkedDebts) {
      await transaction.get(debt.ref);
    }
    for (const s of plan.linkedEventShares) {
      await transaction.get(s.ref);
    }
    for (const e of plan.linkedEventsToCancel) {
      await transaction.get(e.ref);
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
        throw new Error("No se pudo resolver una cuenta sobreviviente para ajustar saldo.");
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

    // Cancel derivative shares of cancelled events
    for (const share of plan.derivativeSharesToCancel) {
      transaction.update(share.ref, {
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

    // Revert/unlink transaction reference in event shares (completions)
    for (const share of plan.linkedEventShares) {
      transaction.update(share.ref, {
        completedByTransactionId: null,
        completedAt: null,
        status: "pending_completion",
        updatedAt: serverTimestamp(),
      });
    }

    // Delete Transactions
    for (const movement of plan.transactions) {
      transaction.delete(movementRefs.get(movement.id)!);
    }

    // Delete Pockets
    for (const pocketId of plan.deletePocketIds) {
      transaction.delete(doc(db, "accounts", plan.parentAccountId, "pockets", pocketId));
    }

    // Delete Account
    if (plan.deleteAccountId) {
      transaction.delete(doc(db, "accounts", plan.deleteAccountId));
    }
  });

  // Post-Delete Audit
  await runPostDeleteAudit(plan);
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

  // 4. Verify no active projections for deleted transactions
  if (txIds.length > 0) {
    const activeProjections = await queryInChunks(
      collection(db, "household_income_entries"),
      "sourceTransactionId",
      txIds,
      [where("status", "==", "active")]
    );
    if (activeProjections.length > 0) {
      throw new Error(`Auditoria fallo: Proyección de hogar activa todavia existe para transaccion eliminada.`);
    }
  }
};

export const deletePocketCascade = async (payload: DeletePocketCascadeInput): Promise<void> => {
  const plan = await buildDeletePocketCascadePlan(payload);
  await executeCascadePlan(plan);
};

export const deleteAccountCascade = async (payload: DeleteAccountCascadeInput): Promise<void> => {
  const plan = await buildDeleteAccountCascadePlan(payload);
  await executeCascadePlan(plan);
};
