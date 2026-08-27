import { DEFAULT_HOUSEHOLD_CATEGORY_COLOR } from "@/lib/categories/household-category-colors";
import { formatMovementGroupLabelEs } from "@/lib/format/date";
import { UNCLASSIFIED_HOUSEHOLD_CATEGORY_KEY } from "@/lib/mplus/derived";
import type { MplusDerivableMovement } from "@/lib/mplus/derived";
import type { MplusMovement } from "@/lib/mplus/models";

/**
 * Resumen de flujo mensual para el Inicio de Hogar.
 */
export interface HouseholdFlowSummary {
  readonly income: number;
  readonly expense: number;
  readonly difference: number;
  readonly totalFlow: number;
  readonly maxFlow: number;
  readonly incomeSharePercent: number;
  readonly expenseSharePercent: number;
  readonly incomeScalePercent: number;
  readonly expenseScalePercent: number;
  readonly isBalanced: boolean;
  readonly isEmpty: boolean;
  readonly accessibleLabel: string;
  readonly periodLabel?: string;
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
      ? Math.round(rawIncome)
      : 0;

  const expense =
    typeof rawExpense === "number" && Number.isFinite(rawExpense) && rawExpense > 0
      ? Math.round(rawExpense)
      : 0;

  const totalFlow = income + expense;
  const maxFlow = Math.max(income, expense);
  const difference = income - expense;
  const isBalanced = totalFlow > 0 && difference === 0;
  const isEmpty = totalFlow === 0;

  let incomeSharePercent = 0;
  let expenseSharePercent = 0;

  if (totalFlow > 0) {
    if (expense === 0) {
      incomeSharePercent = 100;
      expenseSharePercent = 0;
    } else if (income === 0) {
      incomeSharePercent = 0;
      expenseSharePercent = 100;
    } else {
      incomeSharePercent = Math.round((income / totalFlow) * 100);
      expenseSharePercent = 100 - incomeSharePercent;
    }
  }

  const incomeScalePercent = maxFlow > 0 ? (income / maxFlow) * 100 : 0;
  const expenseScalePercent = maxFlow > 0 ? (expense / maxFlow) * 100 : 0;

  const accessibleLabel = isEmpty
    ? `Sin movimientos compartidos registrados en ${input.periodLabel}`
    : `Resumen compartido de ${input.periodLabel}: ingresos $ ${income.toLocaleString("es-CO")}, gastos $ ${expense.toLocaleString("es-CO")}`;

