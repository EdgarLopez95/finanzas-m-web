import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { assertAccountNotArchived } from "@/features/accounts/services/account-lifecycle-guard";
import { nextPocketCountAfterCreate, readPocketCount } from "@/lib/finance/account-pocket-count";
import { allocateThirdPartyLocationFifo, projectThirdPartyHeldAtLocation } from "@/lib/finance/third-party-location";
import type { ThirdPartyLocationConsumption, ThirdPartyLocationEntry, ThirdPartyLocationMove } from "@/lib/finance/third-party-location";
import { assertSufficientOwnFunds } from "@/lib/finance/own-funds-gate";
import { readThirdPartyLocationSnapshot } from "@/features/transactions/services/read-third-party-location-snapshot";
import type { ThirdPartyLedgerState } from "@/features/transactions/services/create-third-party-location-transfer";


export type CreatePocketInput = {
  accountId: string;
  ownerId: string;
  name: string;
  balance: number;
  /** G2 — atribución del monto inicial. Ignorado si `balance === 0`. Default "own". */
  initialOwnership?: "own" | "third_party";
};

/**
 * Seam de inyección interno solo para pruebas (mismo patrón ya establecido en
 * `adjust-account-balance.ts`/`declare-debt-payment.ts`): permite ejercer
 * `createAccountPocket` real con una transacción Firestore simulada.
 */
export type CreateAccountPocketTransactionLike = {
  get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  set: (ref: unknown, data: Record<string, unknown>) => void;
  update: (ref: unknown, data: Record<string, unknown>) => void;
};

type ThirdPartyLocationSnapshotLike = {
  entries: ThirdPartyLocationEntry[];
  moves: ThirdPartyLocationMove[];
  consumptions: ThirdPartyLocationConsumption[];
};

export type CreateAccountPocketDeps = {
  getFirebaseDbFn?: () => unknown;
  docFn?: (...args: unknown[]) => unknown;
  collectionFn?: (...args: unknown[]) => unknown;
  getDocFn?: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  getDocsFn?: (query: unknown) => Promise<{ size: number }>;
  runTransactionFn?: (
    db: unknown,
    updateFunction: (transaction: CreateAccountPocketTransactionLike) => Promise<void>,
  ) => Promise<void>;
  /** G2 — snapshot de ubicación (entries/moves/consumptions), inyectable para tests. */
  readThirdPartyLocationSnapshotFn?: (ownerId: string) => Promise<ThirdPartyLocationSnapshotLike>;
};

const CONFLICT_MSG = "La versión del ledger cambió; se requiere reproyección.";
const EXHAUSTED_MSG = "Los datos cambiaron en otro dispositivo. Intenta nuevamente.";
const MAX_ATTEMPTS = 3;

/**
 * Crea un bolsillo dentro de una cuenta propia y le asigna un monto inicial
 * tomado del Disponible de esa cuenta. Todo ocurre en una sola transacción
 * Firestore: el bolsillo, el descuento del Disponible y el movimiento técnico
 * de traza se escriben juntos o no se escribe nada.
 *
 * G2 — atribución del monto inicial:
 * - `balance === 0`: crea el bolsillo vacío, sin tocar Disponible ni ownership.
 * - `initialOwnership === "own"` (default): la barrera es el dinero PROPIO en
 *   Disponible (físico − no propio retenido), no solo el físico. El held se
 *   lee antes de la transacción (mismo patrón que transfer/gasto propio,
 *   TD-09 aceptado: sin OCC de ledger porque no se mueve dinero no propio).
 * - `initialOwnership === "third_party"`: el monto sale del dinero no propio
 *   retenido en Disponible vía el mismo OCC de ubicación que usa el transfer
 *   no propio — FIFO + ledger versionado, reintento ≤3 en conflicto. Escribe
 *   `third_party_fund_location_operations` (`sourceKind: "pocket_initial"`)
 *   para que el mapa de ownership (G1) vea el held ya en el bolsillo nuevo.
 */
export const createAccountPocket = async (
  payload: CreatePocketInput,
  deps: CreateAccountPocketDeps = {},
): Promise<void> => {
  const balance = Number(payload.balance);

  if (!payload.name.trim()) {
    throw new Error("El nombre del bolsillo es obligatorio.");
  }
  if (!Number.isFinite(balance) || balance < 0) {
    throw new Error("El monto inicial del bolsillo debe ser mayor o igual a cero.");
  }

  if (balance > 0 && payload.initialOwnership === "third_party") {
    return createThirdPartyPocket(payload, deps, balance);
  }
  return createOwnPocket(payload, deps, balance);
};

