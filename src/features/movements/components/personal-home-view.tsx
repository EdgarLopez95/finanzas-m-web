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
 * 1. Tarjeta hero con resumen de flujo mensual compacto (Ingresos y Gastos protagonistas, Balance secundario).
 * 2. Tarjeta analítica única de distribución por categoría que aprovecha la altura disponible en escritorio.
 */
export function MplusHomeView() {
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
    <div className="flex flex-col gap-4 lg:gap-5 flex-1 min-h-0">
      {/* 1. Resumen superior de flujo del mes: Composición asimétrica de 2 zonas (Balance a la izquierda, Ingresos/Gastos apilados a la derecha) */}
      <section className="shrink-0">
        <FinanceCard
          className="overflow-hidden border-white/8 bg-[linear-gradient(180deg,rgba(19,27,42,0.98),rgba(13,19,30,0.98))] shadow-[var(--fm-shadow-hero)] py-4 sm:py-4.5"
          variant="hero"
        >
          <div className="space-y-3.5 sm:space-y-4">
            {/* Encabezado contextual discreto */}
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-[var(--font-display)] text-sm sm:text-base font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]">
                Resumen de {periodLabel}
              </h2>
              <FinanceChip
                className="min-h-0 bg-[rgba(228,179,99,0.14)] px-2.5 py-0.5 text-[10px] sm:text-[11px] text-[var(--fm-pending)] uppercase tracking-[0.12em]"
                variant="pending"
              >
                {selectedPeriod.year}
              </FinanceChip>
            </div>

            {/* Composición asimétrica en 2 zonas: Balance (izq 40-45%) | Ingresos y Gastos en 2 filas (der 55-60%) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center pt-0.5">
              {/* Zona Izquierda: Balance del mes (ancla protagonista) */}
              <div className="lg:col-span-5 flex flex-col justify-center gap-1 min-w-0">
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.1em] text-[var(--fm-text-muted)]">
                  Balance del mes
                </span>
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  {difference === 0 ? (
                    <span className="font-[var(--font-display)] text-3xl sm:text-4xl lg:text-[38px] font-bold tracking-tight text-[var(--fm-warm-paper)]">
                      $ 0
                    </span>
                  ) : (
                    <Amount
                      className="font-[var(--font-display)] text-3xl sm:text-4xl lg:text-[38px] font-bold tracking-tight"
                      showSign
                      size="display"
                      value={difference}
                      variant={difference > 0 ? "income" : "expense"}
                    />
                  )}
                  {flowSummary.isBalanced && (
                    <span className="rounded-full bg-white/6 px-2.5 py-0.5 text-[11px] font-medium text-[var(--fm-text-soft)]">
                      En equilibrio
                    </span>
                  )}
                </div>

                {/* Insight contextual del Balance */}
                {!flowSummary.isEmpty && (
                  <div className="pt-1 flex items-center">
                    {difference < 0 ? (
                      <div className="flex items-center gap-1.5 rounded-md border border-[rgba(248,113,113,0.14)] bg-[rgba(248,113,113,0.06)] px-2 py-0.5 text-[11px] sm:text-xs font-medium text-[var(--fm-expense)]/90">
                        <ArrowDownLeft className="h-3 w-3 shrink-0 stroke-[2.2]" />
                        <span>Gastaste $ {Math.abs(difference).toLocaleString("es-CO")} más de lo que ingresaste</span>
                      </div>
                    ) : difference > 0 ? (
                      <div className="flex items-center gap-1.5 rounded-md border border-[rgba(74,222,128,0.14)] bg-[rgba(74,222,128,0.06)] px-2 py-0.5 text-[11px] sm:text-xs font-medium text-[var(--fm-income)]/90">
                        <ArrowUpRight className="h-3 w-3 shrink-0 stroke-[2.2]" />
                        <span>Ingresaste $ {difference.toLocaleString("es-CO")} más de lo que gastaste</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-md border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[11px] sm:text-xs font-medium text-[var(--fm-text-soft)]">
                        <span>Tus ingresos y gastos están en equilibrio este mes</span>
                      </div>
                    )}
                  </div>
                )}

                {flowSummary.isEmpty && (
                  <p className="text-[11px] text-[var(--fm-text-muted)] pt-0.5">
                    Aún no registras ingresos ni gastos en {periodLabel}
                  </p>
                )}
              </div>

              {/* Zona Derecha: Ingresos y Gastos apilados verticalmente en 2 filas horizontales largas */}
              <div className="lg:col-span-7 flex flex-col justify-center gap-3 sm:gap-3.5 lg:border-l lg:border-white/8 lg:pl-8 pt-3 lg:pt-0 border-t lg:border-t-0 border-white/8">
                {/* Fila 1: Ingresos */}
                <div className="space-y-1.5 w-full">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[rgba(74,222,128,0.2)] bg-[rgba(74,222,128,0.08)] text-[var(--fm-income)]">
                        <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.2]" />
                      </div>
                      <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.1em] text-[var(--fm-text-muted)] truncate">
                        Ingresos
                      </span>
                    </div>
                    <Amount
                      className="font-bold tracking-tight text-base sm:text-lg text-[var(--fm-income)]"
                      showSign={false}
                      size="sm"
                      value={income}
                      variant="income"
                    />
                  </div>
                  {/* Barra de escala proporcional horizontal larga */}
                  <div
                    role="img"
                    aria-label={`Ingresos en ${periodLabel}: $ ${income.toLocaleString("es-CO")}`}
                    className="h-1.5 w-full rounded-full bg-white/6 overflow-hidden"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--fm-income)] motion-safe:transition-[width] motion-safe:duration-300"
                      style={{ width: `${flowSummary.incomeScalePercent}%` }}
                    />
                  </div>
                </div>

                {/* Fila 2: Gastos */}
                <div className="space-y-1.5 w-full">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[rgba(248,113,113,0.2)] bg-[rgba(248,113,113,0.08)] text-[var(--fm-expense)]">
                        <ArrowDownLeft className="h-3.5 w-3.5 stroke-[2.2]" />
                      </div>
                      <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.1em] text-[var(--fm-text-muted)] truncate">
                        Gastos
                      </span>
                    </div>
                    <Amount
                      className="font-bold tracking-tight text-base sm:text-lg text-[var(--fm-expense)]"
                      showSign={false}
                      size="sm"
                      value={expense}
                      variant="expense"
                    />
                  </div>
                  {/* Barra de escala proporcional horizontal larga */}
                  <div
                    role="img"
                    aria-label={`Gastos en ${periodLabel}: $ ${expense.toLocaleString("es-CO")}`}
                    className="h-1.5 w-full rounded-full bg-white/6 overflow-hidden"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--fm-expense)] motion-safe:transition-[width] motion-safe:duration-300"
                      style={{ width: `${flowSummary.expenseScalePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FinanceCard>
      </section>

      {/* 2. Tarjeta analítica única: Distribución por Categoría (Gráfica de barras verticales flexible) */}
      <section className="flex-1 min-h-0 flex flex-col">
        <FinanceCard
          className="border-white/8 bg-[rgba(18,25,39,0.96)] w-full flex-1 min-h-0 flex flex-col py-4 sm:py-4.5 transition-all"
          contentClassName="flex-1 flex flex-col min-h-0"
          headerRight={
            <div
              className="flex items-center rounded-xl bg-white/4 p-1 border border-white/6"
              role="group"
              aria-label="Tipo de desglose por categoría"
            >
              <button
                type="button"
                aria-pressed={breakdownMode === "expense"}
                onClick={() => setBreakdownMode("expense")}
                className={cn(
                  "cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 outline-none select-none",
                  "focus-visible:ring-2 focus-visible:ring-[var(--fm-pending)]",
                  breakdownMode === "expense"
                    ? "bg-[rgba(248,113,113,0.18)] text-[var(--fm-expense)] shadow-sm"
                    : "text-[var(--fm-text-muted)] hover:bg-white/[0.04] hover:text-[var(--fm-warm-paper)]",
                )}
              >
                Gastos
              </button>
              <button
                type="button"
                aria-pressed={breakdownMode === "income"}
                onClick={() => setBreakdownMode("income")}
                className={cn(
                  "cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 outline-none select-none",
                  "focus-visible:ring-2 focus-visible:ring-[var(--fm-pending)]",
                  breakdownMode === "income"
                    ? "bg-[rgba(74,222,128,0.18)] text-[var(--fm-income)] shadow-sm"
                    : "text-[var(--fm-text-muted)] hover:bg-white/[0.04] hover:text-[var(--fm-warm-paper)]",
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
            <div className="space-y-3 py-3 flex-1">
              <FinanceShimmer className="h-10 w-full rounded-xl" />
              <FinanceShimmer className="h-10 w-full rounded-xl" />
              <FinanceShimmer className="h-10 w-full rounded-xl" />
            </div>
          ) : chartItems.length === 0 ? (
            <div className="py-6 flex-1 flex items-center justify-center">
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
            <div className="pt-2 flex-1 flex flex-col min-h-0">
              <PersonalCategoryChart
                items={chartItems}
                mode={breakdownMode}
                className="flex-1"
              />
            </div>
          )}
        </FinanceCard>
      </section>
    </div>
  );
}
