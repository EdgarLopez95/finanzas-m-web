/**
 * ============================================================================
 * HERRAMIENTA QA/DEBUG — SOLO PARA DESARROLLO. Retirar antes de producción.
 * ============================================================================
 *
 * Borrado paginado de los datos personales del usuario actual, filtrados
 * estrictamente por `ownerId`. Paridad funcional con
 * `DebugDataResetRepository.kt` (Android): incluye `third_party_fund_entries`,
 * `third_party_fund_consumptions` Y `third_party_fund_location_operations` —
 * las 3 colecciones de dinero no propio que Android borra por `ownerId`. Web
 * hoy no CREA `third_party_fund_location_operations` en su propio flujo, pero
 * eso no autoriza dejar residuos si esos documentos existieran (ej. creados
 * desde el cliente Android de la misma cuenta, ya que Firestore es
 * compartido) — las Rules (`android/firestore.rules`) permiten `allow delete:
 * if isOwner(resource.data.ownerId)` para esa colección igual que las demás.
 *
 * No usa una transacción global: cada colección se pagina y borra en batches
 * de máximo `QA_RESET_PAGE_SIZE` documentos (ver `qa-reset-batch-delete.ts`).
 * Un fallo en una colección no detiene el borrado de las demás — se acumula
 * en `failed` para que el llamador pueda ofrecer "Reintentar" sin afirmar
 * éxito total.
 */
import { collection, getDocs, limit, query, where, writeBatch } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  QA_RESET_PAGE_SIZE,
  addQaResetWipeResults,
  deleteCollectionByField,
  deleteRefsInSafeBatches,
  type QaResetWipeResult,
  type QaResetBatchDeleteDeps,
} from "@/features/qa-reset/services/qa-reset-batch-delete";

export { QA_RESET_PAGE_SIZE };

/**
 * Colecciones personales de nivel superior filtradas por `ownerId`, paridad
 * exacta con las que Android borra en `resetAllDataForCurrentUser` para el
 * scope personal. `accounts` se maneja aparte por su subcolección `pockets`.
 */
export const QA_RESET_PERSONAL_COLLECTIONS = [
  "transactions",
  "categories",
  "third_party_fund_entries",
  "third_party_fund_consumptions",
  "third_party_fund_location_operations",
] as const;

export type { QaResetWipeResult };

export type ResetPersonalDataDeps = {
  queryOwnerPage?: (
    collectionName: string,
    ownerId: string,
    pageSize: number,
  ) => Promise<{ refs: unknown[]; hasMore: boolean }>;
  queryAccountsForOwner?: (ownerId: string) => Promise<unknown[]>;
  queryPocketsForAccount?: (accountRef: unknown) => Promise<unknown[]>;
  commitBatchDelete?: (refs: unknown[]) => Promise<void>;
};

// Nota importante: `getFirebaseDb()` se llama DENTRO de cada default, no al
// construirlo — así, cuando un test inyecta sus propios `deps`, estos
// defaults nunca se invocan y `getFirebaseDb()` (que exige config real de
// Firebase) nunca se ejecuta.
const defaultQueryOwnerPage: NonNullable<ResetPersonalDataDeps["queryOwnerPage"]> = async (
  collectionName,
  ownerId,
  pageSize,
) => {
  const db = getFirebaseDb();
  const q = query(collection(db, collectionName), where("ownerId", "==", ownerId), limit(pageSize));
  const snap = await getDocs(q);
  return { refs: snap.docs.map((docSnap) => docSnap.ref), hasMore: snap.docs.length >= pageSize };
};

const defaultQueryAccountsForOwner: NonNullable<ResetPersonalDataDeps["queryAccountsForOwner"]> = async (ownerId) => {
  const db = getFirebaseDb();
  const snap = await getDocs(query(collection(db, "accounts"), where("ownerId", "==", ownerId)));
  return snap.docs.map((docSnap) => docSnap.ref);
};

const defaultQueryPocketsForAccount: NonNullable<ResetPersonalDataDeps["queryPocketsForAccount"]> = async (
  accountRef,
) => {
  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, "accounts", (accountRef as { id: string }).id, "pockets"));
  return snap.docs.map((docSnap) => docSnap.ref);
};

