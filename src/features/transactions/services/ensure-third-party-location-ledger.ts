import { doc, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";

type LedgerTx = {
  get(ref: unknown): Promise<{ exists(): boolean; data(): Record<string, unknown> }>;
  set(ref: unknown, data: Record<string, unknown>): void;
};
type Deps = {
  db?: unknown;
  ref?: (_db: unknown, ...path: string[]) => unknown;
  run?: (_db: unknown, callback: (tx: LedgerTx) => Promise<void>) => Promise<void>;
  timestamp?: () => unknown;
};

export const ensureThirdPartyLocationLedger = async (ownerId: string, deps: Deps = {}): Promise<void> => {
  if (!ownerId.trim()) throw new Error("El propietario del ledger es obligatorio.");
  const database = deps.db ?? getFirebaseDb();
  const ref = deps.ref ?? ((db: unknown, ...path: string[]) => (doc as unknown as (db: unknown, ...path: string[]) => unknown)(db, ...path));
  const timestamp = deps.timestamp ?? serverTimestamp;
  const run = deps.run ?? ((db, callback) => runTransaction(db as Firestore, callback as never));
  await run(database, async (transaction) => {
    const ledgerRef = ref(database, "third_party_fund_location_ledger", ownerId);
    const snapshot = await transaction.get(ledgerRef);
    if (!snapshot.exists()) {
      transaction.set(ledgerRef, { ownerId, version: 0, lastOperationId: null, updatedAt: timestamp() });
      return;
    }
    const data = snapshot.data();
    if (data.ownerId !== ownerId || !Number.isInteger(data.version) || (data.version as number) < 0) {
      throw new Error("El ledger remoto es inválido.");
    }
  });
};
