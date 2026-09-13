"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  CreditCard,
  Edit2,
  Plus,
  Search,
  Tag,
  User,
  X,
} from "lucide-react";

import { useSearchParams } from "next/navigation";

import { HouseholdCategoryDialog } from "@/features/household/components/household-category-dialog";
import { correctPartnerMovementCategory } from "@/features/household/services/read-household-movements";
import {
  buildHouseholdTimeline,
  groupHouseholdTimelineByDay,
} from "@/features/household/lib/household-dashboard-view-model";
import type { HouseholdTimelineRow } from "@/features/household/lib/household-dashboard-view-model";
import { HouseholdAmount } from "@/features/household/components/ui/household-amount";
import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdCard } from "@/features/household/components/ui/household-card";
import { HouseholdDialog } from "@/features/household/components/ui/household-dialog";
import { HouseholdEmptyState } from "@/features/household/components/ui/household-empty-state";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { formatDateEs } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import type {
  MplusHousehold,
  MplusHouseholdExpense,
  MplusHouseholdExpenseCategory,
  MplusHouseholdMember,
  MplusMemberAccountLabel,
  MplusMemberCategoryLabel,
  MplusMovement,
} from "@/lib/mplus/models";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useMplusComposerStore } from "@/stores/mplus-composer-store";
import { formatCurrencyCop } from "@/lib/format/currency";
import {
  restoreHouseholdExpense,
  deleteHouseholdExpensePermanently,
  updateHouseholdExpense,
  type HouseholdExpenseDraft,
} from "@/features/household/services/household-expense-mutations";
import { RotateCcw, Trash2 } from "lucide-react";

type Props = {
  household: MplusHousehold;
  members: MplusHouseholdMember[];
  categories: MplusHouseholdExpenseCategory[];
  categoryLabels: MplusMemberCategoryLabel[];
  accountLabels: MplusMemberAccountLabel[];
  movements: MplusMovement[];
  currentUid: string;
};



