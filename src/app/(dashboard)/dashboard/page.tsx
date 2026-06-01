import { Amount } from "@/components/finance/amount";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { TransactionTimelineItem } from "@/components/finance/transaction-timeline-item";
import { AppShell } from "@/components/layout/app-shell";

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <section className="grid gap-4 lg:grid-cols-2">
        <FinanceCard title="Balance total" subtitle="Placeholder visual WEB-T" variant="hero">
          <Amount value={5234000} size="hero" />
        </FinanceCard>
        <FinanceCard title="Movimientos recientes" subtitle="Sin datos reales" variant="elevated">
          <div className="space-y-3">
            <TransactionTimelineItem title="Nomina" subtitle="Cuenta principal" amount={2200000} type="income" dateLabel="Hoy" />
            <TransactionTimelineItem title="Arriendo" subtitle="Cuenta hogar" amount={1200000} type="expense" dateLabel="Ayer" />
          </div>
        </FinanceCard>
      </section>
      <FinanceCard title="Acciones" subtitle="Demo de componentes" variant="interactive">
        <div className="flex flex-wrap gap-3">
          <FinanceButton tone="filled">Nuevo gasto</FinanceButton>
          <FinanceButton tone="outlined" variant="outline">
            Nuevo ingreso
          </FinanceButton>
        </div>
      </FinanceCard>
    </AppShell>
  );
}