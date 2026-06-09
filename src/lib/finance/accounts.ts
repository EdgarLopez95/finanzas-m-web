import type { Pocket } from "@/types/pocket";

/**
 * Calcula el saldo total de una cuenta sumando su balance (currentBalance) y el saldo de todos sus bolsillos.
 * Regla: totalCuenta = account.currentBalance + sum(pockets.balance)
 */
export const calculateAccountTotalBalance = (
  currentBalance: number,
  pockets: Pocket[]
): number => {
  const pocketsSum = pockets.reduce((sum, pocket) => sum + pocket.balance, 0);
  return currentBalance + pocketsSum;
};
