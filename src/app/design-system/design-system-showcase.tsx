"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Calendar, Eye, LayoutPanelTop, PanelRightOpen } from "lucide-react";

import { AccountPocketCard } from "@/components/finance/account-pocket-card";
import { Amount } from "@/components/finance/amount";
import { CategoryBreakdownList } from "@/components/finance/category-breakdown-list";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceChip } from "@/components/finance/finance-chip";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { FinanceSidePanel } from "@/components/finance/finance-side-panel";
import { PersonalTransactionRow, PersonalRecentMovementRow } from "@/components/finance/personal-transaction-row";
import { FinanceDropdown } from "@/components/finance/finance-dropdown";
import { SettingRow } from "@/components/finance/setting-row";
import { AppShell } from "@/components/layout/app-shell";
import {
  buildExpenseCategoryBreakdown,
  buildPersonalMovementRows,
} from "@/features/dashboard/lib/personal-view-model";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";
import type { Pocket } from "@/types/pocket";
import type { Transaction } from "@/types/transaction";

const accounts: Account[] = [
  {
    id: "acc-bancolombia",
    ownerId: "design-system",
    name: "Bancolombia",
    balance: 2450000,
    currency: "COP",
    institutionName: "Bancolombia",
    type: "bank",
    updatedAt: new Date("2026-06-08T08:00:00"),
  },
  {
    id: "acc-nequi",
    ownerId: "design-system",
    name: "Nequi",
    balance: 480000,
    currency: "COP",
    institutionName: "Nequi",
    type: "wallet",
    updatedAt: new Date("2026-06-08T08:00:00"),
  },
];

const pockets: Pocket[] = [
  { id: "pocket-rent", accountId: "acc-bancolombia", name: "Arriendo", balance: 700000 },
  { id: "pocket-save", accountId: "acc-bancolombia", name: "Ahorro", balance: 300000 },
  { id: "pocket-market", accountId: "acc-nequi", name: "Mercado", balance: 180000 },
];

const categories: Category[] = [
  { id: "cat-income", ownerId: "design-system", name: "Trabajo freelance", icon: "briefcase", type: "income" },
  { id: "cat-food", ownerId: "design-system", name: "Comida y restaurantes", icon: "utensils", type: "expense" },
  { id: "cat-transport", ownerId: "design-system", name: "Transporte y moto", icon: "car", type: "expense" },
  { id: "cat-services", ownerId: "design-system", name: "Servicios y facturas", icon: "zap", type: "expense" },
  { id: "cat-market", ownerId: "design-system", name: "Mercado", icon: "basket", type: "expense" },
];

const transactions: Transaction[] = [
  {
    id: "tx-income",
    ownerId: "design-system",
    title: "Pago diseno",
    notes: "",
    amount: 850000,
    type: "income",
    accountId: "acc-nequi",
    targetAccountId: null,
    categoryId: "cat-income",
    countsAsRealIncome: true,
    createdAt: new Date("2026-06-08T10:15:00"),
    date: new Date("2026-06-08T10:15:00"),
  },
  {
    id: "tx-lunch",
    ownerId: "design-system",
    title: "Almuerzo",
    notes: "",
    amount: 28000,
    type: "expense",
    accountId: "acc-bancolombia",
    targetAccountId: null,
    categoryId: "cat-food",
    createdAt: new Date("2026-06-08T13:10:00"),
    date: new Date("2026-06-08T13:10:00"),
  },
  {
    id: "tx-gas",
    ownerId: "design-system",
    title: "Gasolina",
    notes: "",
    amount: 45000,
    type: "expense",
    accountId: "acc-nequi",
    targetAccountId: null,
    categoryId: "cat-transport",
    createdAt: new Date("2026-06-07T07:30:00"),
    date: new Date("2026-06-07T07:30:00"),
  },
  {
    id: "tx-transfer",
    ownerId: "design-system",
    title: "",
    notes: "",
    amount: 150000,
    type: "transfer",
    accountId: "acc-bancolombia",
    targetAccountId: "acc-nequi",
    categoryId: "",
    createdAt: new Date("2026-06-06T11:00:00"),
    date: new Date("2026-06-06T11:00:00"),
  },
];

const MonthlyMetricPanel = ({
  amount,
  icon: Icon,
  label,
  tone,
  progressValue,
}: {
  amount: number;
  icon: typeof ArrowUpRight;
  label: string;
  tone: "expense" | "income";
  progressValue: number;
}) => {
  const isIncome = tone === "income";
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border",
            isIncome
              ? "border-[rgba(74,222,128,0.15)] bg-[rgba(74,222,128,0.08)] text-[var(--fm-income)]"
              : "border-[rgba(248,113,113,0.15)] bg-[rgba(248,113,113,0.08)] text-[var(--fm-expense)]"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[var(--fm-text-muted)]">{label}</p>
            <span className="text-xs font-bold text-[var(--fm-text-muted)]">{progressValue}%</span>
          </div>
          <Amount
            className="mt-0.5 font-bold tracking-tight text-3xl leading-none"
            showSign={false}
            size="lg"
            value={amount}
            variant={tone}
          />
        </div>
      </div>
      <div className="h-2.5 w-full rounded-full bg-[rgba(37,48,71,0.6)]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isIncome ? "bg-[var(--fm-income)]" : "bg-[var(--fm-expense)]"
          )}
          style={{ width: `${progressValue}%` }}
        />
      </div>
    </div>
  );
};

