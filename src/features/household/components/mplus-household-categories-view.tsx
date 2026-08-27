"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  MoreVertical,
  Pencil,
  Plus,
  X,
} from "lucide-react";

import {
  archiveHouseholdExpenseCategory,
  createHouseholdExpenseCategory,
  reactivateHouseholdExpenseCategory,
  updateHouseholdExpenseCategory,
} from "@/features/household/services/mplus-household-categories-service";
import { HouseholdAmount } from "@/features/household/components/ui/household-amount";
import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdCard } from "@/features/household/components/ui/household-card";
import { HouseholdDialog } from "@/features/household/components/ui/household-dialog";
import { HouseholdEmptyState } from "@/features/household/components/ui/household-empty-state";
import {
  HouseholdIconSelect,
  type HouseholdIconSelectOption,
} from "@/features/household/components/ui/household-icon-select";
import { HouseholdTextField } from "@/features/household/components/ui/household-text-field";
import {
  EXPENSE_ICON_GROUPS,
  expenseIconCatalog,
  expenseIconOptions,
  resolveCategoryIcon,
} from "@/lib/categories/category-icons";
import {
  DEFAULT_HOUSEHOLD_CATEGORY_COLOR,
  HOUSEHOLD_CATEGORY_COLORS,
} from "@/lib/categories/household-category-colors";
import { formatPeriodLabel } from "@/lib/format/date";
import {
  expenseByHouseholdCategory,
  totalExpense,
  UNCLASSIFIED_HOUSEHOLD_CATEGORY_KEY,
} from "@/lib/mplus/derived";
import type {
  MplusHousehold,
  MplusHouseholdExpenseCategory,
  MplusMovement,
} from "@/lib/mplus/models";
import { cn } from "@/lib/utils";
import { useAppContextStore } from "@/stores/app-context-store";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";

type Props = {
  household: MplusHousehold;
  categories: MplusHouseholdExpenseCategory[];
  movements: MplusMovement[];
  currentUid: string;
};

type TabMode = "distribution" | "manage";

const iconSelectOptions: HouseholdIconSelectOption[] = expenseIconOptions.map((opt) => {
  const Icon = expenseIconCatalog[opt.iconKey];
  return {
    id: opt.iconKey,
    label: opt.label,
    keywords: opt.keywords,
    icon: Icon ? <Icon className="h-5 w-5" /> : undefined,
  };
});

