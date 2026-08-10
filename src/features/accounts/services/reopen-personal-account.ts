import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";

export type ReopenPersonalAccountInput = {
  ownerId: string;
  accountId: string;
};

export type ReopenPersonalAccountTransactionLike = {
  get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  update: (ref: unknown, data: Record<string, unknown>) => void;
};

export type ReopenPersonalAccountDeps = {
  getFirebaseDbFn?: () => unknown;
  docFn?: (...args: unknown[]) => unknown;
  runTransactionFn?: (
    db: unknown,
    updateFunction: (transaction: ReopenPersonalAccountTransactionLike) => Promise<void>,
  ) => Promise<void>;
};

/**
 * Reabre una cuenta personal cerrada. Paridad Android
 * (`AccountRepository.unarchiveAccount`):
 * - `archived = false`.
 * - `includeInTotal = true` SIEMPRE (forzado, incondicional) — Android no
 *   restaura una preferencia previa, no existe ningún campo que la guarde.
 * - No toca Disponible, bolsillos, historial, logo ni color.
 * - No crea movimientos ni recalcula saldos.
 * - Idempotente: reabrir una cuenta ya activa vuelve a escribir los mismos
 *   valores — seguro ante doble clic/reintento.
 */
export const reopenPersonalAccount = async (
  payload: ReopenPersonalAccountInput,
  deps: ReopenPersonalAccountDeps = {},
): Promise<void> => {
  const getDbImpl = deps.getFirebaseDbFn ?? getFirebaseDb;
  const docImpl = deps.docFn ?? ((...args: unknown[]) => (doc as unknown as (...a: unknown[]) => unknown)(...args));
  const runTransactionImpl =
    deps.runTransactionFn ??
    ((database: unknown, updateFunction: (transaction: ReopenPersonalAccountTransactionLike) => Promise<void>) =>
      runTransaction(
        database as ReturnType<typeof getFirebaseDb>,
        updateFunction as unknown as Parameters<typeof runTransaction>[1],
      ) as unknown as Promise<void>);

  const db = getDbImpl();

  await runTransactionImpl(db, async (transaction) => {
    const accountRef = docImpl(db, "accounts", payload.accountId);
    const accountSnap = await transaction.get(accountRef);

    if (!accountSnap.exists()) {
      throw new Error("La cuenta no existe.");
    }
    const accountData = accountSnap.data();
    if (accountData.ownerId !== payload.ownerId) {
      throw new Error("No tienes permiso para reabrir esta cuenta.");
    }

    transaction.update(accountRef, {
      archived: false,
      includeInTotal: true,
      updatedAt: serverTimestamp(),
    });
  });
};
