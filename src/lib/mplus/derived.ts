import type { MovementType } from "./enums";

/**
 * Calculos derivados del contrato v1 (§25).
 *
 * Puros y sobre enteros: Android y Web deben producir exactamente los mismos
 * numeros para el mismo conjunto mensual (fixtures compartidos en
 * `fixtures.ts`). No existen documentos de resumen mensual persistidos
 * (contrato §3.5): todo se recalcula desde los movimientos `active` del mes.
 *
 * Aqui no hay saldo, cuenta como balance, bolsillo, deuda ni transferencia.
 */

export type MplusDerivableMovement = Readonly<{
  type: MovementType;
  amount: number;
  categoryId: string;
  householdCategoryId: string | null;
}>;

/** Clave de agrupacion para el gasto compartido sin clasificar (contrato §13). */
export const UNCLASSIFIED_HOUSEHOLD_CATEGORY_KEY = "unclassified";

const sumBy = (
  movements: readonly MplusDerivableMovement[],
  type: MovementType,
): number =>
  movements.reduce((total, movement) => (movement.type === type ? total + movement.amount : total), 0);

export const totalIncome = (movements: readonly MplusDerivableMovement[]): number =>
  sumBy(movements, "income");

export const totalExpense = (movements: readonly MplusDerivableMovement[]): number =>
  sumBy(movements, "expense");

/** Ingreso total menos gasto total. Puede ser negativo. */
export const monthlyDifference = (movements: readonly MplusDerivableMovement[]): number =>
  totalIncome(movements) - totalExpense(movements);

/** Gasto agrupado por categoria Personal (`categoryId`). */
export const expenseByPersonalCategory = (
  movements: readonly MplusDerivableMovement[],
): Record<string, number> => {
  const totals: Record<string, number> = {};
  for (const movement of movements) {
    if (movement.type !== "expense") continue;
    totals[movement.categoryId] = (totals[movement.categoryId] ?? 0) + movement.amount;
  }
  return totals;
};

/**
 * Gasto agrupado por categoria de Hogar. `householdCategoryId = null` se
 * agrupa bajo `Por clasificar` (contrato §25).
 */
export const expenseByHouseholdCategory = (
  movements: readonly MplusDerivableMovement[],
): Record<string, number> => {
  const totals: Record<string, number> = {};
  for (const movement of movements) {
    if (movement.type !== "expense") continue;
    const key = movement.householdCategoryId ?? UNCLASSIFIED_HOUSEHOLD_CATEGORY_KEY;
    totals[key] = (totals[key] ?? 0) + movement.amount;
  }
  return totals;
};

/** Ingreso de Hogar agrupado por pareja `ownerId + categoryId` (contrato §25). */
export const incomeByOwnerAndCategory = (
  movements: readonly (MplusDerivableMovement & { ownerId: string })[],
): Record<string, number> => {
  const totals: Record<string, number> = {};
  for (const movement of movements) {
    if (movement.type !== "income") continue;
    const key = `${movement.ownerId}__${movement.categoryId}`;
    totals[key] = (totals[key] ?? 0) + movement.amount;
  }
  return totals;
};
