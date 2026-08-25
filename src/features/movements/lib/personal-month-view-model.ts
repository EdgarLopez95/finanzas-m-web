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

export type PersonalFlowSummary = Readonly<{
  income: number;
  expense: number;
  difference: number;
  totalFlow: number;
  incomeSharePercent: number;
  expenseSharePercent: number;
  isBalanced: boolean;
  isEmpty: boolean;
  accessibleLabel: string;
  periodLabel: string;
}>;

/**
 * Calcula la participación proporcional y el estado del flujo financiero mensual.
 *
 * - flujoTotal = ingresos + gastos
 * - porciónIngresos = ingresos / flujoTotal (sumando exactamente 100% con gastos cuando flujoTotal > 0)
 * - porciónGastos = gastos / flujoTotal
 * - Nunca divide entre cero ni genera porcentajes contra ingresos.
 */
export const calculatePersonalFlowSummary = (params: {
  income: number;
  expense: number;
  periodLabel: string;
  formattedIncome?: string;
  formattedExpense?: string;
}): PersonalFlowSummary => {
  const { income, expense, periodLabel, formattedIncome, formattedExpense } = params;
  const safeIncome = Math.max(0, Math.round(income));
  const safeExpense = Math.max(0, Math.round(expense));
  const totalFlow = safeIncome + safeExpense;
  const difference = safeIncome - safeExpense;
  const isBalanced = safeIncome === safeExpense;
  const isEmpty = totalFlow === 0;

  let incomeSharePercent = 0;
  let expenseSharePercent = 0;

  if (totalFlow > 0) {
    if (safeExpense === 0) {
      incomeSharePercent = 100;
      expenseSharePercent = 0;
    } else if (safeIncome === 0) {
      incomeSharePercent = 0;
      expenseSharePercent = 100;
    } else {
      incomeSharePercent = (safeIncome / totalFlow) * 100;
      expenseSharePercent = 100 - incomeSharePercent;
    }
  }

  const incomeText = formattedIncome ?? `$ ${safeIncome.toLocaleString("es-CO")}`;
  const expenseText = formattedExpense ?? `$ ${safeExpense.toLocaleString("es-CO")}`;
  const accessibleLabel = isEmpty
    ? `Flujo del mes en ${periodLabel}: sin ingresos ni gastos registrados`
    : `Flujo del mes en ${periodLabel}: ingresos ${incomeText}, gastos ${expenseText}`;

  return {
    income: safeIncome,
    expense: safeExpense,
    difference,
    totalFlow,
    incomeSharePercent,
    expenseSharePercent,
    isBalanced,
    isEmpty,
    accessibleLabel,
    periodLabel,
  };
};

export type DashboardCategoryChartItem = Readonly<{
  id: string;
  name: string;
  amount: number;
  share: number;
  color: string;
  iconKey: string;
}>;

/**
 * Prepara los datos para el gráfico de barras por categoría del Inicio Personal.
 * - Trabaja sobre copia y filtra únicamente importes positivos y finitos (> 0).
 * - Ordena siempre por importe descendente antes de seleccionar el top 6.
 * - Mantiene hasta 6 categorías individuales preservando nombre, color e icono originales.
 * - Si hay 7 o más, agrupa la 7ma y siguientes en un único ítem "Otras" con color neutro e icono "other".
 * - Calcula porcentajes enteros finitos (0 a 100) derivados del total real de importes positivos.
 */
export const buildDashboardCategoryChartData = (
  items: readonly CategoryBreakdownItem[],
): readonly DashboardCategoryChartItem[] => {
  const positive = items
    .filter(
      (item) =>
        typeof item.amount === "number" &&
        Number.isFinite(item.amount) &&
        item.amount > 0,
    )
    .sort((a, b) => b.amount - a.amount);

  if (positive.length === 0) {
    return [];
  }

  const totalAmount = positive.reduce((sum, item) => sum + item.amount, 0);

  const calculateShare = (amount: number): number => {
    if (totalAmount <= 0) return 0;
    const rounded = Math.round((amount / totalAmount) * 100);
    return Math.max(0, Math.min(100, Number.isFinite(rounded) ? rounded : 0));
  };

  if (positive.length <= 6) {
    return positive.map((item) => ({
      id: item.categoryId,
      name: item.name,
      amount: item.amount,
      share: calculateShare(item.amount),
      color: item.color,
      iconKey: item.iconKey,
    }));
  }

  const topSix: DashboardCategoryChartItem[] = positive.slice(0, 6).map((item) => ({
    id: item.categoryId,
    name: item.name,
    amount: item.amount,
    share: calculateShare(item.amount),
    color: item.color,
    iconKey: item.iconKey,
  }));

  const remaining = positive.slice(6);
  const otherAmount = remaining.reduce((acc, item) => acc + item.amount, 0);
  const otherShare = calculateShare(otherAmount);

  const otherItem: DashboardCategoryChartItem = {
    id: "other",
    name: "Otras",
    amount: otherAmount,
    share: otherShare,
    color: "#94A3B8",
    iconKey: "other",
  };

  return [...topSix, otherItem];
};
