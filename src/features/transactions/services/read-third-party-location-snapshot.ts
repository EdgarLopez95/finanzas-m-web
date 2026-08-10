import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { MoneyLocation, ThirdPartyLocationConsumption, ThirdPartyLocationEntry, ThirdPartyLocationMove } from "@/lib/finance/third-party-location";

type Entry = { id: string; ownerId: string; sourceIncomeTransactionId: string; originalAmount: number; status: string; createdAtMillis: number };
type Operation = { fromAccountId: string; fromPocketId: string | null; toAccountId: string; toPocketId: string | null; lines: Array<{ entryId: string; amount: number }>; status: string };
type Consumption = { entryId: string; consumerExpenseTransactionId: string; amount: number };
type Tx = { accountId?: unknown; pocketId?: unknown };
const locationOf = (tx: Tx | undefined): MoneyLocation | null => typeof tx?.accountId === "string" && tx.accountId ? { accountId: tx.accountId, pocketId: typeof tx.pocketId === "string" ? tx.pocketId : null } : null;
const millis = (value: unknown): number => value && typeof (value as { toMillis?: unknown }).toMillis === "function" ? (value as { toMillis(): number }).toMillis() : 0;

export const buildThirdPartyLocationSnapshot = (input: { entries: Entry[]; transactions: Map<string, Tx>; operations: Operation[]; consumptions: Consumption[] }) => {
  const entries: ThirdPartyLocationEntry[] = input.entries.filter((entry) => entry.status !== "cancelled").map((entry) => ({ entryId: entry.id, createdAtMillis: entry.createdAtMillis, originalAmount: entry.originalAmount, location: locationOf(input.transactions.get(entry.sourceIncomeTransactionId)) }));
  const moves: ThirdPartyLocationMove[] = input.operations.filter((operation) => operation.status === "active").flatMap((operation) => operation.lines.map((line) => ({ entryId: line.entryId, amount: line.amount, from: { accountId: operation.fromAccountId, pocketId: operation.fromPocketId }, to: { accountId: operation.toAccountId, pocketId: operation.toPocketId } })));
  const consumptions: ThirdPartyLocationConsumption[] = input.consumptions.map((consumption) => ({ entryId: consumption.entryId, amount: consumption.amount, location: locationOf(input.transactions.get(consumption.consumerExpenseTransactionId)) }));
  return { entries, moves, consumptions };
};

export const readThirdPartyLocationSnapshot = async (
  ownerId: string,
  deps?: {
    getFirebaseDbFn?: typeof getFirebaseDb;
    getDocsFn?: typeof getDocs;
    getDocFn?: typeof getDoc;
    queryFn?: typeof query;
    collectionFn?: typeof collection;
    whereFn?: typeof where;
    docFn?: typeof doc;
  }
) => {
  const db = deps?.getFirebaseDbFn?.() || getFirebaseDb();
  const _getDocs = deps?.getDocsFn || getDocs;
  const _getDoc = deps?.getDocFn || getDoc;
  const _query = deps?.queryFn || query;
  const _collection = deps?.collectionFn || collection;
  const _where = deps?.whereFn || where;
  const _doc = deps?.docFn || doc;

  const [entrySnap, consumptionSnap, operationSnap] = await Promise.all([
    _getDocs(_query(_collection(db, "third_party_fund_entries"), _where("ownerId", "==", ownerId))),
    _getDocs(_query(_collection(db, "third_party_fund_consumptions"), _where("ownerId", "==", ownerId))),
    _getDocs(_query(_collection(db, "third_party_fund_location_operations"), _where("ownerId", "==", ownerId))),
  ]);
  const entries = entrySnap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Entry, "id" | "createdAtMillis">), createdAtMillis: millis(item.data().createdAt) }));
  const consumptions = consumptionSnap.docs.map((item) => item.data() as Consumption);
  const operations = operationSnap.docs.map((item) => item.data() as Operation);
  const txIds = new Set([...entries.map((item) => item.sourceIncomeTransactionId), ...consumptions.map((item) => item.consumerExpenseTransactionId)]);
  const snapshots = await Promise.all([...txIds].map(async (id) => [id, await _getDoc(_doc(db, "transactions", id))] as const));
  const transactions = new Map<string, Tx>();
  for (const [id, snapshot] of snapshots) if (snapshot.exists()) transactions.set(id, snapshot.data());
  return buildThirdPartyLocationSnapshot({ entries, transactions, operations, consumptions });
};
