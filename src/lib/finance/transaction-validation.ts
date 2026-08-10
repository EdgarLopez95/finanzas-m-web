export const TRANSACTION_AMOUNT_ERROR =
  "El monto debe ser un número finito mayor a cero.";

export function assertValidTransactionAmount(
  amount: unknown,
): asserts amount is number {
  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(TRANSACTION_AMOUNT_ERROR);
  }
}
