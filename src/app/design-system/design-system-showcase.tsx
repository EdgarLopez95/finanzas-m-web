"use client";

import { useMemo, useState } from "react";
import { Calendar, Eye, LayoutPanelTop, PanelRightOpen } from "lucide-react";

import { AccountPocketCard } from "@/components/finance/account-pocket-card";
import { Amount } from "@/components/finance/amount";
import { CategoryBreakdownList } from "@/components/finance/category-breakdown-list";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceChip } from "@/components/finance/finance-chip";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { FinanceSidePanel } from "@/components/finance/finance-side-panel";
import { PersonalTransactionRow } from "@/components/finance/personal-transaction-row";
import { SettingRow } from "@/components/finance/setting-row";
import { AppShell } from "@/components/layout/app-shell";
import {
  buildExpenseCategoryBreakdown,
  buildPersonalMovementRows,
} from "@/features/dashboard/lib/personal-view-model";
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
              Dialogo
            </FinanceButton>
          </>
        }
        subtitle="Shell y componentes vivos para la nueva direccion visual de Personal"
        title="Design System"
        userEmail="lab@finanzasm.dev"
        userName="FM Lab"
      >
        <FinanceCard
          className="overflow-hidden border-white/8 bg-[linear-gradient(180deg,rgba(19,27,42,0.98),rgba(13,19,30,0.98))] shadow-[var(--fm-shadow-hero)]"
          variant="hero"
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--fm-text-soft)]">
                  Dinero propio
                </p>
                <FinanceChip className="normal-case tracking-normal" variant="pending">
                  Saldo real
                </FinanceChip>
              </div>
              <Amount showSign={false} size="display" value={2790000} />
              <div className="grid gap-4 border-t border-white/8 pt-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-[var(--fm-text-muted)]">Saldo bancario bruto</p>
                  <Amount className="text-[var(--fm-text-soft)]" showSign={false} size="md" value={3140000} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-[var(--fm-text-muted)]">No propio pendiente</p>
                  <Amount showSign size="md" value={350000} variant="expense" />
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[24px] border border-white/8 bg-[rgba(20,27,40,0.82)] p-4">
                <p className="text-sm text-[var(--fm-text-soft)]">Ingresos del mes</p>
                <Amount className="mt-3 text-[40px]" showSign={false} size="lg" value={4200000} variant="income" />
              </div>
              <div className="rounded-[24px] border border-white/8 bg-[rgba(20,27,40,0.82)] p-4">
                <p className="text-sm text-[var(--fm-text-soft)]">Gastos del mes</p>
                <Amount className="mt-3 text-[40px]" showSign={false} size="lg" value={2380000} variant="expense" />
              </div>
            </div>
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
            subtitle="Filas enriquecidas con icono, monto y metadata"
            title="Movimientos"
            variant="default"
          >
            <div className="space-y-3">
              {movementRows.map((row) => (
                <PersonalTransactionRow
                  key={row.id}
                  actionSlot={
                    <>
                      <FinanceButton size="sm" tone="text" type="button" variant="ghost">
                        Editar
                      </FinanceButton>
                      <FinanceButton size="sm" tone="destructive" type="button" variant="ghost">
                        Eliminar
                      </FinanceButton>
                    </>
                  }
                  row={row}
                  showGroup
                />
              ))}
            </div>
          </FinanceCard>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <FinanceCard
            className="border-white/8 bg-[rgba(18,25,39,0.96)]"
            subtitle="La card analitica aprobada para Personal"
            title="Gastos por categoria"
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
                description="Accion destructiva compacta"
                title="Cerrar sesion"
              />
            </div>
          </FinanceCard>
        </section>
      </AppShell>

      <FinanceSidePanel
        onClose={() => setPanelOpen(false)}
        open={panelOpen}
        subtitle="El panel lateral es el patron definido para crear y editar movimientos en web."
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
              <p>La logica real vive en los formularios; aqui solo mostramos el contenedor visual.</p>
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
        subtitle="Confirmaciones pequenas y directas para acciones sensibles."
        title="Demo de dialogo"
      >
        <div className="space-y-4">
          <div className="rounded-[24px] border border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.08)] px-4 py-4 text-sm text-[var(--fm-warm-paper)]">
            Este patron se reserva para confirmaciones como eliminar un movimiento.
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
