import { formatMovementGroupLabelEs, formatPersonalMovementDateEs } from "@/lib/format/date";
import {
  expenseByPersonalCategory,
  monthlyDifference,
  totalExpense,
  totalIncome,
  type MplusDerivableMovement,
} from "@/lib/mplus/derived";
import type { MovementLifecycleState, MovementType } from "@/lib/mplus/enums";
import type {
  MplusMovement,
  MplusPersonalAccount,
  MplusPersonalCategory,
} from "@/lib/mplus/models";

/**
 * Modelo de vista del mes Personal (contrato §25).
 *
 * Convierte los documentos del contrato v1 en las filas y cifras que la UI Web
 * ya sabe pintar. NO introduce composicion visual nueva: conserva la misma
 * gramatica de fila (titulo, subtitulo, monto, agrupacion por dia) que la Web
 * base, cambiando solo la fuente de datos y retirando lo que M+ no tiene
 * (saldo, bolsillo, titularidad, transferencia).
 *
 * Todos los totales son enteros COP y salen del nucleo compartido de §25, el
 * mismo que valida los fixtures cruzados con Android.
 */

export type PersonalMonthKpis = Readonly<{
  income: number;
  expense: number;
  /** Ingresos menos gastos. Puede ser negativo. */
  difference: number;
}>;

export type CategoryBreakdownItem = Readonly<{
  categoryId: string;
  name: string;
  amount: number;
  /** Porcentaje entero sobre el total del tipo. */
  share: number;
  color: string;
  iconKey: string;
}>;

export type MplusMovementRow = Readonly<{
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  type: MovementType;
  lifecycleState: MovementLifecycleState;
  occurredAtMillis: number;
  dateLabel: string;
  groupLabel: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIconKey: string;
  accountId: string | null;
  accountName: string | null;
  accountColor: string | null;
  accountIconKey: string | null;
  accountIconType: string | null;
  accountType: string | null;
  /** `true` si el movimiento se comparte con el Hogar ("Contar en Hogar"). */
  isShared: boolean;
  /** Revision remota: la UI la necesita para editar con OCC. */
  revision: number;
  /** Solo en Papelera. */
  purgeAfterMillis: number | null;
}>;

const NEUTRAL_CATEGORY_NAME = "Categoria eliminada";
const NEUTRAL_ACCOUNT_NAME = "Cuenta eliminada";
const NEUTRAL_COLOR = "#6B7280";

/** Proyeccion minima que necesitan los calculos de §25. */
const toDerivable = (movement: MplusMovement): MplusDerivableMovement => ({
  type: movement.type,
  amount: movement.amount,
  categoryId: movement.categoryId,
  householdCategoryId: movement.householdCategoryId,
});

export const buildPersonalMonthKpis = (
  movements: readonly MplusMovement[],
): PersonalMonthKpis => {
  const derivable = movements.map(toDerivable);
  return {
    income: totalIncome(derivable),
    expense: totalExpense(derivable),
    difference: monthlyDifference(derivable),
  };
};

/**
 * Desglose por categoria Personal. `type` decide el catalogo: gasto por
 * categoria es el desglose principal del tablero; ingreso por categoria es la
 * vista secundaria (matriz W2).
 */
export const buildCategoryBreakdown = (
  movements: readonly MplusMovement[],
  categories: readonly MplusPersonalCategory[],
  type: MovementType,
): CategoryBreakdownItem[] => {
  const totals =
    type === "expense"
      ? expenseByPersonalCategory(movements.map(toDerivable))
      : movements.reduce<Record<string, number>>((acc, movement) => {
          if (movement.type !== "income") return acc;
          acc[movement.categoryId] = (acc[movement.categoryId] ?? 0) + movement.amount;
          return acc;
        }, {});

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const grandTotal = Object.values(totals).reduce((sum, amount) => sum + amount, 0);

  return Object.entries(totals)
    .map(([categoryId, amount]) => {
      const category = categoriesById.get(categoryId);
      return {
        categoryId,
        // Una categoria borrada durante un reinicio deja movimientos
        // huerfanos: se degrada con una etiqueta neutra, nunca se inventa.
        name: category?.name ?? NEUTRAL_CATEGORY_NAME,
        amount,
        share: grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0,
        color: category?.color ?? NEUTRAL_COLOR,
        iconKey: category?.iconKey ?? "other",
      } satisfies CategoryBreakdownItem;
    })
    .filter((item) => item.amount > 0)
    .sort((left, right) => right.amount - left.amount);
};

