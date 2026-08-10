import { collection, doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { assertValidTransactionAmount } from "@/lib/finance/transaction-validation";
import { assertAccountNotArchived } from "@/features/accounts/services/account-lifecycle-guard";
import { projectThirdPartyHeldAtLocation } from "@/lib/finance/third-party-location";
import { assertSufficientOwnFunds } from "@/lib/finance/own-funds-gate";
import type { CreateTransferInput } from "@/types/transaction";
import { readThirdPartyLocationSnapshot } from "./read-third-party-location-snapshot";

export type CreatePersonalTransferTransactionLike = {
  get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  set: (ref: unknown, data: Record<string, unknown>) => void;
  update: (ref: unknown, data: Record<string, unknown>) => void;
};

export type CreatePersonalTransferDeps = {
  getFirebaseDbFn?: () => unknown;
  docFn?: (...args: unknown[]) => unknown;
  collectionFn?: (...args: unknown[]) => unknown;
  runTransactionFn?: (
    db: unknown,
    updateFunction: (transaction: CreatePersonalTransferTransactionLike) => Promise<void>,
  ) => Promise<void>;
  readThirdPartyLocationSnapshotFn?: typeof readThirdPartyLocationSnapshot;
};

export const createPersonalTransfer = async (
  payload: CreateTransferInput,
  deps: CreatePersonalTransferDeps = {},
): Promise<void> => {
  assertValidTransactionAmount(payload.amount);

  const docImpl = deps.docFn ?? ((...args: unknown[]) => (doc as unknown as (...a: unknown[]) => unknown)(...args));
  const collectionImpl = deps.collectionFn ?? ((...args: unknown[]) => (collection as unknown as (...a: unknown[]) => unknown)(...args));
  const runTransactionImpl =
    deps.runTransactionFn ??
    ((database: unknown, updateFunction: (transaction: CreatePersonalTransferTransactionLike) => Promise<void>) =>
      runTransaction(
        database as ReturnType<typeof getFirebaseDb>,
        updateFunction as unknown as Parameters<typeof runTransaction>[1],
      ) as unknown as Promise<void>);

  const db = deps.getFirebaseDbFn ? deps.getFirebaseDbFn() : getFirebaseDb();
  const readSnapshot = deps.readThirdPartyLocationSnapshotFn ?? readThirdPartyLocationSnapshot;

  const pocketId = payload.pocketId || null;
  const targetPocketId = payload.targetPocketId || null;

  if (payload.accountId === payload.targetAccountId && pocketId === targetPocketId) {
    throw new Error("El origen y destino de la transferencia no pueden ser idénticos.");
  }

  // Paridad funcional Android: la proyección se lee antes de la transacción
  // (Firestore Web no permite consultas de colección dentro de ella), pero el
  // físico se relee dentro de la transacción antes de aplicar el límite.
  const ownershipSnapshot = await readSnapshot(payload.ownerId);

  await runTransactionImpl(db, async (transaction) => {
    const sourceRef = docImpl(db, "accounts", payload.accountId);
    const targetRef = docImpl(db, "accounts", payload.targetAccountId);

    const sourcePocketRef = pocketId
      ? docImpl(db, "accounts", payload.accountId, "pockets", pocketId)
      : null;
    const targetPocketRef = targetPocketId
      ? docImpl(db, "accounts", payload.targetAccountId, "pockets", targetPocketId)
      : null;

    const [sourceSnap, targetSnap] = await Promise.all([
      transaction.get(sourceRef),
      transaction.get(targetRef),
    ]);

    if (!sourceSnap.exists()) {
      throw new Error("La cuenta origen no existe.");
    }
    if (!targetSnap.exists()) {
      throw new Error("La cuenta destino no existe.");
    }

    const sourceData = sourceSnap.data();
    const targetData = targetSnap.data();

    if (sourceData.ownerId !== payload.ownerId || targetData.ownerId !== payload.ownerId) {
      throw new Error("Solo puedes transferir entre cuentas propias.");
    }

    assertAccountNotArchived(sourceData);
    assertAccountNotArchived(targetData);

    let sourcePocketSnap = null;
    let targetPocketSnap = null;

    if (sourcePocketRef) {
      sourcePocketSnap = await transaction.get(sourcePocketRef);
      if (!sourcePocketSnap.exists()) {
        throw new Error("El bolsillo origen no existe.");
      }
    }

    if (targetPocketRef) {
      targetPocketSnap = await transaction.get(targetPocketRef);
      if (!targetPocketSnap.exists()) {
        throw new Error("El bolsillo destino no existe.");
      }
    }

    // Determine available balance at source container
    let sourceAvailable = 0;
    if (sourcePocketSnap) {
      sourceAvailable = Number(sourcePocketSnap.data()?.balance ?? 0);
    } else {
      const rawBal = sourceData.currentBalance ?? sourceData.balance;
      sourceAvailable = typeof rawBal === "number" ? rawBal : Number(rawBal ?? 0);
    }

    if (!Number.isFinite(sourceAvailable)) {
      throw new Error("El saldo de la cuenta origen es inválido.");
    }

    const thirdPartyHeld = projectThirdPartyHeldAtLocation(
      { accountId: payload.accountId, pocketId },
      ownershipSnapshot.entries,
      ownershipSnapshot.moves,
      ownershipSnapshot.consumptions,
    );

    // G5 — una sola barrera para el transfer propio: el gate canónico
    // (`own-funds-gate`) ya distingue falta de saldo físico, falta de dinero
    // propio y composición imposible, con el mismo copy que el panel del
    // formulario. Reemplaza el chequeo físico inline y el cálculo de `own`
    // que aquí estaban duplicados.
    assertSufficientOwnFunds({
      physicalBalance: sourceAvailable,
      thirdPartyHeld,
      amount: payload.amount,
    });

    // Determine balance at destination container
    let targetAvailable = 0;
    if (targetPocketSnap) {
      targetAvailable = Number(targetPocketSnap.data()?.balance ?? 0);
    } else {
      const rawBal = targetData.currentBalance ?? targetData.balance;
      targetAvailable = typeof rawBal === "number" ? rawBal : Number(rawBal ?? 0);
    }

    if (!Number.isFinite(targetAvailable)) {
      throw new Error("El saldo de la cuenta destino es inválido.");
    }

    // Apply updates
    if (sourcePocketRef && sourcePocketSnap) {
      transaction.update(sourcePocketRef, {
        balance: sourceAvailable - payload.amount,
        updatedAt: serverTimestamp(),
      });
    } else {
      transaction.update(sourceRef, {
        currentBalance: sourceAvailable - payload.amount,
        updatedAt: serverTimestamp(),
      });
    }

    if (targetPocketRef && targetPocketSnap) {
      transaction.update(targetPocketRef, {
        balance: targetAvailable + payload.amount,
        updatedAt: serverTimestamp(),
      });
    } else {
      transaction.update(targetRef, {
        currentBalance: targetAvailable + payload.amount,
        updatedAt: serverTimestamp(),
      });
    }

    const transactionRef = docImpl(collectionImpl(db, "transactions"));

    transaction.set(transactionRef, {
      ownerId: payload.ownerId,
      type: "transfer",
      amount: payload.amount,
      accountId: payload.accountId,
      pocketId: pocketId,
      targetAccountId: payload.targetAccountId,
      targetPocketId: targetPocketId,
      categoryId: null,
      date: Timestamp.fromDate(payload.date),
      description: payload.description?.trim() ?? "",
      createdAt: serverTimestamp(),
      source: "manual",
      status: "confirmed",
      isHousehold: false,
      householdId: null,
    });
  });
};
