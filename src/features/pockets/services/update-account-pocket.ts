import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { assertAccountNotArchived } from "@/features/accounts/services/account-lifecycle-guard";

export type UpdatePocketInput = {
  accountId: string;
  pocketId: string;
  ownerId: string;
  name: string;
};

/**
 * Seam de inyección interno solo para pruebas (mismo patrón ya establecido en
 * `adjust-account-balance.ts`).
 */
export type UpdateAccountPocketTransactionLike = {
  get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  update: (ref: unknown, data: Record<string, unknown>) => void;
};

export type UpdateAccountPocketDeps = {
  getFirebaseDbFn?: () => unknown;
  docFn?: (...args: unknown[]) => unknown;
  runTransactionFn?: (
    db: unknown,
    updateFunction: (transaction: UpdateAccountPocketTransactionLike) => Promise<void>,
  ) => Promise<void>;
};

export const updateAccountPocket = async (
  payload: UpdatePocketInput,
  deps: UpdateAccountPocketDeps = {},
): Promise<void> => {
  if (!payload.name.trim()) {
    throw new Error("El nombre del bolsillo es obligatorio.");
  }

  const getDbImpl = deps.getFirebaseDbFn ?? getFirebaseDb;
  const docImpl = deps.docFn ?? ((...args: unknown[]) => (doc as unknown as (...a: unknown[]) => unknown)(...args));
  const runTransactionImpl =
    deps.runTransactionFn ??
    ((database: unknown, updateFunction: (transaction: UpdateAccountPocketTransactionLike) => Promise<void>) =>
      runTransaction(
        database as ReturnType<typeof getFirebaseDb>,
        updateFunction as unknown as Parameters<typeof runTransaction>[1],
      ) as unknown as Promise<void>);

  const db = getDbImpl();

  await runTransactionImpl(db, async (transaction) => {
    const accountRef = docImpl(db, "accounts", payload.accountId);
    const pocketRef = docImpl(db, "accounts", payload.accountId, "pockets", payload.pocketId);

    const [accountSnap, pocketSnap] = await Promise.all([
      transaction.get(accountRef),
      transaction.get(pocketRef),
    ]);

    if (!accountSnap.exists()) {
      throw new Error("La cuenta seleccionada no existe.");
    }
    if (!pocketSnap.exists()) {
      throw new Error("El bolsillo no existe.");
    }

    const accountData = accountSnap.data();
    if (accountData.ownerId !== payload.ownerId) {
      throw new Error("No tienes permiso para modificar esta cuenta.");
    }
    // Corrección P1-A (Paso 2): una cuenta cerrada no puede recibir cambios en
    // sus bolsillos — chequeo con el snapshot fresco, antes de cualquier escritura.
    assertAccountNotArchived(accountData);

    // Update pocket attributes
    transaction.update(pocketRef, {
      name: payload.name.trim(),
      updatedAt: serverTimestamp(),
    });
  });
};