// ──────────────────────────────────────────────────────────────────────────
// Mío (default) — barrera de dinero propio, sin OCC de ledger.
// ──────────────────────────────────────────────────────────────────────────

const createOwnPocket = async (
  payload: CreatePocketInput,
  deps: CreateAccountPocketDeps,
  balance: number,
): Promise<void> => {
  const getDbImpl = deps.getFirebaseDbFn ?? getFirebaseDb;
  const docImpl = deps.docFn ?? ((...args: unknown[]) => (doc as unknown as (...a: unknown[]) => unknown)(...args));
  const collectionImpl = deps.collectionFn ?? ((...args: unknown[]) => (collection as unknown as (...a: unknown[]) => unknown)(...args));
  const getDocImpl: NonNullable<CreateAccountPocketDeps["getDocFn"]> =
    deps.getDocFn ??
    (async (ref: unknown) => {
      const snap = await getDoc(ref as Parameters<typeof getDoc>[0]);
      return { exists: () => snap.exists(), data: () => snap.data() as Record<string, unknown> };
    });
  const getDocsImpl = deps.getDocsFn ?? ((query: unknown) => getDocs(query as Parameters<typeof getDocs>[0]));
  const readSnapshotImpl = deps.readThirdPartyLocationSnapshotFn ?? readThirdPartyLocationSnapshot;
  const runTransactionImpl =
    deps.runTransactionFn ??
    ((database: unknown, updateFunction: (transaction: CreateAccountPocketTransactionLike) => Promise<void>) =>
      runTransaction(
        database as ReturnType<typeof getFirebaseDb>,
        updateFunction as unknown as Parameters<typeof runTransaction>[1],
      ) as unknown as Promise<void>);

  const db = getDbImpl();
  const accountRef = docImpl(db, "accounts", payload.accountId);

  // Bootstrap legacy fuera de la txn (SDK Web no permite query dentro de ella).
  let observedPocketDocsWhenUnset = 0;
  const accountPre = await getDocImpl(accountRef);
  const accountPreData = accountPre.exists() ? (accountPre.data() as Record<string, unknown>) : null;
  if (accountPreData && readPocketCount(accountPreData) === null) {
    const pocketsSnap = await getDocsImpl(collectionImpl(db, "accounts", payload.accountId, "pockets"));
    observedPocketDocsWhenUnset = pocketsSnap.size;
  }

  // G2 — held en Disponible leído ANTES de la transacción (mismo patrón que
  // `create-personal-transfer.ts`): la barrera es el dinero propio, no solo
  // el físico.
  const ownershipSnapshot = balance > 0 ? await readSnapshotImpl(payload.ownerId) : null;

  await runTransactionImpl(db, async (transaction) => {
    const accountSnap = await transaction.get(accountRef);

    if (!accountSnap.exists()) {
      throw new Error("La cuenta seleccionada no existe.");
    }

    const accountData = accountSnap.data();
    if (accountData.ownerId !== payload.ownerId) {
      throw new Error("No tienes permiso para modificar esta cuenta.");
    }
    // Corrección P1-A (Paso 2): una cuenta cerrada no puede recibir nuevos
    // bolsillos — chequeo con el snapshot fresco, antes de cualquier escritura.
    assertAccountNotArchived(accountData);

    const currentBalanceRaw = accountData.currentBalance ?? accountData.balance;
    const currentBalance = typeof currentBalanceRaw === "number" ? currentBalanceRaw : Number(currentBalanceRaw ?? 0);

    if (balance > 0 && ownershipSnapshot) {
      const held = projectThirdPartyHeldAtLocation(
        { accountId: payload.accountId, pocketId: null },
        ownershipSnapshot.entries,
        ownershipSnapshot.moves,
        ownershipSnapshot.consumptions,
      );
      assertSufficientOwnFunds({ physicalBalance: currentBalance, thirdPartyHeld: held, amount: balance });
    }

    const nextBalance = currentBalance - balance;
    const nextPocketCount = nextPocketCountAfterCreate(accountData, observedPocketDocsWhenUnset);

    // Crear el bolsillo bajo la colección pockets de la cuenta
    const pocketRef = docImpl(collectionImpl(db, "accounts", payload.accountId, "pockets"));
    transaction.set(pocketRef, {
      name: payload.name.trim(),
      balance: balance,
      createdAt: serverTimestamp(),
    });

    // Descontar del saldo disponible + pocketCount (serializa vs close).
    transaction.update(accountRef, {
      currentBalance: nextBalance,
      pocketCount: nextPocketCount,
      updatedAt: serverTimestamp(),
    });

    if (balance > 0) {
      const pocketId = (pocketRef as { id: string }).id;
      const txId = `pocket-initial:${pocketId}`;
      const transactionRef = docImpl(collectionImpl(db, "transactions"), txId);

      transaction.set(transactionRef, {
        ownerId: payload.ownerId,
        type: "transfer",
        amount: balance,
        accountId: payload.accountId,
        pocketId: null,
        targetAccountId: payload.accountId,
        targetPocketId: pocketId,
        categoryId: null,
        date: Timestamp.now(),
        title: "Saldo inicial",
        notes: "Transferencia inicial al crear bolsillo",
        createdAt: serverTimestamp(),
        source: "manual",
        status: "confirmed",
        isHousehold: false,
        householdId: null,
        countsAsRealIncome: false,
        consumesThirdPartyFunds: false,
      });

    }
  });
};