export function MplusHouseholdCategoriesView({
  household,
  categories,
  movements,
  currentUid,
}: Props) {
  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);
  const applyCommittedCategory = useMplusHouseholdStore(
    (state) => state.applyCommittedCategory,
  );

  const [activeTab, setActiveTab] = useState<TabMode>("distribution");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Formulario de Crear / Editar
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MplusHouseholdExpenseCategory | null>(null);
  const [formName, setFormName] = useState("");
  const [formIconKey, setFormIconKey] = useState("shopping");
  const [formColor, setFormColor] = useState(DEFAULT_HOUSEHOLD_CATEGORY_COLOR);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Soporte de ?mode=manage en URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "manage") {
      setActiveTab("manage");
    }
  }, []);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.state === "active"),
    [categories],
  );

  const archivedCategories = useMemo(
    () => categories.filter((c) => c.state === "archived"),
    [categories],
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const totalMonthlyExpense = totalExpense(movements);

  const distributionItems = useMemo(() => {
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

    const total = totalMonthlyExpense > 0 ? totalMonthlyExpense : 1;

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
  }, [movements, totalMonthlyExpense, categoryMap]);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormName("");
    setFormIconKey("shopping");
    setFormColor(DEFAULT_HOUSEHOLD_CATEGORY_COLOR);
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (category: MplusHouseholdExpenseCategory) => {
    setEditingCategory(category);
    setFormName(category.name);
    setFormIconKey(category.iconKey);
    setFormColor(category.color);
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = formName.trim();
    if (trimmed.length < 1 || trimmed.length > 50) {
      setFormError("El nombre debe tener entre 1 y 50 caracteres.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    if (editingCategory) {
      const outcome = await updateHouseholdExpenseCategory({
        householdId: household.id,
        categoryId: editingCategory.id,
        name: trimmed,
        iconKey: formIconKey,
        color: formColor,
        expectedRevision: editingCategory.revision,
        existingCategory: editingCategory,
      });

      setIsSubmitting(false);
      if (outcome.kind === "success") {
        applyCommittedCategory(outcome.value);
        setIsDialogOpen(false);
      } else {
        setFormError(
          outcome.kind === "conflict"
            ? "La categoría cambió remotamente. Actualiza e inténtalo de nuevo."
            : outcome.message || "Error al actualizar categoría.",
        );
      }
    } else {
      const outcome = await createHouseholdExpenseCategory({
        householdId: household.id,
        creatorUid: currentUid,
        name: trimmed,
        iconKey: formIconKey,
        color: formColor,
        existingCount: activeCategories.length,
      });

      setIsSubmitting(false);
      if (outcome.kind === "success") {
        applyCommittedCategory(outcome.value);
        setIsDialogOpen(false);
      } else {
        setFormError(
          outcome.kind === "conflict"
            ? "La categoría cambió remotamente. Actualiza e inténtalo de nuevo."
            : outcome.message || "Error al crear categoría.",
        );
      }
    }
  };

  const handleArchive = async (category: MplusHouseholdExpenseCategory) => {
    setPendingId(category.id);
    setActionError(null);
    try {
      const outcome = await archiveHouseholdExpenseCategory({
        householdId: household.id,
        categoryId: category.id,
        expectedRevision: category.revision,
        existingCategory: category,
      });
      if (outcome.kind === "success") {
        applyCommittedCategory(outcome.value);
        setArchivingId(null);
      } else {
        setActionError(
          outcome.kind === "conflict"
            ? "La categoría cambió remotamente. Actualiza e inténtalo de nuevo."
            : outcome.message || "Error al archivar la categoría.",
        );
      }
    } catch (thrown) {
      setActionError(
        thrown instanceof Error ? thrown.message : "No se pudo archivar la categoría.",
      );
    } finally {
      setPendingId(null);
    }
  };

  const handleReactivate = async (category: MplusHouseholdExpenseCategory) => {
    setPendingId(category.id);
    setActionError(null);
    try {
      const outcome = await reactivateHouseholdExpenseCategory({
        householdId: household.id,
        categoryId: category.id,
        expectedRevision: category.revision,
        existingCategory: category,
      });
      if (outcome.kind === "success") {
        applyCommittedCategory(outcome.value);
      } else {
        setActionError(
          outcome.kind === "conflict"
            ? "La categoría cambió remotamente. Actualiza e inténtalo de nuevo."
            : outcome.message || "Error al reactivar la categoría.",
        );
      }
    } catch (thrown) {
      setActionError(
        thrown instanceof Error ? thrown.message : "No se pudo reactivar la categoría.",
      );
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      {/* Control segmentado de modo */}
      <div className="flex gap-2 rounded-2xl border border-[var(--hh-border)] bg-[var(--hh-surface)] p-1 w-full max-w-md mx-auto mb-2">
        <HouseholdButton
          className={cn(
            "flex-1 text-center justify-center rounded-xl py-2",
            activeTab === "distribution"
              ? "bg-[var(--hh-sage-accent)]/20 text-[var(--hh-text)] font-semibold shadow-sm"
              : "text-[var(--hh-text-muted)]",
          )}
          onClick={() => setActiveTab("distribution")}
          size="sm"
          tone={activeTab === "distribution" ? "filled" : "text"}
          type="button"
          variant={activeTab === "distribution" ? "default" : "ghost"}
        >
          Distribución de gastos
        </HouseholdButton>
        <HouseholdButton
          className={cn(
            "flex-1 text-center justify-center rounded-xl py-2",
            activeTab === "manage"
              ? "bg-[var(--hh-sage-accent)]/20 text-[var(--hh-text)] font-semibold shadow-sm"
              : "text-[var(--hh-text-muted)]",
          )}
          onClick={() => setActiveTab("manage")}
          size="sm"
          tone={activeTab === "manage" ? "filled" : "text"}
          type="button"
          variant={activeTab === "manage" ? "default" : "ghost"}
        >
          Categorías del hogar
        </HouseholdButton>
      </div>

      {actionError ? (
        <p
          role="alert"
          className="rounded-xl border border-[var(--hh-destructive-border)] bg-[var(--hh-destructive-border)]/10 px-3.5 py-2.5 text-sm text-[var(--hh-destructive-content)]"
        >
          {actionError}
        </p>
      ) : null}

      {/* Tab 1: Distribución de Gastos */}
      {activeTab === "distribution" ? (
        <>
          <HouseholdCard variant="hero">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--hh-text-muted)]">
                  Total gastado en {formatPeriodLabel(selectedPeriod)}
                </p>
                <HouseholdAmount
                  showSign={false}
                  size="hero"
                  value={totalMonthlyExpense}
                  variant="expense"
                />
              </div>
            </div>
          </HouseholdCard>

          <HouseholdCard variant="default">
            {distributionItems.length === 0 ? (
              <HouseholdEmptyState
                title="Sin gastos agrupables"
                description="No hay gastos compartidos de este mes para agrupar por categoría."
              />
            ) : (
              <div className="divide-y divide-[var(--hh-border-soft)]">
                {distributionItems.map((item) => {
                  const Icon = resolveCategoryIcon(item.iconKey, "expense");
                  return (
                    <article
                      key={item.key}
                      className="group py-4 first:pt-0 last:pb-0 space-y-2.5 transition-all outline-none rounded-xl px-2 -mx-2 hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className="grid h-10 w-10 place-items-center rounded-xl border flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
                          style={{
                            backgroundColor: `${item.color}22`,
                            borderColor: `${item.color}33`,
                            color: item.color,
                          }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="truncate font-[var(--font-display)] text-base font-semibold tracking-[-0.01em] text-[var(--hh-text)]">
                              {item.name}
                            </p>
                            <span className="text-xs font-medium text-[var(--hh-text-muted)]">
                              {item.percentage}%
                            </span>
                          </div>
                        </div>
                        <HouseholdAmount
                          showSign={false}
                          size="md"
                          value={item.amount}
                          variant="expense"
                        />
                      </div>

                      <div className="relative h-2 rounded-full bg-[var(--hh-border-soft)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                            boxShadow: `0 0 8px ${item.color}66`,
                          }}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </HouseholdCard>
        </>
      ) : (
        /* Tab 2: Categorías del Hogar (Gestión) */
        <div className="space-y-6">
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="w-full h-14 rounded-2xl border border-dashed border-[var(--hh-border)] bg-[var(--hh-surface-subtle)]/40 hover:bg-[var(--hh-surface-elevated)] flex items-center justify-center gap-2.5 text-sm font-semibold text-[var(--hh-primary-action)] transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
              aria-label="Crear nueva categoría del hogar"
            >
              <Plus className="h-4 w-4" />
              <span>Nueva categoría</span>
            </button>

            {!activeCategories.length ? (
              <HouseholdCard>
                <HouseholdEmptyState
                  title="Crea la primera categoría del hogar"
                  description="Te ayudará a organizar y entender los gastos compartidos."
                />
              </HouseholdCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeCategories.map((category) => {
                  const IconComponent = resolveCategoryIcon(category.iconKey, "expense");
                  const isMenuOpen = openMenuId === category.id;
                  const isConfirmingArchive = archivingId === category.id;
                  return (
                    <div
                      key={category.id}
                      className="rounded-2xl border border-[var(--hh-border)] bg-[var(--hh-surface)] p-3.5 transition-colors hover:border-[var(--hh-sage-accent)]/30 flex flex-col justify-between min-w-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className="grid h-10 w-10 place-items-center rounded-xl border flex-shrink-0"
                            style={{
                              backgroundColor: `${category.color}22`,
                              borderColor: `${category.color}44`,
                              color: category.color,
                            }}
                          >
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <span className="font-semibold text-sm text-[var(--hh-text)] truncate">
                            {category.name}
                          </span>
                        </div>
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            className="p-2 rounded-xl text-[var(--hh-text-muted)] hover:text-[var(--hh-text)] hover:bg-white/5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
                            aria-label="Opciones de categoría"
                            onClick={() => setOpenMenuId(isMenuOpen ? null : category.id)}
                          >
                            <MoreVertical className="h-4.5 w-4.5" />
                          </button>
                          {isMenuOpen && (
                            <div className="absolute right-0 top-9 z-20 w-40 rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-elevated)] shadow-xl py-1">
                              <button
                                type="button"
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--hh-text)] hover:bg-white/5 transition-colors"
                                onClick={() => {
                                  handleOpenEdit(category);
                                  setOpenMenuId(null);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5 text-[var(--hh-text-muted)]" />
                                Editar
                              </button>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--hh-destructive-content)] hover:bg-white/5 transition-colors"
                                onClick={() => {
                                  setArchivingId(category.id);
                                  setOpenMenuId(null);
                                }}
                              >
                                <Archive className="h-3.5 w-3.5" />
                                Archivar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {isConfirmingArchive && (
                        <div className="mt-3 rounded-xl border border-[var(--hh-destructive-border)]/30 bg-[var(--hh-destructive-border)]/10 px-3 py-2.5 flex items-center justify-between gap-3">
                          <span className="text-xs text-[var(--hh-text-secondary)] truncate">
                            ¿Archivar <strong>{category.name}</strong>?
                          </span>
                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              className="text-xs text-[var(--hh-text-muted)] hover:text-[var(--hh-text)] px-2 py-1 rounded-lg transition-colors"
                              onClick={() => setArchivingId(null)}
                              disabled={pendingId === category.id}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="text-xs text-[var(--hh-destructive-content)] font-semibold px-2.5 py-1 rounded-lg border border-[var(--hh-destructive-border)] hover:bg-[var(--hh-destructive-border)]/20 transition-colors disabled:opacity-50"
                              disabled={pendingId === category.id}
                              onClick={() => void handleArchive(category)}
                            >
                              {pendingId === category.id ? "..." : "Archivar"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {archivedCategories.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--hh-text-muted)]">
                    Archivadas
                  </p>
                  <span className="inline-flex items-center justify-center rounded-full bg-[var(--hh-surface-elevated)] px-2 py-0.5 text-[10px] font-semibold text-[var(--hh-text-secondary)]">
                    {archivedCategories.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {archivedCategories.map((category) => {
                    const IconComponent = resolveCategoryIcon(category.iconKey, "expense");
                    return (
                      <div
                        key={category.id}
                        className="rounded-2xl border border-[var(--hh-border)] bg-[var(--hh-surface)] p-3.5 opacity-70 transition-opacity hover:opacity-100 flex items-center justify-between gap-3 min-w-0"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className="grid h-9 w-9 place-items-center rounded-xl border flex-shrink-0"
                            style={{
                              backgroundColor: `${category.color}22`,
                              borderColor: `${category.color}44`,
                              color: category.color,
                            }}
                          >
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium text-[var(--hh-text-secondary)] line-through truncate">
                            {category.name}
                          </span>
                        </div>
                        <HouseholdButton
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pendingId === category.id}
                          onClick={() => void handleReactivate(category)}
                          className="h-8 text-[var(--hh-text-secondary)] hover:text-[var(--hh-text)] shrink-0"
                        >
                          <ArchiveRestore className="mr-1 h-3.5 w-3.5" />
                          Reactivar
                        </HouseholdButton>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      )}

      {/* Diálogo de Crear / Editar Categoría de Hogar */}
      <HouseholdDialog
        open={isDialogOpen}
        title={editingCategory ? "Editar categoría del hogar" : "Nueva categoría del hogar"}
        subtitle="Las categorías de gasto de hogar son compartidas por ambos miembros."
        onClose={() => setIsDialogOpen(false)}
      >
        <form className="space-y-4" onSubmit={handleSave}>
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-[var(--hh-destructive-border)] bg-[var(--hh-destructive-border)]/10 p-3 text-xs text-[var(--hh-destructive-content)]"
            >
              {formError}
            </div>
          )}

          <HouseholdTextField
            label="Nombre de la categoría"
            placeholder="Ej. Servicios, Compras, Paseos..."
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />

          <HouseholdIconSelect
            colorPalette={HOUSEHOLD_CATEGORY_COLORS}
            groups={EXPENSE_ICON_GROUPS}
            options={iconSelectOptions}
            selectedColor={formColor}
            selectedIconKey={formIconKey}
            onSelectColor={setFormColor}
            onSelectIcon={setFormIconKey}
          />

          <div className="flex gap-3 pt-3">
            <HouseholdButton
              className="flex-1 justify-center"
              disabled={isSubmitting}
              type="button"
              variant="ghost"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancelar
            </HouseholdButton>
            <HouseholdButton
              className="flex-1 justify-center"
              disabled={!formName.trim() || isSubmitting}
              tone="filled"
              type="submit"
            >
              {isSubmitting ? "Guardando..." : "Guardar categoría"}
            </HouseholdButton>
          </div>
        </form>
      </HouseholdDialog>
    </>
  );
}