  return {
    income,
    expense,
    difference,
    totalFlow,
    maxFlow,
    incomeSharePercent,
    expenseSharePercent,
    incomeScalePercent,
    expenseScalePercent,
    isBalanced,
    isEmpty,
    accessibleLabel,
    periodLabel: input.periodLabel,
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
  readonly shareLabel: string;
  readonly barScalePercent: number;
  readonly color: string;
  readonly iconKey?: string;
  readonly isUnclassified?: boolean;
}

/**
 * Formatea la etiqueta de porcentaje de participación real.
 */
const formatShareLabel = (amount: number, share: number, totalAmount: number): string => {
  if (amount <= 0) return "0%";
  if (amount === totalAmount) return "100%";
  if (totalAmount > 0) {
    const ratio = amount / totalAmount;
    if (ratio < 0.01) {
      return "<1%";
    }
    if (ratio >= 0.995 && amount < totalAmount) {
      return "99,9%";
    }
  }
  return `${share}%`;
};

/**
 * Adaptador de gastos por categoría para el gráfico de Hogar.
 *
 * Preserva "Por clasificar", filtra montos no positivos o no finitos,
 * ordena descendentemente y muestra hasta 10 categorías directamente (o top 9 + "Otras").
 * La altura visual (barScalePercent) se normaliza contra el elemento mayor.
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

  let displayItems: Array<{
    id: string;
    name: string;
    amount: number;
    share: number;
    shareLabel: string;
    color: string;
    iconKey: string;
    isUnclassified?: boolean;
  }>;

  if (positiveItems.length <= 10) {
    displayItems = positiveItems.map((item) => {
      const share = calculateShare(item.amount);
      return {
        ...item,
        share,
        shareLabel: formatShareLabel(item.amount, share, totalAmount),
      };
    });
  } else {
    const topNine = positiveItems.slice(0, 9).map((item) => {
      const share = calculateShare(item.amount);
      return {
        ...item,
        share,
        shareLabel: formatShareLabel(item.amount, share, totalAmount),
      };
    });

    const remaining = positiveItems.slice(9);
    const otherAmount = remaining.reduce((acc, item) => acc + item.amount, 0);
    const otherShare = calculateShare(otherAmount);

    displayItems = [
      ...topNine,
      {
        id: "other",
        name: "Otras",
        amount: otherAmount,
        share: otherShare,
        shareLabel: formatShareLabel(otherAmount, otherShare, totalAmount),
        color: "#94A3B8",
        iconKey: "other",
        isUnclassified: false,
      },
    ];
  }

  // Normalización de la altura de barra contra el elemento de mayor valor (100% de altura útil)
  const maxCategoryAmount = displayItems.reduce(
    (max, item) => Math.max(max, item.amount),
    0,
  );

  const calculateBarScale = (amount: number): number => {
    if (maxCategoryAmount <= 0) return 0;
    const exactPercent = (amount / maxCategoryAmount) * 100;
    return Math.max(0.1, Math.min(100, Math.round(exactPercent * 10) / 10));
  };

  return displayItems.map((item) => ({
    ...item,
    barScalePercent: calculateBarScale(item.amount),
  }));
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

export interface HouseholdIncomeCategoryRow {
  readonly id: string; // `${ownerId}__${categoryId}`
  readonly ownerId: string;
  readonly ownerLabel: string;
  readonly isOwn: boolean;
  readonly categoryId: string;
  readonly name: string;
  readonly iconKey: string;
  readonly color: string;
  readonly amount: number;
  readonly share: number; // 0 a 100
  readonly shareLabel: string;
  readonly barScalePercent: number;
}

export interface HouseholdIncomeCategoryChartItem {
  readonly id: string; // `${ownerId}__${categoryId}`
  readonly ownerId: string;
  readonly ownerLabel: string;
  readonly photoUrl?: string | null;
  readonly isOwn: boolean;
  readonly categoryId: string;
  readonly name: string;
  readonly iconKey: string;
  readonly color: string;
  readonly amount: number;
  readonly share: number; // 0 a 100
  readonly shareLabel: string;
  readonly barScalePercent: number;
}

export interface HouseholdMemberIncomeSection {
  readonly ownerId: string;
  readonly ownerLabel: string;
  readonly isOwn: boolean;
  readonly photoUrl?: string | null;
  readonly totalAmount: number;
  readonly percentageOfTotal: number; // 0 a 100
  readonly shareLabel: string;
  readonly rows: readonly HouseholdIncomeCategoryRow[];
}

export const FALLBACK_INCOME_CATEGORY_NAME = "Categoría de ingreso";
export const FALLBACK_INCOME_ICON = "other";
export const FALLBACK_INCOME_COLOR = "#94A3B8";

/**
 * Adaptador plano de ingresos por categoría para el gráfico de Hogar.
 *
 * Cada barra representa una categoría de ingreso de un integrante (ownerId + categoryId).
 * Se ordenan de forma global por monto descendente sin agrupar ni separar por responsable.
 * La altura de barra se normaliza contra la categoría de mayor valor de todo el Hogar.
 * El porcentaje se calcula sobre el total global de ingresos compartidos.
 */
export function buildHouseholdIncomeCategoryChartData(input: {
  movements: readonly (MplusDerivableMovement & { ownerId: string; categoryId: string })[];
  memberMap: Map<string, { userId: string; displayName: string; photoUrl?: string | null }>;
  currentUid: string;
  ownCategoriesMap: Map<string, { name: string; iconKey: string; color: string }>;
  categoryLabels: readonly { ownerId: string; categoryId: string; name: string; iconKey: string; color: string }[];
}): readonly HouseholdIncomeCategoryChartItem[] {
  const incomes = input.movements.filter(
    (m) =>
      m.type === "income" &&
      typeof m.amount === "number" &&
      Number.isFinite(m.amount) &&
      m.amount > 0,
  );

  const totalIncomeAmount = incomes.reduce((acc, m) => acc + m.amount, 0);
  if (totalIncomeAmount <= 0) return [];

  // Agrupar ingresos por ownerId y categoryId
  const byOwnerAndCat = new Map<string, { ownerId: string; categoryId: string; amount: number }>();
  for (const m of incomes) {
    const key = `${m.ownerId}__${m.categoryId}`;
    const existing = byOwnerAndCat.get(key);
    if (existing) {
      existing.amount += m.amount;
    } else {
      byOwnerAndCat.set(key, { ownerId: m.ownerId, categoryId: m.categoryId, amount: m.amount });
    }
  }

  const rawItems = Array.from(byOwnerAndCat.values());
  if (rawItems.length === 0) return [];

  const resolvedItems = rawItems.map((item) => {
    const isOwn = item.ownerId === input.currentUid;
    const member = input.memberMap.get(item.ownerId);
    const ownerLabel = isOwn
      ? "Tú"
      : member?.displayName?.trim() || "Pareja";
    const photoUrl = member?.photoUrl || null;

    const resolved = resolveHouseholdIncomeCategoryLabel({
      ownerId: item.ownerId,
      categoryId: item.categoryId,
      currentUid: input.currentUid,
      ownCategoriesMap: input.ownCategoriesMap,
      partnerCategoryLabels: input.categoryLabels,
    });

    return {
      id: `${item.ownerId}__${item.categoryId}`,
      ownerId: item.ownerId,
      ownerLabel,
      photoUrl,
      isOwn,
      categoryId: item.categoryId,
      name: resolved.name,
      iconKey: resolved.iconKey,
      color: resolved.color,
      amount: item.amount,
    };
  });

  // Orden global por importe desc, luego nombre asc, luego ownerLabel asc, luego id asc
  resolvedItems.sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount;
    const nameComp = a.name.localeCompare(b.name, "es-CO", { sensitivity: "base" });
    if (nameComp !== 0) return nameComp;
    const ownerComp = a.ownerLabel.localeCompare(b.ownerLabel, "es-CO", { sensitivity: "base" });
    if (ownerComp !== 0) return ownerComp;
    return a.id.localeCompare(b.id);
  });

  const calculateShare = (amount: number) =>
    totalIncomeAmount > 0 ? Math.round((amount / totalIncomeAmount) * 100) : 0;

  let displayItems: typeof resolvedItems;
  if (resolvedItems.length <= 10) {
    displayItems = resolvedItems;
  } else {
    displayItems = resolvedItems.slice(0, 10);
  }

  const maxCategoryAmount = displayItems.reduce((max, item) => Math.max(max, item.amount), 0);

  return displayItems.map((item) => {
    const share = calculateShare(item.amount);
    const barScalePercent =
      maxCategoryAmount > 0
        ? Math.max(0.1, Math.min(100, Math.round(((item.amount / maxCategoryAmount) * 100) * 10) / 10))
        : 0;

    return {
      ...item,
      share,
      shareLabel: formatShareLabel(item.amount, share, totalIncomeAmount),
      barScalePercent,
    };
  });
}

