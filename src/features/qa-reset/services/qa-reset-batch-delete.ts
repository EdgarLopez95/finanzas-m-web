/**
 * ============================================================================
 * HERRAMIENTA QA/DEBUG — SOLO PARA DESARROLLO. Retirar antes de producción.
 * ============================================================================
 *
 * Utilidad de borrado paginado compartida por los distintos "planes" de
 * reinicio (datos personales, documentos de Hogar vinculados al usuario).
 * Centraliza la regla de lotes segura: cada página de lectura y cada
 * `writeBatch` de escritura respeta `QA_RESET_PAGE_SIZE` (400), muy por
 * debajo del límite real de Firestore (500 operaciones por batch) — mismo
 * margen que Android/`dissolve-household.ts`. Un `writeBatch` NUNCA recibe
 * más de `QA_RESET_PAGE_SIZE` referencias, sin importar cuántos documentos
 * traiga la fuente que las produjo (`chunkRefs` se encarga de fragmentar).
 */
export const QA_RESET_PAGE_SIZE = 400;

export type QaResetWipeResult = { deleted: number; failed: number };

export const addQaResetWipeResults = (a: QaResetWipeResult, b: QaResetWipeResult): QaResetWipeResult => ({
  deleted: a.deleted + b.deleted,
  failed: a.failed + b.failed,
});

/** Fragmenta un arreglo en trozos de máximo `size` elementos. */
export const chunkRefs = <T>(refs: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < refs.length; i += size) {
    chunks.push(refs.slice(i, i + size));
  }
  return chunks;
};

export type QaResetBatchDeleteDeps = {
  /**
   * Lee UNA página (máximo `pageSize` docs) de `collectionName` donde
   * `field === value`, y reporta si hay más páginas. El valor por defecto
   * usa Firestore real; los tests inyectan su propia implementación.
   */
  queryFieldPage?: (
    collectionName: string,
    field: string,
    value: string,
    pageSize: number,
  ) => Promise<{ refs: unknown[]; hasMore: boolean }>;
  /** Borra un lote de referencias en un solo `writeBatch`. Nunca debe recibir más de `QA_RESET_PAGE_SIZE` refs. */
  commitBatchDelete?: (refs: unknown[]) => Promise<void>;
};

/**
 * Borra, en páginas de `QA_RESET_PAGE_SIZE`, todos los documentos de
 * `collectionName` donde `field === value`, hasta agotar el resultado. Cada
 * página se borra en un único `writeBatch` (ya acotado a `QA_RESET_PAGE_SIZE`
 * por `queryFieldPage`). Un fallo en cualquier página se reporta como
 * `failed: 1` (la colección puede haber quedado parcialmente borrada) sin
 * lanzar — así el llamador puede continuar con el resto del reset y ofrecer
 * "Reintentar" sin afirmar éxito total.
 */
export const deleteCollectionByField = async (
  collectionName: string,
  field: string,
  value: string,
  deps: QaResetBatchDeleteDeps,
): Promise<QaResetWipeResult> => {
  const queryPage = deps.queryFieldPage;
  const commitDelete = deps.commitBatchDelete;
  if (!queryPage || !commitDelete) {
    throw new Error("qa-reset: queryFieldPage y commitBatchDelete son obligatorios.");
  }

  let deleted = 0;
  try {
    let hasMore = true;
    while (hasMore) {
      const page = await queryPage(collectionName, field, value, QA_RESET_PAGE_SIZE);
      if (page.refs.length > 0) {
        await commitDelete(page.refs);
        deleted += page.refs.length;
      }
      hasMore = page.hasMore;
    }
    return { deleted, failed: 0 };
  } catch (err) {
    console.warn(`[qa-reset] Fallo borrando "${collectionName}" donde ${field} == "${value}":`, err);
    return { deleted, failed: 1 };
  }
};

/**
 * Borra un conjunto ya leído de referencias (no paginado desde una query,
 * p. ej. los `refs` de cuentas o de bolsillos de una cuenta) en lotes de
 * máximo `QA_RESET_PAGE_SIZE`, para que ningún `writeBatch` exceda ese
 * límite sin importar cuántas referencias traiga el arreglo de entrada.
 */
export const deleteRefsInSafeBatches = async (
  refs: unknown[],
  commitBatchDelete: NonNullable<QaResetBatchDeleteDeps["commitBatchDelete"]>,
): Promise<number> => {
  let deleted = 0;
  for (const chunk of chunkRefs(refs, QA_RESET_PAGE_SIZE)) {
    if (chunk.length === 0) continue;
    await commitBatchDelete(chunk);
    deleted += chunk.length;
  }
  return deleted;
};
