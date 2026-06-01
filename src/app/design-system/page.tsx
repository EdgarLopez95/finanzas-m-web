import { Amount } from "@/components/finance/amount";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceChip } from "@/components/finance/finance-chip";
import { EmptyState } from "@/components/finance/empty-state";
import { FinanceShimmer } from "@/components/finance/finance-shimmer";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { TransactionTimelineItem } from "@/components/finance/transaction-timeline-item";
import { financeColors, financeRadius, financeSpacing, financeTypography } from "@/lib/design/tokens";

const colorGroups = [
  ["Interfaz", financeColors.interface],
  ["Financieros", financeColors.financial],
  ["Entidades", financeColors.entity],
] as const;

export default function DesignSystemPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Ruta temporal de desarrollo</p>
        <h1 className="text-[32px] font-semibold">Finanzas M Web - Design System</h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-[22px] font-semibold">Paleta</h2>
        {colorGroups.map(([label, group]) => (
          <div key={label} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(group).map(([name, color]) => (
                <article key={name} className="rounded-[var(--fm-radius-card-medium)] border border-[var(--fm-border-dark)] p-3">
                  <div className="h-12 rounded-xl border border-[var(--fm-border-dark)]" style={{ backgroundColor: color }} />
                  <p className="mt-2 text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">{color}</p>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <FinanceCard title="Default card" subtitle="Base para informacion modular" variant="default">
          <p className="text-sm text-muted-foreground">Card de superficie base para dashboard y formularios.</p>
        </FinanceCard>
        <FinanceCard title="Elevated card" subtitle="Mayor jerarquia visual" variant="elevated">
          <p className="text-sm text-muted-foreground">Ideal para bloques que necesitan separacion fuerte.</p>
        </FinanceCard>
        <FinanceCard title="Hero card" subtitle="Tarjeta destacada" variant="hero">
          <Amount value={7350000} size="hero" />
        </FinanceCard>
        <FinanceCard title="Interactive card" subtitle="Con hover de interaccion" variant="interactive">
          <p className="text-sm text-muted-foreground">Usar para tarjetas clicables en listados/resumenes.</p>
        </FinanceCard>
      </section>

      <section className="space-y-3">
        <h2 className="text-[22px] font-semibold">Botones y chips</h2>
        <div className="flex flex-wrap gap-3">
          <FinanceButton tone="filled">Filled</FinanceButton>
          <FinanceButton tone="outlined" variant="outline">Outlined</FinanceButton>
          <FinanceButton tone="text" variant="ghost">Text</FinanceButton>
          <FinanceButton tone="destructive" variant="destructive">Destructive</FinanceButton>
        </div>
        <div className="flex flex-wrap gap-2">
          <FinanceChip variant="neutral">neutral</FinanceChip>
          <FinanceChip variant="income">income</FinanceChip>
          <FinanceChip variant="expense">expense</FinanceChip>
          <FinanceChip variant="transfer">transfer</FinanceChip>
          <FinanceChip variant="pending">pending</FinanceChip>
          <FinanceChip variant="household">household</FinanceChip>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <FinanceTextField label="Concepto" placeholder="Ej. Mercado" helperText="Se mostrara en timeline." />
        <FinanceTextField label="Monto" placeholder="$ 0" errorText="El monto es obligatorio." />
      </section>

      <section className="space-y-3">
        <h2 className="text-[22px] font-semibold">Amounts</h2>
        <div className="flex flex-wrap items-end gap-4">
          <Amount value={1280000} variant="default" size="lg" />
          <Amount value={350000} variant="income" />
          <Amount value={120000} variant="expense" />
          <Amount value={450000} variant="transfer" />
          <Amount value={98000} variant="pending" />
          <Amount value={99000} variant="neutral" />
          <Amount value={450000} variant="transfer" showSign={false} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[22px] font-semibold">Transaction timeline</h2>
        <div className="space-y-3">
          <TransactionTimelineItem title="Pago nomina" subtitle="Cuenta principal" amount={2200000} type="income" dateLabel="Hoy" metadata="Banco" />
          <TransactionTimelineItem title="Mercado" subtitle="Tarjeta debito" amount={182000} type="expense" dateLabel="Ayer" metadata="Hogar" />
          <TransactionTimelineItem title="Movimiento entre cuentas" amount={400000} type="transfer" dateLabel="30 May" />
          <TransactionTimelineItem title="Reintegro de deuda" subtitle="Compensacion entre miembros" amount={185000} type="reimbursement" dateLabel="29 May" metadata="Reembolso" />
          <TransactionTimelineItem title="Pendiente de confirmar" amount={95000} type="pending" dateLabel="29 May" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[22px] font-semibold">Empty state</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <EmptyState title="Sin cuentas" description="Conecta o crea una cuenta para iniciar tu tablero personal." />
          <EmptyState title="Sin movimientos" description="Aun no hay transacciones registradas para este periodo." />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[22px] font-semibold">Shimmer</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <FinanceShimmer className="h-24" />
          <FinanceShimmer className="h-24" />
          <FinanceShimmer className="h-24" />
        </div>
      </section>

      <section className="rounded-[var(--fm-radius-card-medium)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark)] p-4">
        <h2 className="text-[22px] font-semibold">Tokens de referencia</h2>
        <pre className="mt-2 overflow-auto text-xs text-muted-foreground">{JSON.stringify({ financeSpacing, financeRadius, financeTypography }, null, 2)}</pre>
      </section>
    </main>
  );
}
