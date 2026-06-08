"use client";

import { Amount } from "@/components/finance/amount";
import { EmptyState } from "@/components/finance/empty-state";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceChip } from "@/components/finance/finance-chip";
import { TransactionTimelineItem } from "@/components/finance/transaction-timeline-item";
import { formatDateEs } from "@/lib/format/date";
import type { HouseholdCategory, HouseholdDebt, HouseholdEvent, HouseholdIncomeEntry } from "@/types/household";

type HouseholdOverviewProps = {
  name: string;
  memberCount: number;
  monthlyExpenseTotal: number;
  monthlyIncomeTotal: number;
  monthlyBalance: number;
  categories: HouseholdCategory[];
  debts: HouseholdDebt[];
  recentEvents: HouseholdEvent[];
  incomeEntries: HouseholdIncomeEntry[];
};

const buildEventTitle = (event: HouseholdEvent, categoryName?: string): string => {
  if (event.title.trim().length > 0) {
    return event.title;
  }

  return categoryName ? `Gasto · ${categoryName}` : "Gasto del hogar";
};

export function HouseholdOverview({
  name,
  memberCount,
  monthlyExpenseTotal,
  monthlyIncomeTotal,
  monthlyBalance,
  categories,
  debts,
  recentEvents,
  incomeEntries,
}: HouseholdOverviewProps) {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <div className="space-y-4">
      <section className="grid gap-4 lg:grid-cols-3">
        <FinanceCard title={name} subtitle={`Miembros: ${memberCount || 0}`} variant="hero">
          <div className="flex flex-wrap gap-2">
            <FinanceChip variant="household">Hogar</FinanceChip>
            <FinanceChip variant="neutral">Solo lectura</FinanceChip>
          </div>
        </FinanceCard>

        <FinanceCard title="Gastos del mes" subtitle="Eventos activos del hogar" variant="elevated">
          <Amount value={monthlyExpenseTotal} variant="expense" size="lg" />
        </FinanceCard>

        <FinanceCard title="Balance del mes" subtitle="Entró al Hogar menos gastos del mes" variant="elevated">
          <Amount
            value={monthlyBalance}
            variant={monthlyBalance >= 0 ? "income" : "expense"}
            size="lg"
          />
        </FinanceCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <FinanceCard title="Entró al Hogar" subtitle={`Registros compartidos: ${incomeEntries.length}`} variant="default">
          {incomeEntries.length ? (
            <div className="space-y-3">
              <Amount value={monthlyIncomeTotal} variant="income" size="md" />
              <div className="space-y-2">
                {incomeEntries.slice(0, 5).map((entry) => (
                  <article
                    key={entry.id}
                    className="flex items-center justify-between rounded-[var(--fm-radius-card-medium)] border border-[var(--fm-border-dark)] px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--fm-warm-paper)]">{entry.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.createdAt ? formatDateEs(entry.createdAt) : "Sin fecha"}
                      </p>
                    </div>
                    <Amount value={entry.amount} variant="income" size="sm" />
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="Sin ingresos compartidos" description="Todavia no hay entradas de ingreso para este hogar." />
          )}
        </FinanceCard>

        <FinanceCard title="Pendientes" subtitle={`Registros: ${debts.length}`} variant="default">
          {debts.length ? (
            <div className="space-y-2">
              {debts.slice(0, 6).map((debt) => (
                <article
                  key={debt.id}
                  className="flex items-center justify-between rounded-[var(--fm-radius-card-medium)] border border-[var(--fm-border-dark)] px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--fm-warm-paper)]">{debt.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {debt.createdAt ? formatDateEs(debt.createdAt) : "Sin fecha"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <FinanceChip variant="pending">{debt.status || "Pendiente"}</FinanceChip>
                    <Amount value={debt.amount} variant="pending" size="sm" />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin pendientes" description="No hay deudas o pendientes visibles para este hogar." />
          )}
        </FinanceCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <FinanceCard title="Eventos recientes" subtitle={`Total: ${recentEvents.length}`} variant="elevated">
          {recentEvents.length ? (
            <div className="space-y-3">
              {recentEvents.map((event) => {
                const categoryName = categoryNames.get(event.categoryId);

                return (
                  <TransactionTimelineItem
                    key={event.id}
                    title={buildEventTitle(event, categoryName)}
                    subtitle={event.notes || categoryName || "Evento del hogar"}
                    amount={event.amount}
                    type="expense"
                    dateLabel={event.createdAt ? formatDateEs(event.createdAt) : "Sin fecha"}
                    metadata={categoryName || "Sin categoria"}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState title="Sin eventos recientes" description="Todavia no hay eventos visibles para este hogar." />
          )}
        </FinanceCard>

        <FinanceCard title="Categorias del Hogar" subtitle={`Total: ${categories.length}`} variant="default">
          {categories.length ? (
            <div className="flex flex-wrap gap-2">
              {categories.slice(0, 16).map((category) => (
                <FinanceChip key={category.id} variant="household">
                  {category.name}
                </FinanceChip>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin categorias del hogar" description="Todavia no hay categorias visibles para este hogar." />
          )}
        </FinanceCard>
      </section>
    </div>
  );
}
