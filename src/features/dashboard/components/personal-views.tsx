"use client";

import { useDeferredValue, useMemo, useState, useEffect, useRef } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Search, EyeOff, GripVertical, Plus } from "lucide-react";
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

import { useAuthStore } from "@/stores/auth-store";
import { useCreatePocket } from "@/features/pockets/hooks/use-create-pocket";
import { useUpdatePocket } from "@/features/pockets/hooks/use-update-pocket";
import { useUpdateAccount } from "@/features/accounts/hooks/use-update-account";
import {
  ACCOUNT_TYPE_OPTIONS,
  BANK_OPTIONS,
  WALLET_OPTIONS,
  SAVINGS_OPTIONS,
  TYPE_COLORS,
  resolveIconTypeForSelection,
  type AccountType,
} from "@/lib/accounts/account-visual-catalog";
import { IconSelect } from "@/components/finance/icon-select";
import { AccountIcon } from "@/components/finance/account-icon";
import { AddAccountCard } from "@/features/accounts/components/add-account-card";
import { NewAccountDialog } from "@/features/accounts/components/new-account-dialog";
import { PocketDetailDialog } from "@/features/pockets/components/pocket-detail-dialog";
import { buildExpenseCategoryBreakdown, buildPersonalMovementRows, computeNetPersonalExpenses, isCountableMonthlyExpense, isIncomingDebtReimbursement, type ExpenseCategoryBreakdownItem } from "@/features/dashboard/lib/personal-view-model";
import { OwnershipDistributionPanel } from "@/features/dashboard/components/ownership-distribution-panel";
import type { OwnershipDistributionMode } from "@/features/dashboard/lib/ownership-distribution-view-model";
import { calculateAccountPhysicalBalances } from "@/lib/finance/account-balance-model";
import { type ActionAvailability } from "@/features/accounts/lib/account-action-availability";
import { runIfAllowed } from "@/features/accounts/lib/account-ownership-view-state";
import { readThirdPartyLocationSnapshot } from "@/features/transactions/services/read-third-party-location-snapshot";
import { computeThirdPartyAvailability } from "@/features/transactions/lib/third-party-availability";
import { OwnFundsCompositionNotice } from "@/components/finance/own-funds-composition-notice";
import { resolveOwnFundsCompositionFeedback } from "@/lib/finance/own-funds-gate";
import { MovementDetailDialog } from "@/features/transactions/components/movement-detail-dialog";
import { CategoryDetailDialog } from "@/components/finance/category-detail-dialog";
import { isSameMonthAndYear, formatPeriodLabel } from "@/lib/format/date";
import type { PersonalDashboardData } from "@/stores/personal-data-store";
import type { HouseholdDebt, HouseholdEvent, HouseholdEventShare, HouseholdCategory, HouseholdMemberProfile } from "@/types/household";
import { HouseholdEventDetailDialog } from "@/features/household/components/household-event-detail-dialog";
import { DeclarePaymentDialog } from "@/features/household/components/declare-payment-dialog";
import { useUndoDeclaredDebtPayment } from "@/features/household/hooks/use-undo-declared-debt-payment";
import { MplusHouseholdLifecycleCard } from "@/features/settings/components/mplus-household-lifecycle-card";
import {
  resolveDebtPaymentEligibility,
  resolvePayerUserId,
  buildDebtPaymentBlockedCopy,

} from "@/features/household/lib/auto-settle-debt";
import type { Transaction } from "@/types/transaction";
import type { Account } from "@/types/account";
import type { Pocket } from "@/types/pocket";
import type { Category } from "@/types/category";
import { cn } from "@/lib/utils";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";
import { useAppContextStore } from "@/stores/app-context-store";
import { useTransactionPanelStore } from "@/stores/transaction-panel-store";

import { isTechnicalTransaction } from "@/features/transactions/lib/technical-transactions";
import { isPersonalMovementEditable, isPersonalMovementDeletable } from "@/features/transactions/lib/personal-movement-mutability";
import { useHouseholdData } from "@/features/household/hooks/use-household-data";
import { Pencil, MoreVertical, Archive, X, Check } from "lucide-react";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { useCreateCategory } from "@/features/categories/hooks/use-create-category";
import {
  resolveCategoryIcon,
  DEFAULT_EXPENSE_COLOR,
  DEFAULT_INCOME_COLOR,
} from "@/lib/categories/category-icons";
import { CategoryIconColorPicker } from "@/components/finance/category-icon-color-picker";
import { updateCategory } from "@/features/categories/services/update-category";
import { archiveCategory } from "@/features/categories/services/archive-category";
import { adjustAccountBalance } from "@/features/accounts/services/adjust-account-balance";
import { formatCurrencyCop } from "@/lib/format/currency";
import { isQaResetToolAvailable } from "@/features/qa-reset/lib/qa-reset-availability";
import { QaResetConfirmDialog } from "@/features/qa-reset/components/qa-reset-confirm-dialog";
import { SettingsLayout } from "@/components/layout/settings-layout";
import {
  SettingsPreferencesCard,
  SettingsOrganizationCard,
  SettingsFooter,
} from "@/components/finance/settings-blocks";

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
  householdEvents?: HouseholdEvent[];
  householdEventShares?: HouseholdEventShare[];
  householdCategories?: HouseholdCategory[];
  memberProfiles?: Record<string, HouseholdMemberProfile>;
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
  userPhotoURL?: string | null;
  masked: boolean;
  notificationsEnabled: boolean;
  onToggleMasked: () => void;
  onToggleNotifications: () => void;
  onLogout: () => Promise<void> | void;
};

export const groupRowsByDateLabel = (rows: ReturnType<typeof buildPersonalMovementRows>) => {
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
  const isEditable = isPersonalMovementEditable(transaction);
  const isDeletable = isPersonalMovementDeletable(transaction);

  if (!isEditable && !isDeletable) {
    return null;
  }

  const dropdownItems = [];
  
  if (isEditable) {
    dropdownItems.push({
      label: "Editar",
      onClick: () => onEditMovement(transaction),
    });
  }
  
  if (isDeletable) {
    dropdownItems.push({
      label: "Eliminar",
      onClick: () => onDeleteMovement(transaction),
      variant: "destructive" as const,
    });
  }

  return <FinanceDropdown items={dropdownItems} align="right" />;
};