export function DesignSystemShowcase() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const movementRows = useMemo(
    () => buildPersonalMovementRows(transactions, categories, accounts, new Date("2026-06-08T16:00:00")),
    [],
  );
  const categoryItems = useMemo(
    () => buildExpenseCategoryBreakdown(transactions, categories),
    [],
  );

  return (
    <>
      <AppShell
        actions={
          <>
            <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/8 bg-[rgba(18,25,39,0.92)] px-4 text-sm font-medium text-[var(--fm-warm-paper)]">
              <Calendar className="h-4 w-4 text-[var(--fm-pending)]" />
              Junio
            </div>
            <FinanceButton size="icon" tone="text" type="button" variant="ghost">
              <Eye className="h-4 w-4" />
            </FinanceButton>
            <FinanceButton onClick={() => setPanelOpen(true)} tone="text" type="button" variant="ghost">
              <PanelRightOpen className="h-4 w-4" />
              Panel
            </FinanceButton>
            <FinanceButton onClick={() => setDialogOpen(true)} tone="filled" type="button">
              <LayoutPanelTop className="h-4 w-4" />
              Diálogo
            </FinanceButton>
          </>
        }
        subtitle="Shell y componentes vivos para la nueva dirección visual de Personal"
        title="Design System"
        userEmail="lab@finanzasm.dev"
        userName="FM Lab"
      >
        <FinanceCard
          className="overflow-hidden border-white/8 bg-[linear-gradient(180deg,rgba(19,27,42,0.98),rgba(13,19,30,0.98))] shadow-[var(--fm-shadow-hero)]"
          variant="hero"
        >
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.38fr)_minmax(20rem,0.92fr)]">
            <div className="flex min-h-[220px] flex-col justify-between pr-0 lg:pr-8">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="font-[var(--font-display)] text-[1.45rem] font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
                    Dinero propio
                  </p>
                  <FinanceChip className="min-h-0 bg-[rgba(228,179,99,0.14)] px-3 py-1 text-[11px] text-[var(--fm-pending)] uppercase tracking-[0.12em]" variant="pending">
                    SALDO REAL
                  </FinanceChip>
                </div>
                <div className="pb-2">
                  <Amount showSign={false} size="display" value={2790000} />
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid gap-0 border-t border-white/8 pt-5 sm:grid-cols-2">
                  <div className="space-y-1 pr-0 sm:pr-5">
                    <p className="text-sm text-[var(--fm-text-muted)]">Saldo bancario bruto</p>
                    <Amount className="text-[var(--fm-text-soft)]" showSign={false} size="md" value={3140000} />
                  </div>
                  <div className="space-y-1 pt-4 sm:border-l sm:border-white/8 sm:pl-5 sm:pt-0">
                    <p className="text-sm text-[var(--fm-text-muted)]">No propio pendiente</p>
                    <Amount showSign size="md" value={350000} variant="expense" />
                  </div>
                </div>

                <div className="flex items-start gap-2 text-[13px] leading-[1.45] text-[var(--fm-text-muted)]">
                  <span className="mt-[0.42rem] h-1.5 w-1.5 flex-none rounded-full bg-[var(--fm-pending)]" />
                  <p className="lg:whitespace-nowrap">
                    Es lo que realmente es tuyo: saldo en cuentas menos lo que debes devolver.
                  </p>
                </div>
              </div>
            </div>

            {(() => {
              const ingresos: number = 4200000;
              const gastos: number = 2380000;
              let incomeProgress = 100;
              let expenseProgress = 0;

              if (ingresos === 0 && gastos === 0) {
                incomeProgress = 0;
                expenseProgress = 0;
              } else if (ingresos >= gastos) {
                incomeProgress = 100;
                expenseProgress = ingresos > 0 ? Math.round((gastos / ingresos) * 100) : 0;
              } else {
                expenseProgress = 100;
                incomeProgress = gastos > 0 ? Math.round((ingresos / gastos) * 100) : 0;
              }

              return (
                <div className="mt-5 border-t border-white/8 pt-5 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0 flex flex-col justify-between min-h-[220px] h-full">
                  {/* Ingresos del mes */}
                  <div className="flex-1 flex flex-col justify-center py-2">
                    <MonthlyMetricPanel
                      amount={ingresos}
                      icon={ArrowUpRight}
                      label="Ingresos del mes"
                      tone="income"
                      progressValue={incomeProgress}
                    />
                  </div>

                  <div className="border-t border-white/8" />

                  {/* Gastos del mes */}
                  <div className="flex-1 flex flex-col justify-center py-2">
                    <MonthlyMetricPanel
                      amount={gastos}
                      icon={ArrowDownLeft}
                      label="Gastos del mes"
                      tone="expense"
                      progressValue={expenseProgress}
                    />
                  </div>

                  {/* Mathematical result separator & result */}
                  <div className="border-t border-white/8 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--fm-text-muted)]">Quedo libre</span>
                      <Amount
                        showSign
                        size="sm"
                        value={ingresos - gastos}
                        variant={ingresos - gastos >= 0 ? "income" : "expense"}
                        className="text-base font-bold"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </FinanceCard>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <FinanceCard
            className="border-white/8 bg-[rgba(18,25,39,0.96)]"
            subtitle="Cuenta padre con bolsillos visibles"
            title="Cuentas y bolsillos"
            variant="default"
          >
            <div className="space-y-3">
              {accounts.map((account) => (
                <AccountPocketCard
                  key={account.id}
                  account={account}
                  expanded
                  pockets={pockets.filter((pocket) => pocket.accountId === account.id)}
                />
              ))}
            </div>
          </FinanceCard>

          <FinanceCard
            className="border-white/8 bg-[rgba(18,25,39,0.96)]"
            subtitle="Filas completas (con menu 3 puntos) y compactas (dashboard)"
            title="Movimientos"
            variant="default"
          >
            <div className="space-y-6">
              <div>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--fm-text-muted)]">Historial completo</h4>
                <div className="divide-y divide-white/8">
                  {movementRows.map((row) => (
                    <div key={row.id} className="py-2.5 first:pt-0 last:pb-0">
                      <PersonalTransactionRow
                        actionSlot={
                          <FinanceDropdown
                            items={[
                              { label: "Editar", onClick: () => alert("Editar clicado") },
                              { label: "Eliminar", onClick: () => alert("Eliminar clicado"), variant: "destructive" },
                            ]}
                          />
                        }
                        row={row}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/8 pt-6">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--fm-text-muted)]">Dashboard compactos</h4>
                <div className="divide-y divide-white/8">
                  {movementRows.map((row) => (
                    <div key={row.id} className="py-3 first:pt-0 last:pb-0">
                      <PersonalRecentMovementRow
                        row={row}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FinanceCard>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <FinanceCard
            className="border-white/8 bg-[rgba(18,25,39,0.96)]"
            subtitle="La card analítica aprobada para Personal"
            title="Gastos por categoría"
            variant="default"
          >
            <CategoryBreakdownList items={categoryItems} />
          </FinanceCard>

          <FinanceCard
            className="border-white/8 bg-[rgba(18,25,39,0.96)]"
            subtitle="Filas base para ajustes y preferencias"
            title="Settings Rows"
            variant="default"
          >
            <div className="space-y-1">
              <SettingRow
                action={<FinanceChip className="normal-case tracking-normal" variant="neutral">COP $</FinanceChip>}
                description="Peso colombiano (COP)"
                title="Moneda"
              />
              <SettingRow
                action={<FinanceChip className="normal-case tracking-normal" variant="pending">Activo</FinanceChip>}
                description="Empieza con montos protegidos"
                title="Ocultar saldos al abrir"
              />
              <SettingRow
                action={
                  <FinanceButton tone="destructive" type="button" variant="ghost">
                    Salir
                  </FinanceButton>
                }
                description="Acción destructiva compacta"
                title="Cerrar sesión"
              />
            </div>
          </FinanceCard>
        </section>
      </AppShell>

      <FinanceSidePanel
        onClose={() => setPanelOpen(false)}
        open={panelOpen}
        subtitle="El panel lateral es el patrón definido para crear y editar movimientos en web."
        title="Demo de panel"
      >
        <div className="space-y-4">
          <FinanceCard
            className="border-white/8 bg-[rgba(18,25,39,0.96)]"
            subtitle="Contenido de referencia dentro del panel"
            title="Composicion"
            variant="default"
          >
            <div className="space-y-3 text-sm text-[var(--fm-text-soft)]">
              <p>Se usa para crear gasto, ingreso, transferencia y editar movimientos.</p>
              <p>La lógica real vive en los formularios; aquí solo mostramos el contenedor visual.</p>
            </div>
          </FinanceCard>
          <FinanceButton onClick={() => setPanelOpen(false)} tone="filled" type="button">
            Cerrar panel
          </FinanceButton>
        </div>
      </FinanceSidePanel>

      <FinanceDialog
        onClose={() => setDialogOpen(false)}
        open={dialogOpen}
        subtitle="Confirmaciones pequeñas y directas para acciones sensibles."
        title="Demo de diálogo"
      >
        <div className="space-y-4">
          <div className="rounded-[24px] border border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.08)] px-4 py-4 text-sm text-[var(--fm-warm-paper)]">
            Este patrón se reserva para confirmaciones como eliminar un movimiento.
          </div>
          <div className="flex flex-wrap gap-2">
            <FinanceButton onClick={() => setDialogOpen(false)} tone="filled" type="button">
              Entendido
            </FinanceButton>
            <FinanceButton onClick={() => setDialogOpen(false)} tone="text" type="button" variant="ghost">
              Cancelar
            </FinanceButton>
          </div>
        </div>
      </FinanceDialog>
    </>
  );
}
