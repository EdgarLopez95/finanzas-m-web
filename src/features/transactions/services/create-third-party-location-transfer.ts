import { doc, runTransaction, serverTimestamp, Timestamp, type Firestore } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { assertAccountNotArchived } from "@/features/accounts/services/account-lifecycle-guard";
import { allocateThirdPartyLocationFifo } from "@/lib/finance/third-party-location";
import type {
  ThirdPartyLocationEntry,
  ThirdPartyLocationMove,
  ThirdPartyLocationConsumption,
} from "@/lib/finance/third-party-location";

// ──────────────────────────────────────────────────────────────────────────────
// Input público
// ──────────────────────────────────────────────────────────────────────────────

export type CreateThirdPartyLocationTransferInput = {
  ownerId: string;
  operationId: string;
  amount: number;
  fromAccountId: string;
  fromPocketId: string | null;
  toAccountId: string;
  toPocketId: string | null;
  date: Date;
  description?: string;
};

// ──────────────────────────────────────────────────────────────────────────────
// Snapshot de propiedad (inyectable para tests)
// ──────────────────────────────────────────────────────────────────────────────

export type ThirdPartyLocationSnapshot = {
  entries: ThirdPartyLocationEntry[];
  moves: ThirdPartyLocationMove[];
  consumptions: ThirdPartyLocationConsumption[];
};

export type ThirdPartyLedgerState = {
  ownerId: string;
  version: number;
  lastOperationId: string | null;
};

// ──────────────────────────────────────────────────────────────────────────────
// Dependencias inyectables
// ──────────────────────────────────────────────────────────────────────────────

type TxLike = {
  get(ref: unknown): Promise<{ exists(): boolean; data(): Record<string, unknown> }>;
  set(ref: unknown, data: Record<string, unknown>): void;
  update(ref: unknown, data: Record<string, unknown>): void;
};

export type CreateThirdPartyLocationTransferDeps = {
  db?: unknown;
  ref?: (db: unknown, ...path: string[]) => unknown;
  run?: (db: unknown, fn: (tx: TxLike) => Promise<void>) => Promise<void>;
  timestamp?: () => unknown;
  /** Lee el ledger actual del owner (fuera de la transacción, antes del intento). */
  readLedger?: (ownerId: string) => Promise<ThirdPartyLedgerState>;
  /** Lee el snapshot de ubicaciones (entries, moves, consumptions) del owner. */
  readSnapshot?: (ownerId: string) => Promise<ThirdPartyLocationSnapshot>;
};

// ──────────────────────────────────────────────────────────────────────────────
// Mensaje de error OCC exhausto
// ──────────────────────────────────────────────────────────────────────────────

const CONFLICT_MSG = "La versión del ledger cambió; se requiere reproyección.";
const EXHAUSTED_MSG = "Los datos cambiaron en otro dispositivo. Intenta nuevamente.";
const MAX_ATTEMPTS = 3;

// ──────────────────────────────────────────────────────────────────────────────
// Servicio principal
// ──────────────────────────────────────────────────────────────────────────────