export const SectionLink = ({
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



export const MonthlyMetricPanel = ({
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

/**
 * Nombre visible de un miembro del hogar sin exponer datos privados: solo
 * "Tú" o el displayName público (paridad Android: identidad mínima segura).
 */
const resolveHouseholdMemberName = (
  userId: string,
  currentUid: string | null,
  memberProfiles: Record<string, HouseholdMemberProfile>,
): string => {
  if (userId === currentUid) return "Tú";
  return memberProfiles[userId]?.displayName || "Otro miembro";
};

export function HomeView({
  data,
  totalBalance,
  totalNoPropioPendiente,
  dineroPropio,
  masked,
  householdDebts,
  householdName,
  householdEvents = [],
  householdEventShares = [],
  householdCategories = [],
  memberProfiles = {},
}: HomeViewProps) {
  // Deudas propias (paridad Android: "Te deben"/"Le debés al hogar" viven en
  // Home Personal, no en Home Hogar). Se leen del mismo resumen ya cargado
  // por useHouseholdData(); no se hace ninguna consulta nueva.
  const { summary: householdSummary } = useHouseholdData();
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState<HouseholdDebt | null>(null);
  const { submit: undoDeclare, isSubmitting: isUndoing, error: undoError } = useUndoDeclaredDebtPayment();
  const isEditingBoard = useUiPreferencesStore((state) => state.isEditingBoard);
  const boardOrder = useUiPreferencesStore((state) => state.boardOrder);
  const hiddenCards = useUiPreferencesStore((state) => state.hiddenCards);
  const setBoardOrder = useUiPreferencesStore((state) => state.setBoardOrder);
  const hideCard = useUiPreferencesStore((state) => state.hideCard);
  const showCard = useUiPreferencesStore((state) => state.showCard);

  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

  // Estados para detalles de categoría y movimientos (WPP-088–090)
  const [selectedCategoryItem, setSelectedCategoryItem] = useState<ExpenseCategoryBreakdownItem | null>(null);
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HouseholdEvent | null>(null);
  const categoryTriggerRef = useRef<HTMLElement | null>(null);

  // G1 — mapa de ownership: panel lazy, sin suscripción permanente.
  const [ownershipPanelOpen, setOwnershipPanelOpen] = useState(false);

  const user = useAuthStore((state) => state.user);
  const ownerId = user?.uid ?? "";
  const openEdit = useTransactionPanelStore((state) => state.openEdit);
  const openDelete = useTransactionPanelStore((state) => state.openDelete);

  const myPendingShares = useMemo(() => {
    if (!householdEventShares || !ownerId) return [];
    return householdEventShares.filter(
      (s) => s.memberUserId === ownerId &&
             (s.status === "pending_completion" || s.status === "pending")
    );
  }, [householdEventShares, ownerId]);

  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);

  const periodTransactions = useMemo(
    () => data.transactions.filter((transaction) => {
      const txDate = transaction.date ?? transaction.createdAt;
      return isSameMonthAndYear(txDate, selectedPeriod);
    }),
    [data.transactions, selectedPeriod],
  );

  const ingresosRealesMes = useMemo(
    () => periodTransactions
      .filter((tx) => tx.type === "income" && tx.countsAsRealIncome !== false)
      .reduce((sum, tx) => sum + tx.amount, 0),
    [periodTransactions],
  );

  const gastosMes = useMemo(
    () => computeNetPersonalExpenses(periodTransactions),
    [periodTransactions],
  );

  const categoryItems = useMemo(
    () => buildExpenseCategoryBreakdown(periodTransactions, data.categories),
    [periodTransactions, data.categories],
  );

  const rows = useMemo(
    () => buildPersonalMovementRows(periodTransactions, data.categories, data.accounts, data.pockets),
    [data.accounts, data.categories, data.pockets, periodTransactions],
  );

  const groupedRecentRows = useMemo(
    () => groupRowsByDateLabel(rows.slice(0, 5)),
    [rows],
  );

  const categoryDetailTransactions = useMemo(() => {
    if (!selectedCategoryItem) return [];
    return periodTransactions.filter(
      (tx) =>
        (isCountableMonthlyExpense(tx) || isIncomingDebtReimbursement(tx)) &&
        tx.categoryId === selectedCategoryItem.categoryId
    );
  }, [periodTransactions, selectedCategoryItem]);

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
        return "Por anotar";
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
            subtitle={`Total gastado en ${formatPeriodLabel(selectedPeriod)}`}
            title="Gastos por categoria"
            variant="default"
          >
            {!categoryItems.length ? (
              <EmptyState title="Sin gastos del mes" description="Aun no hay gastos del mes para agrupar por categoria." />
            ) : (
              <CategoryBreakdownList
                items={categoryItems.slice(0, 5)}
                masked={masked}
                onItemClick={(item) => {
                  categoryTriggerRef.current = document.activeElement as HTMLElement;
                  setSelectedCategoryItem(item);
                }}
              />
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
        if (!myPendingShares.length) return null;
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
            subtitle={householdName ? `Anotá en Personal lo que salió de tu banco · ${householdName}` : "Anotá en Personal lo que salió de tu banco"}
            title="Por anotar"
            variant="default"
          >
            <div className="space-y-3">
              {myPendingShares.slice(0, 4).map((share) => {
                const event = householdEvents.find((e) => e.id === share.eventId);
                const title = event?.title || "Gasto del hogar";
                return (
                  <button
                    key={share.id}
                    type="button"
                    onClick={() => event && setSelectedEvent(event)}
                    className="w-full text-left flex items-center justify-between gap-4 rounded-[24px] border border-white/8 bg-[rgba(20,27,40,0.84)] px-4 py-4 transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-household)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-[var(--font-display)] text-xl font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
                        {title}
                      </p>
                      <p className="text-sm text-[var(--fm-text-muted)]">
                        Anotar
                      </p>
                    </div>
                    <Amount masked={masked} showSign size="md" value={share.amount} variant="pending" />
                  </button>
                );
              })}
            </div>
          </FinanceCard>
        );

      default:
        return null;
    }
  };

  const visibleCards = boardOrder.filter((cardId) => {
    if (cardId === "household" && !myPendingShares.length) {
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
                  <button
                    aria-label="Ver dónde está el dinero no propio"
                    className="space-y-1 pt-4 text-left transition-opacity hover:opacity-80 sm:border-l sm:border-white/8 sm:pl-5 sm:pt-0 cursor-pointer"
                    onClick={() => setOwnershipPanelOpen(true)}
                    type="button"
                  >
                    <p className="text-sm text-[var(--fm-text-muted)]">No propio pendiente</p>
                    <Amount masked={masked} showSign size="md" value={totalNoPropioPendiente} variant="expense" />
                  </button>
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
              const ingresos = ingresosRealesMes;
              const gastos = gastosMes;
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

      {/*
       * Deudas del usuario actual (paridad Android: "Te deben"/"Le debés al
       * hogar" viven en Home Personal, no en Home Hogar). Se activan por una
       * deuda propia aunque el evento origen no tenga share pendiente. Datos
       * estrictamente del usuario actual: solo identidad mínima segura de la
       * contraparte (displayName) y el monto compartido de la deuda — nunca
       * cuenta, banco, saldo ni categoría del otro miembro.
       */}
      {(householdSummary.debtsReceivable.length > 0 || householdSummary.debtsOwed.length > 0) && (
        <section className="grid gap-5 grid-cols-1 lg:grid-cols-2">
          {householdSummary.debtsReceivable.length > 0 && (
            <FinanceCard
              className="border-white/8 bg-[rgba(18,25,39,0.96)]"
              title="Te deben"
              subtitle="Deudas del hogar a tu favor"
              variant="default"
            >
              <div className="space-y-2">
                {householdSummary.debtsReceivable.map((debt) => (
                  <div
                    key={debt.id}
                    className="flex items-center justify-between rounded-[20px] border border-white/8 bg-[rgba(20,27,40,0.84)] px-4 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--fm-warm-paper)]">
                        {resolveHouseholdMemberName(debt.fromUserId, householdSummary.currentUid, householdSummary.memberProfiles)}
                      </p>
                      <p className="text-xs text-[var(--fm-text-muted)]">
                        {debt.status === "payment_declared" ? "Esperando confirmación" : "Pendiente"}
                      </p>
                    </div>
                    <Amount masked={masked} showSign size="md" value={debt.amount} variant="income" />
                  </div>
                ))}
              </div>
            </FinanceCard>
          )}

          {householdSummary.debtsOwed.length > 0 && (
            <FinanceCard
              className="border-white/8 bg-[rgba(18,25,39,0.96)]"
              title="Le debés al hogar"
              subtitle="Por pagar"
              variant="default"
            >
              <div className="space-y-2">
                {householdSummary.debtsOwed.map((debt) => {
                  // household-debt-payment-gate: el deudor solo puede pagar
                  // una deuda pending de un evento advancedByPayer cuando
                  // quien adelantó ya anotó su gasto (misma función pura
                  // compartida con el detalle de evento y el servicio).
                  // gateApplies=false (eachPaysOwn/invitation/evento
                  // ausente) nunca cambia el CTA por esta regla.
                  const debtEvent = householdEvents.find((e) => e.id === debt.eventId) ?? null;
                  const paymentEligibility = resolveDebtPaymentEligibility({
                    debtStatus: debt.status,
                    event: debtEvent,
                    eventShares: householdEventShares,
                  });
                  const isWaitingForPayerAnnotation =
                    paymentEligibility.gateApplies && !paymentEligibility.eligible;
                  const payerId =
                    isWaitingForPayerAnnotation && debtEvent
                      ? resolvePayerUserId({
                          paidByUserId: debtEvent.paidByUserId,
                          createdByUserId: debtEvent.createdByUserId,
                        })
                      : null;
                  const payerName = payerId
                    ? resolveHouseholdMemberName(payerId, householdSummary.currentUid, householdSummary.memberProfiles)
                    : null;

                  return (
                    <div
                      key={debt.id}
                      className="flex flex-col gap-2 rounded-[20px] border border-white/8 bg-[rgba(20,27,40,0.84)] px-4 py-3.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--fm-warm-paper)]">
                            {resolveHouseholdMemberName(debt.toUserId, householdSummary.currentUid, householdSummary.memberProfiles)}
                          </p>
                          <p className="text-xs text-[var(--fm-text-muted)]">
                            {debt.status === "payment_declared" ? "Pago declarado" : "Por pagar"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <Amount masked={masked} showSign size="md" value={debt.amount} variant="expense" />
                          {debt.status === "pending" && isWaitingForPayerAnnotation && (
                            <FinanceChip variant="pending">Esperando anotación</FinanceChip>
                          )}
                          {debt.status === "pending" && !isWaitingForPayerAnnotation && (
                            <FinanceButton
                              type="button"
                              size="sm"
                              tone="filled"
                              onClick={() => setSelectedDebtForPayment(debt)}
                              className="bg-[var(--fm-household)] text-[var(--fm-ink)] hover:bg-[color-mix(in_oklch,var(--fm-household),white_8%)] cursor-pointer"
                            >
                              Pagar
                            </FinanceButton>
                          )}
                          {debt.status === "payment_declared" && (
                            <FinanceButton
                              type="button"
                              size="sm"
                              tone="destructive"
                              variant="ghost"
                              disabled={isUndoing}
                              onClick={() => {
                                if (window.confirm("¿Deshacer la declaración de este pago?")) {
                                  undoDeclare({ debtId: debt.id, ownerId: householdSummary.currentUid! });
                                }
                              }}
                              className="cursor-pointer"
                            >
                              Deshacer
                            </FinanceButton>
                          )}
                        </div>
                      </div>
                      {debt.status === "pending" && isWaitingForPayerAnnotation && (
                        <p className="text-xs text-[var(--fm-pending)]">
                          {buildDebtPaymentBlockedCopy(payerName)}
                        </p>
                      )}
                      {undoError && debt.status === "payment_declared" && (
                        <p className="text-xs text-[var(--fm-expense)]">
                          {undoError}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </FinanceCard>
          )}
        </section>
      )}

      {selectedDebtForPayment && (
        <DeclarePaymentDialog
          open={selectedDebtForPayment !== null}
          onClose={() => setSelectedDebtForPayment(null)}
          debtId={selectedDebtForPayment.id}
          debtAmount={selectedDebtForPayment.amount}
          creditorName={resolveHouseholdMemberName(selectedDebtForPayment.toUserId, householdSummary.currentUid, householdSummary.memberProfiles)}
          currentUid={householdSummary.currentUid ?? ""}
        />
      )}

      <OwnershipDistributionPanel
        open={ownershipPanelOpen}
        onClose={() => setOwnershipPanelOpen(false)}
        ownerId={ownerId}
        masked={masked}
        defaultMode={(totalNoPropioPendiente > 0 ? "not_mine" : "mine") as OwnershipDistributionMode}
      />

      {/* Category detail dialog (WPP-088–090) */}
      <CategoryDetailDialog
        open={!!selectedCategoryItem}
        category={selectedCategoryItem}
        transactions={categoryDetailTransactions}
        accounts={data.accounts}
        masked={masked}
        onClose={() => setSelectedCategoryItem(null)}
        onSelectTransaction={(tx) => {
          setSelectedCategoryItem(null);
          setDetailTransaction(tx);
        }}
        triggerRef={categoryTriggerRef}
      />

      {/* Movement detail dialog inside HomeView */}
      <MovementDetailDialog
        open={!!detailTransaction}
        transaction={detailTransaction}
        accounts={data.accounts}
        pockets={data.pockets}
        categories={data.categories}
        masked={masked}
        ownerId={ownerId}
        onClose={() => setDetailTransaction(null)}
        onEdit={(tx) => {
          setDetailTransaction(null);
          openEdit(tx);
        }}
        onDelete={(tx) => {
          setDetailTransaction(null);
          openDelete(tx);
        }}
        onUpdated={async () => {
          setDetailTransaction(null);
        }}
      />

      {selectedEvent && (
        <HouseholdEventDetailDialog
          open={selectedEvent !== null}
          event={selectedEvent}
          categories={householdCategories}
          eventShares={householdEventShares}
          debts={householdDebts}
          currentUid={ownerId}
          memberProfiles={memberProfiles}
          onClose={() => setSelectedEvent(null)}
        />
      )}
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
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [ownershipFilter, setOwnershipFilter] = useState<"all" | "mine" | "not_mine">("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [pocketFilter, setPocketFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);

  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);
  const user = useAuthStore((state) => state.user);
  const ownerId = user?.uid ?? "";

  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  // WPP-071 — filter by selected period
  const periodTransactions = useMemo(
    () =>
      data.transactions.filter((tx) => {
        const txDate = tx.date ?? tx.createdAt;
        return isSameMonthAndYear(txDate, selectedPeriod);
      }),
    [data.transactions, selectedPeriod],
  );

  const rows = useMemo(
    () => buildPersonalMovementRows(periodTransactions, data.categories, data.accounts, data.pockets),
    [data.accounts, data.categories, data.pockets, periodTransactions],
  );

  // Pockets for the selected account filter
  const filteredPockets = useMemo(() => {
    if (accountFilter === "all") return data.pockets;
    return data.pockets.filter((p) => p.accountId === accountFilter);
  }, [accountFilter, data.pockets]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // WPP-072 — type filter
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      // WA-PER-004 — ownership filter
      if (ownershipFilter === "mine") {
        if (row.isHousehold || !row.countsAsRealIncome) return false;
      } else if (ownershipFilter === "not_mine") {
        if (!row.isHousehold && row.countsAsRealIncome) return false;
      }
      // WPP-073 — account filter
      if (accountFilter !== "all" && row.accountId !== accountFilter) return false;
      // WPP-074 — pocket filter
      if (pocketFilter !== "all" && row.pocketId !== pocketFilter) return false;
      // WPP-075 — category filter
      if (categoryFilter !== "all" && row.categoryId !== categoryFilter) return false;
      // WPP-076 — text search (title + subtitle + metadata), debounced
      if (deferredSearch) {
        const haystack = `${row.title} ${row.subtitle} ${row.metadata}`.toLowerCase();
        if (!haystack.includes(deferredSearch)) return false;
      }
      return true;
    });
  }, [deferredSearch, typeFilter, ownershipFilter, accountFilter, pocketFilter, categoryFilter, rows]);

  const groupedRows = useMemo(() => groupRowsByDateLabel(filteredRows), [filteredRows]);

  const activeFilterCount = [
    typeFilter !== "all",
    ownershipFilter !== "all",
    accountFilter !== "all",
    pocketFilter !== "all",
    categoryFilter !== "all",
    search.trim() !== "",
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setTypeFilter("all");
    setOwnershipFilter("all");
    setAccountFilter("all");
    setPocketFilter("all");
    setCategoryFilter("all");
    setSearch("");
  };

  return (
    <>
      {/* WPP-072–076 Filter bar */}
      {/* WPP-072–076 Filter bar */}
      <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" variant="default">
        {/* Filter toolbar */}
        <div className="flex flex-col xl:flex-row xl:items-center gap-4 xl:gap-5 flex-wrap">
          
          {/* 1. Search */}
          <div className="relative w-full xl:w-56 shrink-0">
            <Search className="pointer-events-none absolute inset-y-0 left-4 my-auto h-4 w-4 text-[var(--fm-text-muted)]" />
            <FinanceTextField
              className="pl-11 h-9"
              containerClassName="mb-0"
              label="Buscar movimiento"
              labelClassName="sr-only"
              placeholder="Buscar movimiento..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {/* 2. Type filter */}
          <div className="flex flex-wrap gap-2 shrink-0 xl:border-l xl:border-white/8 xl:pl-5">
            {[
              ["all", "Todos"],
              ["income", "Ingresos"],
              ["expense", "Gastos"],
              ["transfer", "Transfer."],
            ].map(([value, label]) => {
              const active = typeFilter === value;
              return (
                <FinanceButton
                  key={value}
                  className={active ? "h-9 bg-[var(--fm-surface-dark-alt)] text-[var(--fm-warm-paper)]" : "h-9 text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]"}
                  onClick={() => setTypeFilter(value as typeof typeFilter)}
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

          {/* 3. Ownership filter */}
          <div className="flex flex-wrap items-center gap-2 xl:border-l xl:border-white/8 xl:pl-5 shrink-0">
            <span className="text-[11px] font-semibold text-[var(--fm-text-muted)] uppercase tracking-wider sr-only xl:not-sr-only xl:mr-1">Titularidad:</span>
            <div className="flex flex-wrap gap-2" aria-label="Titularidad">
              {[
                ["all", "Todos"],
                ["mine", "Míos"],
                ["not_mine", "No míos"],
              ].map(([value, label]) => {
                const active = ownershipFilter === value;
                return (
                  <FinanceButton
                    key={value}
                    className={active ? "h-9 bg-[var(--fm-surface-dark-alt)] text-[var(--fm-warm-paper)]" : "h-9 text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]"}
                    onClick={() => setOwnershipFilter(value as typeof ownershipFilter)}
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

          {/* 4. Selects */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 xl:border-l xl:border-white/8 xl:pl-5 shrink-0">
            {/* Account filter */}
            <div className="w-full sm:w-48">
              <IconSelect
                id="filterAccountId"
                value={accountFilter}
                onChange={(val) => {
                  setAccountFilter(val);
                  setPocketFilter("all");
                }}
                className="h-9 rounded-xl border-white/8 bg-[rgba(18,25,39,0.96)] text-xs"
                options={[
                  { id: "all", label: "Todas las cuentas" },
                  ...data.accounts.map((acc) => {
                    const accentColor = acc.color || "#60a5fa";
                    return {
                      id: acc.id,
                      label: acc.name,
                      color: accentColor,
                      icon: (
                        <AccountIcon
                          iconType={(acc.iconType as "generic" | "bank_logo") || "generic"}
                          iconKey={acc.iconKey || "bank"}
                          color={accentColor}
                          size="xs"
                        />
                      ),
                    };
                  })
                ]}
              />
            </div>

            {/* Pocket filter — only when account is selected */}
            {accountFilter !== "all" && filteredPockets.length > 0 && (
              <select
                value={pocketFilter}
                onChange={(e) => setPocketFilter(e.target.value)}
                className="h-9 w-full sm:w-auto rounded-xl border border-white/8 bg-[rgba(18,25,39,0.96)] px-3 text-xs text-[var(--fm-text-soft)] focus:outline-none focus:border-white/20 cursor-pointer"
              >
                <option value="all">Todos los bolsillos</option>
                {filteredPockets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {/* Category filter */}
            {(typeFilter === "all" || typeFilter === "income" || typeFilter === "expense") && (
              <div className="w-full sm:w-48">
                <IconSelect
                  id="filterCategoryId"
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  className="h-9 rounded-xl border-white/8 bg-[rgba(18,25,39,0.96)] text-xs"
                  options={[
                    { id: "all", label: "Todas las categorías" },
                    ...data.categories.map((cat) => {
                      const Icon = resolveCategoryIcon(cat.iconKey ?? "", cat.type);
                      return {
                        id: cat.id,
                        label: cat.name,
                        color: cat.color,
                        icon: <Icon className="h-3.5 w-3.5" />,
                      };
                    })
                  ]}
                />
              </div>
            )}
          </div>

          {/* 5. Clear filter */}
          {activeFilterCount > 0 && (
            <div className="xl:ml-auto w-full xl:w-auto flex justify-end">
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex w-full xl:w-auto shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 h-9 text-xs text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                <span>Limpiar</span>
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--fm-pending)] text-[9px] font-bold text-slate-950">
                  {activeFilterCount}
                </span>
              </button>
            </div>
          )}
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
                    if (!transaction) return null;

                    return (
                      <div
                        key={row.id}
                        className="py-2.5 first:pt-0 last:pb-0 cursor-pointer hover:bg-white/[0.015] rounded-xl transition-colors px-1 -mx-1"
                        onClick={() => setDetailTransaction(transaction)}
                      >
                        <PersonalTransactionRow
                          actionSlot={
                            isTechnicalTransaction(transaction.title) ? null : (
                              <MovementActions onDeleteMovement={onDeleteMovement} onEditMovement={onEditMovement} transaction={transaction} />
                            )
                          }
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

      {/* WPP-078–080 Movement detail dialog */}
      <MovementDetailDialog
        open={!!detailTransaction}
        transaction={detailTransaction}
        accounts={data.accounts}
        pockets={data.pockets}
        categories={data.categories}
        masked={masked}
        ownerId={ownerId}
        onClose={() => setDetailTransaction(null)}
        onEdit={(tx) => {
          setDetailTransaction(null);
          onEditMovement(tx);
        }}
        onDelete={(tx) => {
          setDetailTransaction(null);
          onDeleteMovement(tx);
        }}
        onUpdated={async () => {
          setDetailTransaction(null);
        }}
      />
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
  const [amountValue, setAmountValue] = useState("");
  const [initialOwnership, setInitialOwnership] = useState<"own" | "third_party">("own");

  // G2 — held en Disponible de esta cuenta, leído de forma perezosa al abrir
  // (mismo patrón que el detalle de cuenta / create-transfer-card): decide el
  // tope de cada modo, nunca se "aproxima" sin el snapshot canónico.
  const [occLoading, setOccLoading] = useState(false);
  const [occError, setOccError] = useState<string | null>(null);
  const [heldAvailable, setHeldAvailable] = useState(0);

  const { isSubmitting, error, successMessage, submitPocket, resetFeedback } = useCreatePocket();

  useEffect(() => {
    if (open) {
      setName("");
      setAmountValue("");
      setInitialOwnership("own");
      resetFeedback();
    }
  }, [open, resetFeedback]);

  useEffect(() => {
    if (!open || !account) {
      setOccLoading(false);
      setOccError(null);
      setHeldAvailable(0);
      return;
    }

    let cancelled = false;
    setOccLoading(true);
    setOccError(null);

    readThirdPartyLocationSnapshot(ownerId)
      .then((snapshot) => {
        if (cancelled) return;
        setHeldAvailable(computeThirdPartyAvailability({ accountId: account.id, pocketId: null }, snapshot));
      })
      .catch(() => {
        if (cancelled) return;
        setOccError("No se pudo verificar tu dinero disponible. Intenta nuevamente.");
      })
      .finally(() => {
        if (!cancelled) setOccLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, account, ownerId]);

  if (!account) return null;

  const parsedAmount = Number(amountValue.replace(/[^\d]/g, ""));
  const initialBalance = Number.isFinite(parsedAmount) ? parsedAmount : 0;
  const ownAvailable = account.balance - heldAvailable;
  // G2.1 — el tope nunca puede superar el físico de la cuenta, sin importar
  // el modo (ni "mío" ni "no propio" pueden exceder lo que realmente hay).
  const ownershipCap = initialOwnership === "third_party" ? heldAvailable : ownAvailable;
  const modeCap = Math.min(ownershipCap, account.balance);
  // held > físico es una composición inconsistente: el servicio ya la
  // rechaza, esto solo evita ofrecer un submit que sabemos que va a fallar.
  const compositionInconsistent = heldAvailable > account.balance;
  const exceedsCap = initialBalance > 0 && !occLoading && !occError && !compositionInconsistent && initialBalance > modeCap;

  // G4 — en modo "Mío" el rechazo se explica con la composición completa
  // (físico / retenido / Mi dinero), no solo con un texto corto. En modo
  // "No propio" el techo es otro (el held) y este panel no aplica.
  const ownFundsFeedback = resolveOwnFundsCompositionFeedback({
    physical: account.balance,
    held: heldAvailable,
    amount: initialBalance,
  });
  const showOwnFundsNotice =
    initialOwnership === "own" &&
    initialBalance > 0 &&
    !occLoading &&
    !occError &&
    ownFundsFeedback.kind !== "ok";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (initialBalance > 0 && (occLoading || occError || compositionInconsistent || exceedsCap)) return;

    const success = await submitPocket({
      accountId: account.id,
      ownerId,
      name: name.trim(),
      balance: initialBalance,
      initialOwnership,
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

        <div className="space-y-1.5">
          <FinanceTextField
            label="Monto inicial total"
            placeholder="0"
            inputMode="numeric"
            value={amountValue ? formatCurrencyCop(Number(amountValue)) : ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              setAmountValue(raw);
            }}
            disabled={isSubmitting}
          />
          <p className="text-[11px] text-[var(--fm-text-muted)] pl-1">
            Disponible en cuenta: <span className="font-semibold text-[var(--fm-warm-paper)]">{formatCurrencyCop(account.balance)}</span>.
          </p>
        </div>

        {initialBalance > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]">
              Origen del monto inicial
            </span>
            <div className="grid grid-cols-2 bg-white/[0.02] border border-white/8 p-0.5 rounded-xl h-11 w-full max-w-[280px]">
              <button
                type="button"
                onClick={() => setInitialOwnership("own")}
                className={cn(
                  "rounded-[10px] text-xs font-semibold transition-all cursor-pointer select-none",
                  initialOwnership === "own"
                    ? "bg-[var(--fm-income)] text-slate-950 font-bold shadow-sm"
                    : "text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]"
                )}
                disabled={isSubmitting}
              >
                Mío
              </button>
              <button
                type="button"
                onClick={() => setInitialOwnership("third_party")}
                className={cn(
                  "rounded-[10px] text-xs font-semibold transition-all cursor-pointer select-none",
                  initialOwnership === "third_party"
                    ? "bg-[var(--fm-transfer)] text-slate-950 font-bold shadow-sm"
                    : "text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]"
                )}
                disabled={isSubmitting}
              >
                No propio
              </button>
            </div>

            <p className="text-[11px] leading-relaxed text-[var(--fm-text-muted)] pl-1">
              {occLoading
                ? "Calculando…"
                : occError
                ? occError
                : compositionInconsistent
                ? "Composición inconsistente: no se puede crear el bolsillo hasta revisar el dinero no propio de esta cuenta."
                : initialOwnership === "own"
                ? `Puedes usar hasta ${formatCurrencyCop(ownAvailable)} propios.`
                : `Puedes mover hasta ${formatCurrencyCop(heldAvailable)} no propios.`}
            </p>
            {showOwnFundsNotice ? (
              <OwnFundsCompositionNotice className="mt-1" feedback={ownFundsFeedback} />
            ) : exceedsCap ? (
              <p className="text-[11px] leading-relaxed text-[var(--fm-expense)] pl-1">
                El monto supera lo disponible en este modo.
              </p>
            ) : null}
          </div>
        ) : null}

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
            disabled={
              isSubmitting ||
              !name.trim() ||
              (initialBalance > 0 && (occLoading || !!occError || compositionInconsistent || exceedsCap))
            }
          >
            {isSubmitting ? "Creando..." : "Crear bolsillo"}
          </FinanceButton>
        </div>
      </form>
    </FinanceDialog>
  );
}

export function EditPocketDialog({
  open,
  account,
  pocket,
  onClose,
  onUpdated,
  ownerId,
}: {
  open: boolean;
  account: Account | null;
  pocket: Pocket | null;
  onClose: () => void;
  onUpdated: () => void;
  ownerId: string;
}) {
  const [name, setName] = useState("");
  const { isSubmitting, error, successMessage, submitPocket, resetFeedback } = useUpdatePocket();

  useEffect(() => {
    if (open && pocket) {
      setName(pocket.name);
      resetFeedback();
    }
  }, [open, pocket, resetFeedback]);

  if (!account || !pocket) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const success = await submitPocket({
      accountId: account.id,
      pocketId: pocket.id,
      ownerId,
      name: name.trim(),
    });

    if (success) {
      setTimeout(() => {
        onUpdated();
        onClose();
      }, 1000);
    }
  };

  return (
    <FinanceDialog open={open} title="Editar bolsillo" subtitle={`Modificar bolsillo en ${account.name}`} onClose={onClose}>
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
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </FinanceButton>
        </div>
      </form>
    </FinanceDialog>
  );
}


const COLOR_PRESETS = [
  "#60a5fa", "#a78bfa", "#34d399", "#fb7185", "#e4b363",
  "#4fd1c5", "#f97316", "#94a3b8", "#ec4899", "#84cc16",
];

export function EditAccountDialog({
  open,
  account,
  availableBalance,
  pocketsBalance,
  adjustAvailability,
  ownerId,
  onClose,
  onUpdated,
}: {
  open: boolean;
  account: Account;
  /**
   * Disponible físico real de la cuenta (`accounts/{id}.currentBalance`).
   * Paso 1 (cierre): `account.balance` YA es este mismo Disponible crudo (el
   * store nunca lo sobrescribe con el Total) — este prop se mantiene
   * explícito para que el nombre en el JSX deje sin ambigüedad qué
   * concepto se está mostrando, sin depender de que el caller recuerde
   * que `account.balance` significa Disponible aquí.
   */
  availableBalance: number;
  /** Suma de bolsillos de la cuenta — solo para mostrar "Total actual" en el reajuste (Paso 2, 2.3.1). */
  pocketsBalance: number;
  /** Paso 6 (P1/H2): gate de `adjustAvailable`. Editar datos descriptivos sigue permitido. */
  adjustAvailability: ActionAvailability;
  ownerId: string;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [name, setName] = useState(account.name);
  const [type, setType] = useState<AccountType>((account.type as AccountType) ?? "other");
  const [iconKey, setIconKey] = useState<string | null>(account.iconKey ?? null);
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [color, setColor] = useState(account.color || "#60a5fa");
  const [includeInTotal, setIncludeInTotal] = useState(account.includeInTotal !== false);
  const [adjustValue, setAdjustValue] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSuccess, setAdjustSuccess] = useState(false);
  const [adjustSuccessMessage, setAdjustSuccessMessage] = useState("Saldo reajustado.");
  const { isSubmitting, error, successMessage, submitAccount, resetFeedback } = useUpdateAccount();

  useEffect(() => {
    if (open) {
      setName(account.name);
      setType((account.type as AccountType) ?? "other");
      setIconKey(account.iconKey ?? null);
      setColor(account.color || "#60a5fa");
      setIncludeInTotal(account.includeInTotal !== false);
      setAdjustValue("");
      setIsAdjusting(false);
      setAdjustError(null);
      setAdjustSuccess(false);
      setBrandError(null);
      setTypeSheetOpen(false);
      resetFeedback();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account.id]);

  const secondSelectorOptions =
    type === "bank"           ? BANK_OPTIONS :
    type === "digital_wallet" ? WALLET_OPTIONS :
    type === "savings"        ? SAVINGS_OPTIONS :
    null;

  const secondSelectorLabel =
    type === "bank"           ? "Banco" :
    type === "digital_wallet" ? "Billetera" :
    type === "savings"        ? "Tipo de ahorro" :
    null;

  const requiresBrand = type === "bank" || type === "digital_wallet";

  const handleTypeSelect = (newType: AccountType) => {
    setType(newType);
    setIconKey(null);
    setBrandError(null);
    setTypeSheetOpen(false);
  };

  const handleBrandSelect = (selectedKey: string) => {
    setIconKey(selectedKey);
    setBrandError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (requiresBrand && !iconKey) {
      setBrandError(type === "bank" ? "Selecciona un banco" : "Selecciona una billetera");
      return;
    }

    const finalIconKey = iconKey ?? (type === "cash" ? "cash" : type === "savings" ? "savings" : "other");
    const finalIconType = resolveIconTypeForSelection(type, finalIconKey);

    const ok = await submitAccount({
      ownerId,
      accountId: account.id,
      name,
      type,
      iconType: finalIconType,
      iconKey: finalIconKey,
      color,
      includeInTotal,
    });
    if (ok) {
      await onUpdated();
      onClose();
    }
  };

  const handleAdjust = async () => {
    setAdjustError(null);
    setAdjustSuccess(false);
    if (adjustValue.trim() === "") {
      setAdjustError("Ingresa un saldo válido.");
      return;
    }
    const parsed = Number(adjustValue.replace(/[^\d]/g, ""));
    if (!Number.isFinite(parsed)) {
      setAdjustError("Ingresa un saldo válido.");
      return;
    }
    setIsAdjusting(true);
    try {
      const result = await adjustAccountBalance({ ownerId, accountId: account.id, newAvailableBalance: parsed });
      setAdjustValue("");
      setAdjustSuccessMessage(
        result.adjusted ? "Saldo reajustado." : "El disponible ya estaba en ese valor; no se creó ningún movimiento."
      );
      setAdjustSuccess(true);
      if (result.adjusted) {
        await onUpdated();
      }
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : "No fue posible reajustar el saldo.");
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <>
    <FinanceDialog open={open} title="Editar cuenta" onClose={() => { if (!isSubmitting) onClose(); }}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <FinanceTextField
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mi cuenta"
          required
        />
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--fm-text-muted)] uppercase tracking-wider">Tipo</p>
          <button
            type="button"
            onClick={() => setTypeSheetOpen(true)}
            className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/14 hover:bg-white/[0.04]"
          >
            <span className="text-sm font-medium text-[var(--fm-warm-paper)]">
              {ACCOUNT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "Seleccionar"}
            </span>
            <ChevronRight className="h-5 w-5 text-[var(--fm-text-muted)]" />
          </button>
        </div>

        {secondSelectorOptions !== null ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fm-text-muted)]">
              {secondSelectorLabel ?? "Seleccionar"}
            </p>
            {brandError ? (
              <p className="text-xs text-[var(--fm-expense)]">{brandError}</p>
            ) : null}
            <IconSelect
              id="edit-brand-selector"
              value={iconKey ?? ""}
              onChange={handleBrandSelect}
              placeholder={`Seleccionar ${secondSelectorLabel?.toLowerCase() ?? ""}`}
              options={secondSelectorOptions.map((opt) => ({
                id: opt.iconKey,
                label: opt.label,
                color: color,
                icon: (
                  <AccountIcon
                    iconType={resolveIconTypeForSelection(type, opt.iconKey)}
                    iconKey={opt.iconKey}
                    color={color}
                    size="xs"
                  />
                ),
              }))}
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[var(--fm-text-muted)] uppercase tracking-wider">Color</p>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? "white" : "transparent",
                  transform: color === c ? "scale(1.2)" : "scale(1)",
                }}
              />
            ))}
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className={`h-5 w-9 rounded-full transition-colors relative ${
              includeInTotal ? "bg-[var(--fm-income)]" : "bg-white/10"
            }`}
            onClick={() => setIncludeInTotal((v) => !v)}
          >
            <div
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                includeInTotal ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </div>
          <span className="text-sm text-[var(--fm-text-soft)]">Incluir en el total global</span>
        </label>

        {/* Reajustar Nuevo disponible (WA-PER-003 / Paso 2, 2.3) — NUNCA "reajustar el Total".
            Corrección P1-A: una cuenta cerrada no admite reajuste; el servicio ya es la
            barrera real, esto solo evita ofrecer una acción que el backend rechazaría. */}
        {account.archived ? (
          <div className="space-y-1 rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <p className="text-xs font-semibold text-[var(--fm-text-muted)] uppercase tracking-wider">Reajustar Nuevo disponible</p>
            <p className="text-[11px] text-[var(--fm-text-muted)] leading-relaxed">
              Esta cuenta está cerrada. Reábrela primero para poder reajustar su Disponible.
            </p>
          </div>
        ) : (
          <div className="space-y-2 rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <p className="text-xs font-semibold text-[var(--fm-text-muted)] uppercase tracking-wider">Reajustar Nuevo disponible</p>
            <p className="text-[11px] text-[var(--fm-text-muted)] leading-relaxed">
              Disponible actual:{" "}
              <span className="font-semibold text-[var(--fm-warm-paper)]">{formatCurrencyCop(availableBalance)}</span>
              {pocketsBalance > 0 ? (
                <>
                  {" "}· Total actual (con bolsillos):{" "}
                  <span className="font-semibold text-[var(--fm-warm-paper)]">{formatCurrencyCop(availableBalance + pocketsBalance)}</span>
                </>
              ) : null}
              . Ingresá el Nuevo disponible; se creará un movimiento de ajuste en tu historial.
              {pocketsBalance > 0 ? " Este reajuste no modifica tus bolsillos." : null}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={adjustValue ? formatCurrencyCop(Number(adjustValue)) : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setAdjustValue(raw);
                  setAdjustError(null);
                  setAdjustSuccess(false);
                }}
                placeholder="Nuevo disponible"
                className="h-10 flex-1 rounded-xl border border-white/8 bg-white/[0.02] px-3 text-sm text-[var(--fm-warm-paper)] outline-none focus:border-[var(--fm-pending)]/50"
              />
              <FinanceButton
                type="button"
                tone="outlined"
                variant="outline"
                aria-describedby={adjustAvailability.reason ? "adjust-blocked-reason" : undefined}
                onClick={() => runIfAllowed(adjustAvailability, () => void handleAdjust())}
                disabled={isAdjusting || !adjustValue.trim() || !adjustAvailability.enabled}
              >
                {isAdjusting ? "Ajustando..." : "Reajustar"}
              </FinanceButton>
            </div>
            {/* P1/H2 — motivo visible del bloqueo, asociado al botón. */}
            {adjustAvailability.reason ? (
              <p id="adjust-blocked-reason" className="text-[11px] leading-snug text-[var(--fm-text-muted)]">
                {adjustAvailability.reason}
              </p>
            ) : null}
            {adjustError && <p className="text-xs text-[var(--fm-expense)]">{adjustError}</p>}
            {adjustSuccess && <p className="text-xs text-[var(--fm-income)]">{adjustSuccessMessage}</p>}
          </div>
        )}

        {error && <p className="text-xs text-[var(--fm-expense)]">{error}</p>}
        {successMessage && <p className="text-xs text-[var(--fm-income)]">{successMessage}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <FinanceButton type="button" tone="outlined" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </FinanceButton>
          <FinanceButton type="submit" tone="filled" disabled={isSubmitting || (requiresBrand && !iconKey)}>
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </FinanceButton>
        </div>
      </form>
    </FinanceDialog>

    <FinanceDialog
      open={typeSheetOpen}
      onClose={() => setTypeSheetOpen(false)}
      title="Selecciona un tipo de cuenta"
    >
      <div className="mt-4 flex flex-col gap-2">
        {ACCOUNT_TYPE_OPTIONS.map((opt) => {
          const isActive = type === opt.value;
          const accentColor = TYPE_COLORS[opt.value];
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleTypeSelect(opt.value)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all",
                !isActive && "border-white/8 bg-white/[0.02] hover:border-white/14 hover:bg-white/[0.04]"
              )}
              style={
                isActive
                  ? {
                      borderColor: accentColor,
                      backgroundColor: `${accentColor}15`,
                      boxShadow: `0 0 0 1px ${accentColor}40`,
                    }
                  : undefined
              }
            >
              <div
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border"
                style={{
                  backgroundColor: `${accentColor}22`,
                  borderColor: `${accentColor}44`,
                  color: accentColor,
                }}
              >
                <AccountIcon
                  iconType="generic"
                  iconKey={opt.value === "digital_wallet" ? "wallet" : opt.value}
                  color={accentColor}
                  size="xs"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--fm-warm-paper)]">{opt.label}</p>
                <p className="text-xs text-[var(--fm-text-muted)]">{opt.description}</p>
              </div>
              {isActive ? (
                <Check className="h-5 w-5 shrink-0" style={{ color: accentColor }} />
              ) : null}
            </button>
          );
        })}
      </div>
    </FinanceDialog>
    </>
  );
}

export function AccountsView({ data, masked, refresh }: AccountsViewProps) {
  // El detalle de cuenta ya no es un modal montado desde aquí: vive en
  // `/accounts/[accountId]` (ver `AccountDetailView`). Esta vista solo navega.
  const router = useRouter();
  const [selectedAccountForNewPocket, setSelectedAccountForNewPocket] = useState<Account | null>(null);
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  // Detalle de bolsillo abierto desde un tile (guarda el id de la cuenta padre
  // para poder re-resolver bolsillo y cuenta desde `data` tras cada refresh).
  const [selectedPocket, setSelectedPocket] = useState<{ accountId: string; pocketId: string } | null>(null);
  const [pocketPendingEdit, setPocketPendingEdit] = useState<Pocket | null>(null);
  const user = useAuthStore((state) => state.user);
  const ownerId = user?.uid ?? "";

  const pocketDetailAccount = useMemo(() => {
    if (!selectedPocket) return null;
    return data.accounts.find((a) => a.id === selectedPocket.accountId) ?? null;
  }, [data.accounts, selectedPocket]);

  const pocketDetailAccountPockets = useMemo(() => {
    if (!pocketDetailAccount) return [];
    return data.pockets.filter((p) => p.accountId === pocketDetailAccount.id);
  }, [data.pockets, pocketDetailAccount]);

  const pocketDetailPocket = useMemo(() => {
    if (!selectedPocket) return null;
    return pocketDetailAccountPockets.find((p) => p.id === selectedPocket.pocketId) ?? null;
  }, [pocketDetailAccountPockets, selectedPocket]);

  const editPocketAccount = useMemo(() => {
    if (!pocketPendingEdit) return null;
    return data.accounts.find((a) => a.id === pocketPendingEdit.accountId) ?? null;
  }, [data.accounts, pocketPendingEdit]);

  // Paso 1 (cierre): el total del hero es la suma de Totales físicos por
  // cuenta (Disponible + sus bolsillos), nunca la suma cruda de
  // `account.balance` (que es Disponible, no Total).
  const accountsTotalBalance = useMemo(() => {
    return data.accounts.reduce((sum, account) => {
      const accountPockets = data.pockets.filter((p) => p.accountId === account.id);
      const { totalBalance } = calculateAccountPhysicalBalances(account.balance, accountPockets);
      return sum + totalBalance;
    }, 0);
  }, [data.accounts, data.pockets]);

  return (
    <>
      {/*
        Hero abierto: el número más importante de la pantalla se separa del
        fondo por superficie y espacio, no por un contorno fuerte. El patrón de
        card queda reservado para las cuentas.
      */}
      <section className="rounded-[var(--fm-radius-hero)] bg-[rgba(255,255,255,0.022)] px-6 py-7 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2.5">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--fm-text-soft)]">
              Total entre tus cuentas
            </p>
            <Amount masked={masked} showSign={false} size="hero" value={accountsTotalBalance} />
          </div>
          {/* Contexto pasivo, no CTA: sin hover, sin chevron, sin acción. */}
          <span className="self-start rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-[var(--fm-text-muted)] select-none">
            Vista personal activa
          </span>
        </div>
      </section>

      {/* `items-start`: cada cuenta responde a su propio contenido — una con
          bolsillos expandidos no obliga a la vecina a estirarse. */}
      <section className="grid items-start gap-5 xl:grid-cols-2">
        {data.accounts.map((account) => (
          <AccountPocketCard
            key={account.id}
            account={account}
            variant="accounts-page"
            masked={masked}
            pockets={data.pockets.filter((pocket) => pocket.accountId === account.id)}
            onCardClick={() => router.push(`/accounts/${account.id}`)}
            onAddPocketClick={() => setSelectedAccountForNewPocket(account)}
            onPocketClick={(pocket) => setSelectedPocket({ accountId: account.id, pocketId: pocket.id })}
          />
        ))}

        <AddAccountCard onClick={() => setNewAccountOpen(true)} />
      </section>

      {data.archivedAccounts.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--fm-text-soft)]">Cuentas cerradas</p>
            <FinanceChip className="normal-case tracking-normal px-2 py-0.5 text-[10px]" variant="neutral">
              {data.archivedAccounts.length}
            </FinanceChip>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {data.archivedAccounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => router.push(`/accounts/${account.id}`)}
                className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[rgba(18,25,39,0.7)] px-4 py-3 text-left opacity-70 transition-opacity hover:opacity-100"
              >
                <AccountIcon
                  iconType={(account.iconType as "generic" | "bank_logo") || "generic"}
                  iconKey={account.iconKey || "bank"}
                  color={account.color || "#60a5fa"}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--fm-text-soft)]">{account.name}</p>
                  <p className="text-[11px] text-[var(--fm-text-muted)]">Cerrada · toca para reabrir o eliminar</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

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

      {/* Detalle de bolsillo (click en un tile). La edición se delega al
          `EditPocketDialog` que ya vive en esta vista, para no duplicarlo. */}
      <PocketDetailDialog
        open={!!pocketDetailPocket && !pocketPendingEdit}
        account={pocketDetailAccount}
        pocket={pocketDetailPocket}
        pockets={pocketDetailAccountPockets}
        masked={masked}
        ownerId={ownerId}
        onClose={() => setSelectedPocket(null)}
        onEdit={(pocket) => setPocketPendingEdit(pocket)}
        onDeleted={async () => {
          setSelectedPocket(null);
          if (refresh) {
            await refresh();
          }
        }}
      />

      {/*
        Política de retorno post-edición (A): cerrar la edición — por cancelar o
        por guardar — NO limpia `selectedPocket`, así que se vuelve al detalle
        del bolsillo, ya con el nombre actualizado. El detalle se re-resuelve
        desde `data`, no desde una copia congelada. Salir del flujo es un solo
        Esc más. Si en QA llegara a sentirse apilado, la alternativa es B:
        `setSelectedPocket(null)` en ambos handlers.
      */}
      <EditPocketDialog
        open={!!pocketPendingEdit}
        account={editPocketAccount}
        pocket={pocketPendingEdit}
        ownerId={ownerId}
        onClose={() => setPocketPendingEdit(null)}
        onUpdated={async () => {
          setPocketPendingEdit(null);
          if (refresh) {
            await refresh();
          }
        }}
      />

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

// ─── Edit Category Dialog ────────────────────────────────────────────────────

interface EditCategoryDialogProps {
  open: boolean;
  onClose: () => void;
  category: Category & { type: "expense" | "income" };
  onSaved: () => Promise<void>;
}

export function EditCategoryDialog({ open, onClose, category, onSaved }: EditCategoryDialogProps) {
  const kind = category.type;
  const [name, setName] = useState(category.name);
  const [selectedColor, setSelectedColor] = useState(category.color || (kind === "income" ? DEFAULT_INCOME_COLOR : DEFAULT_EXPENSE_COLOR));
  const [selectedIconKey, setSelectedIconKey] = useState(category.iconKey || (kind === "income" ? "salary" : "food"));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(category.name);
      setSelectedColor(category.color || (kind === "income" ? DEFAULT_INCOME_COLOR : DEFAULT_EXPENSE_COLOR));
      setSelectedIconKey(category.iconKey || (kind === "income" ? "salary" : "food"));
      setError(null);
    }
  }, [open, category, kind]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await updateCategory({
        ownerId: category.ownerId,
        categoryId: category.id,
        name: name.trim(),
        kind,
        iconKey: selectedIconKey,
        color: selectedColor,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const SelectedIcon = resolveCategoryIcon(selectedIconKey, kind);

  return (
    <FinanceDialog open={open} title="Editar categoría" onClose={onClose} size="wide">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-[var(--fm-expense)]">{error}</div>
        )}

        <div className="space-y-2">
          <label htmlFor="edit-category-name" className="text-[14px] font-medium text-[var(--fm-warm-paper)]">
            Nombre
          </label>
          <div className="relative">
            <input
              id="edit-category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
              placeholder={kind === "income" ? "Ej. Sueldo, Freelance" : "Ej. Restaurantes, Supermercado"}
              className="h-11 w-full rounded-[var(--fm-radius-input)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] py-2 pl-3 pr-12 text-[14px] text-[var(--fm-warm-paper)] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)] disabled:opacity-60"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border"
              style={{ backgroundColor: `${selectedColor}22`, borderColor: `${selectedColor}55`, color: selectedColor }}
            >
              <SelectedIcon className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

          <CategoryIconColorPicker
            kind={kind}
            selectedIconKey={selectedIconKey}
            selectedColor={selectedColor}
            onSelectIcon={setSelectedIconKey}
            onSelectColor={setSelectedColor}
          />

        <div className="flex justify-end gap-3 border-t border-white/6 pt-4">
          <FinanceButton type="button" onClick={onClose} variant="ghost" tone="text" disabled={isSubmitting}>
            Cancelar
          </FinanceButton>
          <FinanceButton type="submit" variant="default" tone="filled" disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </FinanceButton>
        </div>
      </form>
    </FinanceDialog>
  );
}

// ─── Create Category Dialog ──────────────────────────────────────────────────

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
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(kind === "income" ? DEFAULT_INCOME_COLOR : DEFAULT_EXPENSE_COLOR);
  const [selectedIconKey, setSelectedIconKey] = useState(kind === "income" ? "salary" : "food");

  // reset state on open
  useEffect(() => {
    if (open) {
      setName("");
      setSelectedColor(kind === "income" ? DEFAULT_INCOME_COLOR : DEFAULT_EXPENSE_COLOR);
      setSelectedIconKey(kind === "income" ? "salary" : "food");
    }
  }, [open, kind]);

  const { isSubmitting, error, successMessage, submitCategory } = useCreateCategory();

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

  const SelectedIcon = resolveCategoryIcon(selectedIconKey, kind);

  return (
    <FinanceDialog
      open={open}
      title="Crear categoría"
      subtitle={`Añadir nueva categoría de ${kind === "income" ? "ingreso" : "gasto"}`}
      onClose={onClose}
      size="wide"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
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

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label htmlFor="create-category-name" className="text-[14px] font-medium text-[var(--fm-warm-paper)]">
              Nombre
            </label>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Obligatorio
            </span>
          </div>
          <div className="relative">
            <input
              id="create-category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
              placeholder={kind === "income" ? "Ej. Sueldo, Freelance" : "Ej. Restaurantes, Supermercado"}
              className="h-11 w-full rounded-[var(--fm-radius-input)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] py-2 pl-3 pr-12 text-[14px] text-[var(--fm-warm-paper)] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)] disabled:opacity-60"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border"
              style={{ backgroundColor: `${selectedColor}22`, borderColor: `${selectedColor}55`, color: selectedColor }}
            >
              <SelectedIcon className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        <CategoryIconColorPicker
          kind={kind}
          selectedIconKey={selectedIconKey}
          selectedColor={selectedColor}
          onSelectIcon={setSelectedIconKey}
          onSelectColor={setSelectedColor}
        />

        <div className="flex justify-end gap-3 border-t border-white/6 pt-4">
          <FinanceButton type="button" onClick={onClose} variant="ghost" tone="text" disabled={isSubmitting}>
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Estados para detalles de categoría y movimientos (WPP-088–090)
  const [selectedCategoryItem, setSelectedCategoryItem] = useState<ExpenseCategoryBreakdownItem | null>(null);
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);
  const categoryTriggerRef = useRef<HTMLElement | null>(null);

  const openEdit = useTransactionPanelStore((state) => state.openEdit);
  const openDelete = useTransactionPanelStore((state) => state.openDelete);

  // Parse ?mode=manage safely on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "manage") {
        setViewMode("manage");
      }
    }
  }, []);

  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);
  const filteredTransactions = useMemo(() => {
    return data.transactions.filter((transaction) => {
      const movementDate = transaction.date ?? transaction.createdAt;
      if (!movementDate) {
        return false;
      }

      if (range === "month") {
        return isSameMonthAndYear(movementDate, selectedPeriod);
      }

      return movementDate.getFullYear() === selectedPeriod.year;
    });
  }, [data.transactions, range, selectedPeriod]);

  const items = useMemo(
    () => buildExpenseCategoryBreakdown(filteredTransactions, data.categories),
    [data.categories, filteredTransactions],
  );
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  const categoryDetailTransactions = useMemo(() => {
    if (!selectedCategoryItem) return [];
    return filteredTransactions.filter(
      (tx) =>
        (isCountableMonthlyExpense(tx) || isIncomingDebtReimbursement(tx)) &&
        tx.categoryId === selectedCategoryItem.categoryId
    );
  }, [filteredTransactions, selectedCategoryItem]);

  // Gestión: solo activas por kind. Las archivadas se mantienen en el store para resolución histórica.
  const filteredCategories = useMemo(() => {
    return data.categories.filter((category) => category.type === activeKind && !category.archived);
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
              <CategoryBreakdownList
                items={items}
                masked={masked}
                onItemClick={(item) => {
                  categoryTriggerRef.current = document.activeElement as HTMLElement;
                  setSelectedCategoryItem(item);
                }}
              />
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
                    const isMenuOpen = openMenuId === category.id;
                    const isConfirmingArchive = archivingId === category.id;
                    return (
                      <div key={category.id} className="transition-colors">
                        <div className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.02]">
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
                            <span className="font-semibold text-sm text-[var(--fm-warm-paper)]">{category.name}</span>
                          </div>
                          <div className="relative">
                            <button
                              className="p-2 rounded-xl text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] hover:bg-white/5 transition-all outline-none"
                              aria-label="Opciones de categoría"
                              onClick={() => setOpenMenuId(isMenuOpen ? null : category.id)}
                            >
                              <MoreVertical className="h-4.5 w-4.5" />
                            </button>
                            {isMenuOpen && (
                              <div className="absolute right-0 top-9 z-20 w-40 rounded-xl border border-white/10 bg-[rgba(18,25,39,0.98)] shadow-xl py-1">
                                <button
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--fm-warm-paper)] hover:bg-white/5 transition-colors"
                                  onClick={() => { setEditingCategory(category); setOpenMenuId(null); }}
                                >
                                  <Pencil className="h-3.5 w-3.5 text-[var(--fm-text-muted)]" />
                                  Editar
                                </button>
                                <button
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--fm-expense)] hover:bg-white/5 transition-colors"
                                  onClick={() => { setArchivingId(category.id); setOpenMenuId(null); }}
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                  Archivar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {isConfirmingArchive && (
                          <div className="mx-4 mb-3 rounded-xl border border-[var(--fm-expense)]/20 bg-[rgba(251,113,133,0.06)] px-4 py-3 flex items-center justify-between gap-3">
                            <span className="text-xs text-[var(--fm-text-soft)]">¿Archivar <strong>{category.name}</strong>? No aparecerá en formularios nuevos.</span>
                            <div className="flex gap-2 shrink-0">
                              <button
                                className="text-xs text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] px-2 py-1 rounded-lg transition-colors"
                                onClick={() => setArchivingId(null)}
                                disabled={isArchiving}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="text-xs text-[var(--fm-expense)] font-semibold px-2.5 py-1 rounded-lg border border-[var(--fm-expense)]/20 hover:bg-[rgba(251,113,133,0.1)] transition-colors disabled:opacity-50"
                                disabled={isArchiving}
                                onClick={async () => {
                                  setIsArchiving(true);
                                  try {
                                    await archiveCategory(category.id);
                                    setArchivingId(null);
                                    if (refresh) await refresh();
                                  } catch {
                                    // silently ignore — user can retry
                                  } finally {
                                    setIsArchiving(false);
                                  }
                                }}
                              >
                                {isArchiving ? "..." : "Archivar"}
                              </button>
                            </div>
                          </div>
                        )}
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
            if (refresh) await refresh();
          }}
        />
      )}

      {/* Edit Modal */}
      {editingCategory && (editingCategory.type === "expense" || editingCategory.type === "income") && (
        <EditCategoryDialog
          open={Boolean(editingCategory)}
          onClose={() => setEditingCategory(null)}
          category={editingCategory as Category & { type: "expense" | "income" }}
          onSaved={async () => {
            if (refresh) await refresh();
          }}
        />
      )}

      {/* Category detail dialog (WPP-088–090) */}
      <CategoryDetailDialog
        open={!!selectedCategoryItem}
        category={selectedCategoryItem}
        transactions={categoryDetailTransactions}
        accounts={data.accounts}
        masked={masked}
        onClose={() => setSelectedCategoryItem(null)}
        onSelectTransaction={(tx) => {
          setSelectedCategoryItem(null);
          setDetailTransaction(tx);
        }}
        triggerRef={categoryTriggerRef}
      />

      {/* Movement detail dialog inside CategoriesView */}
      <MovementDetailDialog
        open={!!detailTransaction}
        transaction={detailTransaction}
        accounts={data.accounts}
        pockets={data.pockets}
        categories={data.categories}
        masked={masked}
        ownerId={ownerId}
        onClose={() => setDetailTransaction(null)}
        onEdit={(tx) => {
          setDetailTransaction(null);
          openEdit(tx);
        }}
        onDelete={(tx) => {
          setDetailTransaction(null);
          openDelete(tx);
        }}
        onUpdated={async () => {
          setDetailTransaction(null);
        }}
      />
    </div>
  );
}

