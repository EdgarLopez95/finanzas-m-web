export type ThirdPartyLocationLedger = {
  ownerId: string;
  version: number;
  lastOperationId: string | null;
};

export const createThirdPartyLocationLedger = (ownerId: string): ThirdPartyLocationLedger => {
  if (!ownerId.trim()) throw new Error("El propietario del ledger es obligatorio.");
  return { ownerId, version: 0, lastOperationId: null };
};

export const nextThirdPartyLocationLedger = (
  current: ThirdPartyLocationLedger,
  operationId: string,
): ThirdPartyLocationLedger => {
  if (!Number.isInteger(current.version) || current.version < 0) {
    throw new Error("La versión actual del ledger es inválida.");
  }
  if (!operationId.trim()) throw new Error("El identificador de operación es obligatorio.");
  return { ownerId: current.ownerId, version: current.version + 1, lastOperationId: operationId };
};
