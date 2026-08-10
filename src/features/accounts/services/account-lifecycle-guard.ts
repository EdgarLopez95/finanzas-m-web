/**
 * Corrección P1 (Paso 2, hallazgo P1-A): mensaje canónico único usado por
 * TODOS los servicios que puedan mutar dinero o estructura de una cuenta
 * existente (reajustar Disponible, crear/editar/eliminar bolsillo, y
 * cualquier otro mutador futuro) para rechazar la operación cuando la cuenta
 * está cerrada. Un solo texto de dominio, nunca reimplementado por servicio.
 */
export const CLOSED_ACCOUNT_MUTATION_MESSAGE = "No puedes modificar una cuenta cerrada. Reábrela primero.";

/**
 * Debe llamarse DENTRO de la transacción Firestore del mutador, inmediatamente
 * después de leer la cuenta fresca (`transaction.get`) y validar `ownerId`, y
 * ANTES de crear o actualizar cualquier documento (bolsillo, transacción,
 * cuenta). Nunca debe alimentarse con datos recibidos por props/estado de UI
 * — solo con el snapshot leído dentro de esa misma transacción.
 */
export const assertAccountNotArchived = (accountData: Record<string, unknown>): void => {
  if (accountData.archived === true) {
    throw new Error(CLOSED_ACCOUNT_MUTATION_MESSAGE);
  }
};