export function SettingsView({
  userName,
  userEmail,
  userPhotoURL,
  masked,
  notificationsEnabled,
  onToggleMasked,
  onToggleNotifications,
  onLogout,
}: SettingsViewProps) {
  const { data: householdData } = useHouseholdData();
  const currentUid = useAuthStore((state) => state.user?.uid ?? "");
  const [isQaResetDialogOpen, setIsQaResetDialogOpen] = useState(false);
  const qaResetToolAvailable = isQaResetToolAvailable();

  const unifiedHero = (
    <section className="rounded-[var(--fm-radius-card-medium)] border border-white/8 bg-[rgba(18,25,39,0.96)] px-6 py-6 sm:px-8 sm:py-7">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-stretch lg:gap-10">
        {/* Cuenta personal */}
        <div className="flex min-w-0 items-center gap-5 lg:self-center">
          <ProfileAvatar
            name={userName}
            photoURL={userPhotoURL}
            size="xl"
            decorative
            className="bg-[linear-gradient(180deg,rgba(85,104,138,0.92),rgba(41,53,80,0.92))] font-[var(--font-display)] text-[var(--fm-warm-paper)] ring-1 ring-white/10"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--fm-text-soft)]">
              Tu cuenta
            </p>
            <p className="mt-1 truncate font-[var(--font-display)] text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[var(--fm-warm-paper)]">
              {userName || "Usuario"}
            </p>
            <p className="mt-0.5 truncate text-sm text-[var(--fm-text-muted)]">
              {userEmail || "Cargando perfil..."}
            </p>
            <p className="mt-3 text-xs text-[var(--fm-text-muted)]">
              Moneda · <span className="font-semibold text-[var(--fm-warm-paper)]">COP</span>
            </p>
          </div>
        </div>

        {/* Hogar M+: Ciclo de vida unificado (DEC-073...080) */}
        <div className="min-w-0 border-t border-white/6 pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <MplusHouseholdLifecycleCard
            currentUid={currentUid}
            userName={userName}
            userPhotoURL={userPhotoURL}
          />
        </div>
      </div>
    </section>
  );

  return (
    <>
      <SettingsLayout
        profileBlock={unifiedHero}
        preferencesBlock={
          <SettingsPreferencesCard
            masked={masked}
            notificationsEnabled={notificationsEnabled}
            onToggleMasked={onToggleMasked}
            onToggleNotifications={onToggleNotifications}
          />
        }
        organizationBlock={<SettingsOrganizationCard />}
        footerBlock={
          <SettingsFooter
            qaResetToolAvailable={qaResetToolAvailable}
            onOpenQaReset={() => setIsQaResetDialogOpen(true)}
            onLogout={onLogout}
          />
        }
      />
      {qaResetToolAvailable && (
        <QaResetConfirmDialog
          open={isQaResetDialogOpen}
          onClose={() => setIsQaResetDialogOpen(false)}
          uid={currentUid}
          household={householdData?.household ?? null}
        />
      )}
    </>
  );
}
