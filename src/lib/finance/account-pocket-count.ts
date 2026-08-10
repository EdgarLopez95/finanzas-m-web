/**
 * Contador atómico de bolsillos en `accounts/{id}.pocketCount`.
 * Create/delete/close compiten sobre el mismo doc de cuenta: Firestore reintenta
 * la txn perdedora y evita la carrera close↔create sin query de subcolección
 * dentro de la transacción (límite del SDK Web).
 */
export const readPocketCount = (accountData: Record<string, unknown>): number | null => {
  const raw = accountData.pocketCount;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
    return null;
  }
  return Math.floor(raw);
};

export const nextPocketCountAfterCreate = (
  accountData: Record<string, unknown>,
  observedPocketDocsWhenUnset: number,
): number => {
  const current = readPocketCount(accountData);
  if (current !== null) {
    return current + 1;
  }
  if (!Number.isFinite(observedPocketDocsWhenUnset) || observedPocketDocsWhenUnset < 0) {
    throw new Error("No se pudo determinar el número de bolsillos de la cuenta.");
  }
  return Math.floor(observedPocketDocsWhenUnset) + 1;
};

export const nextPocketCountAfterDelete = (accountData: Record<string, unknown>): number => {
  const current = readPocketCount(accountData);
  if (current === null) {
    // Legacy sin contador: no inventamos un valor; el caller puede omitir el campo.
    return 0;
  }
  return Math.max(0, current - 1);
};

export const assertAccountHasNoPocketsForClose = (
  accountData: Record<string, unknown>,
): void => {
  const count = readPocketCount(accountData);
  if (count !== null && count > 0) {
    throw new Error(
      `Esta cuenta tiene ${count} bolsillo(s) activo(s). Resuélvelos o elimínalos antes de cerrar la cuenta.`,
    );
  }
};