export const createThirdPartyLocationTransfer = async (
  input: CreateThirdPartyLocationTransferInput,
  deps: CreateThirdPartyLocationTransferDeps = {},
): Promise<void> => {
  const {
    ownerId,
    operationId,
    amount,
    fromAccountId,
    fromPocketId,
    toAccountId,
    toPocketId,
    date,
    description = "",
  } = input;

  // Validación de identidad básica
  if (!ownerId.trim()) throw new Error("El propietario es obligatorio.");
  if (!operationId.trim()) throw new Error("El operationId es obligatorio.");
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("El monto debe ser positivo.");
  if (fromAccountId === toAccountId && fromPocketId === toPocketId)
    throw new Error("El origen y destino no pueden ser idénticos.");

  // Resolución de dependencias
  const database = deps.db ?? getFirebaseDb();
  const refFn =
    deps.ref ??
    ((db: unknown, ...path: string[]) =>
      (doc as unknown as (db: unknown, ...path: string[]) => unknown)(db, ...path));
  const timestamp = deps.timestamp ?? serverTimestamp;
  const runTx =
    deps.run ??
    ((db: unknown, fn: (tx: TxLike) => Promise<void>) =>
      runTransaction(
        db as Firestore,
        fn as Parameters<typeof runTransaction>[1],
      ) as unknown as Promise<void>);

  const readSnapshot =
    deps.readSnapshot ??
    (async (id: string): Promise<ThirdPartyLocationSnapshot> => {
      // Importación lazy para no romper el grafo en tests sin Firebase
      const { readThirdPartyLocationSnapshot } = await import(
        "@/features/transactions/services/read-third-party-location-snapshot"
      );
      return readThirdPartyLocationSnapshot(id);
    });

  const readLedger =
    deps.readLedger ??
    (async (id: string): Promise<ThirdPartyLedgerState> => {
      // Importación lazy del ledger
      const { doc: firestoreDoc, getDoc } = await import("firebase/firestore");
      const snap = await getDoc(
        firestoreDoc(database as Firestore, "third_party_fund_location_ledger", id),
      );
      if (!snap.exists()) throw new Error("El ledger OCC no ha sido inicializado.");
      const data = snap.data();
      return {
        ownerId: data.ownerId as string,
        version: data.version as number,
        lastOperationId: (data.lastOperationId as string | null) ?? null,
      };
    });

  // Loop OCC: máximo MAX_ATTEMPTS intentos
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // 1. Leer ledger y snapshot FUERA de la transacción (consultas de colección)
    const [ledger, snapshot] = await Promise.all([
      readLedger(ownerId),
      readSnapshot(ownerId),
    ]);

    const expectedVersion = ledger.version;

    // 2. Reconstruir FIFO desde cero (puede lanzar si hay error de negocio)
    //    Errores de negocio NO se reintentan.
    let fifoLines: Array<{ entryId: string; amount: number }>;
    try {
      fifoLines = allocateThirdPartyLocationFifo(
        amount,
        snapshot.entries,
        snapshot.moves,
        snapshot.consumptions,
        { accountId: fromAccountId, pocketId: fromPocketId },
      );
    } catch (bizError) {
      // Error de negocio (insuficiente, inconsistente, >50 líneas, ubicación null)
      // → propagar inmediatamente sin reintentar
      throw bizError;
    }

    // 3. Commit atómico: una única runTransaction con TODAS las escrituras
    try {
      await runTx(database, async (tx) => {
        // ── a. Leer saldos físicos y ledger DENTRO de la transacción ──────────
        const sourceRef = refFn(database, "accounts", fromAccountId);
        const targetRef = refFn(database, "accounts", toAccountId);
        const sourcePocketRef = fromPocketId
          ? refFn(database, "accounts", fromAccountId, "pockets", fromPocketId)
          : null;
        const targetPocketRef = toPocketId
          ? refFn(database, "accounts", toAccountId, "pockets", toPocketId)
          : null;
        const ledgerRef = refFn(
          database,
          "third_party_fund_location_ledger",
          ownerId,
        );

        const reads = [
          tx.get(sourceRef),
          tx.get(targetRef),
          tx.get(ledgerRef),
        ] as const;
        const [sourceSnap, targetSnap, ledgerSnap] = await Promise.all(reads);

        if (!sourceSnap.exists()) throw new Error("La cuenta origen no existe.");
        if (!targetSnap.exists()) throw new Error("La cuenta destino no existe.");
        if (!ledgerSnap.exists())
          throw new Error("El ledger OCC no ha sido inicializado.");

        const sourceData = sourceSnap.data();
        const targetData = targetSnap.data();
        const ledgerData = ledgerSnap.data();

        // ── b. Validaciones dentro de la transacción ──────────────────────────
        if (sourceData.ownerId !== ownerId || targetData.ownerId !== ownerId) {
          throw new Error("Solo puedes transferir entre cuentas propias.");
        }
        assertAccountNotArchived(sourceData);
        assertAccountNotArchived(targetData);

        // Verificar versión OCC
        if (ledgerData.ownerId !== ownerId || ledgerData.version !== expectedVersion) {
          throw new Error(CONFLICT_MSG);
        }

        // ── c. Determinar saldos físicos ──────────────────────────────────────
        type SnapLike = { exists(): boolean; data(): Record<string, unknown> };
        let sourcePocketSnap: SnapLike | null = null;
        let targetPocketSnap: SnapLike | null = null;

        if (sourcePocketRef) {
          sourcePocketSnap = await tx.get(sourcePocketRef);
          if (!sourcePocketSnap.exists()) throw new Error("El bolsillo origen no existe.");
        }
        if (targetPocketRef) {
          targetPocketSnap = await tx.get(targetPocketRef);
          if (!targetPocketSnap.exists()) throw new Error("El bolsillo destino no existe.");
        }

        const rawSourceBalance = sourcePocketSnap
          ? sourcePocketSnap.data().balance
          : (sourceData.currentBalance ?? sourceData.balance);
        const sourcePhysical =
          typeof rawSourceBalance === "number"
            ? rawSourceBalance
            : Number(rawSourceBalance ?? 0);

        const rawTargetBalance = targetPocketSnap
          ? targetPocketSnap.data().balance
          : (targetData.currentBalance ?? targetData.balance);
        const targetPhysical =
          typeof rawTargetBalance === "number"
            ? rawTargetBalance
            : Number(rawTargetBalance ?? 0);

        if (!Number.isFinite(sourcePhysical)) throw new Error("El saldo del origen es inválido.");
        if (!Number.isFinite(targetPhysical)) throw new Error("El saldo del destino es inválido.");

        if (amount > sourcePhysical) {
          throw new Error(
            `Saldo físico insuficiente en el origen (disponible: ${sourcePhysical.toLocaleString("es-CO")}).`,
          );
        }

        // ── d. Actualizar saldos físicos ──────────────────────────────────────
        if (sourcePocketRef && sourcePocketSnap) {
          tx.update(sourcePocketRef, { balance: sourcePhysical - amount, updatedAt: timestamp() });
        } else {
          tx.update(sourceRef, { currentBalance: sourcePhysical - amount, updatedAt: timestamp() });
        }

        if (targetPocketRef && targetPocketSnap) {
          tx.update(targetPocketRef, { balance: targetPhysical + amount, updatedAt: timestamp() });
        } else {
          tx.update(targetRef, { currentBalance: targetPhysical + amount, updatedAt: timestamp() });
        }

        // ── e. Crear transacción histórica ────────────────────────────────────
        const txRef = refFn(database, "transactions", operationId);
        tx.set(txRef, {
          ownerId,
          type: "transfer",
          amount,
          accountId: fromAccountId,
          pocketId: fromPocketId,
          targetAccountId: toAccountId,
          targetPocketId: toPocketId,
          categoryId: null,
          date: Timestamp.fromDate(date),
          description: description.trim(),
          createdAt: timestamp(),
          source: "manual",
          status: "confirmed",
          isHousehold: false,
          householdId: null,
          movesThirdPartyFunds: true,
        });

        // ── f. Crear operación OCC ────────────────────────────────────────────
        const opRef = refFn(
          database,
          "third_party_fund_location_operations",
          operationId,
        );
        tx.set(opRef, {
          id: operationId,
          ownerId,
          sourceTransactionId: operationId,
          sourceKind: "transfer",
          fromAccountId,
          fromPocketId,
          toAccountId,
          toPocketId,
          totalAmount: amount,
          lines: fifoLines,
          status: "active",
          createdAt: timestamp(),
          updatedAt: timestamp(),
        });

        // ── g. Actualizar ledger ──────────────────────────────────────────────
        tx.update(ledgerRef, {
          version: expectedVersion + 1,
          lastOperationId: operationId,
          updatedAt: timestamp(),
        });
      });

      // Commit exitoso → salir del loop
      return;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === CONFLICT_MSG &&
        attempt < MAX_ATTEMPTS - 1
      ) {
        // Conflicto OCC: reproyectar en el siguiente intento
        continue;
      }
      // Error de negocio o último intento agotado
      if (error instanceof Error && error.message === CONFLICT_MSG) {
        throw new Error(EXHAUSTED_MSG);
      }
      throw error;
    }
  }

  // Por construcción nunca llegamos aquí, pero TypeScript lo requiere
  throw new Error(EXHAUSTED_MSG);
};