const defaultCommitBatchDelete: NonNullable<ResetPersonalDataDeps["commitBatchDelete"]> = async (refs) => {
  if (refs.length === 0) return;
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  for (const ref of refs) {
    batch.delete(ref as Parameters<typeof batch.delete>[0]);
  }
  await batch.commit();
};

/**
 * Borra en páginas de `QA_RESET_PAGE_SIZE` una colección filtrada por
 * `ownerId`, hasta agotar el resultado. Delega en el helper genérico
 * compartido (`deleteCollectionByField`) fijando `field = "ownerId"`.
 */
export const deletePersonalCollectionByOwner = async (
  collectionName: string,
  ownerId: string,
  deps: ResetPersonalDataDeps = {},
): Promise<QaResetWipeResult> => {
  const batchDeps: QaResetBatchDeleteDeps = {
    queryFieldPage: deps.queryOwnerPage
      ? (colName, _field, value, pageSize) => deps.queryOwnerPage!(colName, value, pageSize)
      : (colName, _field, value, pageSize) => defaultQueryOwnerPage(colName, value, pageSize),
    commitBatchDelete: deps.commitBatchDelete ?? defaultCommitBatchDelete,
  };
  return deleteCollectionByField(collectionName, "ownerId", ownerId, batchDeps);
};

/**
 * `accounts` no se filtra por página simple porque cada cuenta tiene su
 * propia subcolección `pockets` que debe borrarse ANTES que el documento
 * padre (paridad Android: `deleteAccountsAndPockets`). Tanto los pockets de
 * cada cuenta como el lote final de cuentas se fragmentan en trozos de
 * máximo `QA_RESET_PAGE_SIZE` vía `deleteRefsInSafeBatches` — ningún
 * `writeBatch` excede ese límite sin importar cuántas cuentas/pockets tenga
 * el usuario de prueba.
 */
export const deleteAccountsAndPocketsForOwner = async (
  ownerId: string,
  deps: ResetPersonalDataDeps = {},
): Promise<QaResetWipeResult> => {
  const queryAccounts = deps.queryAccountsForOwner ?? defaultQueryAccountsForOwner;
  const queryPockets = deps.queryPocketsForAccount ?? defaultQueryPocketsForAccount;
  const commitDelete = deps.commitBatchDelete ?? defaultCommitBatchDelete;

  try {
    const accountRefs = await queryAccounts(ownerId);
    if (accountRefs.length === 0) {
      return { deleted: 0, failed: 0 };
    }

    let deleted = 0;
    for (const accountRef of accountRefs) {
      const pocketRefs = await queryPockets(accountRef);
      if (pocketRefs.length > 0) {
        deleted += await deleteRefsInSafeBatches(pocketRefs, commitDelete);
      }
    }
    deleted += await deleteRefsInSafeBatches(accountRefs, commitDelete);

    return { deleted, failed: 0 };
  } catch (err) {
    console.warn(`[qa-reset] Fallo borrando accounts/pockets (ownerId=${ownerId}):`, err);
    return { deleted: 0, failed: 1 };
  }
};

/**
 * Orquesta el borrado de TODAS las colecciones personales del usuario
 * actual. No es una transacción atómica: cada colección se borra por
 * separado para respetar los límites de batch de Firestore y para que un
 * fallo puntual (p. ej. permission-denied en una sola colección) no aborte
 * el resto del reset.
 */
export const resetPersonalDataForCurrentUser = async (
  ownerId: string,
  deps: ResetPersonalDataDeps = {},
): Promise<QaResetWipeResult> => {
  let total: QaResetWipeResult = { deleted: 0, failed: 0 };

  for (const collectionName of QA_RESET_PERSONAL_COLLECTIONS) {
    const result = await deletePersonalCollectionByOwner(collectionName, ownerId, deps);
    total = addQaResetWipeResults(total, result);
  }

  const accountsResult = await deleteAccountsAndPocketsForOwner(ownerId, deps);
  total = addQaResetWipeResults(total, accountsResult);

  return total;
};
