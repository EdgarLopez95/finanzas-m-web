/**
 * ============================================================================
 * HERRAMIENTA QA/DEBUG — SOLO PARA DESARROLLO. Retirar antes de producción.
 * ============================================================================
 *
 * Puerto directo de `deleteOrphanedHouseholdDocs(userId)`
 * (`DebugDataResetRepository.kt`): limpia, siempre filtrando estrictamente
 * por el UID del usuario actual (nunca por `householdId` de un Hogar ajeno),
 * los documentos de Hogar donde el usuario está vinculado por un campo de
 * user-scope ya existente en el modelo:
 *
 *  - `household_events`         donde `createdByUserId == uid`
 *  - `household_categories`     donde `createdByUserId == uid`
 *  - `household_event_shares`   donde `memberUserId == uid`
 *  - `household_income_entries` donde `sourceOwnerId == uid`
 *  - `household_review_items`   donde `sourceOwnerId == uid`
 *  - `household_debts`          donde `fromUserId == uid`
 *  - `household_debts`          donde `toUserId == uid`
 *
 * Esta limpieza es intencionalmente GLOBAL por UID (no acotada a un
 * `householdId` concreto): cubre tanto documentos huérfanos de un reset
 * anterior que quedó a medias (el Hogar padre ya no existe) como los
 * documentos propios de un Hogar AJENO todavía activo — por eso, para un
 * miembro no dueño, este paso debe ejecutarse ANTES de `leaveHousehold`
 * (mientras las Rules aún lo reconocen como miembro con permiso de borrar sus
 * propios documentos). Nunca borra un documento por pertenecer al
 * `householdId` de otro — solo por estar vinculado al UID actual mediante
 * uno de los 7 campos de arriba, así que jamás toca datos del dueño ni de
 * otro miembro.
 */
import { collection, getDocs, limit, query, where, writeBatch } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import {
  QA_RESET_PAGE_SIZE,
  addQaResetWipeResults,
  deleteCollectionByField,
  type QaResetWipeResult,
  type QaResetBatchDeleteDeps,
} from "@/features/qa-reset/services/qa-reset-batch-delete";

/** Paridad exacta con `deleteOrphanedHouseholdDocs(userId)` de Android. */
export const QA_RESET_HOUSEHOLD_LINKED_DOC_QUERIES = [
  { collection: "household_events", field: "createdByUserId" },
  { collection: "household_categories", field: "createdByUserId" },
  { collection: "household_event_shares", field: "memberUserId" },
  { collection: "household_income_entries", field: "sourceOwnerId" },
  { collection: "household_review_items", field: "sourceOwnerId" },
  { collection: "household_debts", field: "fromUserId" },
  { collection: "household_debts", field: "toUserId" },
] as const;

export type ResetHouseholdLinkedDocsDeps = {
  queryFieldPage?: (
    collectionName: string,
    field: string,
    value: string,
    pageSize: number,
  ) => Promise<{ refs: unknown[]; hasMore: boolean }>;
  commitBatchDelete?: (refs: unknown[]) => Promise<void>;
};

const defaultQueryFieldPage: NonNullable<ResetHouseholdLinkedDocsDeps["queryFieldPage"]> = async (
  collectionName,
  field,
  value,
  pageSize,
) => {
  const db = getFirebaseDb();
  const q = query(collection(db, collectionName), where(field, "==", value), limit(pageSize));
  const snap = await getDocs(q);
  return { refs: snap.docs.map((docSnap) => docSnap.ref), hasMore: snap.docs.length >= pageSize };
};

const defaultCommitBatchDelete: NonNullable<ResetHouseholdLinkedDocsDeps["commitBatchDelete"]> = async (refs) => {
  if (refs.length === 0) return;
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  for (const ref of refs) {
    batch.delete(ref as Parameters<typeof batch.delete>[0]);
  }
  await batch.commit();
};

/**
 * Ejecuta las 7 queries de limpieza por UID, cada una paginada e
 * independiente. Reporta el total acumulado; un fallo puntual en una de las
 * 7 no detiene las demás.
 */
export const resetHouseholdLinkedDocsForCurrentUser = async (
  uid: string,
  deps: ResetHouseholdLinkedDocsDeps = {},
): Promise<QaResetWipeResult> => {
  const batchDeps: QaResetBatchDeleteDeps = {
    queryFieldPage: deps.queryFieldPage ?? defaultQueryFieldPage,
    commitBatchDelete: deps.commitBatchDelete ?? defaultCommitBatchDelete,
  };

  let total: QaResetWipeResult = { deleted: 0, failed: 0 };
  for (const { collection: collectionName, field } of QA_RESET_HOUSEHOLD_LINKED_DOC_QUERIES) {
    const result = await deleteCollectionByField(collectionName, field, uid, batchDeps);
    total = addQaResetWipeResults(total, result);
  }
  return total;
};

export { QA_RESET_PAGE_SIZE };
