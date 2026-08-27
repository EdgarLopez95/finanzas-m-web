"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, HelpCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { HouseholdCategoryChart } from "@/features/household/components/household-category-chart";
import { HouseholdQuickClassifyDialog } from "@/features/household/components/household-quick-classify-dialog";
import { HouseholdAmount } from "@/features/household/components/ui/household-amount";
import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdCard } from "@/features/household/components/ui/household-card";
import { HouseholdChip } from "@/features/household/components/ui/household-chip";
import { HouseholdEmptyState } from "@/features/household/components/ui/household-empty-state";
import {
  buildHouseholdExpenseChartData,
  buildHouseholdIncomeCategoryChartData,
  calculateHouseholdFlowSummary,
} from "@/features/household/lib/household-dashboard-view-model";
import {
  expenseByHouseholdCategory,
  monthlyDifference,
  totalExpense,
  totalIncome,
  UNCLASSIFIED_HOUSEHOLD_CATEGORY_KEY,
} from "@/lib/mplus/derived";
import type {
  MplusHousehold,
  MplusHouseholdExpenseCategory,
  MplusHouseholdMember,
  MplusMemberCategoryLabel,
  MplusMovement,
  MplusPersonalCategory,
} from "@/lib/mplus/models";
import { cn } from "@/lib/utils";

