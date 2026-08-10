import { collection, doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { assertAccountNotArchived } from "@/features/accounts/services/account-lifecycle-guard";
import { nextPocketCountAfterDelete, readPocketCount } from "@/lib/finance/account-pocket-count";
import { Timestamp } from "firebase/firestore";
import { allocateThirdPartyLocationFifo, projectThirdPartyHeldAtLocation } from "@/lib/finance/third-party-location";
import type { ThirdPartyLocationConsumption, ThirdPartyLocationEntry, ThirdPartyLocationMove } from "@/lib/finance/third-party-location";
import { readThirdPartyLocationSnapshot } from "@/features/transactions/services/read-third-party-location-snapshot";
import type { ThirdPartyLedgerState } from "@/features/transactions/services/create-third-party-location-transfer";


export type DeletePocketInput = {
  accountId: string;
  pocketId: string;
  ownerId: string;
};

export type DeleteAccountPocketTransactionLike = {
  get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  delete: (ref: unknown) => void;
  update: (ref: unknown, data: Record<string, unknown>) => void;
  set: (ref: unknown, data: Record<string, unknown>) => void;
};

type ThirdPartyLocationSnapshotLike = {
  entries: ThirdPartyLocationEntry[];
  moves: ThirdPartyLocationMove[];
  consumptions: ThirdPartyLocationConsumption[];
};

export type DeleteAccountPocketDeps = {
  getFirebaseDbFn?: () => unknown;
  docFn?: (...args: unknown[]) => unknown;
  collectionFn?: (...args: unknown[]) => unknown;
  getDocFn?: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  runTransactionFn?: (
    db: unknown,
    updateFunction: (transaction: DeleteAccountPocketTransactionLike) => Promise<void>,
  ) => Promise<void>;
  /** G2 — snapshot de ubicación (entries/moves/consumptions), inyectable para tests. */
  readThirdPartyLocationSnapshotFn?: (ownerId: string) => Promise<ThirdPartyLocationSnapshotLike>;
};

const CONFLICT_MSG = "La versión del ledger cambió; se requiere reproyección.";
const EXHAUSTED_MSG = "Los datos cambiaron en otro dispositivo. Intenta nuevamente.";
const MAX_ATTEMPTS = 3;

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

/**
 * Elimina un bolsillo y devuelve su saldo físico completo al Disponible de la
 * cuenta, todo en una sola transacción Firestore. El total físico de la
 * cuenta no cambia.
 *
 * G2.1 — ruta ÚNICA, siempre bajo el gate del ledger OCC (cierra el hueco de
 * G2: un `preHeld` leído fuera de cualquier transacción podía quedar obsoleto
 * si otro cliente movía dinero no propio a este bolsillo justo antes del
 * commit, dejando held huérfano en un `pocketId` ya borrado). En cada
 * intento (≤3) se relee ledger + snapshot y se recalcula `held` desde cero;
 * dentro de la transacción SIEMPRE se valida `ledger.version`, así que
 * cualquier `location_op` concurrente hacia este bolsillo fuerza un retry que
 * ve el held actualizado:
 * - `held === 0` en el intento que termina comiteando: tx `pocket-delete-own:{id}`,
 *   sin `location_op` ni bump de ledger (nada que mover), pero el chequeo de
 *   versión sí ocurrió.
 * - `held > 0`: tx `pocket-delete:{id}` con `movesThirdPartyFunds: true` +
 *   `third_party_fund_location_operations` (`sourceKind: "pocket_delete"`) +
 *   ledger version+1, para que G1 no muestre un residual en la ubicación
 *   borrada.
 * - `held > físico` del bolsillo → inconsistencia: rechazo, NO se borra
 *   (sin clamp).
 */
export const deleteAccountPocket = async (
  payload: DeletePocketInput,
  deps: DeleteAccountPocketDeps = {},
): Promise<void> => {
  const getDbImpl = deps.getFirebaseDbFn ?? getFirebaseDb;
  const docImpl = deps.docFn ?? ((...args: unknown[]) => (doc as unknown as (...a: unknown[]) => unknown)(...args));
  const collectionImpl = deps.collectionFn ?? ((...args: unknown[]) => (collection as unknown as (...a: unknown[]) => unknown)(...args));
  const getDocImpl: NonNullable<DeleteAccountPocketDeps["getDocFn"]> =
    deps.getDocFn ??
    (async (ref: unknown) => {
      const snap = await getDoc(ref as Parameters<typeof getDoc>[0]);
      return { exists: () => snap.exists(), data: () => snap.data() as Record<string, unknown> };
    });
  const readSnapshotImpl = deps.readThirdPartyLocationSnapshotFn ?? readThirdPartyLocationSnapshot;
  const runTransactionImpl =
    deps.runTransactionFn ??
    ((database: unknown, updateFunction: (transaction: DeleteAccountPocketTransactionLike) => Promise<void>) =>
      runTransaction(
        database as ReturnType<typeof getFirebaseDb>,
        updateFunction as unknown as Parameters<typeof runTransaction>[1],
      ) as unknown as Promise<void>);

  const db = getDbImpl();
  const accountRef = docImpl(db, "accounts", payload.accountId);
  const pocketRef = docImpl(db, "accounts", payload.accountId, "pockets", payload.pocketId);

  // G2.1 — mismo bootstrap del ledger OCC que usan transfer/gasto/create
  // pocket no propio. Se ejecuta SIEMPRE, no solo cuando ya se sabe que hay
  // held, porque el propio held solo se conoce leyendo el snapshot y el
  // ledger debe existir para poder validar versión en cualquier intento.
  const { ensureThirdPartyLocationLedger } = await import("@/features/transactions/services/ensure-third-party-location-ledger");
  await ensureThirdPartyLocationLedger(payload.ownerId, { db, ref: docImpl, run: deps.runTransactionFn as never });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // 1. Leer ledger y snapshot FUERA de la transacción, en cada intento.
    const [ledger, snapshot] = await Promise.all([
      readLedgerState(payload.ownerId, db, docImpl, getDocImpl),
      readSnapshotImpl(payload.ownerId),
    ]);
    const expectedVersion = ledger.version;

    const held = projectThirdPartyHeldAtLocation(
      { accountId: payload.accountId, pocketId: payload.pocketId },
      snapshot.entries,
      snapshot.moves,
      snapshot.consumptions,
    );

    // FIFO desde el bolsillo → Disponible. Errores de negocio (inconsistente,
    // insuficiente) NO se reintentan.
    let fifoLines: Array<{ entryId: string; amount: number }> = [];
    if (held > 0) {
      try {
        fifoLines = allocateThirdPartyLocationFifo(
          held,
          snapshot.entries,
          snapshot.moves,
          snapshot.consumptions,
          { accountId: payload.accountId, pocketId: payload.pocketId },
        );
      } catch (bizError) {
        throw bizError;
      }
    }

    const operationId = held > 0 ? `pocket-delete:${payload.pocketId}` : `pocket-delete-own:${payload.pocketId}`;

    try {
      await runTransactionImpl(db, async (transaction) => {
        const ledgerRef = docImpl(db, "third_party_fund_location_ledger", payload.ownerId);

        const [accountSnap, pocketSnap, ledgerSnap] = await Promise.all([
          transaction.get(accountRef),
          transaction.get(pocketRef),
          transaction.get(ledgerRef),
        ]);

        if (!accountSnap.exists()) throw new Error("La cuenta seleccionada no existe.");
        if (!pocketSnap.exists()) throw new Error("El bolsillo no existe.");
        if (!ledgerSnap.exists()) throw new Error("El ledger OCC no ha sido inicializado.");

        const accountData = accountSnap.data();
        if (accountData.ownerId !== payload.ownerId) {
          throw new Error("No tienes permiso para modificar esta cuenta.");
        }
        assertAccountNotArchived(accountData);

        // G2.1 — este chequeo de versión SIEMPRE ocurre, incluso cuando este
        // intento calculó held=0: si otro dispositivo movió dinero no propio
        // a este bolsillo entre la pre-lectura y el commit, el ledger avanzó
        // y este intento se rechaza como conflicto → retry → held actualizado.
        const ledgerData = ledgerSnap.data();
        if (ledgerData.ownerId !== payload.ownerId || ledgerData.version !== expectedVersion) {
          throw new Error(CONFLICT_MSG);
        }

        const pocketData = pocketSnap.data();
        const pocketBalance = Number(pocketData.balance ?? 0);

        // Sin clamp: si lo no propio retenido supera el físico del bolsillo,
        // se rechaza y NO se borra nada.
        if (held > pocketBalance) {
          throw new Error("La composición de dinero propio en el bolsillo es inconsistente.");
        }

        const currentBalanceRaw = accountData.currentBalance ?? accountData.balance;
        const currentAvailable = typeof currentBalanceRaw === "number" ? currentBalanceRaw : Number(currentBalanceRaw ?? 0);
        const nextAvailable = currentAvailable + pocketBalance;

        transaction.delete(pocketRef);

        const accountUpdate: Record<string, unknown> = {
          currentBalance: nextAvailable,
          updatedAt: serverTimestamp(),
        };
        if (readPocketCount(accountData) !== null) {
          accountUpdate.pocketCount = nextPocketCountAfterDelete(accountData);
        }
        transaction.update(accountRef, accountUpdate);

        if (pocketBalance > 0) {
          const transactionRef = docImpl(collectionImpl(db, "transactions"), operationId);
          transaction.set(transactionRef, {
            ownerId: payload.ownerId,
            type: "transfer",
            amount: pocketBalance,
            accountId: payload.accountId,
            pocketId: payload.pocketId,
            targetAccountId: payload.accountId, // Available
            targetPocketId: null, // Available
            categoryId: null,
            date: Timestamp.now(),
            title: "Cierre de bolsillo",
            notes: "Saldo retornado al disponible de la cuenta",
            createdAt: serverTimestamp(),
            source: "manual",
            status: "confirmed",
            isHousehold: false,
            householdId: null,
            countsAsRealIncome: false,
            consumesThirdPartyFunds: false,
            ...(held > 0 ? { movesThirdPartyFunds: true } : {}),
          });
        }

        if (held > 0) {
          const opRef = docImpl(db, "third_party_fund_location_operations", operationId);
          transaction.set(opRef, {
            id: operationId,
            ownerId: payload.ownerId,
            sourceTransactionId: operationId,
            sourceKind: "pocket_delete",
            fromAccountId: payload.accountId,
            fromPocketId: payload.pocketId,
            toAccountId: payload.accountId,
            toPocketId: null,
            totalAmount: held,
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
        }
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