export function MplusHouseholdMovementsView({
  household,
  members,
  categories,
  categoryLabels,
  accountLabels,
  movements,
  currentUid,
}: Props) {
  const searchParams = useSearchParams();
  const initialCategory =
    searchParams?.get("categoryId") ||
    searchParams?.get("category") ||
    (searchParams?.get("unclassified") === "true" ? "unclassified" : "all");
  const initialType = searchParams?.get("type") || "all";
  const initialMember = searchParams?.get("memberId") || "all";
  const initialAccount = searchParams?.get("accountId") || "all";

  const applyCommittedMovement = useMplusHouseholdStore(
    (state) => state.applyCommittedMovement,
  );
  const applyCommittedMapping = useMplusHouseholdStore(
    (state) => state.applyCommittedMapping,
  );
  const applyCommittedCategory = useMplusHouseholdStore(
    (state) => state.applyCommittedCategory,
  );
  const applyCommittedHouseholdExpense = useMplusHouseholdStore(
    (state) => state.applyCommittedHouseholdExpense,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>(initialMember);
  const [selectedType, setSelectedType] = useState<string>(initialType);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCategory);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccount);

  const [selectedMovement, setSelectedMovement] = useState<MplusMovement | null>(null);
  const [listMode, setListMode] = useState<"active" | "trash">("active");
  const [selectedHouseholdExpense, setSelectedHouseholdExpense] = useState<MplusHouseholdExpense | null>(null);
  const [reclassifyingExpense, setReclassifyingExpense] = useState<MplusHouseholdExpense | null>(null);
  const [pendingDeleteExpense, setPendingDeleteExpense] = useState<MplusHouseholdExpense | null>(null);
  const [isTrashActionSubmitting, setIsTrashActionSubmitting] = useState(false);
  const [trashFeedbackError, setTrashFeedbackError] = useState<string | null>(null);

  const householdExpenses = useMplusHouseholdStore((state) => state.expenses);
  const trashedExpenses = useMplusHouseholdStore((state) => state.trashedExpenses);
  const openEditHouseholdExpense = useMplusComposerStore((state) => state.openEditHouseholdExpense);
  const openTrashHouseholdExpense = useMplusComposerStore((state) => state.openTrashHouseholdExpense);

  const hasLeftMember = useMemo(() => members.some((m) => m.state === "left"), [members]);

  const [isReclassifying, setIsReclassifying] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [targetCategoryId, setTargetCategoryId] = useState("");
  const [isSubmittingReclass, setIsSubmittingReclass] = useState(false);
  const [reclassError, setReclassError] = useState<string | null>(null);

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.userId, m])),
    [members],
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const categoryLabelMap = useMemo(
    () => new Map(categoryLabels.map((l) => [l.id, l])),
    [categoryLabels],
  );

  const accountLabelMap = useMemo(
    () => new Map(accountLabels.map((l) => [l.id, l])),
    [accountLabels],
  );

  const activeExpenseCategories = useMemo(
    () => categories.filter((c) => c.state === "active"),
    [categories],
  );

  // Cronología unificada: movimientos legacy + gastos originados en Hogar
  const timelineRows = useMemo(() =>
    buildHouseholdTimeline(movements, householdExpenses, {
      search: searchQuery,
      type: selectedType as "all" | "income" | "expense",
      memberId: selectedMemberId,
      categoryId: selectedCategoryId,
      accountId: selectedAccountId,
    }),
    [
      movements,
      householdExpenses,
      searchQuery,
      selectedType,
      selectedMemberId,
      selectedCategoryId,
      selectedAccountId,
    ],
  );

  // Agrupación por día en orden cronológico descendente
  const groupedTimeline = useMemo(
    () => groupHouseholdTimelineByDay(timelineRows),
    [timelineRows],
  );

  const activeFilterCount = [
    selectedType !== "all",
    selectedMemberId !== "all",
    selectedCategoryId !== "all",
    selectedAccountId !== "all",
    searchQuery.trim() !== "",
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedMemberId("all");
    setSelectedType("all");
    setSelectedCategoryId("all");
    setSelectedAccountId("all");
  };

  const handleStartReclassify = (movement: MplusMovement) => {
    setSelectedMovement(movement);
    setReclassifyingExpense(null);
    setTargetCategoryId(movement.householdCategoryId ?? "");
    setReclassError(null);
    setIsReclassifying(true);
  };

  const handleStartReclassifyExpense = (expense: MplusHouseholdExpense) => {
    setReclassifyingExpense(expense);
    setSelectedMovement(null);
    setTargetCategoryId(expense.householdCategoryId ?? "");
    setReclassError(null);
    setIsReclassifying(true);
  };

  const handleSaveReclassify = async () => {
    if (reclassifyingExpense) {
      setIsSubmittingReclass(true);
      setReclassError(null);

      const draft: HouseholdExpenseDraft = {
        title: reclassifyingExpense.title,
        amount: reclassifyingExpense.amount,
        note: reclassifyingExpense.note,
        occurredAtMillis: reclassifyingExpense.occurredAtMillis,
        householdCategoryId: targetCategoryId || null,
        distributionMode: reclassifyingExpense.distributionMode,
        customDistribution:
          reclassifyingExpense.distributionMode === "custom"
            ? {
                memberAAmount: reclassifyingExpense.memberAAmount,
                memberBAmount: reclassifyingExpense.memberBAmount,
              }
            : undefined,
      };

      const outcome = await updateHouseholdExpense(
        reclassifyingExpense,
        household,
        draft,
        {
          userId: currentUid,
          members,
        },
      );

      setIsSubmittingReclass(false);

      if (outcome.kind === "success") {
        applyCommittedHouseholdExpense(outcome.value);
        const existingMovement = movements.find((m) => m.id === outcome.value.id);
        if (existingMovement) {
          applyCommittedMovement({
            ...existingMovement,
            householdCategoryId: outcome.value.householdCategoryId,
            revision: outcome.value.revision,
            updatedAtMillis: outcome.value.updatedAtMillis,
          });
        }
        setIsReclassifying(false);
        setReclassifyingExpense(null);
        setSelectedHouseholdExpense(outcome.value);
      } else {
        setReclassError(
          outcome.kind === "conflict"
            ? "El gasto cambió remotamente. Actualiza e inténtalo de nuevo."
            : outcome.message || "Error al clasificar el gasto.",
        );
      }
      return;
    }

    if (!selectedMovement || !targetCategoryId) return;
    setIsSubmittingReclass(true);
    setReclassError(null);

    const outcome = await correctPartnerMovementCategory({
      householdId: household.id,
      movement: selectedMovement,
      targetHouseholdCategoryId: targetCategoryId,
      updatedByUid: currentUid,
    });

    setIsSubmittingReclass(false);

    if (outcome.kind === "success") {
      applyCommittedMovement(outcome.value.updatedMovement);
      applyCommittedMapping(outcome.value.mapping);
      setIsReclassifying(false);
      setSelectedMovement(outcome.value.updatedMovement);
    } else {
      setReclassError(
        outcome.kind === "conflict"
          ? "El movimiento cambió remotamente. Actualiza e inténtalo de nuevo."
          : outcome.message || "Error al clasificar el movimiento.",
      );
    }
  };

  const handleCategoryCreatedFromReclassify = async (
    newCategory: MplusHouseholdExpenseCategory,
  ) => {
    applyCommittedCategory(newCategory);
    setTargetCategoryId(newCategory.id);

    if (reclassifyingExpense) {
      setIsSubmittingReclass(true);
      setReclassError(null);

      const draft: HouseholdExpenseDraft = {
        title: reclassifyingExpense.title,
        amount: reclassifyingExpense.amount,
        note: reclassifyingExpense.note,
        occurredAtMillis: reclassifyingExpense.occurredAtMillis,
        householdCategoryId: newCategory.id,
        distributionMode: reclassifyingExpense.distributionMode,
        customDistribution:
          reclassifyingExpense.distributionMode === "custom"
            ? {
                memberAAmount: reclassifyingExpense.memberAAmount,
                memberBAmount: reclassifyingExpense.memberBAmount,
              }
            : undefined,
      };

      const outcome = await updateHouseholdExpense(
        reclassifyingExpense,
        household,
        draft,
        {
          userId: currentUid,
          members,
        },
      );

      setIsSubmittingReclass(false);

      if (outcome.kind === "success") {
        applyCommittedHouseholdExpense(outcome.value);
        const existingMovement = movements.find((m) => m.id === outcome.value.id);
        if (existingMovement) {
          applyCommittedMovement({
            ...existingMovement,
            householdCategoryId: outcome.value.householdCategoryId,
            revision: outcome.value.revision,
            updatedAtMillis: outcome.value.updatedAtMillis,
          });
        }
        setIsReclassifying(false);
        setReclassifyingExpense(null);
        setSelectedHouseholdExpense(outcome.value);
      } else {
        setReclassError(
          outcome.kind === "conflict"
            ? "El gasto cambió remotamente. Actualiza e inténtalo de nuevo."
            : outcome.message || "Error al clasificar el gasto.",
        );
      }
      return;
    }

    if (selectedMovement) {
      setIsSubmittingReclass(true);
      setReclassError(null);

      const outcome = await correctPartnerMovementCategory({
        householdId: household.id,
        movement: selectedMovement,
        targetHouseholdCategoryId: newCategory.id,
        updatedByUid: currentUid,
      });

      setIsSubmittingReclass(false);

      if (outcome.kind === "success") {
        applyCommittedMovement(outcome.value.updatedMovement);
        applyCommittedMapping(outcome.value.mapping);
        setIsReclassifying(false);
        setSelectedMovement(outcome.value.updatedMovement);
      } else {
        setReclassError(
          outcome.kind === "conflict"
            ? "El movimiento cambió remotamente. Actualiza e inténtalo de nuevo."
            : outcome.message || "Error al clasificar el movimiento.",
        );
      }
    }
  };

  return (
    <>
      {/* 1. Barra de Búsqueda y Filtros */}
      <HouseholdCard contentClassName="p-4">
        <div className="flex flex-col xl:flex-row xl:items-center gap-4 xl:gap-5 flex-wrap">
          {/* 1. Búsqueda por título */}
          <div className="relative w-full xl:w-56 shrink-0">
            <Search className="pointer-events-none absolute inset-y-0 left-4 my-auto h-4 w-4 text-[var(--hh-text-muted)]" />
            <input
              className="h-9 w-full rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] pl-11 pr-8 text-xs font-medium text-[var(--hh-text)] placeholder:text-[var(--hh-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
              placeholder="Buscar movimiento..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--hh-text-muted)] hover:text-[var(--hh-text)] p-0.5 cursor-pointer"
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 2. Tipo */}
          <div className="flex flex-wrap gap-2 shrink-0 xl:border-l xl:border-[var(--hh-border-soft)] xl:pl-5">
            {(
              [
                ["all", "Todos"],
                ["income", "Ingresos"],
                ["expense", "Gastos"],
              ] as const
            ).map(([value, label]) => {
              const active = selectedType === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedType(value)}
                  className={cn(
                    "h-9 px-3 text-xs rounded-xl font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]",
                    active
                      ? "bg-[var(--hh-surface-subtle)] text-[var(--hh-text)] font-semibold border border-[var(--hh-border)] shadow-xs"
                      : "text-[var(--hh-text-muted)] hover:text-[var(--hh-text)] hover:bg-white/[0.03]",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* 3. Selectores contextuales (Miembro, Categoría Hogar, Cuenta) */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 xl:border-l xl:border-[var(--hh-border-soft)] xl:pl-5 shrink-0">
            {/* Miembro */}
            <div className="w-full sm:w-48">
              <select
                aria-label="Filtrar por miembro"
                className="h-9 w-full rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] px-3 text-xs font-medium text-[var(--hh-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
              >
                <option value="all">Todos los miembros</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.userId === currentUid ? `${m.displayName} (Tú)` : m.displayName}
                  </option>
                ))}
              </select>
            </div>

            {/* Categoría de Hogar o Ingreso */}
            <div className="w-full sm:w-48">
              <select
                aria-label="Filtrar por categoría"
                className="h-9 w-full rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] px-3 text-xs font-medium text-[var(--hh-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
              >
                <option value="all">Todas las categorías</option>
                {selectedType !== "income" && (
                  <option value="unclassified">Por clasificar</option>
                )}
                {selectedType !== "income" &&
                  categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.state === "archived" ? "(Archivada)" : ""}
                    </option>
                  ))}
                {selectedType === "income" &&
                  categoryLabels.map((l) => (
                    <option key={l.categoryId} value={l.categoryId}>
                      {l.name}
                    </option>
                  ))}
                {selectedCategoryId !== "all" &&
                  selectedCategoryId !== "unclassified" &&
                  !categories.some((c) => c.id === selectedCategoryId) &&
                  !categoryLabels.some((l) => l.categoryId === selectedCategoryId) && (
                    <option value={selectedCategoryId}>Categoría ({selectedCategoryId})</option>
                  )}
              </select>
            </div>

            {/* Cuenta origen */}
            <div className="w-full sm:w-48">
              <select
                aria-label="Filtrar por cuenta"
                className="h-9 w-full rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] px-3 text-xs font-medium text-[var(--hh-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                <option value="all">Todas las cuentas</option>
                <option value="unassigned">Sin cuenta</option>
                {accountLabels.map((a) => (
                  <option key={a.id} value={a.accountId}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Limpiar */}
          {activeFilterCount > 0 && (
            <div className="xl:ml-auto w-full xl:w-auto flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="flex w-full xl:w-auto shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--hh-border)] bg-white/[0.03] px-3 h-9 text-xs text-[var(--hh-text-muted)] hover:text-[var(--hh-text)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
              >
                <X className="h-3.5 w-3.5" />
                <span>Limpiar</span>
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--hh-primary-action)] text-[9px] font-bold text-slate-950">
                  {activeFilterCount}
                </span>
              </button>
            </div>
          )}
        </div>
      </HouseholdCard>

      {/* Selector de modo: Movimientos / Papelera */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap gap-2">
          {([
            ["active", "Movimientos"],
            ["trash", "Papelera"],
          ] as const).map(([val, label]) => {
            const active = listMode === val;
            return (
              <HouseholdButton
                key={val}
                size="sm"
                tone={active ? "filled" : "text"}
                variant={active ? "default" : "ghost"}
                onClick={() => setListMode(val)}
              >
                {label}
                {val === "trash" && trashedExpenses.length > 0 ? ` (${trashedExpenses.length})` : ""}
              </HouseholdButton>
            );
          })}
        </div>
      </div>

      {listMode === "trash" ? (
        <HouseholdCard contentClassName="p-4 space-y-4">
          <div className="space-y-1">
            <h3 className="font-[var(--font-display)] text-base font-semibold text-[var(--hh-text)]">
              Papelera de Hogar
            </h3>
            <p className="text-xs text-[var(--hh-text-muted)]">
              Un gasto eliminado queda 30 días aquí. Al vencer se purga definitivamente junto con sus participaciones derivadas.
            </p>
            {hasLeftMember && (
              <p className="text-xs text-amber-400 font-medium pt-1">
                Un integrante abandonó el hogar. Las acciones manuales en papelera están bloqueadas; los gastos se purgan automáticamente al vencer.
              </p>
            )}
          </div>

          {trashFeedbackError && (
            <p className="text-xs text-rose-400 font-medium">{trashFeedbackError}</p>
          )}

          {trashedExpenses.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--hh-text-muted)]">
              La papelera de Hogar está vacía.
            </div>
          ) : (
            <div className="divide-y divide-[var(--hh-border-soft)]">
              {trashedExpenses.map((expense) => {
                const daysLeft = expense.purgeAfterMillis
                  ? Math.max(0, Math.ceil((expense.purgeAfterMillis - Date.now()) / (24 * 60 * 60 * 1000)))
                  : 30;

                return (
                  <div key={expense.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--hh-text)] truncate">{expense.title}</p>
                      <div className="text-xs text-[var(--hh-text-muted)] mt-0.5 flex items-center gap-1.5">
                        <HouseholdAmount size="sm" value={expense.amount} variant="expense" />
                        <span>·</span>
                        <span>Vence en {daysLeft} días</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <HouseholdButton
                        type="button"
                        size="sm"
                        tone="outlined"
                        disabled={hasLeftMember || isTrashActionSubmitting}
                        onClick={async () => {
                          setIsTrashActionSubmitting(true);
                          setTrashFeedbackError(null);
                          const res = await restoreHouseholdExpense(expense, household, { userId: currentUid, members });
                          setIsTrashActionSubmitting(false);
                          if (res.kind !== "success") {
                            setTrashFeedbackError(res.kind === "rejected" ? res.message : "Error al restaurar");
                          }
                        }}
                        className="cursor-pointer text-xs"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restaurar
                      </HouseholdButton>

                      <HouseholdButton
                        type="button"
                        size="sm"
                        tone="destructive"
                        disabled={hasLeftMember || isTrashActionSubmitting}
                        onClick={() => setPendingDeleteExpense(expense)}
                        className="cursor-pointer text-xs"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Eliminar
                      </HouseholdButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </HouseholdCard>
      ) : null}

      {listMode === "active" && (
        groupedTimeline.length === 0 ? (
        <HouseholdCard contentClassName="py-12 px-4">
          <HouseholdEmptyState
            title="Sin resultados"
            description={
              hasActiveFilters
                ? "No encontramos movimientos compartidos con los filtros seleccionados."
                : "No hay movimientos compartidos registrados en este período."
            }
          />
        </HouseholdCard>
      ) : (
        <HouseholdCard contentClassName="p-4">
          <div className="space-y-6">
            {groupedTimeline.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="px-1 text-[11px] uppercase tracking-[0.22em] text-[var(--hh-text-muted)]">
                  {group.label}
                </p>
                <div className="divide-y divide-[var(--hh-border-soft)]">
                  {group.rows.map((row: HouseholdTimelineRow) => {
                    // ── Fila: gasto originado en Hogar ──────────────────────
                    if (row.kind === "household_expense") {
                      const expense = row.expense;
                      const cat = expense.householdCategoryId
                        ? categoryMap.get(expense.householdCategoryId)
                        : null;
                      const isUnclassified = expense.householdCategoryId === null;
                      const categoryName = cat?.name ?? "Por clasificar";
                      const iconKey = cat?.iconKey ?? "other";
                      const color = cat?.color ?? "#94A3B8";
                      const Icon = resolveCategoryIcon(iconKey, "expense");
                      const isOwner = expense.createdBy === currentUid;
                      const creator = memberMap.get(expense.createdBy);

                      return (
                        <div key={expense.id} className="py-2.5 first:pt-0 last:pb-0 px-1 -mx-1">
                          <article className="flex items-center justify-between gap-3 py-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedHouseholdExpense(expense)}
                              className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer rounded-xl p-1 -m-1 transition-colors hover:bg-[var(--hh-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)] min-h-[44px]"
                              aria-label={`Ver detalle de ${expense.title}`}
                            >
                              {/* Icono */}
                              <div
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
                                style={{
                                  backgroundColor: `${color}22`,
                                  borderColor: `${color}22`,
                                  color,
                                }}
                              >
                                <Icon className="h-4 w-4" />
                              </div>

                              {/* Título y subtítulo */}
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-[var(--font-display)] text-[15px] font-semibold tracking-[-0.02em] text-[var(--hh-text)]">
                                  {expense.title}
                                </p>
                                <p className="truncate text-[12px] text-[var(--hh-text-muted)] flex items-center gap-1.5">
                                  <span className={isUnclassified ? "font-semibold text-[var(--hh-pending)]" : ""}>
                                    {categoryName}
                                  </span>
                                  <span>·</span>
                                  <span>{isOwner ? "Registrado por ti" : `Por ${creator?.displayName ?? "Pareja"}`}</span>
                                </p>
                              </div>
                            </button>

                            {/* Monto y contexto */}
                            <div className="flex items-center gap-3 shrink-0">
                              {isUnclassified && (
                                <span className="hidden sm:inline-flex items-center rounded-lg bg-[var(--hh-pending)]/12 px-2 py-0.5 text-[11px] font-semibold text-[var(--hh-pending)]">
                                  Por clasificar
                                </span>
                              )}
                              <HouseholdAmount
                                className="text-[15px] font-semibold"
                                showSign
                                size="sm"
                                value={expense.amount}
                                variant="expense"
                              />
                              <ChevronRight className="h-4 w-4 text-[var(--hh-text-muted)] shrink-0 opacity-60" />
                            </div>
                          </article>
                        </div>
                      );
                    }

                    // ── Fila: movimiento legacy (Personal → Hogar) ───────────
                    const movement = row.movement;
                    const member = memberMap.get(movement.ownerId);
                    const isOwner = movement.ownerId === currentUid;
                    const cat = movement.householdCategoryId
                      ? categoryMap.get(movement.householdCategoryId)
                      : null;
                    const catLabel = categoryLabelMap.get(
                      `${movement.ownerId}__${movement.categoryId}`,
                    );
                    const isUnclassified =
                      movement.type === "expense" && movement.householdCategoryId === null;

                    const categoryName =
                      movement.type === "expense"
                        ? cat?.name ?? "Por clasificar"
                        : catLabel?.name ?? "Ingreso";

                    const iconKey =
                      movement.type === "expense"
                        ? cat?.iconKey ?? "other"
                        : catLabel?.iconKey ?? "salary";

                    const color =
                      movement.type === "expense"
                        ? cat?.color ?? "#94A3B8"
                        : catLabel?.color ?? "#22C55E";

                    const Icon = resolveCategoryIcon(iconKey, movement.type);

                    return (
                      <div key={movement.id} className="py-2.5 first:pt-0 last:pb-0 px-1 -mx-1">
                        <article className="flex items-center justify-between gap-3 py-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (movement.origin === "household_expense") {
                                const exp = householdExpenses.find((e) => e.id === movement.id);
                                if (exp) setSelectedHouseholdExpense(exp);
                              } else {
                                setSelectedMovement(movement);
                              }
                            }}
                            className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer rounded-xl p-1 -m-1 transition-colors hover:bg-[var(--hh-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)] min-h-[44px]"
                            aria-label={`Ver detalle de ${movement.title}`}
                          >
                            {/* Icono */}
                            <div
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
                              style={{
                                backgroundColor: `${color}22`,
                                borderColor: `${color}22`,
                                color,
                              }}
                            >
                              <Icon className="h-4 w-4" />
                            </div>

                            {/* Título y subtítulo */}
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-[var(--font-display)] text-[15px] font-semibold tracking-[-0.02em] text-[var(--hh-text)]">
                                {movement.title}
                              </p>
                              <p className="truncate text-[12px] text-[var(--hh-text-muted)] flex items-center gap-1.5">
                                <span className={isUnclassified ? "font-semibold text-[var(--hh-pending)]" : ""}>
                                  {categoryName}
                                </span>
                                <span>·</span>
                                <span>{isOwner ? "Registrado por ti" : `Por ${member?.displayName ?? "Pareja"}`}</span>
                              </p>
                            </div>
                          </button>

                          {/* Monto y contexto */}
                          <div className="flex items-center gap-3 shrink-0">
                            {isUnclassified && (
                              <span className="hidden sm:inline-flex items-center rounded-lg bg-[var(--hh-pending)]/12 px-2 py-0.5 text-[11px] font-semibold text-[var(--hh-pending)]">
                                Por clasificar
                              </span>
                            )}
                            <HouseholdAmount
                              className="text-[15px] font-semibold"
                              showSign
                              size="sm"
                              value={movement.amount}
                              variant={movement.type}
                            />
                            <ChevronRight className="h-4 w-4 text-[var(--hh-text-muted)] shrink-0 opacity-60" />
                          </div>
                        </article>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </HouseholdCard>
        )
      )}

      {/* Diálogo de Detalle de Movimiento Compartido (Solo Lectura) */}
      <HouseholdDialog
        open={Boolean(selectedMovement) && !isReclassifying}
        title="Detalle del movimiento compartido"
        subtitle="Movimiento consolidado del libro compartido"
        onClose={() => setSelectedMovement(null)}
      >
        {selectedMovement && (() => {
          const member = memberMap.get(selectedMovement.ownerId);
          const isOwner = selectedMovement.ownerId === currentUid;
          const cat = selectedMovement.householdCategoryId
            ? categoryMap.get(selectedMovement.householdCategoryId)
            : null;
          const catLabel = categoryLabelMap.get(
            `${selectedMovement.ownerId}__${selectedMovement.categoryId}`,
          );
          const accLabel = selectedMovement.accountId
            ? accountLabelMap.get(
                `${selectedMovement.ownerId}__${selectedMovement.accountId}`,
              )
            : null;
          const isUnclassified =
            selectedMovement.type === "expense" &&
            selectedMovement.householdCategoryId === null;

          return (
            <div className="space-y-5">
              {/* Encabezado Monto */}
              <div className="flex flex-col items-center justify-center rounded-2xl bg-[var(--hh-surface-subtle)] p-6 text-center">
                <HouseholdAmount
                  className="font-[var(--font-display)] font-bold text-3xl"
                  value={selectedMovement.amount}
                  variant={selectedMovement.type}
                />
                <p className="mt-1 text-sm font-semibold text-[var(--hh-text)]">
                  {selectedMovement.title}
                </p>
                <p className="mt-0.5 text-xs text-[var(--hh-text-muted)]">
                  {formatDateEs(new Date(selectedMovement.occurredAtMillis))}
                </p>
              </div>

              {/* Atributos */}
              <div className="divide-y divide-[var(--hh-border-soft)] text-sm">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[var(--hh-text-muted)] flex items-center gap-2">
                    <User className="h-4 w-4" /> Registrado por
                  </span>
                  <span className="font-medium text-[var(--hh-text)]">
                    {isOwner ? "Tú" : member?.displayName ?? "Pareja"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[var(--hh-text-muted)] flex items-center gap-2">
                    <Tag className="h-4 w-4" /> Categoría de Hogar
                  </span>
                  <span className={cn("font-medium", isUnclassified ? "text-[var(--hh-pending)] font-semibold" : "text-[var(--hh-text)]")}>
                    {cat?.name ?? "Por clasificar"}
                  </span>
                </div>

                {catLabel && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[var(--hh-text-muted)] flex items-center gap-2">
                      <Tag className="h-4 w-4" /> Categoría Personal
                    </span>
                    <span className="font-medium text-[var(--hh-text)]">
                      {catLabel.name}
                    </span>
                  </div>
                )}

                {accLabel && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[var(--hh-text-muted)] flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> Cuenta informada
                    </span>
                    <span className="font-medium text-[var(--hh-text)]">
                      {accLabel.name}
                    </span>
                  </div>
                )}

                {selectedMovement.note && (
                  <div className="py-2.5">
                    <span className="text-xs font-semibold text-[var(--hh-text-muted)] block mb-1">
                      Nota
                    </span>
                    <p className="text-sm text-[var(--hh-text)] bg-[var(--hh-surface-subtle)] rounded-xl p-3">
                      {selectedMovement.note}
                    </p>
                  </div>
                )}
              </div>

              {/* Botón de Clasificar / Corregir para el compañero (§9.4) */}
              {selectedMovement.type === "expense" && (
                <div className="pt-2">
                  <HouseholdButton
                    className="w-full justify-center"
                    tone="filled"
                    onClick={() => handleStartReclassify(selectedMovement)}
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    {isUnclassified ? "Clasificar gasto para el hogar" : "Cambiar categoría de hogar"}
                  </HouseholdButton>
                </div>
              )}
            </div>
          );
        })()}
      </HouseholdDialog>

      {/* Diálogo de Reclasificación de Gasto (§9.4, §14) */}
      <HouseholdDialog
        open={isReclassifying && !isCreatingCategory}
        title={reclassifyingExpense ? "Cambiar categoría de Hogar" : "Clasificar gasto para el hogar"}
        subtitle={
          reclassifyingExpense
            ? "Modifica la categoría del gasto en el Hogar."
            : selectedMovement?.ownerId === currentUid
            ? "Elige la categoría de hogar adecuada. Finanzas M recordará esta elección para tus próximos gastos similares."
            : "Elige la categoría de hogar adecuada. Finanzas M recordará esta elección para futuros gastos similares de tu pareja."
        }
        onClose={() => {
          setIsReclassifying(false);
          setReclassifyingExpense(null);
        }}
      >
        {(selectedMovement || reclassifyingExpense) && (
          <div className="space-y-4">
            {reclassError && (
              <div
                role="alert"
                className="rounded-xl border border-[var(--hh-destructive-border)] bg-[var(--hh-destructive-border)]/10 p-3 text-xs text-[var(--hh-destructive-content)]"
              >
                {reclassError}
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--hh-text-muted)]">
                  Selecciona la categoría de Hogar
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingCategory(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--hh-primary-action)] hover:underline cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nueva categoría
                </button>
              </div>
              <div className="grid max-h-60 gap-2 overflow-y-auto pr-1">
                {reclassifyingExpense && (
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer",
                      targetCategoryId === ""
                        ? "border-[var(--hh-primary-action)] bg-[var(--hh-primary-action)]/10 text-[var(--hh-text)]"
                        : "border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-elevated)]",
                    )}
                    onClick={() => setTargetCategoryId("")}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700/30 text-[var(--hh-text-muted)]">
                      <Tag className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-sm">Por clasificar</span>
                      <p className="text-[11px] text-[var(--hh-text-muted)]">Sin categoría asignada</p>
                    </div>
                  </button>
                )}

                {activeExpenseCategories.map((c) => {
                  const Icon = resolveCategoryIcon(c.iconKey, "expense");
                  const isSelected = targetCategoryId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer",
                        isSelected
                          ? "border-[var(--hh-primary-action)] bg-[var(--hh-primary-action)]/10 text-[var(--hh-text)]"
                          : "border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-elevated)]",
                      )}
                      onClick={() => setTargetCategoryId(c.id)}
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: `${c.color}22`,
                          color: c.color,
                        }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-sm">{c.name}</span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setIsCreatingCategory(true)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--hh-border)] p-3 text-xs font-semibold text-[var(--hh-primary-action)] hover:bg-[var(--hh-surface-subtle)] hover:border-[var(--hh-primary-action)] transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Nueva categoría de Hogar
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <HouseholdButton
                className="flex-1 justify-center"
                disabled={isSubmittingReclass}
                variant="ghost"
                onClick={() => {
                  setIsReclassifying(false);
                  setReclassifyingExpense(null);
                }}
              >
                Cancelar
              </HouseholdButton>
              <HouseholdButton
                className="flex-1 justify-center"
                disabled={isSubmittingReclass || (!reclassifyingExpense && !targetCategoryId)}
                tone="filled"
                onClick={handleSaveReclassify}
              >
                {isSubmittingReclass ? "Guardando..." : "Guardar clasificación"}
              </HouseholdButton>
            </div>
          </div>
        )}
      </HouseholdDialog>

      {/* Diálogo para Crear Categoría de Hogar desde la Reclasificación */}
      <HouseholdCategoryDialog
        open={isCreatingCategory}
        householdId={household.id}
        creatorUid={currentUid}
        existingCount={activeExpenseCategories.length}
        onClose={() => setIsCreatingCategory(false)}
        onSuccess={handleCategoryCreatedFromReclassify}
      />

      {/* Diálogo de Detalle de Gasto Originado en Hogar */}
      {selectedHouseholdExpense && (
        <HouseholdDialog
          open={Boolean(selectedHouseholdExpense) && !isReclassifying}
          onClose={() => setSelectedHouseholdExpense(null)}
          title="Detalle del gasto de Hogar"
          subtitle="Información y distribución compartida"
        >
          <div className="space-y-5 text-[var(--hh-text)]">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] p-5 text-center">
              <HouseholdAmount
                className="font-[var(--font-display)] text-3xl font-bold"
                showSign
                size="display"
                value={selectedHouseholdExpense.amount}
                variant="expense"
              />
              <p className="mt-1.5 font-[var(--font-display)] text-base font-semibold text-[var(--hh-text)]">
                {selectedHouseholdExpense.title}
              </p>
              <p className="mt-0.5 text-xs text-[var(--hh-text-muted)]">
                {formatDateEs(new Date(selectedHouseholdExpense.occurredAtMillis))}
              </p>
            </div>

            <div className="divide-y divide-[var(--hh-border-soft)] text-sm">
              <div className="flex items-center justify-between py-3">
                <span className="text-xs font-medium text-[var(--hh-text-muted)]">Categoría de Hogar</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-[var(--hh-text)]">
                    {selectedHouseholdExpense.householdCategoryId
                      ? categoryMap.get(selectedHouseholdExpense.householdCategoryId)?.name ?? "Por clasificar"
                      : "Por clasificar"}
                  </span>
                  {hasLeftMember && (
                    <button
                      type="button"
                      onClick={() => handleStartReclassifyExpense(selectedHouseholdExpense)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--hh-primary-action)] hover:underline cursor-pointer"
                    >
                      <Edit2 className="h-3 w-3" />
                      <span>Cambiar</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="py-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-[var(--hh-text-muted)]">
                  <span>Distribución</span>
                  <span className="capitalize">{selectedHouseholdExpense.distributionMode === "equal" ? "Equitativo" : "Personalizado"}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {(() => {
                    const memberA = memberMap.get(selectedHouseholdExpense.memberAId);
                    const memberB = memberMap.get(selectedHouseholdExpense.memberBId);
                    const nameA = memberA?.displayName ?? "Integrante A";
                    const nameB = memberB?.displayName ?? "Integrante B";
                    const isMeA = selectedHouseholdExpense.memberAId === currentUid;
                    const isMeB = selectedHouseholdExpense.memberBId === currentUid;

                    return (
                      <>
                        <div className="rounded-xl border border-[var(--hh-border-soft)] bg-[var(--hh-surface-subtle)]/40 p-2.5 flex items-center gap-2.5">
                          <ProfileAvatar
                            name={nameA}
                            photoURL={memberA?.photoUrl}
                            size="sm"
                            decorative
                            className="h-8 w-8 text-xs shrink-0 border border-[var(--hh-border-soft)] bg-[var(--hh-surface-elevated)] text-[var(--hh-text)]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[var(--hh-text-muted)] truncate font-medium">
                              {nameA}
                              {isMeA ? " (Tú)" : ""}
                            </p>
                            <p className="font-semibold text-sm text-[var(--hh-text)] mt-0.5">
                              {formatCurrencyCop(selectedHouseholdExpense.memberAAmount)}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-xl border border-[var(--hh-border-soft)] bg-[var(--hh-surface-subtle)]/40 p-2.5 flex items-center gap-2.5">
                          <ProfileAvatar
                            name={nameB}
                            photoURL={memberB?.photoUrl}
                            size="sm"
                            decorative
                            className="h-8 w-8 text-xs shrink-0 border border-[var(--hh-border-soft)] bg-[var(--hh-surface-elevated)] text-[var(--hh-text)]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[var(--hh-text-muted)] truncate font-medium">
                              {nameB}
                              {isMeB ? " (Tú)" : ""}
                            </p>
                            <p className="font-semibold text-sm text-[var(--hh-text)] mt-0.5">
                              {formatCurrencyCop(selectedHouseholdExpense.memberBAmount)}
                            </p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {selectedHouseholdExpense.note ? (
                <div className="py-3">
                  <span className="mb-1.5 block text-xs font-semibold text-[var(--hh-text-muted)]">Nota</span>
                  <p className="whitespace-pre-wrap break-words rounded-xl border border-[var(--hh-border-soft)] bg-[var(--hh-surface-subtle)] p-3 text-sm text-[var(--hh-text)]">
                    {selectedHouseholdExpense.note}
                  </p>
                </div>
              ) : null}
            </div>

            {hasLeftMember && (
              <p className="text-xs text-amber-400 font-medium">
                Un integrante abandonó el hogar. En modo histórico solo se puede modificar la categoría de Hogar.
              </p>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-[var(--hh-border)] pt-4">
              <HouseholdButton
                type="button"
                tone="destructive"
                disabled={hasLeftMember}
                onClick={() => {
                  const exp = selectedHouseholdExpense;
                  setSelectedHouseholdExpense(null);
                  openTrashHouseholdExpense(exp);
                }}
                size="sm"
                className="cursor-pointer"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Enviar a la Papelera
              </HouseholdButton>

              <div className="flex items-center gap-2">
                <HouseholdButton
                  type="button"
                  tone="text"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedHouseholdExpense(null)}
                  className="cursor-pointer"
                >
                  Cerrar
                </HouseholdButton>
                {hasLeftMember ? (
                  <HouseholdButton
                    type="button"
                    tone="filled"
                    onClick={() => handleStartReclassifyExpense(selectedHouseholdExpense)}
                    size="sm"
                    className="cursor-pointer"
                  >
                    <Edit2 className="mr-1.5 h-4 w-4" />
                    Cambiar categoría
                  </HouseholdButton>
                ) : (
                  <HouseholdButton
                    type="button"
                    tone="filled"
                    onClick={() => {
                      const exp = selectedHouseholdExpense;
                      setSelectedHouseholdExpense(null);
                      openEditHouseholdExpense(exp);
                    }}
                    size="sm"
                    className="cursor-pointer"
                  >
                    <Edit2 className="mr-1.5 h-4 w-4" />
                    Editar
                  </HouseholdButton>
                )}
              </div>
            </div>
          </div>
        </HouseholdDialog>
      )}

      {/* Confirmación de eliminación permanente de gasto de Hogar */}
      {pendingDeleteExpense && (
        <HouseholdDialog
          open={Boolean(pendingDeleteExpense)}
          onClose={() => setPendingDeleteExpense(null)}
          title="¿Eliminar gasto definitivamente?"
          subtitle="Esta acción eliminará el gasto y sus participaciones de forma permanente. No se puede deshacer."
        >
          <div className="flex flex-col gap-4 text-[var(--hh-text)]">
            <p className="text-sm text-[var(--hh-text-muted)]">
              Se eliminará <span className="font-semibold text-[var(--hh-text)]">{pendingDeleteExpense.title}</span> ({formatCurrencyCop(pendingDeleteExpense.amount)}) para siempre.
            </p>
            {trashFeedbackError && (
              <p className="text-xs text-rose-400 font-medium">{trashFeedbackError}</p>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <HouseholdButton
                type="button"
                tone="text"
                disabled={isTrashActionSubmitting}
                onClick={() => setPendingDeleteExpense(null)}
              >
                Cancelar
              </HouseholdButton>
              <HouseholdButton
                type="button"
                tone="destructive"
                disabled={isTrashActionSubmitting}
                aria-busy={isTrashActionSubmitting}
                onClick={async () => {
                  if (!pendingDeleteExpense) return;
                  setIsTrashActionSubmitting(true);
                  setTrashFeedbackError(null);
                  const res = await deleteHouseholdExpensePermanently(pendingDeleteExpense, household, { userId: currentUid, members });
                  setIsTrashActionSubmitting(false);
                  if (res.kind === "success") {
                    setPendingDeleteExpense(null);
                  } else {
                    setTrashFeedbackError(res.kind === "rejected" ? res.message : "Error al eliminar");
                  }
                }}
              >
                {isTrashActionSubmitting ? "Eliminando..." : "Eliminar para siempre"}
              </HouseholdButton>
            </div>
          </div>
        </HouseholdDialog>
      )}

    </>
  );
}
