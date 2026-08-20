"use client";

import { useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  HelpCircle,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { HouseholdAmount } from "@/features/household/components/ui/household-amount";
import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdCard } from "@/features/household/components/ui/household-card";
import { HouseholdChip } from "@/features/household/components/ui/household-chip";
import { HouseholdEmptyState } from "@/features/household/components/ui/household-empty-state";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { DEFAULT_HOUSEHOLD_CATEGORY_COLOR } from "@/lib/categories/household-category-colors";
import { formatDateEs } from "@/lib/format/date";
import {
  expenseByHouseholdCategory,
  incomeByOwnerAndCategory,
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
} from "@/lib/mplus/models";
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

export function MplusHouseholdOverview({
  household,
  members,
  categories,
  categoryLabels,
  movements,
  periodLabel,
  currentUid,
}: Props) {
  const router = useRouter();
  const masked = useUiPreferencesStore((state) => state.balancesHidden);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.userId, m])),
    [members],
  );

  const categoryLabelMap = useMemo(
    () => new Map(categoryLabels.map((l) => [l.id, l])),
    [categoryLabels],
  );

  // Cálculos puros derivados del contrato (§25)
  const incomeTotal = totalIncome(movements);
  const expenseTotal = totalExpense(movements);
  const diffTotal = monthlyDifference(movements);

  const expenseBreakdown = useMemo(() => {
    const raw = expenseByHouseholdCategory(movements);
    const items: Array<{
      key: string;
      name: string;
      iconKey: string;
      color: string;
      amount: number;
      percentage: number;
      isUnclassified: boolean;
    }> = [];

    const total = expenseTotal > 0 ? expenseTotal : 1;

    for (const [key, amount] of Object.entries(raw)) {
      if (key === UNCLASSIFIED_HOUSEHOLD_CATEGORY_KEY) {
        items.push({
          key,
          name: "Por clasificar",
          iconKey: "other",
          color: "#94A3B8",
          amount,
          percentage: Math.round((amount / total) * 100),
          isUnclassified: true,
        });
      } else {
        const cat = categoryMap.get(key);
        items.push({
          key,
          name: cat?.name ?? "Categoría",
          iconKey: cat?.iconKey ?? "other",
          color: cat?.color ?? DEFAULT_HOUSEHOLD_CATEGORY_COLOR,
          amount,
          percentage: Math.round((amount / total) * 100),
          isUnclassified: false,
        });
      }
    }

    return items.sort((a, b) => b.amount - a.amount);
  }, [movements, expenseTotal, categoryMap]);

  const unclassifiedCount = useMemo(
    () =>
      movements.filter(
        (m) => m.type === "expense" && m.householdCategoryId === null,
      ).length,
    [movements],
  );

  const incomeBreakdown = useMemo(() => {
    const raw = incomeByOwnerAndCategory(movements);
    const items: Array<{
      ownerId: string;
      categoryId: string;
      memberName: string;
      categoryName: string;
      iconKey: string;
      color: string;
      amount: number;
    }> = [];

    for (const [key, amount] of Object.entries(raw)) {
      const [ownerId, categoryId] = key.split("__");
      const member = memberMap.get(ownerId);
      const label = categoryLabelMap.get(key);

      items.push({
        ownerId,
        categoryId,
        memberName: member?.displayName ?? (ownerId === currentUid ? "Tú" : "Pareja"),
        categoryName: label?.name ?? "Ingreso",
        iconKey: label?.iconKey ?? "salary",
        color: label?.color ?? "#22C55E",
        amount,
      });
    }

    return items.sort((a, b) => b.amount - a.amount);
  }, [movements, memberMap, categoryLabelMap, currentUid]);

  const recentMovements = movements.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Banner / Alerta si hay gastos por clasificar */}
      {unclassifiedCount > 0 && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-[24px] border border-[var(--hh-border)] bg-[var(--hh-surface-elevated)] px-5 py-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--hh-sage-accent)]/15 text-[var(--hh-primary-action)]">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--hh-text)]">
                {unclassifiedCount === 1
                  ? "1 gasto pendiente por clasificar"
                  : `${unclassifiedCount} gastos pendientes por clasificar`}
              </p>
              <p className="text-xs text-[var(--hh-text-secondary)]">
                Ayuda a clasificar en qué se gastó para mantener estadísticas compartidas exactas.
              </p>
            </div>
          </div>
          <HouseholdButton
            size="sm"
            tone="filled"
            onClick={() => router.push("/household/movements")}
          >
            Ver gastos
          </HouseholdButton>
        </div>
      )}

      {/* Hero Mensual de Hogar */}
      <section className="rounded-[var(--hh-radius-card-large)] border border-[var(--hh-border)] bg-[linear-gradient(180deg,var(--hh-surface-elevated),var(--hh-surface))] p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hh-border-soft)] pb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--hh-text-muted)]">
              Resumen mensual
            </p>
            <h2 className="mt-1 font-[var(--font-display)] text-xl font-bold tracking-tight text-[var(--hh-text)]">
              {household.name || "Hogar compartido"} · {periodLabel}
            </h2>
          </div>
          <HouseholdChip variant="household">
            {movements.length} {movements.length === 1 ? "movimiento compartido" : "movimientos compartidos"}
          </HouseholdChip>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {/* Ingresos compartidos */}
          <div className="flex flex-col gap-2 rounded-2xl border border-[var(--hh-border-soft)] bg-[var(--hh-surface-subtle)] p-5">
            <div className="flex items-center gap-2 text-[var(--hh-primary-action)]">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--hh-primary-action)]/12">
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--hh-text-secondary)]">
                Ingresos del mes
              </span>
            </div>
            <HouseholdAmount
              className="font-[var(--font-display)] font-bold text-2xl text-[var(--hh-text)]"
              masked={masked}
              value={incomeTotal}
              variant="income"
            />
          </div>

          {/* Gastos compartidos */}
          <div className="flex flex-col gap-2 rounded-2xl border border-[var(--hh-border-soft)] bg-[var(--hh-surface-subtle)] p-5">
            <div className="flex items-center gap-2 text-[var(--hh-destructive-content)]">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--hh-destructive-border)]/12">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--hh-text-secondary)]">
                Gastos del mes
              </span>
            </div>
            <HouseholdAmount
              className="font-[var(--font-display)] font-bold text-2xl text-[var(--hh-text)]"
              masked={masked}
              value={expenseTotal}
              variant="expense"
            />
          </div>

          {/* Diferencia mensual */}
          <div className="flex flex-col gap-2 rounded-2xl border border-[var(--hh-border-soft)] bg-[var(--hh-surface-subtle)] p-5">
            <div className="flex items-center gap-2 text-[var(--hh-text-secondary)]">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5">
                <TrendingUp className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--hh-text-secondary)]">
                Diferencia del mes
              </span>
            </div>
            <HouseholdAmount
              className="font-[var(--font-display)] font-bold text-2xl text-[var(--hh-text)]"
              masked={masked}
              value={diffTotal}
              variant={diffTotal >= 0 ? "income" : "expense"}
            />
          </div>
        </div>
      </section>

      {/* Grid: Gastos por Categoría + Ingresos por Integrante */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Desglose de Gastos por Categoría */}
        <HouseholdCard className="flex flex-col">
          <div className="mb-4 flex items-center justify-between border-b border-[var(--hh-border-soft)] pb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--hh-text-muted)]">
                Distribución
              </p>
              <h3 className="font-[var(--font-display)] text-lg font-bold text-[var(--hh-text)]">
                Gastos por categoría
              </h3>
            </div>
            <HouseholdButton
              size="sm"
              variant="ghost"
              onClick={() => router.push("/household/categories")}
            >
              Gestionar
            </HouseholdButton>
          </div>

          {expenseBreakdown.length === 0 ? (
            <div className="py-8">
              <HouseholdEmptyState
                title="Sin gastos este mes"
                description="No hay gastos compartidos registrados para este período."
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--hh-border-soft)]">
              {expenseBreakdown.map((item) => {
                const Icon = resolveCategoryIcon(item.iconKey, "expense");
                return (
                  <div
                    key={item.key}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor: `${item.color}22`,
                            color: item.color,
                          }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="truncate text-sm font-medium text-[var(--hh-text)]">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-[var(--hh-text-muted)]">
                          {item.percentage}%
                        </span>
                        <HouseholdAmount
                          className="text-sm font-semibold"
                          masked={masked}
                          value={item.amount}
                          variant="expense"
                        />
                      </div>
                    </div>
                    {/* Barra de progreso */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--hh-border-soft)]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </HouseholdCard>

        {/* Desglose de Ingresos por Integrante */}
        <HouseholdCard className="flex flex-col">
          <div className="mb-4 flex items-center justify-between border-b border-[var(--hh-border-soft)] pb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--hh-text-muted)]">
                Aportes
              </p>
              <h3 className="font-[var(--font-display)] text-lg font-bold text-[var(--hh-text)]">
                Ingresos compartidos
              </h3>
            </div>
          </div>

          {incomeBreakdown.length === 0 ? (
            <div className="py-8">
              <HouseholdEmptyState
                title="Sin ingresos este mes"
                description="No hay ingresos compartidos registrados para este período."
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--hh-border-soft)]">
              {incomeBreakdown.map((item, idx) => {
                const Icon = resolveCategoryIcon(item.iconKey, "income");
                return (
                  <div
                    key={`${item.ownerId}__${item.categoryId}__${idx}`}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          backgroundColor: `${item.color}22`,
                          color: item.color,
                        }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--hh-text)]">
                          {item.categoryName}
                        </p>
                        <p className="text-xs text-[var(--hh-text-muted)]">
                          Por {item.memberName}
                        </p>
                      </div>
                    </div>
                    <HouseholdAmount
                      className="text-sm font-semibold"
                      masked={masked}
                      value={item.amount}
                      variant="income"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </HouseholdCard>
      </div>

      {/* Movimientos Recientes Compartidos */}
      <HouseholdCard>
        <div className="mb-4 flex items-center justify-between border-b border-[var(--hh-border-soft)] pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--hh-text-muted)]">
              Historial
            </p>
            <h3 className="font-[var(--font-display)] text-lg font-bold text-[var(--hh-text)]">
              Movimientos recientes
            </h3>
          </div>
          <HouseholdButton
            size="sm"
            variant="ghost"
            onClick={() => router.push("/household/movements")}
          >
            Ver todos
            <ChevronRight className="ml-1 h-4 w-4" />
          </HouseholdButton>
        </div>

        {recentMovements.length === 0 ? (
          <div className="py-6">
            <HouseholdEmptyState
              title="Sin movimientos"
              description="Los movimientos marcados con «Contar en Hogar» aparecerán aquí."
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--hh-border-soft)]">
            {recentMovements.map((movement) => {
              const member = memberMap.get(movement.ownerId);
              const isOwner = movement.ownerId === currentUid;
              const cat = movement.householdCategoryId
                ? categoryMap.get(movement.householdCategoryId)
                : null;
              const label = categoryLabelMap.get(
                `${movement.ownerId}__${movement.categoryId}`,
              );

              const categoryName =
                movement.type === "expense"
                  ? cat?.name ?? "Por clasificar"
                  : label?.name ?? "Ingreso";

              const iconKey =
                movement.type === "expense"
                  ? cat?.iconKey ?? "other"
                  : label?.iconKey ?? "salary";

              const color =
                movement.type === "expense"
                  ? cat?.color ?? "#94A3B8"
                  : label?.color ?? "#22C55E";

              const Icon = resolveCategoryIcon(iconKey, movement.type);

              return (
                <div
                  key={movement.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${color}22`,
                        color,
                      }}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--hh-text)]">
                        {movement.title}
                      </p>
                      <p className="text-xs text-[var(--hh-text-muted)]">
                        {categoryName} · {formatDateEs(new Date(movement.occurredAtMillis))} · {isOwner ? "Tú" : member?.displayName ?? "Pareja"}
                      </p>
                    </div>
                  </div>
                  <HouseholdAmount
                    className="text-sm font-bold shrink-0"
                    masked={masked}
                    value={movement.amount}
                    variant={movement.type}
                  />
                </div>
              );
            })}
          </div>
        )}
      </HouseholdCard>
    </div>
  );
}
