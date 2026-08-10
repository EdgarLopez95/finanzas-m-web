import { collection, doc, getDocs, runTransaction, serverTimestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { assertAccountHasNoPocketsForClose } from "@/lib/finance/account-pocket-count";

export type ClosePersonalAccountInput = {
  ownerId: string;
  accountId: string;
};

/**
 * Seam de inyección interno solo para pruebas (mismo patrón que
 * `declare-debt-payment.ts`): permite ejercer `closePersonalAccount` real con
 * una transacción Firestore simulada, sin tocar Firebase real.
 */
export type ClosePersonalAccountTransactionLike = {
  get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  update: (ref: unknown, data: Record<string, unknown>) => void;
};

export type ClosePersonalAccountDeps = {
  getFirebaseDbFn?: () => unknown;
  docFn?: (...args: unknown[]) => unknown;
  collectionFn?: (...args: unknown[]) => unknown;
  getDocsFn?: (query: unknown) => Promise<{ empty: boolean; size: number }>;
  runTransactionFn?: (
    db: unknown,
    updateFunction: (transaction: ClosePersonalAccountTransactionLike) => Promise<void>,
  ) => Promise<void>;
};

/**
 * Cierra ("archiva") una cuenta personal. Paridad Android
 * (`AccountRepository.archiveAccount`):
 * - Única precondición: la cuenta no debe tener bolsillos (no exige que el
 *   Disponible sea cero — Android tampoco lo exige).
 * - Efecto: `archived = true`, `includeInTotal = false` (forzado). No borra
 *   ni modifica saldos, movimientos ni datos descriptivos.
 * - Idempotente: cerrar una cuenta ya cerrada vuelve a escribir los mismos
 *   valores — no lanza ni duplica nada, seguro ante doble clic.
 *
 * Chequeo en dos capas:
 * 1. `getDocs(pockets)` previo (UX rápida + cuentas legacy sin `pocketCount`).
 * 2. Dentro de la txn: `assertAccountHasNoPocketsForClose` lee `pocketCount`
 *    del snapshot fresco. Create/delete bolsillo mutan el mismo doc de cuenta,
 *    así que una carrera hace retry y el close ve `pocketCount > 0`.
 */
export const closePersonalAccount = async (
  payload: ClosePersonalAccountInput,
  deps: ClosePersonalAccountDeps = {},
): Promise<void> => {
  const getDbImpl = deps.getFirebaseDbFn ?? getFirebaseDb;
  const docImpl = deps.docFn ?? ((...args: unknown[]) => (doc as unknown as (...a: unknown[]) => unknown)(...args));
  const collectionImpl = deps.collectionFn ?? ((...args: unknown[]) => (collection as unknown as (...a: unknown[]) => unknown)(...args));
  const getDocsImpl = deps.getDocsFn ?? ((query: unknown) => getDocs(query as Parameters<typeof getDocs>[0]));
  const runTransactionImpl =
    deps.runTransactionFn ??
    ((database: unknown, updateFunction: (transaction: ClosePersonalAccountTransactionLike) => Promise<void>) =>
      runTransaction(
        database as ReturnType<typeof getFirebaseDb>,
        updateFunction as unknown as Parameters<typeof runTransaction>[1],
      ) as unknown as Promise<void>);

  const db = getDbImpl();

  const pocketsRef = collectionImpl(db, "accounts", payload.accountId, "pockets");
  const pocketsSnap = await getDocsImpl(pocketsRef);
  if (!pocketsSnap.empty) {
    throw new Error(
      `Esta cuenta tiene ${pocketsSnap.size} bolsillo(s) activo(s). Resuélvelos o elimínalos antes de cerrar la cuenta.`,
    );
  }

  await runTransactionImpl(db, async (transaction) => {
    const accountRef = docImpl(db, "accounts", payload.accountId);
    const accountSnap = await transaction.get(accountRef);

    if (!accountSnap.exists()) {
      throw new Error("La cuenta no existe.");
    }
    const accountData = accountSnap.data();
    if (accountData.ownerId !== payload.ownerId) {
      throw new Error("No tienes permiso para cerrar esta cuenta.");
    }

    assertAccountHasNoPocketsForClose(accountData);

    transaction.update(accountRef, {
      archived: true,
      includeInTotal: false,
      updatedAt: serverTimestamp(),
    });
  });
};
