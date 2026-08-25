"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { Amount } from "@/components/finance/amount";
import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceChip } from "@/components/finance/finance-chip";
import { FinanceShimmer } from "@/components/finance/finance-shimmer";
import { PersonalCategoryChart } from "@/features/movements/components/personal-category-chart";
import {
  buildDashboardCategoryChartData,
  calculatePersonalFlowSummary,
} from "@/features/movements/lib/personal-month-view-model";
import { useMplusPersonal } from "@/features/movements/hooks/use-mplus-personal";
import { formatPeriodLabel } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { useAppContextStore } from "@/stores/app-context-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

/**
 * Inicio Personal de Finanzas M+.
 *
 * Muestra únicamente:
 * 1. Tarjeta hero con resumen de flujo mensual (Ingresos y Gastos protagonistas, Balance secundario).
 * 2. Tarjeta analítica única de distribución por categoría con selector Gastos / Ingresos
 *    y gráfico de barras responsivo (vertical en desktop, horizontal en móvil).
 */
export function MplusHomeView({ masked }: { masked: boolean }) {
  const { kpis, expenseBreakdown, incomeBreakdown, status, error, isLoading } =
    useMplusPersonal();
  const refresh = useMplusPersonalStore((state) => state.refresh);
  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);

  /** Modo del gráfico de categoría: 'expense' (inicial) o 'income'. */
  const [breakdownMode, setBreakdownMode] = useState<"expense" | "income">("expense");

  const { income, expense, difference } = kpis;
  const periodLabel = formatPeriodLabel(selectedPeriod);
  const flowSummary = useMemo(
    () => calculatePersonalFlowSummary({ income, expense, periodLabel }),
    [income, expense, periodLabel],
  );

  const rawBreakdown = breakdownMode === "expense" ? expenseBreakdown : incomeBreakdown;
  const chartItems = useMemo(
    () => buildDashboardCategoryChartData(rawBreakdown),
    [rawBreakdown],
  );

  if (status === "error") {
    return (
      <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" variant="default">
        <div role="alert" className="space-y-4">
          <EmptyState
            title="No pudimos cargar tu mes"
            description={error ?? "Revisa tu conexión e intenta de nuevo."}
          />
          <div className="flex justify-center">
            <FinanceButton type="button" size="sm" onClick={() => void refresh()}>
              Reintentar
            </FinanceButton>
          </div>
        </div>
      </FinanceCard>
    );
  }

  return (
    <>
      {/* 1. Resumen superior de flujo del mes */}
      <section>
        <FinanceCard
          className="overflow-hidden border-white/8 bg-[linear-gradient(180deg,rgba(19,27,42,0.98),rgba(13,19,30,0.98))] shadow-[var(--fm-shadow-hero)]"
          variant="hero"
        >
          <div className="space-y-6">
            {/* Encabezado contextual discreto */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <h2 className="font-[var(--font-display)] text-lg font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)] sm:text-xl">
                Resumen de {periodLabel}
              </h2>
              <FinanceChip
                className="min-h-0 bg-[rgba(228,179,99,0.14)] px-3 py-1 text-[11px] text-[var(--fm-pending)] uppercase tracking-[0.12em]"
                variant="pending"
              >
                {selectedPeriod.year}
              </FinanceChip>
            </div>

            {/* Fila principal: protagonistas (Ingresos y Gastos) */}
            <div className="grid grid-cols-1 divide-y divide-white/8 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              {/* Columna Ingresos */}
              <div className="flex items-center gap-4 pb-5 lg:pb-0 lg:pr-8">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[rgba(74,222,128,0.18)] bg-[rgba(74,222,128,0.08)] text-[var(--fm-income)] shadow-inner">
                  <ArrowUpRight className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--fm-text-muted)]">
                    Ingresos
                  </p>
                  <div className="mt-1">
                    <Amount
                      className="font-bold tracking-tight text-3xl sm:text-4xl text-[var(--fm-income)]"
                      masked={masked}
                      showSign={false}
                      size="display"
                      value={income}
                      variant="income"
                    />
                  </div>
                </div>
              </div>

              {/* Columna Gastos */}
              <div className="flex items-center gap-4 pt-5 lg:pt-0 lg:pl-8">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[rgba(248,113,113,0.18)] bg-[rgba(248,113,113,0.08)] text-[var(--fm-expense)] shadow-inner">
                  <ArrowDownLeft className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--fm-text-muted)]">
                    Gastos
                  </p>
                  <div className="mt-1">
                    <Amount
                      className="font-bold tracking-tight text-3xl sm:text-4xl text-[var(--fm-expense)]"
                      masked={masked}
                      showSign={false}
                      size="display"
                      value={expense}
                      variant="expense"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Barra de flujo continua y compacta */}
            <div className="space-y-2 pt-1">
              <div
                role="img"
                aria-label={flowSummary.accessibleLabel}
                className="relative flex h-2.5 w-full overflow-hidden rounded-full bg-[rgba(37,48,71,0.6)]"
              >
                {flowSummary.isEmpty ? (
                  <div className="h-full w-full bg-[rgba(148,163,184,0.2)]" />
                ) : (
                  <>
                    {flowSummary.incomeSharePercent > 0 && (
                      <div
                        className="h-full bg-[var(--fm-income)] motion-safe:transition-[width] motion-safe:duration-300"
                        style={{ width: `${flowSummary.incomeSharePercent}%` }}
                      />
                    )}
                    {flowSummary.expenseSharePercent > 0 && (
                      <div
                        className="h-full bg-[var(--fm-expense)] motion-safe:transition-[width] motion-safe:duration-300"
                        style={{ width: `${flowSummary.expenseSharePercent}%` }}
                      />
                    )}
                  </>
                )}
              </div>

              {flowSummary.isEmpty && (
                <p className="text-xs text-[var(--fm-text-muted)]">
                  Aún no registras ingresos ni gastos en {periodLabel}
                </p>
              )}
            </div>

            {/* Resultado secundario: Balance del mes */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--fm-text-muted)]">
                  Balance del mes
                </span>
                {flowSummary.isBalanced && (
                  <span className="rounded-full bg-white/6 px-2.5 py-0.5 text-[11px] font-medium text-[var(--fm-text-soft)]">
                    En equilibrio
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {difference === 0 ? (
                  <span className="font-[var(--font-display)] text-base font-semibold text-[var(--fm-warm-paper)]">
                    {masked ? "••••••" : "$ 0"}
                  </span>
                ) : (
                  <Amount
                    className="font-[var(--font-display)] text-base font-semibold"
                    masked={masked}
                    showSign
                    size="sm"
                    value={difference}
                    variant={difference > 0 ? "income" : "expense"}
                  />
                )}
              </div>
            </div>
          </div>
        </FinanceCard>
      </section>

      {/* 2. Tarjeta analítica única: Distribución por Categoría */}
      <section>
        <FinanceCard
          className="border-white/8 bg-[rgba(18,25,39,0.96)] w-full transition-all"
          headerRight={
            <div
              className="flex items-center rounded-xl bg-white/5 p-1 border border-white/8"
              role="group"
              aria-label="Tipo de desglose por categoría"
            >
              <button
                type="button"
                aria-pressed={breakdownMode === "expense"}
                onClick={() => setBreakdownMode("expense")}
                className={cn(
                  "cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                  breakdownMode === "expense"
                    ? "bg-[rgba(248,113,113,0.18)] text-[var(--fm-expense)] shadow-sm"
                    : "text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]",
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
                    ? "bg-[rgba(74,222,128,0.18)] text-[var(--fm-income)] shadow-sm"
                    : "text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]",
                )}
              >
                Ingresos
              </button>
            </div>
          }
          subtitle={
            breakdownMode === "expense"
              ? `Total gastado en ${periodLabel}`
              : `Total ingresado en ${periodLabel}`
          }
          title={
            breakdownMode === "expense"
              ? "Gastos por categoría"
              : "Ingresos por categoría"
          }
          variant="default"
        >
          {isLoading ? (
            <div className="space-y-4 py-4">
              <FinanceShimmer className="h-10 w-full rounded-xl" />
              <FinanceShimmer className="h-10 w-full rounded-xl" />
              <FinanceShimmer className="h-10 w-full rounded-xl" />
            </div>
          ) : chartItems.length === 0 ? (
            <div className="py-6">
              <EmptyState
                title={
                  breakdownMode === "expense"
                    ? "Sin gastos este mes"
                    : "Sin ingresos este mes"
                }
                description={
                  breakdownMode === "expense"
                    ? `Aún no has registrado gastos en ${periodLabel}.`
                    : `Aún no has registrado ingresos en ${periodLabel}.`
                }
              />
            </div>
          ) : (
            <div className="pt-2">
              <PersonalCategoryChart items={chartItems} mode={breakdownMode} />
            </div>
          )}
        </FinanceCard>
      </section>
    </>
  );
}