/**
 * Resuelve nombre, icono y color de una categoría de ingreso:
 * - Para el usuario actual: busca en el mapa de categorías personales propias.
 * - Para la pareja / otros miembros: busca en las etiquetas proyectadas (partnerCategoryLabels / categoryLabels).
 * - Fallback seguro sin romper la vista si falta la etiqueta.
 */
export function resolveHouseholdIncomeCategoryLabel(input: {
  ownerId: string;
  categoryId: string;
  currentUid: string;
  ownCategoriesMap: Map<string, { name: string; iconKey: string; color: string }>;
  partnerCategoryLabels: readonly { ownerId: string; categoryId: string; name: string; iconKey: string; color: string }[];
}): { name: string; iconKey: string; color: string } {
  if (input.ownerId === input.currentUid) {
    const ownCat = input.ownCategoriesMap.get(input.categoryId);
    return {
      name: ownCat?.name || FALLBACK_INCOME_CATEGORY_NAME,
      iconKey: ownCat?.iconKey || FALLBACK_INCOME_ICON,
      color: ownCat?.color || FALLBACK_INCOME_COLOR,
    };
  }

  const label = input.partnerCategoryLabels.find(
    (l) => l.ownerId === input.ownerId && l.categoryId === input.categoryId,
  );
  return {
    name: label?.name || FALLBACK_INCOME_CATEGORY_NAME,
    iconKey: label?.iconKey || FALLBACK_INCOME_ICON,
    color: label?.color || FALLBACK_INCOME_COLOR,
  };
}

