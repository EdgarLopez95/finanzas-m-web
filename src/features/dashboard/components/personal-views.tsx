"use client";

import { useDeferredValue, useMemo, useState, useEffect } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Search, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";


import { AccountPocketCard } from "@/components/finance/account-pocket-card";
import { Amount } from "@/components/finance/amount";
import { CategoryBreakdownList } from "@/components/finance/category-breakdown-list";
import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceChip } from "@/components/finance/finance-chip";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { PersonalTransactionRow, PersonalRecentMovementRow } from "@/components/finance/personal-transaction-row";
import { FinanceDropdown } from "@/components/finance/finance-dropdown";

import { FinanceDialog } from "@/components/finance/finance-dialog";
import { getAccountVisual } from "@/lib/design/personal-visuals";
import { useAuthStore } from "@/stores/auth-store";
import { useDeletePersonalEntities } from "@/features/accounts/hooks/use-delete-personal-entities";
import { useCreatePocket } from "@/features/pockets/hooks/use-create-pocket";
import { AddAccountCard } from "@/features/accounts/components/add-account-card";
import { NewAccountDialog } from "@/features/accounts/components/new-account-dialog";
import { buildExpenseCategoryBreakdown, buildPersonalMovementRows } from "@/features/dashboard/lib/personal-view-model";
import { isSameMonthAndYear } from "@/lib/format/date";
import type { PersonalDashboardData } from "@/features/dashboard/hooks/use-personal-dashboard-data";
import type { HouseholdDebt } from "@/types/household";
import type { Transaction } from "@/types/transaction";
import type { Account } from "@/types/account";
import type { Pocket } from "@/types/pocket";
import type { Category } from "@/types/category";
import { cn } from "@/lib/utils";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";
import { useHouseholdData } from "@/features/household/hooks/use-household-data";
import { Pencil, Tag, LayoutGrid, Check, Cloud, LogOut, Home, AlertTriangle, MoreVertical } from "lucide-react";
import { useCreateCategory } from "@/features/categories/hooks/use-create-category";
import {
  resolveCategoryIcon,
  expenseIconOptions,
  incomeIconOptions,
} from "@/lib/categories/category-icons";

type MovementActionHandlers = {
  onEditMovement: (transaction: Transaction) => void;
  onDeleteMovement: (transaction: Transaction) => void;
};

type HomeViewProps = {
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
  refresh?: () => Promise<void>;
};

type CategoriesViewProps = {
  data: PersonalDashboardData;
  masked: boolean;
  refresh?: () => Promise<void>;
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
}: MovementActionHandlers & { transaction: Transaction }) => {
  const dropdownItems = [
    {
      label: "Editar",
      onClick: () => onEditMovement(transaction),
    },
    {
      label: "Eliminar",
      onClick: () => onDeleteMovement(transaction),
      variant: "destructive" as const,
    },
  ];

  return <FinanceDropdown items={dropdownItems} align="right" />;
};

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

