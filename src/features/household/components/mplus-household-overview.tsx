"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, HelpCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { HouseholdCategoryChart } from "@/features/household/components/household-category-chart";
import { HouseholdAmount } from "@/features/household/components/ui/household-amount";
import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdCard } from "@/features/household/components/ui/household-card";
import { HouseholdChip } from "@/features/household/components/ui/household-chip";
import { HouseholdEmptyState } from "@/features/household/components/ui/household-empty-state";
import {
  buildHouseholdExpenseChartData,
  buildHouseholdIncomeMemberChartData,
  calculateHouseholdFlowSummary,
} from "@/features/household/lib/household-dashboard-view-model";
import {
  expenseByHouseholdCategory,
  monthlyDifference,
  totalExpense,
  totalIncome,
} from "@/lib/mplus/derived";
import type {
  MplusHousehold,
  MplusHouseholdExpenseCategory,
  MplusHouseholdMember,
  MplusMemberCategoryLabel,
  MplusMovement,
} from "@/lib/mplus/models";
import { cn } from "@/lib/utils";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

type Props = {
  household: MplusHousehold;
  members: MplusHouseholdMember[];
  categories: MplusHouseholdExpenseCategory[];
  categoryLabels: MplusMemberCategoryLabel[];
  movements: MplusMovement[];
  periodLabel: string;
  currentUid: string;
};

/**
 * Inicio de Hogar de Finanzas M+.
 *
 * Muestra únicamente:
 * 1. Tarjeta hero con resumen de flujo mensual compartido (Ingresos y Gastos protagonistas, Balance secundario).
 * 2. Tarjeta analítica única expansible:
 *    - Gastos: distribución por categoría compartida (incluye 'Por clasificar').
 *    - Ingresos: distribución por integrante aportante.
 */