/**
 * Construye la estructura jerárquica de ingresos compartidos de Hogar por integrante y categoría personal.
 *
 * Paridad con Android:
 * 1. Sección por `ownerId`, con identidad (“Tú” primero, luego pareja), avatar, subtotal y porcentaje del total.
 * 2. Filas internas por `ownerId + categoryId` con nombre, icono, color, monto y porcentaje.
 * 3. Orden: "Tú" siempre primero, luego integrantes por subtotal desc; dentro de cada integrante, categorías por importe desc con desempate estable.
 */
export function buildHouseholdIncomeSections(input: {
  movements: readonly (MplusDerivableMovement & { ownerId: string; categoryId: string })[];
  memberMap: Map<string, { userId: string; displayName: string; photoUrl?: string | null }>;
  currentUid: string;
  ownCategoriesMap: Map<string, { name: string; iconKey: string; color: string }>;
  categoryLabels: readonly { ownerId: string; categoryId: string; name: string; iconKey: string; color: string }[];
}): readonly HouseholdMemberIncomeSection[] {
  const incomes = input.movements.filter(
    (m) =>
      m.type === "income" &&
      typeof m.amount === "number" &&
      Number.isFinite(m.amount) &&
      m.amount > 0,
  );

  const totalIncomeAmount = incomes.reduce((acc, m) => acc + m.amount, 0);
  if (totalIncomeAmount <= 0) return [];

  // Agrupar ingresos por ownerId y categoryId
  const byOwnerAndCat = new Map<string, { ownerId: string; categoryId: string; amount: number }>();
  for (const m of incomes) {
    const key = `${m.ownerId}__${m.categoryId}`;
    const existing = byOwnerAndCat.get(key);
    if (existing) {
      existing.amount += m.amount;
    } else {
      byOwnerAndCat.set(key, { ownerId: m.ownerId, categoryId: m.categoryId, amount: m.amount });
    }
  }

  const items = Array.from(byOwnerAndCat.values());
  const maxCategoryAmount = items.reduce((max, item) => Math.max(max, item.amount), 0);

  // Agrupar items por ownerId
  const itemsByOwner = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByOwner.get(item.ownerId) || [];
    list.push(item);
    itemsByOwner.set(item.ownerId, list);
  }

  const sections: HouseholdMemberIncomeSection[] = [];

  for (const [ownerId, ownerItems] of itemsByOwner.entries()) {
    const isOwn = ownerId === input.currentUid;
    const member = input.memberMap.get(ownerId);
    const ownerLabel = isOwn
      ? "Tú"
      : member?.displayName?.trim() || "Pareja";
    const photoUrl = member?.photoUrl || null;

    const resolvedRows = ownerItems.map((item) => {
      const resolved = resolveHouseholdIncomeCategoryLabel({
        ownerId: item.ownerId,
        categoryId: item.categoryId,
        currentUid: input.currentUid,
        ownCategoriesMap: input.ownCategoriesMap,
        partnerCategoryLabels: input.categoryLabels,
      });
      return {
        id: `${item.ownerId}__${item.categoryId}`,
        ownerId: item.ownerId,
        categoryId: item.categoryId,
        name: resolved.name,
        iconKey: resolved.iconKey,
        color: resolved.color,
        amount: item.amount,
      };
    });

    // Orden dentro de cada integrante: importe desc, nombre asc, id asc
    resolvedRows.sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      const nameComp = a.name.localeCompare(b.name, "es-CO", { sensitivity: "base" });
      if (nameComp !== 0) return nameComp;
      return a.categoryId.localeCompare(b.categoryId);
    });

    const memberTotalAmount = resolvedRows.reduce((acc, r) => acc + r.amount, 0);
    const memberShare =
      totalIncomeAmount > 0
        ? Math.round((memberTotalAmount / totalIncomeAmount) * 100)
        : 0;

    const rows: HouseholdIncomeCategoryRow[] = resolvedRows.map((r) => {
      const share =
        totalIncomeAmount > 0
          ? Math.round((r.amount / totalIncomeAmount) * 100)
          : 0;
      const barScalePercent =
        maxCategoryAmount > 0
          ? Math.max(0.1, Math.min(100, Math.round(((r.amount / maxCategoryAmount) * 100) * 10) / 10))
          : 0;

      return {
        ...r,
        ownerLabel,
        isOwn,
        share,
        shareLabel: formatShareLabel(r.amount, share, totalIncomeAmount),
        barScalePercent,
      };
    });

    sections.push({
      ownerId,
      ownerLabel,
      isOwn,
      photoUrl,
      totalAmount: memberTotalAmount,
      percentageOfTotal: memberShare,
      shareLabel: formatShareLabel(memberTotalAmount, memberShare, totalIncomeAmount),
      rows,
    });
  }

  // Orden de secciones: "Tú" (isOwn === true) siempre primero; luego totalAmount desc; luego ownerLabel asc
  sections.sort((a, b) => {
    if (a.isOwn !== b.isOwn) return a.isOwn ? -1 : 1;
    if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount;
    return a.ownerLabel.localeCompare(b.ownerLabel, "es-CO", { sensitivity: "base" });
  });

  return sections;
}

