import { collection, doc, getDoc, getDocs, query, runTransaction, where } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { toSafeString } from "@/lib/firebase/firestore-parsers";
import { INITIAL_BALANCE_DESCRIPTION } from "@/features/accounts/services/create-personal-account";

export type DeleteClosedPersonalAccountInput = {
  ownerId: string;
  accountId: string;
};

/** Forma mínima de una transacción relevante para decidir bloqueo/borrado — no acopla al tipo `Transaction` completo. */
export type MinimalOwnedTransaction = {
  id: string;
  type: string;
  accountId: string;
  targetAccountId: string | null;
  pocketId: string | null;
  targetPocketId: string | null;
  title: string;
  countsAsRealIncome: boolean;
  categoryId: string | null;
};

/**
 * Paridad Android (`AccountRepository.deleteAccount`, carve-out de
 * "Saldo inicial" en `TransactionDao.countBlockingTransactionsByAccount`):
 * la transacción técnica de saldo inicial de ESTA cuenta nunca bloquea el
 * borrado ni cuenta como "movimiento real". Debe pertenecer a esta cuenta
 * como origen (no como destino), ser un income, tener exactamente el título
 * canónico, `countsAsRealIncome === false` y sin categoría.
 */
export const isInitialBalanceTransactionForAccount = (
  tx: MinimalOwnedTransaction,
  accountId: string,
): boolean =>
  tx.type === "income" &&
  tx.accountId === accountId &&
  tx.title.trim() === INITIAL_BALANCE_DESCRIPTION &&
  tx.countsAsRealIncome === false &&
  !tx.categoryId;

/**
 * Paridad Android (carve-out `type = 'transfer' AND (pocketId != '' OR
 * targetPocketId != '')`): una transferencia que involucra un bolsillo en
 * cualquiera de sus dos lados ("pocket-trace") tampoco bloquea el borrado.
 */
export const isPocketTraceTransfer = (tx: MinimalOwnedTransaction): boolean =>
  tx.type === "transfer" && (!!tx.pocketId || !!tx.targetPocketId);

/**
 * Un movimiento "bloquea" el borrado de una cuenta ACTIVA (no archivada) si
 * no es ninguno de los dos carve-outs anteriores. Paridad Android exacta:
 * el ajuste técnico de saldo ("Ajuste manual de saldo") SÍ bloquea — solo el
 * saldo inicial y las transferencias con bolsillo están exceptuados.
 */
export const isBlockingTransactionForAccountDeletion = (
  tx: MinimalOwnedTransaction,
  accountId: string,
): boolean => !isInitialBalanceTransactionForAccount(tx, accountId) && !isPocketTraceTransfer(tx);

export type DeleteClosedPersonalAccountTransactionLike = {
  get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  delete: (ref: unknown) => void;
};

export type DeleteClosedPersonalAccountDeps = {
  getFirebaseDbFn?: () => unknown;
  docFn?: (...args: unknown[]) => unknown;
  collectionFn?: (...args: unknown[]) => unknown;
  queryFn?: (...args: unknown[]) => unknown;
  whereFn?: (...args: unknown[]) => unknown;
  getDocFn?: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  getDocsFn?: (q: unknown) => Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }> }>;
  runTransactionFn?: (
    db: unknown,
    updateFunction: (transaction: DeleteClosedPersonalAccountTransactionLike) => Promise<void>,
  ) => Promise<void>;
};

const mapTransactionDocForPlan = (id: string, data: Record<string, unknown>): MinimalOwnedTransaction => ({
  id,
  type: toSafeString(data.type),
  accountId: toSafeString(data.accountId),
  targetAccountId: toSafeString(data.targetAccountId) || null,
  pocketId: toSafeString(data.pocketId) || null,
  targetPocketId: toSafeString(data.targetPocketId) || null,
  title: toSafeString(data.title || data.name || data.description),
  countsAsRealIncome: data.countsAsRealIncome === false ? false : true,
  categoryId: toSafeString(data.categoryId) || null,
});

/**
 * Elimina definitivamente el CONTENEDOR de una cuenta personal. Paridad
 * Android (`AccountRepository.deleteAccount`):
 * - Precondición 1 (SIEMPRE, activa o cerrada): la cuenta no debe tener
 *   bolsillos — se bloquea, no se borran en cascada.
 * - Precondición 2 (SOLO si la cuenta NO está archivada): no debe tener
 *   movimientos "bloqueantes" — ver `isBlockingTransactionForAccountDeletion`.
 *   Una cuenta archivada (cerrada) se puede eliminar sin este chequeo,
 *   sin importar cuántos movimientos reales tenga.
 * - Al eliminar: se borra el documento de la cuenta y ÚNICAMENTE la(s)
 *   transacción(es) técnica(s) de "Saldo inicial" de esta cuenta (paridad
 *   Android exacta: `deleteAccount` borra igual esas + las de traza de
 *   bolsillo, pero estas últimas no pueden existir aquí porque la
 *   precondición 1 ya garantiza cero bolsillos). Ningún otro movimiento,
 *   categoría, bolsillo o registro de dinero no propio se toca.
 * - Toda pantalla histórica que referencie esta cuenta después de borrada
 *   debe degradar a "Cuenta eliminada" (ver `personal-view-model.ts`), nunca
 *   lanzar ni sustituir otra cuenta.
 * - Corrección P1-B (Paso 2): la autorización final de "está cerrada" se
 *   revalida DENTRO de la transacción con el snapshot fresco
 *   (`freshAccountData.archived === true`) — el `isArchived` calculado antes
 *   de la transacción (usado solo para decidir si aplica el chequeo de
 *   movimientos bloqueantes, más barato de evaluar temprano) NUNCA autoriza
 *   el borrado por sí mismo. Si la cuenta se reabrió entre la pre-lectura y
 *   el commit, la transacción rechaza sin borrar nada.
 */