export const buildMplusMovementRows = (
  movements: readonly MplusMovement[],
  categories: readonly MplusPersonalCategory[],
  accounts: readonly MplusPersonalAccount[],
  referenceDate = new Date(),
): MplusMovementRow[] => {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const accountsById = new Map(accounts.map((account) => [account.id, account]));

  return movements.map((movement) => {
    const category = categoriesById.get(movement.categoryId);
    const account = movement.accountId ? accountsById.get(movement.accountId) : undefined;
    const occurredAt = new Date(movement.occurredAtMillis);

    const categoryName = category?.name ?? NEUTRAL_CATEGORY_NAME;
    const accountName = movement.accountId
      ? (account?.name ?? NEUTRAL_ACCOUNT_NAME)
      : null;

    // Misma gramatica de subtitulo que la Web base: la nota manda; si no hay,
    // se compone con categoria y, cuando existe, la cuenta.
    const subtitle =
      movement.note.trim().length > 0
        ? movement.note.trim()
        : accountName
          ? `${categoryName} - ${accountName}`
          : categoryName;

    return {
      id: movement.id,
      title: movement.title,
      subtitle,
      amount: movement.amount,
      type: movement.type,
      lifecycleState: movement.lifecycleState,
      occurredAtMillis: movement.occurredAtMillis,
      dateLabel: formatPersonalMovementDateEs(occurredAt),
      groupLabel: formatMovementGroupLabelEs(occurredAt, referenceDate),
      categoryId: movement.categoryId,
      categoryName,
      categoryColor: category?.color ?? NEUTRAL_COLOR,
      categoryIconKey: category?.iconKey ?? "other",
      accountId: movement.accountId,
      accountName,
      accountColor: account?.color ?? null,
      accountIconKey: account?.iconKey ?? null,
      accountIconType: account?.iconType ?? null,
      accountType: account?.type ?? null,
      isShared: movement.householdId !== null,
      revision: movement.revision,
      purgeAfterMillis: movement.purgeAfterMillis,
    } satisfies MplusMovementRow;
  });
};

/** Agrupa filas por su etiqueta de dia, conservando el orden de entrada. */
export const groupRowsByDay = (
  rows: readonly MplusMovementRow[],
): Array<{ label: string; rows: MplusMovementRow[] }> => {
  const groups: Array<{ label: string; rows: MplusMovementRow[] }> = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.label === row.groupLabel) {
      last.rows.push(row);
    } else {
      groups.push({ label: row.groupLabel, rows: [row] });
    }
  }
  return groups;
};

export type MovementFilters = Readonly<{
  /** Texto libre sobre el titulo (contrato §19.1: se filtra localmente). */
  search: string;
  type: MovementType | "all";
  categoryId: string | "all";
  accountId: string | "all" | "none";
}>;

export const EMPTY_MOVEMENT_FILTERS: MovementFilters = {
  search: "",
  type: "all",
  categoryId: "all",
  accountId: "all",
};

/**
 * Filtros combinables aplicados en cliente sobre el mes ya cargado
 * (contrato §19.1). No cambian los totales del tablero: son solo del historial.
 */
export const applyMovementFilters = (
  rows: readonly MplusMovementRow[],
  filters: MovementFilters,
): MplusMovementRow[] => {
  const search = filters.search.trim().toLocaleLowerCase("es-CO");

  return rows.filter((row) => {
    if (filters.type !== "all" && row.type !== filters.type) return false;
    if (filters.categoryId !== "all" && row.categoryId !== filters.categoryId) return false;
    if (filters.accountId === "none" && row.accountId !== null) return false;
    if (
      filters.accountId !== "all" &&
      filters.accountId !== "none" &&
      row.accountId !== filters.accountId
    ) {
      return false;
    }
    if (search.length > 0 && !row.title.toLocaleLowerCase("es-CO").includes(search)) {
      return false;
    }
    return true;
  });
};

/** Dias enteros que le quedan a un documento en Papelera antes de purgarse. */
export const daysUntilPurge = (
  purgeAfterMillis: number | null,
  nowMillis: number,
): number | null => {
  if (purgeAfterMillis === null) return null;
  return Math.max(0, Math.ceil((purgeAfterMillis - nowMillis) / 86_400_000));
};

/** Etiqueta de vencimiento visible en la Papelera. */
export const purgeCountdownLabel = (
  purgeAfterMillis: number | null,
  nowMillis: number,
): string => {
  const days = daysUntilPurge(purgeAfterMillis, nowMillis);
  if (days === null) return "";
  if (days === 0) return "Se elimina hoy";
  if (days === 1) return "Queda 1 dia";
  return `Quedan ${days} dias`;
};