/**
 * Adaptador plano legacy de ingresos por integrante para el gráfico de barras.
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

  let displayItems: Array<{
    id: string;
    name: string;
    amount: number;
    share: number;
    shareLabel: string;
    color: string;
    iconKey: string;
  }>;

  if (positiveItems.length <= 10) {
    displayItems = positiveItems.map((item) => {
      const share = calculateShare(item.amount);
      return {
        ...item,
        share,
        shareLabel: formatShareLabel(item.amount, share, totalAmount),
      };
    });
  } else {
    const topNine = positiveItems.slice(0, 9).map((item) => {
      const share = calculateShare(item.amount);
      return {
        ...item,
        share,
        shareLabel: formatShareLabel(item.amount, share, totalAmount),
      };
    });

    const remaining = positiveItems.slice(9);
    const otherAmount = remaining.reduce((acc, item) => acc + item.amount, 0);
    const otherShare = calculateShare(otherAmount);

    displayItems = [
      ...topNine,
      {
        id: "other",
        name: "Otras",
        amount: otherAmount,
        share: otherShare,
        shareLabel: formatShareLabel(otherAmount, otherShare, totalAmount),
        color: "#94A3B8",
        iconKey: "other",
      },
    ];
  }

  // Normalización de la altura de barra contra el elemento de mayor valor
  const maxCategoryAmount = displayItems.reduce(
    (max, item) => Math.max(max, item.amount),
    0,
  );

  const calculateBarScale = (amount: number): number => {
    if (maxCategoryAmount <= 0) return 0;
    const exactPercent = (amount / maxCategoryAmount) * 100;
    return Math.max(0.1, Math.min(100, Math.round(exactPercent * 10) / 10));
  };

  return displayItems.map((item) => ({
    ...item,
    barScalePercent: calculateBarScale(item.amount),
  }));
}

export interface HouseholdMovementGroup {
  readonly label: string;
  readonly movements: readonly MplusMovement[];
}

/**
 * Agrupa movimientos del Hogar por día en orden cronológico descendente.
 */
export function groupHouseholdMovementsByDay(
  movements: readonly MplusMovement[],
  referenceDate = new Date(),
): readonly HouseholdMovementGroup[] {
  const sorted = [...movements].sort(
    (a, b) => b.occurredAtMillis - a.occurredAtMillis,
  );

  const groups: HouseholdMovementGroup[] = [];
  for (const mov of sorted) {
    const label = formatMovementGroupLabelEs(
      new Date(mov.occurredAtMillis),
      referenceDate,
    );
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      (last.movements as MplusMovement[]).push(mov);
    } else {
      groups.push({ label, movements: [mov] });
    }
  }
  return groups;
}
