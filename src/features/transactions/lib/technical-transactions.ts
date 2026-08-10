export const TECHNICAL_TRANSACTION_TITLES = {
  SALDO_INICIAL: "Saldo inicial",
  AJUSTE_MANUAL: "Ajuste manual de saldo",
  CIERRE_BOLSILLO: "Cierre de bolsillo",
} as const;

export const isTechnicalTransaction = (title?: string | null): boolean => {
  if (!title) return false;
  const normalized = title.trim();
  const values: readonly string[] = Object.values(TECHNICAL_TRANSACTION_TITLES);
  return values.includes(normalized);
};