const MonthlyMetricPanel = ({
  amount,
  icon: Icon,
  label,
  masked,
  tone,
  progressValue,
}: {
  amount: number;
  icon: typeof ArrowUpRight;
  label: string;
  masked: boolean;
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
            masked={masked}
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

export function HomeView({
  data,
  totalBalance,
  totalNoPropioPendiente,
  dineroPropio,
  masked,
  householdDebts,
  householdName,
}: HomeViewProps) {
  const isEditingBoard = useUiPreferencesStore((state) => state.isEditingBoard);
  const boardOrder = useUiPreferencesStore((state) => state.boardOrder);
  const hiddenCards = useUiPreferencesStore((state) => state.hiddenCards);
  const setBoardOrder = useUiPreferencesStore((state) => state.setBoardOrder);
  const hideCard = useUiPreferencesStore((state) => state.hideCard);
  const showCard = useUiPreferencesStore((state) => state.showCard);

  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

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
  const groupedRecentRows = useMemo(
    () => groupRowsByDateLabel(rows.slice(0, 5)),
    [rows],
  );

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData("text/plain", cardId);
    setDraggedCardId(cardId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetCardId: string) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("text/plain");
    if (cardId === targetCardId) return;

    const newOrder = [...boardOrder];
    const sourceIndex = newOrder.indexOf(cardId);
    const targetIndex = newOrder.indexOf(targetCardId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      newOrder.splice(sourceIndex, 1);
      newOrder.splice(targetIndex, 0, cardId);
      setBoardOrder(newOrder);
    }
    setDraggedCardId(null);
  };

  const handleDragEnd = () => {
    setDraggedCardId(null);
  };

  const getCardTitle = (cardId: string) => {
    switch (cardId) {
      case "accounts":
        return "Cuentas y bolsillos";
      case "categories":
        return "Gastos por categoría";
      case "movements":
        return "Movimientos recientes";
      case "household":
        return "Pendientes del Hogar";
      default:
        return cardId;
    }
  };

  const renderCardContent = (cardId: string) => {
    switch (cardId) {
      case "accounts":
        return (
          <FinanceCard
            className={cn(
              "border-white/8 bg-[rgba(18,25,39,0.96)] h-full transition-all",
              isEditingBoard && "border-dashed border-[var(--fm-pending)]/40 hover:border-[var(--fm-pending)]/80"
            )}
            headerRight={
              isEditingBoard ? (
                <div className="flex items-center gap-1.5">
                  <div className="p-1.5 cursor-grab text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] active:cursor-grabbing transition-colors" title="Arrastrar para reordenar">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <button
                    onClick={() => hideCard("accounts")}
                    className="p-1.5 rounded-lg text-[var(--fm-text-muted)] hover:text-[var(--fm-expense)] hover:bg-white/5 transition-all cursor-pointer"
                    title="Ocultar del tablero"
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <SectionLink href="/accounts" />
              )
            }
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
                    masked={masked}
                    pockets={data.pockets.filter((pocket) => pocket.accountId === account.id)}
                  />
                ))}
              </div>
            )}
          </FinanceCard>
        );

      case "categories":
        return (
          <FinanceCard
            className={cn(
              "border-white/8 bg-[rgba(18,25,39,0.96)] h-full transition-all",
              isEditingBoard && "border-dashed border-[var(--fm-pending)]/40 hover:border-[var(--fm-pending)]/80"
            )}
            headerRight={
              isEditingBoard ? (
                <div className="flex items-center gap-1.5">
                  <div className="p-1.5 cursor-grab text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] active:cursor-grabbing transition-colors" title="Arrastrar para reordenar">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <button
                    onClick={() => hideCard("categories")}
                    className="p-1.5 rounded-lg text-[var(--fm-text-muted)] hover:text-[var(--fm-expense)] hover:bg-white/5 transition-all cursor-pointer"
                    title="Ocultar del tablero"
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <SectionLink href="/categories" />
              )
            }
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
        );

      case "movements":
        return (
          <FinanceCard
            className={cn(
              "border-white/8 bg-[rgba(18,25,39,0.96)] h-full transition-all",
              isEditingBoard && "border-dashed border-[var(--fm-pending)]/40 hover:border-[var(--fm-pending)]/80"
            )}
            headerRight={
              isEditingBoard ? (
                <div className="flex items-center gap-1.5">
                  <div className="p-1.5 cursor-grab text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] active:cursor-grabbing transition-colors" title="Arrastrar para reordenar">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <button
                    onClick={() => hideCard("movements")}
                    className="p-1.5 rounded-lg text-[var(--fm-text-muted)] hover:text-[var(--fm-expense)] hover:bg-white/5 transition-all cursor-pointer"
                    title="Ocultar del tablero"
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <SectionLink href="/movements" />
              )
            }
            subtitle="Ultimos movimientos personales"
            title="Movimientos recientes"
            variant="default"
          >
            {!rows.length ? (
              <EmptyState title="Sin movimientos" description="Aun no tienes transacciones personales recientes." />
            ) : (
              <div className="space-y-4">
                {groupedRecentRows.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <p className="px-1 text-[11px] uppercase tracking-[0.22em] text-[var(--fm-text-muted)]">
                      {group.label}
                    </p>
                    <div className="divide-y divide-white/8">
                      {group.rows.map((row) => (
                        <div key={row.id} className="py-2.5 first:pt-0 last:pb-0">
                          <PersonalRecentMovementRow
                            masked={masked}
                            row={row}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FinanceCard>
        );

      case "household":
        if (!householdDebts.length) return null;
        return (
          <FinanceCard
            className={cn(
              "border-white/8 bg-[rgba(18,25,39,0.96)] h-full transition-all",
              isEditingBoard && "border-dashed border-[var(--fm-pending)]/40 hover:border-[var(--fm-pending)]/80"
            )}
            headerRight={
              isEditingBoard ? (
                <div className="flex items-center gap-1.5">
                  <div className="p-1.5 cursor-grab text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] active:cursor-grabbing transition-colors" title="Arrastrar para reordenar">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <button
                    onClick={() => hideCard("household")}
                    className="p-1.5 rounded-lg text-[var(--fm-text-muted)] hover:text-[var(--fm-expense)] hover:bg-white/5 transition-all cursor-pointer"
                    title="Ocultar del tablero"
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <FinanceChip className="normal-case tracking-normal" variant="household">Compartido</FinanceChip>
              )
            }
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
        );

      default:
        return null;
    }
  };

  const visibleCards = boardOrder.filter((cardId) => {
    if (cardId === "household" && !householdDebts.length) {
      return false;
    }
    return !hiddenCards.includes(cardId);
  });

  return (
    <>
      <section>
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
                  <Amount masked={masked} showSign={false} size="display" value={dineroPropio} />
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid gap-0 border-t border-white/8 pt-5 sm:grid-cols-2">
                  <div className="space-y-1 pr-0 sm:pr-5">
                    <p className="text-sm text-[var(--fm-text-muted)]">Saldo bancario bruto</p>
                    <Amount className="text-[var(--fm-text-soft)]" masked={masked} showSign={false} size="md" value={totalBalance} />
                  </div>
                  <div className="space-y-1 pt-4 sm:border-l sm:border-white/8 sm:pl-5 sm:pt-0">
                    <p className="text-sm text-[var(--fm-text-muted)]">No propio pendiente</p>
                    <Amount masked={masked} showSign size="md" value={totalNoPropioPendiente} variant="expense" />
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
              const ingresos = data.ingresosRealesMes;
              const gastos = data.gastosMes;
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
                      masked={masked}
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
                      masked={masked}
                      tone="expense"
                      progressValue={expenseProgress}
                    />
                  </div>

                  {/* Mathematical result separator & result */}
                  <div className="border-t border-white/8 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--fm-text-muted)]">Quedo libre</span>
                      <Amount
                        masked={masked}
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
      </section>

      {isEditingBoard && (
        <div className="flex flex-col gap-3 rounded-[24px] border border-[rgba(228,179,99,0.22)] bg-[rgba(228,179,99,0.04)] px-5 py-4 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-[var(--fm-text-soft)]">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-[var(--fm-pending)] animate-pulse" />
              <p>
                <strong>Personaliza tu Inicio:</strong> Arrastra para reordenar · oculta lo que no uses.
              </p>
            </div>
            <button
              onClick={() => {
                useUiPreferencesStore.getState().resetBoard();
              }}
              className="text-xs text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] underline cursor-pointer transition-colors"
            >
              Restablecer valores por defecto
            </button>
          </div>
          {hiddenCards.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3 text-xs text-[var(--fm-text-muted)]">
              <span>Ocultas:</span>
              <div className="flex flex-wrap gap-1.5">
                {hiddenCards.map((cardId) => (
                  <button
                    key={cardId}
                    onClick={() => showCard(cardId)}
                    className="flex items-center gap-1 rounded-full border border-white/8 bg-white/5 px-3 py-1 font-semibold text-[var(--fm-text-soft)] hover:bg-white/10 hover:text-[var(--fm-warm-paper)] transition-all cursor-pointer text-xs"
                  >
                    + {getCardTitle(cardId)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <section className="grid gap-5 grid-cols-1 lg:grid-cols-2">
        {visibleCards.map((cardId) => {
          return (
            <div
              key={cardId}
              draggable={isEditingBoard}
              onDragStart={(e) => handleDragStart(e, cardId)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, cardId)}
              onDragEnd={handleDragEnd}
              className={cn(
                "transition-all duration-200",
                isEditingBoard && "hover:scale-[1.005] hover:shadow-[0_8px_30px_rgb(0_0,0/0.3)]",
                draggedCardId === cardId && "opacity-40 scale-[0.98]"
              )}
            >
              {renderCardContent(cardId)}
            </div>
          );
        })}

        {isEditingBoard && hiddenCards.length > 0 && (
          <div
            onClick={() => showCard(hiddenCards[0])}
            className="flex flex-col items-center justify-center p-6 border border-dashed border-white/10 hover:border-[var(--fm-pending)]/40 bg-white/[0.01] hover:bg-[rgba(228,179,99,0.02)] rounded-[var(--fm-radius-card-large)] transition-all cursor-pointer group/add select-none min-h-[120px]"
          >
            <Plus className="h-5 w-5 text-[var(--fm-text-muted)] group-hover/add:text-[var(--fm-pending)] transition-colors mb-1.5" />
            <span className="text-sm font-semibold text-[var(--fm-text-muted)] group-hover/add:text-[var(--fm-pending)] transition-colors">
              Agregar tarjeta al tablero
            </span>
            <span className="text-xs text-[var(--fm-text-muted)]/50 mt-1">
              (Haz clic para mostrar {getCardTitle(hiddenCards[0])})
            </span>
          </div>
        )}
      </section>
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
          <div className="space-y-6">
            {groupedRows.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="px-1 text-[11px] uppercase tracking-[0.22em] text-[var(--fm-text-muted)]">
                  {group.label}
                </p>
                <div className="divide-y divide-white/8">
                  {group.rows.map((row) => {
                    const transaction = data.transactions.find((item) => item.id === row.id);
                    if (!transaction) {
                      return null;
                    }

                    return (
                      <div key={row.id} className="py-2.5 first:pt-0 last:pb-0">
                        <PersonalTransactionRow
                          actionSlot={<MovementActions onDeleteMovement={onDeleteMovement} onEditMovement={onEditMovement} transaction={transaction} />}
                          masked={masked}
                          row={row}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </FinanceCard>
    </>
  );
}

export function NewPocketDialog({
  open,
  account,
  onClose,
  onCreated,
  ownerId,
}: {
  open: boolean;
  account: Account | null;
  onClose: () => void;
  onCreated: () => void;
  ownerId: string;
}) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const { isSubmitting, error, successMessage, submitPocket, resetFeedback } = useCreatePocket();

  useEffect(() => {
    if (open) {
      setName("");
      setBalance("");
      resetFeedback();
    }
  }, [open, resetFeedback]);

  if (!account) return null;

  const currentAvailable = account.balance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const amountNum = Number(balance || 0);

    const success = await submitPocket({
      accountId: account.id,
      ownerId,
      name: name.trim(),
      balance: amountNum,
    });

    if (success) {
      setTimeout(() => {
        onCreated();
        onClose();
      }, 1000);
    }
  };

  return (
    <FinanceDialog open={open} title="Nuevo bolsillo" subtitle={`Crear bolsillo en ${account.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-[rgba(239,68,68,0.1)] border border-red-500/20 p-3 text-xs text-[var(--fm-expense)]">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="rounded-xl bg-[rgba(74,222,128,0.1)] border border-green-500/20 p-3 text-xs text-[var(--fm-income)]">
            {successMessage}
          </div>
        )}

        <FinanceTextField
          label="Nombre del bolsillo"
          placeholder="Ej: Ahorro viaje, Impuestos"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isSubmitting}
        />

        <div className="space-y-1">
          <FinanceTextField
            label="Monto inicial (opcional)"
            placeholder="0"
            type="number"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            disabled={isSubmitting}
          />
          <p className="text-[11px] text-[var(--fm-text-muted)]">
            Se descontará de los fondos disponibles actuales de la cuenta ($ {currentAvailable.toLocaleString("es-CO")})
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <FinanceButton
            type="button"
            onClick={onClose}
            variant="ghost"
            tone="text"
            disabled={isSubmitting}
          >
            Cancelar
          </FinanceButton>
          <FinanceButton
            type="submit"
            variant="default"
            tone="filled"
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? "Creando..." : "Crear bolsillo"}
          </FinanceButton>
        </div>
      </form>
    </FinanceDialog>
  );
}

export function AccountDetailDialog({
  open,
  account,
  pockets,
  transactions,
  categories,
  accounts,
  masked,
  onClose,
  onAddPocketClick,
  ownerId,
  onDeleted,
}: {
  open: boolean;
  account: Account | null;
  pockets: Pocket[];
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  masked: boolean;
  ownerId: string;
  onClose: () => void;
  onAddPocketClick: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [txFilterMode, setTxFilterMode] = useState<"recent" | "all">("recent");
  const [pocketPendingDelete, setPocketPendingDelete] = useState<Pocket | null>(null);
  const [accountDeleteOpen, setAccountDeleteOpen] = useState(false);
  const {
    isSubmitting,
    error,
    resetError,
    submitDeleteAccount,
    submitDeletePocket,
  } = useDeletePersonalEntities();

  const accountTxs = useMemo(() => {
    if (!account) return [];
    return transactions
      .filter((t) => t.accountId === account.id || t.targetAccountId === account.id)
      .sort((a, b) => {
        const dateA = a.date || a.createdAt || new Date(0);
        const dateB = b.date || b.createdAt || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
  }, [transactions, account]);

  const displayTxs = useMemo(() => {
    return txFilterMode === "recent" ? accountTxs.slice(0, 5) : accountTxs;
  }, [accountTxs, txFilterMode]);

  const rows = useMemo(() => {
    return buildPersonalMovementRows(displayTxs, categories, accounts);
  }, [displayTxs, categories, accounts]);

  const groupedTxs = useMemo(() => {
    return groupRowsByDateLabel(rows);
  }, [rows]);

  if (!account) return null;

  const visual = getAccountVisual(account);
  const Icon = visual.icon;
  const pocketsBalance = pockets.reduce((sum, p) => sum + p.balance, 0);
  const disponibleBalance = account.balance - pocketsBalance;

  const currentMonthTxs = transactions.filter((t) => {
    const date = t.date ?? t.createdAt;
    return (t.accountId === account.id || t.targetAccountId === account.id) &&
      isSameMonthAndYear(date, new Date());
  });

  const gastoMes = currentMonthTxs
    .filter((t) => t.type === "expense" && t.accountId === account.id)
    .reduce((sum, t) => sum + t.amount, 0);

  const ingresoMes = currentMonthTxs
    .filter((t) => t.type === "income" && t.accountId === account.id)
    .reduce((sum, t) => sum + t.amount, 0);

  const transferCount = currentMonthTxs
    .filter((t) => t.type === "transfer" && (t.accountId === account.id || t.targetAccountId === account.id))
    .length;

  const handleDeletePocket = async () => {
    if (!pocketPendingDelete) {
      return;
    }

    resetError();
    const deleted = await submitDeletePocket(ownerId, pocketPendingDelete.id);
    if (!deleted) {
      return;
    }

    setPocketPendingDelete(null);
    await onDeleted();
  };

  const handleDeleteAccount = async () => {
    resetError();
    const deleted = await submitDeleteAccount(ownerId, account.id);
    if (!deleted) {
      return;
    }

    setAccountDeleteOpen(false);
    await onDeleted();
  };

  return (
    <>
      <FinanceDialog
        open={open}
        title="Detalle de cuenta"
        onClose={onClose}
        headerActions={
          <button
            type="button"
            aria-label={`Eliminar cuenta ${account.name}`}
            onClick={() => {
              resetError();
              setAccountDeleteOpen(true);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[var(--fm-text-muted)] transition-colors hover:border-[var(--fm-expense)]/30 hover:bg-[var(--fm-expense)]/10 hover:text-[var(--fm-expense)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-expense)]/50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        }
      >
        <div className="space-y-5">
        {/* Bloque superior de la cuenta */}
        <div className="flex flex-col items-center py-4 border-b border-white/8">
          <div
            className="grid h-12 w-12 place-items-center rounded-full border mb-2"
            style={{
              backgroundColor: visual.accentSoft,
              borderColor: `${visual.accent}22`,
              color: visual.accent,
            }}
          >
            <Icon className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--fm-warm-paper)]">{account.name}</h3>
          <p className="text-xs text-[var(--fm-text-muted)] mt-1">Saldo total</p>
          <Amount masked={masked} showSign={false} size="display" value={account.balance} className="text-3xl font-bold mt-0.5" />
          <div className="grid grid-cols-2 gap-4 w-full mt-4 text-center">
            <div className="py-2 border-r border-white/8">
              <p className="text-xs text-[var(--fm-text-muted)]">Disponible</p>
              <Amount masked={masked} showSign={false} size="sm" value={disponibleBalance} className="text-base font-bold text-[var(--fm-income)] mt-0.5" />
            </div>
            <div className="py-2">
              <p className="text-xs text-[var(--fm-text-muted)]">En bolsillos</p>
              <Amount masked={masked} showSign={false} size="sm" value={pocketsBalance} className="text-base font-bold text-[var(--fm-pending)] mt-0.5" />
            </div>
          </div>
        </div>

        {/* Bloque "Este mes" */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--fm-text-muted)] uppercase tracking-wider">Este mes</p>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center">
              <ArrowDownLeft className="h-4 w-4 text-[var(--fm-expense)] mx-auto mb-1" />
              <Amount masked={masked} showSign={false} size="sm" value={gastoMes} className="text-sm font-bold text-[var(--fm-warm-paper)]" />
              <p className="text-[10px] text-[var(--fm-text-muted)] mt-0.5">Gastos</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center">
              <ArrowUpRight className="h-4 w-4 text-[var(--fm-income)] mx-auto mb-1" />
              <Amount masked={masked} showSign={false} size="sm" value={ingresoMes} className="text-sm font-bold text-[var(--fm-warm-paper)]" />
              <p className="text-[10px] text-[var(--fm-text-muted)] mt-0.5">Ingresos</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center">
              <div className="h-4 w-4 text-[var(--fm-transfer)] mx-auto mb-1 flex items-center justify-center font-semibold text-xs">⇄</div>
              <span className="text-sm font-bold text-[var(--fm-warm-paper)]">{transferCount}</span>
              <p className="text-[10px] text-[var(--fm-text-muted)] mt-0.5">Transfer.</p>
            </div>
          </div>
        </div>

        {/* Bloque "Bolsillos" */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-xs font-semibold text-[var(--fm-text-muted)] uppercase tracking-wider">Bolsillos</p>
            <span className="text-xs text-[var(--fm-text-muted)] font-medium">
              <Amount masked={masked} showSign={false} size="sm" value={pocketsBalance} className="inline text-xs text-[var(--fm-text-soft)]" /> en {pockets.length} {pockets.length === 1 ? "bolsillo" : "bolsillos"}
            </span>
          </div>
          <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
            {pockets.length === 0 ? (
              <p className="text-xs text-[var(--fm-text-muted)] py-4 text-center">No hay bolsillos creados.</p>
            ) : (
              pockets.map((pocket, idx) => (
                <div key={pocket.id} className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: idx % 2 === 0 ? visual.accent : "var(--fm-pending)" }} />
                    <span className="text-sm text-[var(--fm-text-soft)]">{pocket.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Amount masked={masked} showSign={false} size="sm" value={pocket.balance} />
                    <button
                      type="button"
                      onClick={() => setPocketPendingDelete(pocket)}
                      className="text-[var(--fm-text-muted)] hover:text-[var(--fm-expense)] p-1 rounded transition-colors"
                      title="Eliminar bolsillo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
            <button
              type="button"
              onClick={() => {
                onAddPocketClick();
              }}
              className="w-full py-1.5 mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--fm-pending)] hover:bg-white/5 rounded-xl border border-dashed border-[var(--fm-pending)]/20 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo bolsillo
            </button>
          </div>
        </div>

        {/* Bloque "Movimientos" */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-xs font-semibold text-[var(--fm-text-muted)] uppercase tracking-wider">Movimientos</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTxFilterMode("recent")}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-all ${
                  txFilterMode === "recent"
                    ? "bg-white/10 text-[var(--fm-warm-paper)]"
                    : "text-[var(--fm-text-muted)] hover:text-[var(--fm-text-soft)]"
                }`}
              >
                Recientes
              </button>
              <button
                type="button"
                onClick={() => setTxFilterMode("all")}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-all ${
                  txFilterMode === "all"
                    ? "bg-white/10 text-[var(--fm-warm-paper)]"
                    : "text-[var(--fm-text-muted)] hover:text-[var(--fm-text-soft)]"
                }`}
              >
                Ver todo
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 divide-y divide-white/8">
            {groupedTxs.length === 0 ? (
              <p className="text-xs text-[var(--fm-text-muted)] py-4 text-center">Sin movimientos este mes.</p>
            ) : (
              groupedTxs.map((group) => (
                <div key={group.label} className="pt-2 first:pt-0">
                  <div className="text-[10px] font-bold text-[var(--fm-text-muted)] uppercase tracking-wider mb-1">
                    {group.label}
                  </div>
                  <div className="space-y-1">
                    {group.rows.map((row) => (
                      <PersonalTransactionRow key={row.id} row={row} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        </div>
      </FinanceDialog>

      <FinanceDialog
        open={!!pocketPendingDelete}
        title="Eliminar bolsillo"
        subtitle="Se eliminará este bolsillo y los movimientos asociados a él. Esta acción no se puede deshacer."
        onClose={() => {
          if (!isSubmitting) {
            setPocketPendingDelete(null);
            resetError();
          }
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--fm-warm-paper)]">
            {pocketPendingDelete
              ? `Vas a eliminar "${pocketPendingDelete.name}" y liberar su saldo a la cuenta disponible.`
              : "Confirma esta eliminación antes de continuar."}
          </p>
          {error ? <p className="text-sm text-[var(--fm-expense)]">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <FinanceButton
              type="button"
              tone="outlined"
              variant="outline"
              onClick={() => {
                setPocketPendingDelete(null);
                resetError();
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </FinanceButton>
            <FinanceButton type="button" tone="destructive" onClick={() => void handleDeletePocket()} disabled={isSubmitting}>
              {isSubmitting ? "Eliminando..." : "Eliminar bolsillo"}
            </FinanceButton>
          </div>
        </div>
      </FinanceDialog>

      <FinanceDialog
        open={accountDeleteOpen}
        title="Eliminar cuenta"
        subtitle="Se eliminará esta cuenta, todos sus bolsillos y todos los movimientos asociados. Esta acción no se puede deshacer."
        onClose={() => {
          if (!isSubmitting) {
            setAccountDeleteOpen(false);
            resetError();
          }
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--fm-warm-paper)]">
            Se borrará por completo la cuenta &quot;{account.name}&quot; junto con sus datos asociados que la Web puede limpiar de forma segura.
          </p>
          {error ? <p className="text-sm text-[var(--fm-expense)]">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <FinanceButton
              type="button"
              tone="outlined"
              variant="outline"
              onClick={() => {
                setAccountDeleteOpen(false);
                resetError();
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </FinanceButton>
            <FinanceButton type="button" tone="destructive" onClick={() => void handleDeleteAccount()} disabled={isSubmitting}>
              {isSubmitting ? "Eliminando..." : "Eliminar cuenta"}
            </FinanceButton>
          </div>
        </div>
      </FinanceDialog>
    </>
  );
}

export function AccountsView({ data, masked, refresh }: AccountsViewProps) {
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<Account | null>(null);
  const [selectedAccountForNewPocket, setSelectedAccountForNewPocket] = useState<Account | null>(null);
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const ownerId = user?.uid ?? "";

  const detailAccount = useMemo(() => {
    if (!selectedAccountForDetail) return null;
    return data.accounts.find((a) => a.id === selectedAccountForDetail.id) || selectedAccountForDetail;
  }, [data.accounts, selectedAccountForDetail]);

  const detailPockets = useMemo(() => {
    if (!detailAccount) return [];
    return data.pockets.filter((p) => p.accountId === detailAccount.id);
  }, [data.pockets, detailAccount]);

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

      <section className="grid gap-5 xl:grid-cols-2">
        {data.accounts.map((account) => (
          <FinanceCard
            key={account.id}
            className="border-white/8 bg-[rgba(18,25,39,0.96)] hover:border-white/12 transition-colors"
            variant="default"
          >
            <AccountPocketCard
              account={account}
              variant="accounts-page"
              masked={masked}
              pockets={data.pockets.filter((pocket) => pocket.accountId === account.id)}
              onCardClick={() => setSelectedAccountForDetail(account)}
              onAddPocketClick={() => setSelectedAccountForNewPocket(account)}
            />
          </FinanceCard>
        ))}

        <AddAccountCard onClick={() => setNewAccountOpen(true)} />
      </section>

      {selectedAccountForDetail && (
        <AccountDetailDialog
          open={!!selectedAccountForDetail}
          account={detailAccount}
          pockets={detailPockets}
          transactions={data.transactions}
          categories={data.categories}
          accounts={data.accounts}
          masked={masked}
          ownerId={ownerId}
          onClose={() => setSelectedAccountForDetail(null)}
          onAddPocketClick={() => {
            setSelectedAccountForNewPocket(selectedAccountForDetail);
          }}
          onDeleted={async () => {
            setSelectedAccountForDetail(null);
            if (refresh) {
              await refresh();
            }
          }}
        />
      )}

      {selectedAccountForNewPocket && (
        <NewPocketDialog
          open={!!selectedAccountForNewPocket}
          account={selectedAccountForNewPocket}
          ownerId={ownerId}
          onClose={() => setSelectedAccountForNewPocket(null)}
          onCreated={async () => {
            if (refresh) {
              await refresh();
            }
          }}
        />
      )}

      <NewAccountDialog
        open={newAccountOpen}
        ownerId={ownerId}
        onClose={() => setNewAccountOpen(false)}
        onCreated={async () => {
          if (refresh) {
            await refresh();
          }
        }}
      />
    </>
  );
}

interface CreateCategoryDialogProps {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  kind: "expense" | "income";
  onCreated: () => Promise<void>;
}

export function CreateCategoryDialog({
  open,
  onClose,
  ownerId,
  kind,
  onCreated,
}: CreateCategoryDialogProps) {
  const [step, setStep] = useState<"form" | "selector">("form");
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(kind === "income" ? "#22C55E" : "#EF4444");
  const [selectedIconKey, setSelectedIconKey] = useState(kind === "income" ? "salary" : "food");
  
  // reset state on open
  useEffect(() => {
    if (open) {
      setStep("form");
      setName("");
      setSelectedColor(kind === "income" ? "#22C55E" : "#EF4444");
      setSelectedIconKey(kind === "income" ? "salary" : "food");
      setSearchTerm("");
      setSelectedGroup("Todos");
    }
  }, [open, kind]);

  const { isSubmitting, error, successMessage, submitCategory } = useCreateCategory();

  // Color Palette
  const colors = [
    "#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4", "#3B82F6", "#6366F1", "#A855F7",
    "#F87171", "#FB923C", "#FACC15", "#4ADE80", "#22D3EE", "#60A5FA", "#818CF8", "#C084FC",
  ];

  // Selector Step State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("Todos");

  // Groups list based on kind
  const groups = useMemo(() => {
    return kind === "income"
      ? ["Todos", "Trabajo", "Ingresos", "Otros"]
      : ["Todos", "Comida", "Hogar", "Transporte", "Salud", "Compras", "Servicios", "Otros"];
  }, [kind]);

  // Filtered icons
  const filteredOptions = useMemo(() => {
    const options = kind === "income" ? incomeIconOptions : expenseIconOptions;
    return options.filter((opt) => {
      if (selectedGroup !== "Todos" && opt.group !== selectedGroup) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesLabel = opt.label.toLowerCase().includes(term);
        const matchesKey = opt.iconKey.toLowerCase().includes(term);
        const matchesKeywords = opt.keywords.some((kw) => kw.includes(term));
        return matchesLabel || matchesKey || matchesKeywords;
      }
      return true;
    });
  }, [kind, selectedGroup, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedIconKey || !selectedColor) return;
    
    const success = await submitCategory({
      ownerId,
      name: name.trim(),
      kind,
      iconKey: selectedIconKey,
      color: selectedColor,
    });

    if (success) {
      await onCreated();
      // wait a bit for success feedback, then close
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  const handleSelectIconAndColor = () => {
    setStep("selector");
  };

  const handleSelectorDone = () => {
    setStep("form");
  };

  const SelectedIcon = resolveCategoryIcon(selectedIconKey, kind);

  return (
    <FinanceDialog 
      open={open} 
      title={step === "form" ? "Crear categoría" : "Elegir ícono y color"} 
      subtitle={step === "form" ? `Añadir nueva categoría de ${kind === "income" ? "ingreso" : "gasto"}` : undefined} 
      onClose={onClose}
    >
      {step === "form" ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-[var(--fm-expense)]">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-xs text-[var(--fm-income)]">
              {successMessage}
            </div>
          )}

          {/* Nombre Input */}
          <FinanceTextField
            label="Nombre"
            placeholder={kind === "income" ? "Ej. Sueldo, Freelance" : "Ej. Restaurantes, Supermercado"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isSubmitting}
          />

          {/* Ícono y color button row */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]">
              Ícono y color
            </label>
            <button
              type="button"
              onClick={handleSelectIconAndColor}
              className="w-full h-12 rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.05] flex items-center justify-between px-4 text-sm text-[var(--fm-warm-paper)] transition-all cursor-pointer outline-none focus:border-amber-500/50"
            >
              <div className="flex items-center gap-2.5">
                <div 
                  className="h-6 w-6 rounded-full flex items-center justify-center border border-white/10"
                  style={{ backgroundColor: `${selectedColor}22`, color: selectedColor }}
                >
                  <SelectedIcon className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium">Cambiar ícono y color</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--fm-text-muted)]" />
            </button>
          </div>

          {/* Preview card */}
          <div className="rounded-xl border border-white/6 bg-[rgba(20,27,40,0.4)] p-4 flex flex-col items-center justify-center gap-2.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--fm-text-muted)]">Vista previa</span>
            <div className="flex flex-col items-center gap-1.5">
              <div 
                className="h-12 w-12 rounded-full flex items-center justify-center border border-white/15 transition-all duration-300"
                style={{ 
                  backgroundColor: `${selectedColor}22`,
                  borderColor: `${selectedColor}44`,
                  color: selectedColor,
                  boxShadow: `0 0 12px ${selectedColor}15`
                }}
              >
                <SelectedIcon className="h-5 w-5" />
              </div>
              <span className="font-semibold text-sm text-[var(--fm-warm-paper)] min-h-[1.25rem]">
                {name.trim() || (kind === "income" ? "Ej. Sueldo" : "Ej. Restaurantes")}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-end pt-1">
            <FinanceButton
              type="button"
              onClick={onClose}
              variant="ghost"
              tone="text"
              disabled={isSubmitting}
            >
              Cancelar
            </FinanceButton>
            <FinanceButton
              type="submit"
              variant="default"
              tone="filled"
              disabled={isSubmitting || !name.trim() || !selectedIconKey || !selectedColor}
            >
              {isSubmitting ? "Guardando..." : "Guardar categoría"}
            </FinanceButton>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fm-text-muted)]" />
            <input
              type="text"
              placeholder={kind === "income" ? "Buscar sueldo, venta, freelance..." : "Buscar comida, banco, mascota..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/8 bg-white/[0.02] pl-10 pr-4 text-sm text-[var(--fm-warm-paper)] placeholder-[var(--fm-text-muted)] focus:border-amber-500/50 focus:ring-0 outline-none transition-all"
            />
          </div>

          {/* Paleta de colores */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]">
              Color
            </span>
            <div className="grid grid-cols-8 gap-2.5">
              {colors.map((color) => {
                const isSelected = selectedColor === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      "h-8 w-8 rounded-full transition-all duration-200 border border-white/10 hover:scale-110 relative flex items-center justify-center cursor-pointer outline-none",
                      isSelected ? "ring-2 ring-offset-2 ring-offset-[rgba(18,25,39,0.98)] scale-105" : ""
                    )}
                    style={isSelected
                      ? { backgroundColor: color, boxShadow: `0 0 0 2px rgba(18,25,39,0.98), 0 0 0 4px ${color}` }
                      : { backgroundColor: color }
                    }
                    aria-label={`Seleccionar color ${color}`}
                  >
                    {isSelected && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtro de grupo */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]">
              Grupo
            </span>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
              {groups.map((group) => {
                const isSelected = selectedGroup === group;
                return (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setSelectedGroup(group)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold border transition-all shrink-0 cursor-pointer outline-none",
                      isSelected
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : "border-white/8 bg-white/[0.02] text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] hover:border-white/15"
                    )}
                  >
                    {group}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid de iconos */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]">
              Íconos ({filteredOptions.length})
            </span>
            {filteredOptions.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center rounded-xl border border-white/6 bg-white/[0.01] text-xs text-[var(--fm-text-muted)]">
                No encontramos iconos con ese término.
              </div>
            ) : (
              <div className="grid grid-cols-6 sm:grid-cols-7 gap-2.5 max-h-[180px] overflow-y-auto pr-1">
                {filteredOptions.map((opt) => {
                  const Icon = resolveCategoryIcon(opt.iconKey, kind);
                  const isSelected = selectedIconKey === opt.iconKey;
                  return (
                    <button
                      key={opt.iconKey}
                      type="button"
                      onClick={() => setSelectedIconKey(opt.iconKey)}
                      className={cn(
                        "h-11 rounded-xl border flex items-center justify-center transition-all hover:bg-white/[0.04] cursor-pointer outline-none",
                        isSelected
                          ? "font-bold"
                          : "border-white/6 bg-white/[0.01] text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]"
                      )}
                      style={isSelected ? {
                        borderColor: `${selectedColor}80`,
                        backgroundColor: `${selectedColor}18`,
                        color: selectedColor,
                      } : undefined}
                      title={opt.label}
                      aria-label={`Seleccionar icono ${opt.label}`}
                    >
                      <Icon className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Listo button */}
          <div className="pt-2 flex justify-end">
            <FinanceButton
              type="button"
              onClick={handleSelectorDone}
              variant="default"
              tone="filled"
              className="w-full sm:w-auto"
            >
              Listo
            </FinanceButton>
          </div>
        </div>
      )}
    </FinanceDialog>
  );
}

export function CategoriesView({ data, masked, refresh }: CategoriesViewProps) {
  const user = useAuthStore((state) => state.user);
  const ownerId = user?.uid || "";

  const [viewMode, setViewMode] = useState<"report" | "manage">("report");
  const [activeKind, setActiveKind] = useState<"expense" | "income">("expense");
  const [range, setRange] = useState<"month" | "year">("month");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Parse ?mode=manage safely on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "manage") {
        setViewMode("manage");
      }
    }
  }, []);

  // Filter transactions for report mode
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

  // Filter categories for management mode
  const filteredCategories = useMemo(() => {
    return data.categories.filter((category) => category.type === activeKind);
  }, [data.categories, activeKind]);

  return (
    <div className="space-y-6">
      {/* Segmented Control for Mode selection */}
      <div className="flex gap-2 rounded-2xl border border-white/8 bg-[rgba(18,25,39,0.92)] p-1 w-full max-w-md mx-auto mb-2">
        <FinanceButton
          className={cn(
            "flex-1 text-center justify-center rounded-xl py-2",
            viewMode === "report" ? "bg-[var(--fm-surface-dark-alt)] text-[var(--fm-warm-paper)] font-semibold" : "text-[var(--fm-text-muted)]"
          )}
          onClick={() => setViewMode("report")}
          size="sm"
          tone={viewMode === "report" ? "filled" : "text"}
          type="button"
          variant={viewMode === "report" ? "default" : "ghost"}
        >
          Distribución de gastos
        </FinanceButton>
        <FinanceButton
          className={cn(
            "flex-1 text-center justify-center rounded-xl py-2",
            viewMode === "manage" ? "bg-[var(--fm-surface-dark-alt)] text-[var(--fm-warm-paper)] font-semibold" : "text-[var(--fm-text-muted)]"
          )}
          onClick={() => setViewMode("manage")}
          size="sm"
          tone={viewMode === "manage" ? "filled" : "text"}
          type="button"
          variant={viewMode === "manage" ? "default" : "ghost"}
        >
          Mis categorías
        </FinanceButton>
      </div>

      {viewMode === "report" ? (
        <>
          <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" variant="hero">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--fm-text-soft)]">
                  Total gastado {range === "month" ? "este mes" : "este año"}
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
                  Año
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
      ) : (
        <div className="space-y-6">
          {/* Segmented Control for Gasto / Ingreso kind selection */}
          <div className="flex gap-2 rounded-2xl border border-white/8 bg-[rgba(18,25,39,0.92)] p-1 w-fit">
            <FinanceButton
              className={cn(
                "rounded-xl py-1.5 px-4 font-semibold transition-all",
                activeKind === "expense" 
                  ? "bg-[rgba(251,113,133,0.14)] text-[var(--fm-expense)] border border-[var(--fm-expense)]/10" 
                  : "text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]"
              )}
              onClick={() => setActiveKind("expense")}
              size="sm"
              tone={activeKind === "expense" ? "filled" : "text"}
              type="button"
              variant={activeKind === "expense" ? "default" : "ghost"}
            >
              Gastos
            </FinanceButton>
            <FinanceButton
              className={cn(
                "rounded-xl py-1.5 px-4 font-semibold transition-all",
                activeKind === "income" 
                  ? "bg-[rgba(52,211,153,0.14)] text-[var(--fm-income)] border border-[var(--fm-income)]/10" 
                  : "text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]"
              )}
              onClick={() => setActiveKind("income")}
              size="sm"
              tone={activeKind === "income" ? "filled" : "text"}
              type="button"
              variant={activeKind === "income" ? "default" : "ghost"}
            >
              Ingresos
            </FinanceButton>
          </div>

          <div className="space-y-4">
            {/* Dashed "+ Nueva categoría" button card */}
            <button
              onClick={() => setShowCreateModal(true)}
              className={cn(
                "w-full h-14 rounded-2xl border border-dashed flex items-center justify-center gap-2.5 text-sm font-semibold transition-all cursor-pointer outline-none",
                activeKind === "expense"
                  ? "border-[var(--fm-expense)]/20 bg-[rgba(251,113,133,0.02)] text-[var(--fm-expense)] hover:bg-[rgba(251,113,133,0.06)] focus:ring-1 focus:ring-[var(--fm-expense)]/40"
                  : "border-[var(--fm-income)]/20 bg-[rgba(52,211,153,0.02)] text-[var(--fm-income)] hover:bg-[rgba(52,211,153,0.06)] focus:ring-1 focus:ring-[var(--fm-income)]/40"
              )}
              aria-label={`Crear nueva categoría de ${activeKind === "expense" ? "gasto" : "ingreso"}`}
            >
              <Plus className="h-4 w-4" />
              <span>Nueva categoría</span>
            </button>

            {/* Grid/List of existing categories */}
            {!filteredCategories.length ? (
              <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]">
                <EmptyState
                  title="Crea tu primera categoría"
                  description="Te ayudará a entender mejor tus movimientos."
                />
              </FinanceCard>
            ) : (
              <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)] p-0 overflow-hidden" variant="default">
                <div className="divide-y divide-white/8">
                  {filteredCategories.map((category) => {
                    const IconComponent = resolveCategoryIcon(category.iconKey, activeKind);
                    return (
                      <div key={category.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3.5">
                          <div
                            className="grid h-10 w-10 place-items-center rounded-full border border-white/10"
                            style={{
                              backgroundColor: `${category.color || (activeKind === "income" ? "#22C55E" : "#EF4444")}22`,
                              borderColor: `${category.color || (activeKind === "income" ? "#22C55E" : "#EF4444")}44`,
                              color: category.color || (activeKind === "income" ? "#22C55E" : "#EF4444"),
                            }}
                          >
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <span className="font-semibold text-sm text-[var(--fm-warm-paper)]">
                            {category.name}
                          </span>
                        </div>
                        <button
                          className="p-2 rounded-xl text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] hover:bg-white/5 transition-all outline-none"
                          aria-label="Opciones de categoría"
                        >
                          <MoreVertical className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </FinanceCard>
            )}
          </div>
        </div>
      )}

      {/* Creation Modal */}
      {ownerId && (
        <CreateCategoryDialog
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          ownerId={ownerId}
          kind={activeKind}
          onCreated={async () => {
            if (refresh) {
              await refresh();
            }
          }}
        />
      )}
    </div>
  );
}

type SettingItemProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  sincronizado?: boolean;
};

function SettingItem({
  icon,
  title,
  description,
  badge,
  onClick,
  disabled = false,
  destructive = false,
  sincronizado = false,
}: SettingItemProps) {
  const isClickable = Boolean(onClick) && !disabled;

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={disabled}
      className={cn(
        "w-full text-left flex items-center justify-between p-4 rounded-[20px] border transition-all select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
        sincronizado
          ? "border-[rgba(52,211,153,0.1)] bg-[rgba(52,211,153,0.04)] cursor-default"
          : isClickable
          ? destructive
            ? "border-[rgba(239,68,68,0.12)] bg-[rgba(239,68,68,0.02)] hover:bg-[rgba(239,68,68,0.06)] active:bg-[rgba(239,68,68,0.08)] cursor-pointer"
            : "border-white/5 bg-white/[0.01] hover:bg-white/[0.04] active:bg-white/5 cursor-pointer"
          : destructive
          ? "border-red-500/10 bg-red-500/[0.01] opacity-65 cursor-default"
          : "border-white/5 bg-white/[0.01] opacity-65 cursor-default",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            destructive
              ? "bg-red-500/10 text-red-400"
              : sincronizado
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-white/[0.04] text-[var(--fm-text-soft)]"
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 text-left">
          <p
            className={cn(
              "font-semibold text-sm truncate",
              destructive ? "text-red-400" : sincronizado ? "text-emerald-400" : "text-[var(--fm-warm-paper)]"
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              "text-xs truncate",
              destructive ? "text-red-400/60" : sincronizado ? "text-emerald-400/60" : "text-[var(--fm-text-muted)]"
            )}
          >
            {description}
          </p>
        </div>
      </div>

      {badge ? (
        <div
          className={cn(
            "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider select-none shrink-0 border",
            badge.includes("NO DISPONIBLE") || destructive
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-white/10 border-white/10 text-[var(--fm-text-soft)]"
          )}
        >
          {badge}
        </div>
      ) : (
        isClickable && (
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              destructive ? "text-red-400/50" : "text-[var(--fm-text-muted)]"
            )}
          />
        )
      )}
    </button>
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
  const router = useRouter();
  const { data: householdData } = useHouseholdData();
  const hasHousehold = Boolean(householdData?.activeHouseholdId);
  const householdName = householdData?.household?.name || "Hogar compartido";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Columna 1: Perfil y Hogar */}
        <div className="space-y-6">
          {/* Perfil */}
          <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" title="Perfil" variant="default">
            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-[24px] border border-white/8 bg-[rgba(20,27,40,0.84)] px-4 py-4">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-[linear-gradient(180deg,rgba(85,104,138,0.92),rgba(41,53,80,0.92))] font-[var(--font-display)] text-xl font-semibold text-[var(--fm-warm-paper)] select-none">
                  {(userName || "FM")
                    .split(" ")
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() ?? "")
                    .join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-[var(--font-display)] text-2xl font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
                    {userName || "Edgar Felipe López Acosta"}
                  </p>
                  <p className="truncate text-sm text-[var(--fm-text-muted)]">
                    {userEmail || "edgarfelipe.l.a@gmail.com"}
                  </p>
                </div>
              </div>

              {/* Moneda Row */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--fm-warm-paper)]">Moneda</p>
                  <p className="text-xs text-[var(--fm-text-muted)]">Peso colombiano (COP)</p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-1.5 text-xs font-semibold text-[var(--fm-warm-paper)] select-none">
                  COP $
                </div>
              </div>
            </div>
          </FinanceCard>

          {/* Hogar */}
          {hasHousehold && (
            <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" title={`Hogar: ${householdName}`} variant="default">
              <div className="space-y-3">
                <SettingItem
                  icon={<Pencil className="h-5 w-5" />}
                  title="Editar nombre del hogar"
                  description="Cambia el nombre visible de tu hogar compartido."
                  badge="PRÓXIMAMENTE"
                  disabled={true}
                />
                <SettingItem
                  icon={<Home className="h-5 w-5" />}
                  title="Disolver hogar"
                  description="Desvincula a los miembros y borra el registro de Hogar."
                  badge="NO DISPONIBLE EN WEB TODAVÍA"
                  destructive={true}
                  disabled={true}
                />
              </div>
            </FinanceCard>
          )}
        </div>

        {/* Columna 2: Preferencias, Organización y Sincronización */}
        <div className="space-y-6">
          {/* Preferencias */}
          <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" title="Preferencias" variant="default">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[var(--fm-warm-paper)]">Ocultar saldos al abrir</p>
                  <p className="text-xs text-[var(--fm-text-muted)]">Empieza con los montos protegidos</p>
                </div>
                <Toggle checked={masked} label="Ocultar saldos al abrir" onToggle={onToggleMasked} />
              </div>
              <div className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[var(--fm-warm-paper)]">Notificaciones</p>
                  <p className="text-xs text-[var(--fm-text-muted)]">Recordatorios de pendientes del Hogar</p>
                </div>
                <Toggle checked={notificationsEnabled} label="Notificaciones" onToggle={onToggleNotifications} />
              </div>
            </div>
          </FinanceCard>

          {/* Organización */}
          <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" title="Organización" variant="default">
            <div className="space-y-3">
              <SettingItem
                icon={<Tag className="h-5 w-5" />}
                title="Administrar categorías"
                description="Crea, edita y archiva tus categorías personales."
                onClick={() => router.push("/categories?mode=manage")}
              />
              <SettingItem
                icon={<LayoutGrid className="h-5 w-5" />}
                title="Cards de Inicio"
                description="Decide qué aparece y en qué orden en tu pantalla principal."
                badge="PRÓXIMAMENTE"
                disabled={true}
              />
            </div>
          </FinanceCard>

          {/* Sincronización y diagnóstico */}
          <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" title="Sincronización y diagnóstico" variant="default">
            <div className="space-y-3">
              <SettingItem
                icon={<Check className="h-5 w-5" />}
                title="Todo sincronizado"
                description="Tus datos están guardados en la nube."
                sincronizado={true}
              />
              <SettingItem
                icon={<Cloud className="h-5 w-5" />}
                title="Auditar datos en Firebase"
                description="Cuenta cuántos documentos quedan en Firestore para tu usuario y Hogar."
                badge="PRÓXIMAMENTE"
                disabled={true}
              />
            </div>
          </FinanceCard>
        </div>
      </div>

      {/* Zona peligrosa */}
      <FinanceCard className="border-red-500/15 bg-[rgba(239,68,68,0.02)]" title="Zona peligrosa" variant="default">
        <div className="space-y-3">
          <SettingItem
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Reiniciar todos los datos"
            description="Borra movimientos, cuentas, bolsillos, categorías y disuelve el Hogar."
            badge="NO DISPONIBLE EN WEB TODAVÍA"
            disabled={true}
            destructive={true}
          />
          <SettingItem
            icon={<LogOut className="h-5 w-5" />}
            title="Cerrar sesión"
            description="Salir de tu cuenta en este dispositivo."
            onClick={onLogout}
            destructive={true}
          />
        </div>
      </FinanceCard>
    </div>
  );
}
