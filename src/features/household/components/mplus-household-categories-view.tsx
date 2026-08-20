"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Edit2,
  Plus,
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
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

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
  const masked = useUiPreferencesStore((state) => state.balancesHidden);
  const applyCommittedCategory = useMplusHouseholdStore(
    (state) => state.applyCommittedCategory,
  );

  const [activeTab, setActiveTab] = useState<TabMode>("distribution");

  // Formulario de Crear / Editar
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MplusHouseholdExpenseCategory | null>(null);
  const [formName, setFormName] = useState("");
  const [formIconKey, setFormIconKey] = useState("shopping");
  const [formColor, setFormColor] = useState(DEFAULT_HOUSEHOLD_CATEGORY_COLOR);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    const outcome = await archiveHouseholdExpenseCategory({
      householdId: household.id,
      categoryId: category.id,
      expectedRevision: category.revision,
      existingCategory: category,
    });
    if (outcome.kind === "success") {
      applyCommittedCategory(outcome.value);
    }
  };

  const handleReactivate = async (category: MplusHouseholdExpenseCategory) => {
    const outcome = await reactivateHouseholdExpenseCategory({
      householdId: household.id,
      categoryId: category.id,
      expectedRevision: category.revision,
      existingCategory: category,
    });
    if (outcome.kind === "success") {
      applyCommittedCategory(outcome.value);
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector de Tabs */}
      <div className="flex rounded-[18px] border border-[var(--hh-border)] bg-[var(--hh-surface)] p-1 w-fit">
        <button
          type="button"
          className={cn(
            "rounded-[14px] px-5 py-2 text-sm font-semibold transition-all",
            activeTab === "distribution"
              ? "bg-[var(--hh-sage-accent)]/20 text-[var(--hh-text)] shadow-sm"
              : "text-[var(--hh-text-muted)] hover:text-[var(--hh-text)]",
          )}
          onClick={() => setActiveTab("distribution")}
        >
          Distribución del mes
        </button>
        <button
          type="button"
          className={cn(
            "rounded-[14px] px-5 py-2 text-sm font-semibold transition-all",
            activeTab === "manage"
              ? "bg-[var(--hh-sage-accent)]/20 text-[var(--hh-text)] shadow-sm"
              : "text-[var(--hh-text-muted)] hover:text-[var(--hh-text)]",
          )}
          onClick={() => setActiveTab("manage")}
        >
          Administrar categorías ({activeCategories.length})
        </button>
      </div>

      {/* Tab 1: Distribución de Gastos */}
      {activeTab === "distribution" && (
        <HouseholdCard className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--hh-border-soft)] pb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--hh-text-muted)]">
                Gastos comunes
              </p>
              <h3 className="font-[var(--font-display)] text-lg font-bold text-[var(--hh-text)]">
                Distribución por categoría
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-[var(--hh-text-muted)] block">Total mes</span>
              <HouseholdAmount
                className="text-base font-bold"
                masked={masked}
                value={totalMonthlyExpense}
                variant="expense"
              />
            </div>
          </div>

          {distributionItems.length === 0 ? (
            <div className="py-8">
              <HouseholdEmptyState
                title="Sin gastos registrados"
                description="No hay gastos compartidos en este período para mostrar distribución."
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--hh-border-soft)]">
              {distributionItems.map((item) => {
                const Icon = resolveCategoryIcon(item.iconKey, "expense");
                return (
                  <div key={item.key} className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor: `${item.color}22`,
                            color: item.color,
                          }}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <span className="truncate text-sm font-semibold text-[var(--hh-text)]">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-[var(--hh-text-muted)] font-medium">
                          {item.percentage}%
                        </span>
                        <HouseholdAmount
                          className="text-sm font-bold"
                          masked={masked}
                          value={item.amount}
                          variant="expense"
                        />
                      </div>
                    </div>
                    {/* Barra */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--hh-border-soft)]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </HouseholdCard>
      )}

      {/* Tab 2: Administrar Categorías */}
      {activeTab === "manage" && (
        <div className="space-y-6">
          <HouseholdCard className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--hh-border-soft)] pb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--hh-text-muted)]">
                  Catálogo de Hogar
                </p>
                <h3 className="font-[var(--font-display)] text-lg font-bold text-[var(--hh-text)]">
                  Categorías activas
                </h3>
              </div>
              <HouseholdButton size="sm" tone="filled" onClick={handleOpenCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                Nueva categoría
              </HouseholdButton>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {activeCategories.map((category) => {
                const Icon = resolveCategoryIcon(category.iconKey, "expense");
                return (
                  <div
                    key={category.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] p-3.5 transition-all hover:bg-[var(--hh-surface-elevated)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          backgroundColor: `${category.color}22`,
                          color: category.color,
                        }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="truncate text-sm font-semibold text-[var(--hh-text)]">
                        {category.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--hh-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--hh-text)]"
                        title="Editar categoría"
                        type="button"
                        onClick={() => handleOpenEdit(category)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--hh-text-muted)] transition-colors hover:bg-[var(--hh-destructive-border)]/10 hover:text-[var(--hh-destructive-content)]"
                        title="Archivar categoría"
                        type="button"
                        onClick={() => handleArchive(category)}
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </HouseholdCard>

          {/* Categorías Archivadas */}
          {archivedCategories.length > 0 && (
            <HouseholdCard className="space-y-4 border-dashed">
              <div className="border-b border-[var(--hh-border-soft)] pb-3">
                <h4 className="font-semibold text-sm text-[var(--hh-text-muted)]">
                  Categorías archivadas ({archivedCategories.length})
                </h4>
                <p className="text-xs text-[var(--hh-text-muted)]">
                  No se pueden asignar a gastos nuevos, pero preservan el historial.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {archivedCategories.map((category) => {
                  const Icon = resolveCategoryIcon(category.iconKey, "expense");
                  return (
                    <div
                      key={category.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--hh-border-soft)] bg-[var(--hh-surface-subtle)]/50 p-3.5 opacity-70"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor: `${category.color}22`,
                            color: category.color,
                          }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="truncate text-sm font-medium text-[var(--hh-text-secondary)] line-through">
                          {category.name}
                        </span>
                      </div>

                      <HouseholdButton
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReactivate(category)}
                      >
                        <ArchiveRestore className="mr-1 h-3.5 w-3.5" />
                        Reactivar
                      </HouseholdButton>
                    </div>
                  );
                })}
              </div>
            </HouseholdCard>
          )}
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
    </div>
  );
}