export const deleteClosedPersonalAccount = async (
  payload: DeleteClosedPersonalAccountInput,
  deps: DeleteClosedPersonalAccountDeps = {},
): Promise<void> => {
  const getDbImpl = deps.getFirebaseDbFn ?? getFirebaseDb;
  const docImpl = deps.docFn ?? ((...args: unknown[]) => (doc as unknown as (...a: unknown[]) => unknown)(...args));
  const collectionImpl = deps.collectionFn ?? ((...args: unknown[]) => (collection as unknown as (...a: unknown[]) => unknown)(...args));
  const queryImpl = deps.queryFn ?? ((...args: unknown[]) => (query as unknown as (...a: unknown[]) => unknown)(...args));
  const whereImpl = deps.whereFn ?? ((...args: unknown[]) => (where as unknown as (...a: unknown[]) => unknown)(...args));
  const getDocImpl: NonNullable<DeleteClosedPersonalAccountDeps["getDocFn"]> =
    deps.getDocFn ??
    (async (ref: unknown) =>
      getDoc(ref as Parameters<typeof getDoc>[0]) as unknown as Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>);
  const getDocsImpl: NonNullable<DeleteClosedPersonalAccountDeps["getDocsFn"]> =
    deps.getDocsFn ??
    (async (q: unknown) =>
      getDocs(q as Parameters<typeof getDocs>[0]) as unknown as Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }> }>);
  const runTransactionImpl =
    deps.runTransactionFn ??
    ((database: unknown, updateFunction: (transaction: DeleteClosedPersonalAccountTransactionLike) => Promise<void>) =>
      runTransaction(
        database as ReturnType<typeof getFirebaseDb>,
        updateFunction as unknown as Parameters<typeof runTransaction>[1],
      ) as unknown as Promise<void>);

  const db = getDbImpl();
  const accountRef = docImpl(db, "accounts", payload.accountId);

  const accountSnap = await getDocImpl(accountRef);
  if (!accountSnap.exists()) {
    throw new Error("La cuenta no existe.");
  }
  const accountData = accountSnap.data();
  if (toSafeString(accountData.ownerId) !== payload.ownerId) {
    throw new Error("No tienes permiso para eliminar esta cuenta.");
  }
  const isArchived = accountData.archived === true;

  const pocketsSnap = await getDocsImpl(collectionImpl(db, "accounts", payload.accountId, "pockets"));
  if (pocketsSnap.docs.length > 0) {
    throw new Error(
      `Esta cuenta tiene ${pocketsSnap.docs.length} bolsillo(s). Resuélvelos o elimínalos antes de eliminar la cuenta.`,
    );
  }

  const [bySourceSnap, byTargetSnap] = await Promise.all([
    getDocsImpl(queryImpl(collectionImpl(db, "transactions"), whereImpl("ownerId", "==", payload.ownerId), whereImpl("accountId", "==", payload.accountId))),
    getDocsImpl(queryImpl(collectionImpl(db, "transactions"), whereImpl("ownerId", "==", payload.ownerId), whereImpl("targetAccountId", "==", payload.accountId))),
  ]);

  const byId = new Map<string, MinimalOwnedTransaction>();
  for (const d of bySourceSnap.docs) byId.set(d.id, mapTransactionDocForPlan(d.id, d.data()));
  for (const d of byTargetSnap.docs) byId.set(d.id, mapTransactionDocForPlan(d.id, d.data()));
  const transactions = Array.from(byId.values());

  if (!isArchived) {
    const blocking = transactions.filter((tx) => isBlockingTransactionForAccountDeletion(tx, payload.accountId));
    if (blocking.length > 0) {
      throw new Error(
        `Esta cuenta tiene ${blocking.length} movimiento(s) real(es). Ciérrala primero desde "Cerrar cuenta" para poder eliminarla.`,
      );
    }
  }

  const initialBalanceTxIds = transactions
    .filter((tx) => isInitialBalanceTransactionForAccount(tx, payload.accountId))
    .map((tx) => tx.id);

  await runTransactionImpl(db, async (transaction) => {
    const freshAccountSnap = await transaction.get(accountRef);
    if (!freshAccountSnap.exists()) {
      throw new Error("La cuenta no existe.");
    }
    const freshAccountData = freshAccountSnap.data();
    if (toSafeString(freshAccountData.ownerId) !== payload.ownerId) {
      throw new Error("No tienes permiso para eliminar esta cuenta.");
    }
    // Corrección P1-B (Paso 2): la decisión de permitir el borrado depende
    // EXCLUSIVAMENTE del snapshot leído dentro de esta transacción — nunca
    // del `isArchived` calculado antes de ella (esa lectura previa no es
    // atómica con este commit; otra pestaña pudo reabrir la cuenta mientras
    // tanto). Si ya no está cerrada, se rechaza sin tocar ningún documento.
    if (freshAccountData.archived !== true) {
      throw new Error("Solo puedes eliminar una cuenta cerrada.");
    }

    const txRefs = initialBalanceTxIds.map((id) => docImpl(db, "transactions", id));
    const txSnaps = await Promise.all(txRefs.map((ref) => transaction.get(ref)));

    txSnaps.forEach((snap, idx) => {
      if (snap.exists()) {
        transaction.delete(txRefs[idx]);
      }
    });

    transaction.delete(accountRef);
  });
};