type Props = {
  household: MplusHousehold;
  members: MplusHouseholdMember[];
  categories: MplusHouseholdExpenseCategory[];
  categoryLabels: MplusMemberCategoryLabel[];
  personalCategories?: MplusPersonalCategory[];
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
 *    - Ingresos: distribución jerárquica por integrante aportante y sus categorías personales.
 */
export function MplusHouseholdOverview({
  household,
  members,
  categories,
  categoryLabels,
  personalCategories = [],
  movements,
  periodLabel,
  currentUid,
}: Props) {
  const router = useRouter();

  /** Modo del gráfico: 'expense' (inicial) o 'income'. */
  const [breakdownMode, setBreakdownMode] = useState<"expense" | "income">("expense");
  const [isQuickClassifyOpen, setIsQuickClassifyOpen] = useState(false);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const ownCategoriesMap = useMemo(
    () => new Map(personalCategories.map((c) => [c.id, { name: c.name, iconKey: c.iconKey, color: c.color }])),
    [personalCategories],
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

  // Movimientos y cantidad de gastos sin clasificar
  const unclassifiedMovements = useMemo(
    () =>
      movements.filter(
        (m) =>
          m.type === "expense" &&
          m.lifecycleState === "active" &&
          (m.householdCategoryId === null || m.householdCategoryId === UNCLASSIFIED_HOUSEHOLD_CATEGORY_KEY),
      ),
    [movements],
  );

  const unclassifiedCount = unclassifiedMovements.length;

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
      buildHouseholdIncomeCategoryChartData({
        movements: movements.filter((m) => m.type === "income"),
        memberMap,
        currentUid,
        ownCategoriesMap,
        categoryLabels,
      }),
    [movements, memberMap, currentUid, ownCategoriesMap, categoryLabels],
  );

  return (
    <div className="flex flex-col gap-4 lg:gap-5 flex-1 min-h-0">
      {/* 1. Resumen superior de flujo del mes compartido: Composición asimétrica de 2 zonas */}
      <section className="shrink-0">
        <HouseholdCard
          className="overflow-hidden shadow-[var(--hh-shadow-hero)] py-4 sm:py-4.5"
          variant="hero"
        >
          <div className="space-y-3.5 sm:space-y-4">
            {/* Encabezado contextual discreto */}
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-[var(--font-display)] text-sm sm:text-base font-semibold tracking-[-0.02em] text-[var(--hh-text)]">
                Resumen de {periodLabel}
              </h2>
              <HouseholdChip
                className="min-h-0 px-2.5 py-0.5 text-[10px] sm:text-[11px]"
                variant="household"
              >
                {household.name || "Hogar compartido"}
              </HouseholdChip>
            </div>

            {/* Composición asimétrica en 2 zonas: Balance (izq 40-45%) | Ingresos y Gastos en 2 filas (der 55-60%) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center pt-0.5">
              {/* Zona Izquierda: Balance del mes (ancla protagonista) */}
              <div className="lg:col-span-5 flex flex-col justify-center gap-1 min-w-0">
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.1em] text-[var(--hh-text-muted)]">
                  Balance del mes
                </span>
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  {diffTotal === 0 ? (
                    <span className="font-[var(--font-display)] text-3xl sm:text-4xl lg:text-[38px] font-bold tracking-tight text-[var(--hh-text)]">
                      $ 0
                    </span>
                  ) : (
                    <HouseholdAmount
                      className="font-[var(--font-display)] text-3xl sm:text-4xl lg:text-[38px] font-bold tracking-tight"
                      showSign
                      size="display"
                      value={diffTotal}
                      variant={diffTotal > 0 ? "income" : "expense"}
                    />
                  )}
                  {flowSummary.isBalanced && (
                    <span className="rounded-full bg-[var(--hh-surface-elevated)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--hh-text-secondary)]">
                      En equilibrio
                    </span>
                  )}
                </div>

                {/* Insight contextual del Balance */}
                {!flowSummary.isEmpty && (
                  <div className="pt-1 flex items-center">
                    {diffTotal < 0 ? (
                      <div className="flex items-center gap-1.5 rounded-md border border-[var(--hh-destructive-border)]/20 bg-[var(--hh-destructive-border)]/10 px-2 py-0.5 text-[11px] sm:text-xs font-medium text-[var(--hh-destructive-content)]">
                        <ArrowDownLeft className="h-3 w-3 shrink-0 stroke-[2.2]" />
                        <span>Gastaron $ {Math.abs(diffTotal).toLocaleString("es-CO")} más de lo que ingresaron</span>
                      </div>
                    ) : diffTotal > 0 ? (
                      <div className="flex items-center gap-1.5 rounded-md border border-[var(--hh-primary-action)]/20 bg-[var(--hh-primary-action)]/10 px-2 py-0.5 text-[11px] sm:text-xs font-medium text-[var(--hh-primary-action)]">
                        <ArrowUpRight className="h-3 w-3 stroke-[2.2]" />
                        <span>Ingresaron $ {diffTotal.toLocaleString("es-CO")} más de lo que gastaron</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-md border border-[var(--hh-border-soft)] bg-[var(--hh-surface-elevated)] px-2 py-0.5 text-[11px] sm:text-xs font-medium text-[var(--hh-text-secondary)]">
                        <span>Los ingresos y gastos compartidos están en equilibrio este mes</span>
                      </div>
                    )}
                  </div>
                )}

                {flowSummary.isEmpty && (
                  <p className="text-[11px] text-[var(--hh-text-muted)] pt-0.5">
                    Aún no registran ingresos ni gastos en {periodLabel}
                  </p>
                )}
              </div>

              {/* Zona Derecha: Ingresos y Gastos apilados verticalmente en 2 filas horizontales largas */}
              <div className="lg:col-span-7 flex flex-col justify-center gap-3 sm:gap-3.5 lg:border-l lg:border-[var(--hh-border-soft)] lg:pl-8 pt-3 lg:pt-0 border-t lg:border-t-0 border-[var(--hh-border-soft)]">
                {/* Fila 1: Ingresos */}
                <div className="space-y-1.5 w-full">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--hh-primary-action)]/25 bg-[var(--hh-primary-action)]/10 text-[var(--hh-primary-action)]">
                        <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.2]" />
                      </div>
                      <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.1em] text-[var(--hh-text-muted)] truncate">
                        Ingresos compartidos
                      </span>
                    </div>
                    <HouseholdAmount
                      className="font-bold tracking-tight text-base sm:text-lg text-[var(--hh-primary-action)]"
                      showSign={false}
                      size="sm"
                      value={incomeTotal}
                      variant="income"
                    />
                  </div>
                  {/* Barra de escala proporcional horizontal larga */}
                  <div
                    role="img"
                    aria-label={`Ingresos compartidos en ${periodLabel}: $ ${incomeTotal.toLocaleString("es-CO")}`}
                    className="h-1.5 w-full rounded-full bg-[var(--hh-surface-elevated)] overflow-hidden"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--hh-primary-action)] motion-safe:transition-[width] motion-safe:duration-300"
                      style={{ width: `${flowSummary.incomeScalePercent}%` }}
                    />
                  </div>
                </div>

                {/* Fila 2: Gastos */}
                <div className="space-y-1.5 w-full">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--hh-destructive-border)]/25 bg-[var(--hh-destructive-border)]/10 text-[var(--hh-destructive-content)]">
                        <ArrowDownLeft className="h-3.5 w-3.5 stroke-[2.2]" />
                      </div>
                      <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.1em] text-[var(--hh-text-muted)] truncate">
                        Gastos compartidos
                      </span>
                    </div>
                    <HouseholdAmount
                      className="font-bold tracking-tight text-base sm:text-lg text-[var(--hh-destructive-content)]"
                      showSign={false}
                      size="sm"
                      value={expenseTotal}
                      variant="expense"
                    />
                  </div>
                  {/* Barra de escala proporcional horizontal larga */}
                  <div
                    role="img"
                    aria-label={`Gastos compartidos en ${periodLabel}: $ ${expenseTotal.toLocaleString("es-CO")}`}
                    className="h-1.5 w-full rounded-full bg-[var(--hh-surface-elevated)] overflow-hidden"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--hh-destructive-border)] motion-safe:transition-[width] motion-safe:duration-300"
                      style={{ width: `${flowSummary.expenseScalePercent}%` }}
                    />
                  </div>
                </div>
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
              : `Total ingresado en ${periodLabel}`
          }
          title={
            breakdownMode === "expense"
              ? "Gastos por categoría"
              : "Ingresos por categoría"
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
                tone="text"
                onClick={() => setIsQuickClassifyOpen(true)}
                className="shrink-0 text-xs font-semibold text-[var(--hh-primary-action)] hover:text-white hover:bg-[var(--hh-primary-action)]/15 py-1.5 h-auto px-3 rounded-lg transition-colors cursor-pointer"
              >
                Clasificar gastos
              </HouseholdButton>
            </div>
          )}

          {breakdownMode === "expense" ? (
            expenseChartItems.length === 0 ? (
              <div className="py-6 flex-1 flex items-center justify-center">
                <HouseholdEmptyState
                  title="Sin gastos compartidos este mes"
                  description={`Aún no registran gastos en ${periodLabel}.`}
                />
              </div>
            ) : (
              <div className="pt-2 flex-1 flex flex-col min-h-0">
                <HouseholdCategoryChart
                  expenseItems={expenseChartItems}
                  mode="expense"
                  periodLabel={periodLabel}
                  className="flex-1 flex flex-col min-h-0"
                  onSelectCategory={(categoryId, item) => {
                    if (categoryId === "unclassified" || item.isUnclassified) {
                      setIsQuickClassifyOpen(true);
                    } else if (categoryId === "other") {
                      router.push("/household/movements?type=expense");
                    } else {
                      router.push(`/household/movements?categoryId=${encodeURIComponent(categoryId)}&type=expense`);
                    }
                  }}
                />
              </div>
            )
          ) : incomeChartItems.length === 0 ? (
            <div className="py-6 flex-1 flex items-center justify-center">
              <HouseholdEmptyState
                title="Sin ingresos compartidos este mes"
                description={`Aún no registran ingresos compartidos en ${periodLabel}.`}
              />
            </div>
          ) : (
            <div className="pt-2 flex-1 flex flex-col min-h-0">
              <HouseholdCategoryChart
                incomeItems={incomeChartItems}
                mode="income"
                periodLabel={periodLabel}
                className="flex-1 flex flex-col min-h-0"
                onSelectIncomeCategory={(categoryId, memberId) =>
                  router.push(
                    `/household/movements?categoryId=${encodeURIComponent(categoryId)}&memberId=${encodeURIComponent(memberId)}&type=income`,
                  )
                }
              />
            </div>
          )}
        </HouseholdCard>
      </section>

      {/* Modal de Clasificación Rápida de Gastos Compartidos */}
      <HouseholdQuickClassifyDialog
        open={isQuickClassifyOpen}
        householdId={household.id}
        currentUid={currentUid}
        unclassifiedMovements={unclassifiedMovements}
        categories={categories}
        members={members}
        personalCategories={personalCategories}
        categoryLabels={categoryLabels}
        onClose={() => setIsQuickClassifyOpen(false)}
      />
    </div>
  );
}
