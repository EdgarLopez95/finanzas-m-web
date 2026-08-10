import type { Pocket } from "@/types/pocket";
import { calculateAccountPhysicalBalances } from "@/lib/finance/account-balance-model";

/**
 * Calcula el saldo total de una cuenta sumando su balance (currentBalance) y el saldo de todos sus bolsillos.
 * Regla: totalCuenta = account.currentBalance + sum(pockets.balance)
 *
 * Delegación deliberada a `calculateAccountPhysicalBalances` (Paso 1 —
 * núcleo financiero): esa función es ahora la única fuente de verdad de la
 * regla Disponible/Total/bolsillos. Se conserva como API pública estable
 * para consumidores/pruebas existentes; el store (`personal-data-store.ts`)
 * ya NO la usa para enriquecer `Account.balance` (Paso 1, cierre) — cada
 * pantalla que necesita el Total lo deriva localmente donde ya tiene la
 * cuenta y sus bolsillos en scope.
 */
export const calculateAccountTotalBalance = (
  currentBalance: number,
  pockets: Pocket[]
): number => {
  return calculateAccountPhysicalBalances(currentBalance, pockets).totalBalance;
};

/**
 * Entrada explícita y tipada para el bruto global — nunca un `Account`
 * completo. Un `Account` trae `.balance`, que en todo el código significa
 * SIEMPRE Disponible (Paso 1, cierre); si `computeGrossBalance` aceptara
 * `Account[]` volvería a abrir la puerta a que alguien le pase un `.balance`
 * ambiguo esperando que sea Total. Por eso el caller debe entregar el Total
 * físico ya derivado (`calculateAccountPhysicalBalances(...).totalBalance`)
 * junto con la bandera de inclusión, sin más campos.
 */
export type GrossBalanceEntry = {
  includeInTotal: boolean;
  totalBalance: number;
};

/**
 * Calcula el saldo bruto global sumando `totalBalance` de cada entrada con
 * `includeInTotal`. Las cuentas archivadas ya deben estar excluidas antes de
 * llamar esta función.
 * Compatible con Android: netOwnBalance = grossBalance - thirdPartyOpenAmount.
 */
export const computeGrossBalance = (entries: GrossBalanceEntry[]): number => {
  return entries
    .filter((entry) => entry.includeInTotal)
    .reduce((sum, entry) => sum + entry.totalBalance, 0);
};
