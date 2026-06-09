"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { AccountPocketCard } from "@/components/finance/account-pocket-card";
import { Amount } from "@/components/finance/amount";
import { CategoryBreakdownList } from "@/components/finance/category-breakdown-list";
import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceChip } from "@/components/finance/finance-chip";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { PersonalTransactionRow } from "@/components/finance/personal-transaction-row";
import { SettingRow } from "@/components/finance/setting-row";
import { buildExpenseCategoryBreakdown, buildPersonalMovementRows } from "@/features/dashboard/lib/personal-view-model";
import { isSameMonthAndYear } from "@/lib/format/date";
import type { PersonalDashboardData } from "@/features/dashboard/hooks/use-personal-dashboard-data";
import type { HouseholdDebt } from "@/types/household";
import type { Transaction } from "@/types/transaction";

type MovementActionHandlers = {
  onEditMovement: (transaction: Transaction) => void;
  onDeleteMovement: (transaction: Transaction) => void;
};

type HomeViewProps = MovementActionHandlers & {
  data: PersonalDashboardData;
  totalBalance: number;
  totalNoPropioPendiente: number;
  dineroPropio: number;
  masked: boolean;
  householdDebts: HouseholdDebt[];
  householdName?: string | null;
};

type AccountsViewProps = {
  data: PersonalDashboardData;
  masked: boolean;
};

type CategoriesViewProps = {
  data: PersonalDashboardData;
  masked: boolean;
};

type MovementsViewProps = MovementActionHandlers & {
  data: PersonalDashboardData;
  masked: boolean;
};

type SettingsViewProps = {
  userName?: string | null;
  userEmail?: string | null;
  masked: boolean;
  notificationsEnabled: boolean;
  onToggleMasked: () => void;
  onToggleNotifications: () => void;
  onLogout: () => Promise<void> | void;
};

const groupRowsByDateLabel = (rows: ReturnType<typeof buildPersonalMovementRows>) => {
  const groups: Array<{ label: string; rows: typeof rows }> = [];

  for (const row of rows) {
    const lastGroup = groups[groups.length - 1];

    if (!lastGroup || lastGroup.label !== row.groupLabel) {
      groups.push({
        label: row.groupLabel,
        rows: [row],
      });
      continue;
    }

    lastGroup.rows.push(row);
  }

  return groups;
};

const MovementActions = ({
  transaction,
  onDeleteMovement,
  onEditMovement,
}: MovementActionHandlers & { transaction: Transaction }) => (
  <>
    <FinanceButton
      onClick={() => onEditMovement(transaction)}
      size="sm"
      tone="text"
      type="button"
      variant="ghost"
    >
      Editar
    </FinanceButton>
    <FinanceButton
      onClick={() => onDeleteMovement(transaction)}
      size="sm"
      tone="destructive"
      type="button"
      variant="ghost"
    >
      Eliminar
    </FinanceButton>
  </>
);

const SectionLink = ({
  href,
  label = "Ver todo",
}: {
  href: string;
  label?: string;
}) => {
  const router = useRouter();

  return (
    <FinanceButton
      className="text-[var(--fm-text-soft)]"
      onClick={() => router.push(href)}
      size="sm"
      tone="text"
      type="button"
      variant="ghost"
    >
      {label}
      <ChevronRight className="h-4 w-4" />
    </FinanceButton>
  );
};

