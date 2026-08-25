import { UNCLASSIFIED_HOUSEHOLD_CATEGORY_KEY } from "@/lib/mplus/derived";
import type { MplusDerivableMovement } from "@/lib/mplus/derived";
import { DEFAULT_HOUSEHOLD_CATEGORY_COLOR } from "@/lib/categories/household-category-colors";

/**
 * Resumen de flujo mensual para el Inicio de Hogar.
 */
export interface HouseholdFlowSummary {
  readonly income: number;
  readonly expense: number;
  readonly difference: number;
  readonly totalFlow: number;
  readonly incomeSharePercent: number;
  readonly expenseSharePercent: number;
  readonly isBalanced: boolean;
  readonly isEmpty: boolean;
  readonly accessibleLabel: string;
}

export function calculateHouseholdFlowSummary(input: {
  income: number;
  expense: number;
  periodLabel: string;
}): HouseholdFlowSummary {
  const rawIncome = input.income;
  const rawExpense = input.expense;

  const income =
    typeof rawIncome === "number" && Number.isFinite(rawIncome) && rawIncome > 0
      ? rawIncome
      : 0;

  const expense =
    typeof rawExpense === "number" && Number.isFinite(rawExpense) && rawExpense > 0
      ? rawExpense
      : 0;

  const totalFlow = income + expense;
  const difference = income - expense;
  const isBalanced = totalFlow > 0 && difference === 0;
  const isEmpty = totalFlow === 0;

  let incomeSharePercent = 0;
  let expenseSharePercent = 0;

  if (totalFlow > 0) {
    incomeSharePercent = Math.round((income / totalFlow) * 100);
    expenseSharePercent = 100 - incomeSharePercent;
  }

  const accessibleLabel = isEmpty
    ? `Sin movimientos compartidos registrados en ${input.periodLabel}`
    : `Resumen compartido de ${input.periodLabel}: ${incomeSharePercent}% ingresos, ${expenseSharePercent}% gastos`;

  return {
    income,
    expense,
    difference,
    totalFlow,
    incomeSharePercent,
    expenseSharePercent,
    isBalanced,
    isEmpty,
    accessibleLabel,
  };
}

/**
 * Elemento de datos para el gráfico de barras de Hogar.
 */
export interface HouseholdDashboardChartItem {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
  readonly share: number; // 0 a 100
  readonly color: string;
  readonly iconKey?: string;
  readonly isUnclassified?: boolean;
}

/**
 * Adaptador de gastos por categoría para el gráfico de Hogar.
 *
 * Preserva "Por clasificar", filtra montos no positivos o no finitos,
 * ordena descendentemente y agrupa a partir del 7mo elemento en "Otras".
 */
export function buildHouseholdExpenseChartData(
  rawExpenses: Record<string, number>,
  categoryMap: Map<string, { id: string; name: string; color: string; iconKey: string }>,
): readonly HouseholdDashboardChartItem[] {
  const positiveItems: Array<{
    id: string;
    name: string;
    amount: number;
    color: string;
    iconKey: string;
    isUnclassified: boolean;
  }> = [];

  for (const [key, amount] of Object.entries(rawExpenses)) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    if (key === UNCLASSIFIED_HOUSEHOLD_CATEGORY_KEY) {
      positiveItems.push({
        id: key,
        name: "Por clasificar",
        amount,
        color: "#94A3B8",
        iconKey: "other",
        isUnclassified: true,
      });
    } else {
      const cat = categoryMap.get(key);
      positiveItems.push({
        id: key,
        name: cat?.name ?? "Categoría",
        amount,
        color: cat?.color ?? DEFAULT_HOUSEHOLD_CATEGORY_COLOR,
        iconKey: cat?.iconKey ?? "other",
        isUnclassified: false,
      });
    }
  }

  if (positiveItems.length === 0) {
    return [];
  }

  // Orden descendente por importe
  positiveItems.sort((a, b) => b.amount - a.amount);

  const totalAmount = positiveItems.reduce((acc, item) => acc + item.amount, 0);
  const calculateShare = (amount: number) =>
    totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0;

  if (positiveItems.length <= 6) {
    return positiveItems.map((item) => ({
      ...item,
      share: calculateShare(item.amount),
    }));
  }

  const topSix = positiveItems.slice(0, 6).map((item) => ({
    ...item,
    share: calculateShare(item.amount),
  }));

  const remaining = positiveItems.slice(6);
  const otherAmount = remaining.reduce((acc, item) => acc + item.amount, 0);
  const otherShare = calculateShare(otherAmount);

  const otherItem: HouseholdDashboardChartItem = {
    id: "other",
    name: "Otras",
    amount: otherAmount,
    share: otherShare,
    color: "#94A3B8",
    iconKey: "other",
  };

  return [...topSix, otherItem];
}

/** Paleta armónica sage para integrantes de Hogar */
export const HOUSEHOLD_MEMBER_PALETTE = [
  "#8BCFBC", // Primary action / Sage light
  "#4FA58F", // Accent
  "#6C8E7F", // Sage accent
  "#2F6F63", // Primary
  "#A7D8CA", // Pale sage
  "#3B5B52", // Forest strong
] as const;

/**
 * Adaptador de ingresos por integrante para el gráfico de Hogar.
 *
 * Agrupa los ingresos compartidos por `ownerId`, usa el nombre visible del integrante,
 * asigna un color estable de Hogar, ordena descendentemente y agrupa más de 6 en "Otras".
 */
export function buildHouseholdIncomeMemberChartData(
  movements: readonly (MplusDerivableMovement & { ownerId: string })[],
  memberMap: Map<string, { userId: string; displayName: string }>,
  currentUid: string,
): readonly HouseholdDashboardChartItem[] {
  const memberTotals: Record<string, number> = {};

  for (const m of movements) {
    if (m.type !== "income") continue;
    if (typeof m.amount !== "number" || !Number.isFinite(m.amount) || m.amount <= 0) continue;
    memberTotals[m.ownerId] = (memberTotals[m.ownerId] ?? 0) + m.amount;
  }

  const entries = Object.entries(memberTotals);
  if (entries.length === 0) {
    return [];
  }

  // Orden descendente por importe acumulado
  entries.sort((a, b) => b[1] - a[1]);

  const positiveItems: Array<{
    id: string;
    name: string;
    amount: number;
    color: string;
    iconKey: string;
  }> = entries.map(([ownerId, amount], idx) => {
    const member = memberMap.get(ownerId);
    const name =
      member?.displayName || (ownerId === currentUid ? "Tú" : "Integrante");
    const color =
      HOUSEHOLD_MEMBER_PALETTE[idx % HOUSEHOLD_MEMBER_PALETTE.length];

    return {
      id: ownerId,
      name,
      amount,
      color,
      iconKey: "user",
    };
  });

  const totalAmount = positiveItems.reduce((acc, item) => acc + item.amount, 0);
  const calculateShare = (amount: number) =>
    totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0;

  if (positiveItems.length <= 6) {
    return positiveItems.map((item) => ({
      ...item,
      share: calculateShare(item.amount),
    }));
  }

  const topSix = positiveItems.slice(0, 6).map((item) => ({
    ...item,
    share: calculateShare(item.amount),
  }));

  const remaining = positiveItems.slice(6);
  const otherAmount = remaining.reduce((acc, item) => acc + item.amount, 0);
  const otherShare = calculateShare(otherAmount);

  const otherItem: HouseholdDashboardChartItem = {
    id: "other",
    name: "Otras",
    amount: otherAmount,
    share: otherShare,
    color: "#94A3B8",
    iconKey: "other",
  };

  return [...topSix, otherItem];
}