export function MplusHouseholdOverview({
  household,
  members,
  categories,
  movements,
  periodLabel,
  currentUid,
}: Props) {
  const router = useRouter();
  const masked = useUiPreferencesStore((state) => state.balancesHidden);

  /** Modo del gráfico: 'expense' (inicial) o 'income'. */
  const [breakdownMode, setBreakdownMode] = useState<"expense" | "income">("expense");

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.userId, m])),
    [members],
  );

  // Cálculos derivados puros (§25)
  const incomeTotal = totalIncome(movements);
  const expenseTotal = totalExpense(movements);
  const diffTotal = monthlyDifference(movements);

  const flowSummary = useMemo(
    () =>
      calculateHouseholdFlowSummary({
        income: incomeTotal,
        expense: expenseTotal,
        periodLabel,
      }),
    [incomeTotal, expenseTotal, periodLabel],
  );

  // Cantidad de gastos sin clasificar
  const unclassifiedCount = useMemo(
    () =>
      movements.filter(
        (m) => m.type === "expense" && m.householdCategoryId === null,
      ).length,
    [movements],
  );

  // Adaptadores de datos para el gráfico analítico
  const rawExpenseBreakdown = useMemo(
    () => expenseByHouseholdCategory(movements),
    [movements],
  );

  const expenseChartItems = useMemo(
    () => buildHouseholdExpenseChartData(rawExpenseBreakdown, categoryMap),
    [rawExpenseBreakdown, categoryMap],
  );

  const incomeChartItems = useMemo(
    () =>
      buildHouseholdIncomeMemberChartData(
        movements.filter((m) => m.type === "income"),
        memberMap,
        currentUid,
      ),
    [movements, memberMap, currentUid],
  );

  const currentChartItems =
    breakdownMode === "expense" ? expenseChartItems : incomeChartItems;

  return (
    <div className="flex flex-col gap-4 lg:gap-5 flex-1 min-h-0">
      {/* 1. Resumen superior de flujo del mes compartido (compacto y jerárquico) */}
      <section className="shrink-0">
        <HouseholdCard
          className="overflow-hidden shadow-[var(--hh-shadow-hero)] py-3 sm:py-3.5"
          variant="hero"
        >
          <div className="space-y-3.5 sm:space-y-4">
            {/* Encabezado contextual discreto */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-[var(--font-display)] text-base sm:text-lg font-semibold tracking-[-0.02em] text-[var(--hh-text)]">
                Resumen de {periodLabel}
              </h2>
              <HouseholdChip
                className="min-h-0 px-2.5 py-0.5 text-[10px] sm:text-[11px]"
                variant="household"
              >
                {household.name || "Hogar compartido"}
              </HouseholdChip>
            </div>

            {/* Fila principal: protagonistas (Ingresos y Gastos) */}
            <div className="grid grid-cols-1 divide-y divide-[var(--hh-border-soft)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              {/* Columna Ingresos */}
              <div className="flex items-center gap-3.5 pb-3 lg:pb-0 lg:pr-6">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--hh-primary-action)]/25 bg-[var(--hh-primary-action)]/10 text-[var(--hh-primary-action)] shadow-inner">
                  <ArrowUpRight className="h-5 w-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.1em] text-[var(--hh-text-muted)]">
                    Ingresos compartidos
                  </p>
                  <div className="mt-0.5">
                    <HouseholdAmount
                      className="font-bold tracking-tight text-2xl sm:text-3xl text-[var(--hh-primary-action)]"
                      masked={masked}
                      showSign={false}
                      size="display"
                      value={incomeTotal}
                      variant="income"
                    />
                  </div>
                </div>
              </div>

              {/* Columna Gastos */}
              <div className="flex items-center gap-3.5 pt-3 lg:pt-0 lg:pl-6">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--hh-destructive-border)]/25 bg-[var(--hh-destructive-border)]/10 text-[var(--hh-destructive-content)] shadow-inner">
                  <ArrowDownLeft className="h-5 w-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.1em] text-[var(--hh-text-muted)]">
                    Gastos compartidos
                  </p>
                  <div className="mt-0.5">
                    <HouseholdAmount
                      className="font-bold tracking-tight text-2xl sm:text-3xl text-[var(--hh-destructive-content)]"
                      masked={masked}
                      showSign={false}
                      size="display"
                      value={expenseTotal}
                      variant="expense"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Barra de flujo continua y compacta */}
            <div className="space-y-1.5 pt-0.5">
              <div
                role="img"
                aria-label={flowSummary.accessibleLabel}
                className="relative flex h-2 w-full overflow-hidden rounded-full bg-[var(--hh-surface-elevated)] border border-[var(--hh-border-soft)]"
              >
                {flowSummary.isEmpty ? (
                  <div className="h-full w-full bg-[var(--hh-border-soft)]" />
                ) : (
                  <>
                    {flowSummary.incomeSharePercent > 0 && (
                      <div
                        className="h-full bg-[var(--hh-primary-action)] motion-safe:transition-[width] motion-safe:duration-300"
                        style={{ width: `${flowSummary.incomeSharePercent}%` }}
                      />
                    )}
                    {flowSummary.expenseSharePercent > 0 && (
                      <div
                        className="h-full bg-[var(--hh-destructive-border)] motion-safe:transition-[width] motion-safe:duration-300"
                        style={{ width: `${flowSummary.expenseSharePercent}%` }}
                      />
                    )}
                  </>
                )}
              </div>

              {flowSummary.isEmpty && (
                <p className="text-[11px] text-[var(--hh-text-muted)]">
                  Aún no registran movimientos compartidos en {periodLabel}
                </p>
              )}
            </div>

            {/* Resultado secundario: Balance del mes */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--hh-border-soft)] pt-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-medium text-[var(--hh-text-secondary)]">
                  Balance del mes
                </span>
                {flowSummary.isBalanced && (
                  <span className="rounded-full bg-[var(--hh-surface-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--hh-text-secondary)]">
                    En equilibrio
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {diffTotal === 0 ? (
                  <span className="font-[var(--font-display)] text-sm sm:text-base font-semibold text-[var(--hh-text)]">
                    {masked ? "$ ----" : "$ 0"}
                  </span>
                ) : (
                  <HouseholdAmount
                    className="font-[var(--font-display)] text-sm sm:text-base font-semibold"
                    masked={masked}
                    showSign
                    size="sm"
                    value={diffTotal}
                    variant={diffTotal > 0 ? "income" : "expense"}
                  />
                )}
              </div>
            </div>
          </div>
        </HouseholdCard>
      </section>

      {/* 2. Tarjeta analítica única de Hogar (Expansible en escritorio) */}
      <section className="flex-1 min-h-0 flex flex-col">
        <HouseholdCard
          className="w-full flex-1 min-h-0 flex flex-col transition-all"
          contentClassName="flex-1 flex flex-col min-h-0"
          headerRight={
            <div
              className="flex items-center rounded-xl bg-[var(--hh-surface-elevated)] p-1 border border-[var(--hh-border-soft)]"
              role="group"
              aria-label="Tipo de desglose compartido"
            >
              <button
                type="button"
                aria-pressed={breakdownMode === "expense"}
                onClick={() => setBreakdownMode("expense")}
                className={cn(
                  "cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                  breakdownMode === "expense"
                    ? "bg-[var(--hh-destructive-border)]/20 text-[var(--hh-destructive-content)] shadow-sm"
                    : "text-[var(--hh-text-muted)] hover:text-[var(--hh-text)]",
                )}
              >
                Gastos
              </button>
              <button
                type="button"
                aria-pressed={breakdownMode === "income"}
                onClick={() => setBreakdownMode("income")}
                className={cn(
                  "cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                  breakdownMode === "income"
                    ? "bg-[var(--hh-primary-action)]/20 text-[var(--hh-primary-action)] shadow-sm"
                    : "text-[var(--hh-text-muted)] hover:text-[var(--hh-text)]",
                )}
              >
                Ingresos
              </button>
            </div>
          }
          subtitle={
            breakdownMode === "expense"
              ? `Total gastado en ${periodLabel}`
              : `Total aportado en ${periodLabel}`
          }
          title={
            breakdownMode === "expense"
              ? "Gastos por categoría"
              : "Aportes por integrante"
          }
          variant="default"
        >
          {/* Aviso compacto de gastos por clasificar integrado dentro de la tarjeta */}
          {breakdownMode === "expense" && unclassifiedCount > 0 && (
            <div
              role="status"
              className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--hh-border-soft)] bg-[var(--hh-surface-elevated)] px-3.5 py-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <HelpCircle className="h-4 w-4 shrink-0 text-[var(--hh-primary-action)]" />
                <span className="text-[var(--hh-text-secondary)] truncate">
                  {unclassifiedCount === 1
                    ? "1 gasto pendiente por clasificar"
                    : `${unclassifiedCount} gastos pendientes por clasificar`}
                </span>
              </div>
              <HouseholdButton
                size="sm"
                variant="ghost"
                onClick={() => router.push("/household/movements")}
                className="shrink-0 text-xs text-[var(--hh-primary-action)] hover:underline py-1 h-auto px-2"
              >
                Clasificar gastos
              </HouseholdButton>
            </div>
          )}

          {currentChartItems.length === 0 ? (
            <div className="py-6 flex-1 flex items-center justify-center">
              <HouseholdEmptyState
                title={
                  breakdownMode === "expense"
                    ? "Sin gastos compartidos este mes"
                    : "Sin aportes compartidos este mes"
                }
                description={
                  breakdownMode === "expense"
                    ? `Aún no registran gastos en ${periodLabel}.`
                    : `Aún no registran aportes de ingresos en ${periodLabel}.`
                }
              />
            </div>
          ) : (
            <div className="pt-2 flex-1 flex flex-col min-h-0">
              <HouseholdCategoryChart
                items={currentChartItems}
                mode={breakdownMode}
                masked={masked}
                className="flex-1 flex flex-col min-h-0"
              />
            </div>
          )}
        </HouseholdCard>
      </section>
    </div>
  );
}