const Toggle = ({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) => (
  <button
    aria-label={label}
    aria-pressed={checked}
    className="relative inline-flex h-8 w-14 items-center rounded-full border border-white/8 bg-[rgba(28,37,55,0.94)] px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
    onClick={onToggle}
    type="button"
  >
    <span
      className="absolute inset-y-1 left-1 w-6 rounded-full bg-[var(--fm-warm-paper)] transition-transform"
      style={{
        transform: checked ? "translateX(1.45rem)" : "translateX(0)",
        background: checked ? "var(--fm-pending)" : "var(--fm-warm-paper)",
      }}
    />
  </button>
);

export function HomeView({
  data,
  totalBalance,
  totalNoPropioPendiente,
  dineroPropio,
  masked,
  householdDebts,
  householdName,
  onEditMovement,
  onDeleteMovement,
}: HomeViewProps) {
  const currentMonthTransactions = useMemo(
    () => data.transactions.filter((transaction) => isSameMonthAndYear(transaction.date ?? transaction.createdAt, new Date())),
    [data.transactions],
  );
  const categoryItems = useMemo(
    () => buildExpenseCategoryBreakdown(currentMonthTransactions, data.categories),
    [currentMonthTransactions, data.categories],
  );
  const rows = useMemo(
    () => buildPersonalMovementRows(data.transactions, data.categories, data.accounts),
    [data.accounts, data.categories, data.transactions],
  );
  const groupedRows = useMemo(() => groupRowsByDateLabel(rows.slice(0, 5)), [rows]);

  return (
    <>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.9fr)]">
        <FinanceCard
          className="overflow-hidden border-white/8 bg-[linear-gradient(180deg,rgba(19,27,42,0.98),rgba(13,19,30,0.98))] shadow-[var(--fm-shadow-hero)]"
          variant="hero"
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--fm-text-soft)]">
                  Dinero propio
                </p>
                <FinanceChip className="normal-case tracking-normal" variant="pending">
                  Saldo real
                </FinanceChip>
              </div>

              <Amount masked={masked} showSign={false} size="display" value={dineroPropio} />

              <div className="grid gap-4 border-t border-white/8 pt-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-[var(--fm-text-muted)]">Saldo bancario bruto</p>
                  <Amount className="text-[var(--fm-text-soft)]" masked={masked} showSign={false} size="md" value={totalBalance} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-[var(--fm-text-muted)]">No propio pendiente</p>
                  <Amount masked={masked} showSign size="md" value={totalNoPropioPendiente} variant="expense" />
                </div>
              </div>

              <p className="max-w-[52ch] text-sm text-[var(--fm-text-muted)]">
                Es lo que realmente es tuyo: saldo en cuentas menos lo que debes devolver.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[24px] border border-white/8 bg-[rgba(20,27,40,0.82)] p-4">
                <p className="text-sm text-[var(--fm-text-soft)]">Ingresos reales del mes</p>
                <Amount className="mt-3 text-[40px]" masked={masked} showSign={false} size="lg" value={data.ingresosRealesMes} variant="income" />
              </div>
              <div className="rounded-[24px] border border-white/8 bg-[rgba(20,27,40,0.82)] p-4">
                <p className="text-sm text-[var(--fm-text-soft)]">Gastos del mes</p>
                <Amount className="mt-3 text-[40px]" masked={masked} showSign={false} size="lg" value={data.gastosMes} variant="expense" />
              </div>
            </div>
          </div>
        </FinanceCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.85fr)]">
        <FinanceCard
          className="border-white/8 bg-[rgba(18,25,39,0.96)]"
          headerRight={<SectionLink href="/accounts" />}
          subtitle={`Total en ${data.accounts.length} cuentas`}
          title="Cuentas y bolsillos"
          variant="default"
        >
          {!data.accounts.length ? (
            <EmptyState title="Sin cuentas" description="Aun no tienes cuentas personales registradas." />
          ) : (
            <div className="space-y-3">
              {data.accounts.slice(0, 3).map((account) => (
                <AccountPocketCard
                  key={account.id}
                  account={account}
                  expanded
                  masked={masked}
                  pockets={data.pockets.filter((pocket) => pocket.accountId === account.id)}
                />
              ))}
            </div>
          )}
        </FinanceCard>

        <FinanceCard
          className="border-white/8 bg-[rgba(18,25,39,0.96)]"
          subtitle="Ingresos vs gastos del mes actual"
          title="Balance del mes"
          variant="default"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--fm-text-soft)]">Ingresos</span>
                <Amount masked={masked} showSign={false} size="sm" value={data.ingresosRealesMes} variant="income" />
              </div>
              <div className="h-2 rounded-full bg-[rgba(37,48,71,0.88)]">
                <div className="h-full rounded-full bg-[var(--fm-income)]" style={{ width: "100%" }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--fm-text-soft)]">Gastos</span>
                <Amount masked={masked} showSign={false} size="sm" value={data.gastosMes} variant="expense" />
              </div>
              <div className="h-2 rounded-full bg-[rgba(37,48,71,0.88)]">
                <div
                  className="h-full rounded-full bg-[var(--fm-expense)]"
                  style={{
                    width: `${data.ingresosRealesMes > 0 ? Math.min(100, Math.round((data.gastosMes / data.ingresosRealesMes) * 100)) : 0}%`,
                  }}
                />
              </div>
            </div>
            <div className="border-t border-white/8 pt-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--fm-text-soft)]">Quedo libre</span>
                <Amount
                  masked={masked}
                  showSign
                  size="lg"
                  value={data.ingresosRealesMes - data.gastosMes}
                  variant={data.ingresosRealesMes - data.gastosMes >= 0 ? "income" : "expense"}
                />
              </div>
            </div>
          </div>
        </FinanceCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <FinanceCard
          className="border-white/8 bg-[rgba(18,25,39,0.96)]"
          headerRight={<SectionLink href="/movements" />}
          subtitle="Ultimos movimientos personales"
          title="Movimientos recientes"
          variant="default"
        >
          {!rows.length ? (
            <EmptyState title="Sin movimientos" description="Aun no tienes transacciones personales recientes." />
          ) : (
            <div className="space-y-3">
              {groupedRows.map((group) => (
                <div key={group.label} className="space-y-3">
                  <p className="px-1 text-[11px] uppercase tracking-[0.22em] text-[var(--fm-text-muted)]">
                    {group.label}
                  </p>
                  {group.rows.map((row) => {
                    const transaction = data.transactions.find((item) => item.id === row.id);
                    if (!transaction) {
                      return null;
                    }

                    return (
                      <PersonalTransactionRow
                        key={row.id}
                        actionSlot={<MovementActions onDeleteMovement={onDeleteMovement} onEditMovement={onEditMovement} transaction={transaction} />}
                        masked={masked}
                        row={row}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </FinanceCard>

        <FinanceCard
          className="border-white/8 bg-[rgba(18,25,39,0.96)]"
          headerRight={<SectionLink href="/categories" />}
          subtitle="Total gastado en el mes actual"
          title="Gastos por categoria"
          variant="default"
        >
          {!categoryItems.length ? (
            <EmptyState title="Sin gastos del mes" description="Aun no hay gastos del mes para agrupar por categoria." />
          ) : (
            <CategoryBreakdownList items={categoryItems.slice(0, 5)} masked={masked} />
          )}
        </FinanceCard>
      </section>

      {householdDebts.length ? (
        <FinanceCard
          className="border-white/8 bg-[rgba(18,25,39,0.96)]"
          headerRight={<FinanceChip className="normal-case tracking-normal" variant="household">Compartido</FinanceChip>}
          subtitle={householdName ? `Pendientes visibles de ${householdName}` : "Pendientes visibles del hogar"}
          title="Pendientes del Hogar"
          variant="default"
        >
          <div className="space-y-3">
            {householdDebts.slice(0, 4).map((debt) => (
              <div key={debt.id} className="flex items-center justify-between gap-4 rounded-[24px] border border-white/8 bg-[rgba(20,27,40,0.84)] px-4 py-4">
                <div className="min-w-0">
                  <p className="truncate font-[var(--font-display)] text-xl font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
                    {debt.title}
                  </p>
                  <p className="text-sm text-[var(--fm-text-muted)]">
                    {debt.status || "Pendiente"}
                  </p>
                </div>
                <Amount masked={masked} showSign size="md" value={debt.amount} variant="pending" />
              </div>
            ))}
          </div>
        </FinanceCard>
      ) : null}
    </>
  );
}

export function MovementsView({
  data,
  masked,
  onDeleteMovement,
  onEditMovement,
}: MovementsViewProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "income" | "expense" | "transfer">("all");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const rows = useMemo(
    () => buildPersonalMovementRows(data.transactions, data.categories, data.accounts),
    [data.accounts, data.categories, data.transactions],
  );

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filter !== "all" && row.type !== filter) {
        return false;
      }

      if (!deferredSearch) {
        return true;
      }

      const haystack = `${row.title} ${row.subtitle} ${row.metadata}`.toLowerCase();
      return haystack.includes(deferredSearch);
    });
  }, [deferredSearch, filter, rows]);
  const groupedRows = useMemo(() => groupRowsByDateLabel(filteredRows), [filteredRows]);

  return (
    <>
      <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" variant="default">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-2xl">
            <Search className="pointer-events-none absolute inset-y-0 left-4 my-auto h-4 w-4 text-[var(--fm-text-muted)]" />
            <FinanceTextField
              className="pl-11"
              containerClassName="mb-0"
              label="Buscar movimiento"
              labelClassName="sr-only"
              placeholder="Buscar movimiento..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["all", "Todos"],
              ["income", "Ingresos"],
              ["expense", "Gastos"],
              ["transfer", "Transfer."],
            ].map(([value, label]) => {
              const active = filter === value;

              return (
                <FinanceButton
                  key={value}
                  className={active ? "bg-[var(--fm-surface-dark-alt)]" : undefined}
                  onClick={() => setFilter(value as typeof filter)}
                  size="sm"
                  tone={active ? "filled" : "text"}
                  type="button"
                  variant={active ? "default" : "ghost"}
                >
                  {label}
                </FinanceButton>
              );
            })}
          </div>
        </div>
      </FinanceCard>

      <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" variant="default">
        {!groupedRows.length ? (
          <EmptyState title="Sin movimientos" description="No encontramos movimientos para ese filtro." />
        ) : (
          <div className="space-y-3">
            {groupedRows.map((group) => (
              <div key={group.label} className="space-y-3">
                <p className="px-1 text-[11px] uppercase tracking-[0.22em] text-[var(--fm-text-muted)]">
                  {group.label}
                </p>
                {group.rows.map((row) => {
                  const transaction = data.transactions.find((item) => item.id === row.id);
                  if (!transaction) {
                    return null;
                  }

                  return (
                    <PersonalTransactionRow
                      key={row.id}
                      actionSlot={<MovementActions onDeleteMovement={onDeleteMovement} onEditMovement={onEditMovement} transaction={transaction} />}
                      masked={masked}
                      row={row}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </FinanceCard>
    </>
  );
}

export function AccountsView({ data, masked }: AccountsViewProps) {
  return (
    <>
      <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" variant="hero">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--fm-text-soft)]">
              Total entre tus cuentas
            </p>
            <Amount masked={masked} showSign={false} size="hero" value={data.accounts.reduce((sum, account) => sum + account.balance, 0)} />
          </div>
          <FinanceChip className="normal-case tracking-normal" variant="neutral">
            Vista personal activa
          </FinanceChip>
        </div>
      </FinanceCard>

      {!data.accounts.length ? (
        <EmptyState title="Sin cuentas" description="Aun no tienes cuentas personales registradas." />
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          {data.accounts.map((account) => (
            <FinanceCard
              key={account.id}
              className="border-white/8 bg-[rgba(18,25,39,0.96)]"
              variant="default"
            >
              <AccountPocketCard
                account={account}
                compact
                expanded
                masked={masked}
                pockets={data.pockets.filter((pocket) => pocket.accountId === account.id)}
              />
            </FinanceCard>
          ))}
        </section>
      )}
    </>
  );
}

export function CategoriesView({ data, masked }: CategoriesViewProps) {
  const [range, setRange] = useState<"month" | "year">("month");
  const filteredTransactions = useMemo(() => {
    const now = new Date();

    return data.transactions.filter((transaction) => {
      const movementDate = transaction.date ?? transaction.createdAt;
      if (!movementDate) {
        return false;
      }

      if (range === "month") {
        return isSameMonthAndYear(movementDate, now);
      }

      return movementDate.getFullYear() === now.getFullYear();
    });
  }, [data.transactions, range]);

  const items = useMemo(
    () => buildExpenseCategoryBreakdown(filteredTransactions, data.categories),
    [data.categories, filteredTransactions],
  );
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" variant="hero">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--fm-text-soft)]">
              Total gastado {range === "month" ? "este mes" : "este anio"}
            </p>
            <Amount masked={masked} showSign={false} size="hero" value={total} variant="expense" />
          </div>
          <div className="flex gap-2 rounded-2xl border border-white/8 bg-[rgba(18,25,39,0.92)] p-1">
            <FinanceButton
              className={range === "month" ? "bg-[var(--fm-surface-dark-alt)]" : undefined}
              onClick={() => setRange("month")}
              size="sm"
              tone={range === "month" ? "filled" : "text"}
              type="button"
              variant={range === "month" ? "default" : "ghost"}
            >
              Mes
            </FinanceButton>
            <FinanceButton
              className={range === "year" ? "bg-[var(--fm-surface-dark-alt)]" : undefined}
              onClick={() => setRange("year")}
              size="sm"
              tone={range === "year" ? "filled" : "text"}
              type="button"
              variant={range === "year" ? "default" : "ghost"}
            >
              Anio
            </FinanceButton>
          </div>
        </div>
      </FinanceCard>

      <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" variant="default">
        {!items.length ? (
          <EmptyState title="Sin gastos agrupables" description="No hay gastos para este rango de tiempo." />
        ) : (
          <CategoryBreakdownList items={items} masked={masked} />
        )}
      </FinanceCard>
    </>
  );
}

export function SettingsView({
  userName,
  userEmail,
  masked,
  notificationsEnabled,
  onToggleMasked,
  onToggleNotifications,
  onLogout,
}: SettingsViewProps) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" title="Perfil" variant="default">
        <div className="space-y-5">
          <div className="flex items-center gap-4 rounded-[24px] border border-white/8 bg-[rgba(20,27,40,0.84)] px-4 py-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[linear-gradient(180deg,rgba(85,104,138,0.92),rgba(41,53,80,0.92))] font-[var(--font-display)] text-xl font-semibold text-[var(--fm-warm-paper)]">
              {(userName || "FM")
                .split(" ")
                .map((part) => part.trim())
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() ?? "")
                .join("")}
            </div>
            <div className="min-w-0">
              <p className="truncate font-[var(--font-display)] text-2xl font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
                {userName || "Sesion activa"}
              </p>
              <p className="truncate text-sm text-[var(--fm-text-muted)]">
                {userEmail || "Google Auth"}
              </p>
            </div>
          </div>

          <SettingRow
            action={<FinanceChip className="normal-case tracking-normal" variant="neutral">COP $</FinanceChip>}
            description="Peso colombiano (COP)"
            title="Moneda"
          />
          <SettingRow
            action={
              <FinanceButton onClick={onLogout} size="sm" tone="destructive" type="button" variant="ghost">
                Salir
              </FinanceButton>
            }
            description="Salir de tu cuenta en este dispositivo"
            title="Cerrar sesion"
          />
        </div>
      </FinanceCard>

      <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" title="Preferencias" variant="default">
        <div className="space-y-1">
          <SettingRow
            action={<Toggle checked={masked} label="Ocultar saldos al abrir" onToggle={onToggleMasked} />}
            description="Empieza con los montos protegidos"
            title="Ocultar saldos al abrir"
          />
          <SettingRow
            action={<Toggle checked={notificationsEnabled} label="Notificaciones" onToggle={onToggleNotifications} />}
            description="Recordatorios de pendientes del Hogar"
            title="Notificaciones"
          />
        </div>
      </FinanceCard>
    </section>
  );
}
