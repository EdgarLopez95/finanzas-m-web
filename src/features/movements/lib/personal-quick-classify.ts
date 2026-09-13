import type { MplusMovement } from "@/lib/mplus/models";

/**
 * Filtra exclusivamente las participaciones derivadas de gastos de Hogar del usuario actual
 * que están activas y no tienen categoría Personal asignada (`categoryId === null`).
 *
 * Cumple contrato ORQ-054:
 * - Solo entran derivadas propias (`ownerId === currentUid`).
 * - Solo movimientos activos (`lifecycleState === "active"`).
 * - Solo tipo gasto (`type === "expense"`).
 * - Solo originados en Hogar (`origin === "household_expense"`).
 * - Solo sin clasificar (`categoryId === null`).
 * - Ordenados por fecha descendente (más recientes primero).
 */
export function filterPersonalUnclassifiedMovements(
  movements: readonly MplusMovement[],
  currentUid: string,
): MplusMovement[] {
  if (!currentUid) {
    return [];
  }

  return movements
    .filter(
      (m) =>
        m.ownerId === currentUid &&
        m.lifecycleState === "active" &&
        m.type === "expense" &&
        m.origin === "household_expense" &&
        m.categoryId === null,
    )
    .sort((a, b) => b.occurredAtMillis - a.occurredAtMillis);
}