// ──────────────────────────────────────────────────────────────────────────
// No propio — OCC de ubicación (clon del loop de `createThirdPartyLocationTransfer`,
// comentarios "G2" marcan lo específico de crear bolsillo).
// ──────────────────────────────────────────────────────────────────────────

const readLedgerState = async (
  ownerId: string,
  db: unknown,
  docImpl: (...args: unknown[]) => unknown,
  getDocImpl: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>,
): Promise<ThirdPartyLedgerState> => {
  const ref = docImpl(db, "third_party_fund_location_ledger", ownerId);
  const snap = await getDocImpl(ref);
  if (!snap.exists()) throw new Error("El ledger OCC no ha sido inicializado.");
  const data = snap.data();
  return {
    ownerId: data.ownerId as string,
    version: data.version as number,
    lastOperationId: (data.lastOperationId as string | null) ?? null,
  };
};

const createThirdPartyPocket = async (
  payload: CreatePocketInput,
  deps: CreateAccountPocketDeps,
  balance: number,
): Promise<void> => {
  const getDbImpl = deps.getFirebaseDbFn ?? getFirebaseDb;
  const docImpl = deps.docFn ?? ((...args: unknown[]) => (doc as unknown as (...a: unknown[]) => unknown)(...args));
  const collectionImpl = deps.collectionFn ?? ((...args: unknown[]) => (collection as unknown as (...a: unknown[]) => unknown)(...args));
  const getDocImpl: NonNullable<CreateAccountPocketDeps["getDocFn"]> =
    deps.getDocFn ??
    (async (ref: unknown) => {
      const snap = await getDoc(ref as Parameters<typeof getDoc>[0]);
      return { exists: () => snap.exists(), data: () => snap.data() as Record<string, unknown> };
    });
  const getDocsImpl = deps.getDocsFn ?? ((query: unknown) => getDocs(query as Parameters<typeof getDocs>[0]));
  const readSnapshotImpl = deps.readThirdPartyLocationSnapshotFn ?? readThirdPartyLocationSnapshot;
  const runTransactionImpl =
    deps.runTransactionFn ??
    ((database: unknown, updateFunction: (transaction: CreateAccountPocketTransactionLike) => Promise<void>) =>
      runTransaction(
        database as ReturnType<typeof getFirebaseDb>,
        updateFunction as unknown as Parameters<typeof runTransaction>[1],
      ) as unknown as Promise<void>);

  const db = getDbImpl();
  const accountRef = docImpl(db, "accounts", payload.accountId);

  // G2 — mismo bootstrap del ledger OCC que usan transfer/gasto no propio.
  const { ensureThirdPartyLocationLedger } = await import("@/features/transactions/services/ensure-third-party-location-ledger");
  await ensureThirdPartyLocationLedger(payload.ownerId, { db, ref: docImpl, run: deps.runTransactionFn as never });

  // Bootstrap legacy de pocketCount, igual que la ruta "own", fuera de la txn.
  let observedPocketDocsWhenUnset = 0;
  const accountPre = await getDocImpl(accountRef);
  const accountPreData = accountPre.exists() ? (accountPre.data() as Record<string, unknown>) : null;
  if (accountPreData && readPocketCount(accountPreData) === null) {
    const pocketsSnap = await getDocsImpl(collectionImpl(db, "accounts", payload.accountId, "pockets"));
    observedPocketDocsWhenUnset = pocketsSnap.size;
  }

  // G2 — pocketId estable generado UNA sola vez, reusado en todos los
  // intentos OCC (tanto los nuestros como los reintentos internos de
  // Firestore): así `operationId`/`pocketId` nunca cambian entre reintentos.
  const pocketRef = docImpl(collectionImpl(db, "accounts", payload.accountId, "pockets"));
  const pocketId = (pocketRef as { id: string }).id;
  const operationId = `pocket-initial:${pocketId}`;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // 1. Leer ledger y snapshot FUERA de la transacción.
    const [ledger, snapshot] = await Promise.all([
      readLedgerState(payload.ownerId, db, docImpl, getDocImpl),
      readSnapshotImpl(payload.ownerId),
    ]);
    const expectedVersion = ledger.version;

    // 2. Planear FIFO desde Disponible → nuevo bolsillo. Errores de negocio
    //    (insuficiente, inconsistente) NO se reintentan.
    let fifoLines: Array<{ entryId: string; amount: number }>;
    try {
      fifoLines = allocateThirdPartyLocationFifo(
        balance,
        snapshot.entries,
        snapshot.moves,
        snapshot.consumptions,
        { accountId: payload.accountId, pocketId: null },
      );
    } catch (bizError) {
      throw bizError;
    }

    try {
      await runTransactionImpl(db, async (transaction) => {
        const ledgerRef = docImpl(db, "third_party_fund_location_ledger", payload.ownerId);

        const [accountSnap, ledgerSnap] = await Promise.all([
          transaction.get(accountRef),
          transaction.get(ledgerRef),
        ]);

        if (!accountSnap.exists()) throw new Error("La cuenta seleccionada no existe.");
        if (!ledgerSnap.exists()) throw new Error("El ledger OCC no ha sido inicializado.");

        const accountData = accountSnap.data();
        if (accountData.ownerId !== payload.ownerId) {
          throw new Error("No tienes permiso para modificar esta cuenta.");
        }
        assertAccountNotArchived(accountData);

        const ledgerData = ledgerSnap.data();
        if (ledgerData.ownerId !== payload.ownerId || ledgerData.version !== expectedVersion) {
          throw new Error(CONFLICT_MSG);
        }

        const currentBalanceRaw = accountData.currentBalance ?? accountData.balance;
        const currentBalance = typeof currentBalanceRaw === "number" ? currentBalanceRaw : Number(currentBalanceRaw ?? 0);

        if (balance > currentBalance) {
          throw new Error(`Saldo disponible insuficiente ($ ${currentBalance.toLocaleString("es-CO")}) para asignar al bolsillo.`);
        }

        const nextBalance = currentBalance - balance;
        const nextPocketCount = nextPocketCountAfterCreate(accountData, observedPocketDocsWhenUnset);

        transaction.set(pocketRef, {
          name: payload.name.trim(),
          balance,
          createdAt: serverTimestamp(),
        });

        transaction.update(accountRef, {
          currentBalance: nextBalance,
          pocketCount: nextPocketCount,
          updatedAt: serverTimestamp(),
        });

        const transactionRef = docImpl(collectionImpl(db, "transactions"), operationId);
        transaction.set(transactionRef, {
          ownerId: payload.ownerId,
          type: "transfer",
          amount: balance,
          accountId: payload.accountId,
          pocketId: null,
          targetAccountId: payload.accountId,
          targetPocketId: pocketId,
          categoryId: null,
          date: Timestamp.now(),
          title: "Saldo inicial",
          notes: "Transferencia inicial al crear bolsillo (dinero no propio)",
          createdAt: serverTimestamp(),
          source: "manual",
          status: "confirmed",
          isHousehold: false,
          householdId: null,
          countsAsRealIncome: false,
          consumesThirdPartyFunds: false,
          movesThirdPartyFunds: true,
        });

        const opRef = docImpl(db, "third_party_fund_location_operations", operationId);
        transaction.set(opRef, {
          id: operationId,
          ownerId: payload.ownerId,
          sourceTransactionId: operationId,
          sourceKind: "pocket_initial",
          fromAccountId: payload.accountId,
          fromPocketId: null,
          toAccountId: payload.accountId,
          toPocketId: pocketId,
          totalAmount: balance,
          lines: fifoLines,
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.update(ledgerRef, {
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
