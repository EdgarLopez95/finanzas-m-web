"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronUp } from "lucide-react";

import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdCard } from "@/features/household/components/ui/household-card";
import { HouseholdAmount } from "@/features/household/components/ui/household-amount";
import { HouseholdEmptyState } from "@/features/household/components/ui/household-empty-state";
import { HouseholdIconSelect, type HouseholdIconSelectOption } from "@/features/household/components/ui/household-icon-select";
import { HouseholdDialog } from "@/features/household/components/ui/household-dialog";
import { HouseholdTimelineItem } from "@/features/household/components/ui/household-timeline-item";
import { HouseholdChip } from "@/features/household/components/ui/household-chip";
import { useHouseholdCategories } from "@/features/household/hooks/use-household-categories";
import { HouseholdEventDetailDialog } from "../household-event-detail-dialog";
import { groupCategoryBreakdown } from "@/features/household/lib/household-view-model";
import type { CategoryBreakdownItem } from "@/features/household/lib/household-view-model";
import { expenseIconCatalog, expenseIconOptions, EXPENSE_ICON_GROUPS } from "@/lib/categories/category-icons";
import {
  HOUSEHOLD_CATEGORY_COLORS,
  DEFAULT_HOUSEHOLD_CATEGORY_COLOR,
} from "@/lib/categories/household-category-colors";
import type {
  HouseholdCategory,
  HouseholdDebt,
  HouseholdEvent,
  HouseholdEventShare,
  HouseholdMemberProfile,
} from "@/types/household";
import { useAppContextStore } from "@/stores/app-context-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";
import { isSameMonthAndYear, formatDateEs } from "@/lib/format/date";
import { cn } from "@/lib/utils";

const DEFAULT_ICON = "housing";

type Props = {
  householdId: string;
  currentUid: string;
  categories: HouseholdCategory[];
  events: HouseholdEvent[];
  eventShares: HouseholdEventShare[];
  debts: HouseholdDebt[];
  memberProfiles: Record<string, HouseholdMemberProfile>;
};

type ViewMode = "report" | "manage";
type Mode = "list" | "create" | "edit";

type FormState = {
  name: string;
  iconKey: string;
  color: string;
};

const iconSelectOptions: HouseholdIconSelectOption[] = expenseIconOptions.map((opt) => {
  const Icon = expenseIconCatalog[opt.iconKey];
  return {
    id: opt.iconKey,
    label: opt.label,
    keywords: opt.keywords,
    icon: Icon ? <Icon className="h-6 w-6" strokeWidth={1.75} /> : undefined,
  };
});

function CategoryIcon({ iconKey, color }: { iconKey: string; color: string }) {
  const Icon = expenseIconCatalog[iconKey];
  if (!Icon) return null;
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
      style={{ backgroundColor: `${color}22`, color }}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

/**
 * Fila de "Distribución de gastos" (Hogar): misma jerarquía que el listado
 * Personal equivalente (icono · nombre · % · monto, barra completa debajo),
 * pero sobre tokens `--hh-*` y el color real de la categoría de Hogar.
 */
function HouseholdCategoryBreakdownRow({
  item,
  share,
  masked,
  isFirst,
  onSelect,
}: {
  item: CategoryBreakdownItem;
  share: number;
  masked: boolean;
  isFirst: boolean;
  onSelect: () => void;
}) {
  const color = item.color || DEFAULT_HOUSEHOLD_CATEGORY_COLOR;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-2.5 px-4 py-4 text-left outline-none transition-colors",
        "cursor-pointer hover:bg-[var(--hh-surface-hover)]",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--hh-focus-ring)]",
        !isFirst && "border-t border-[var(--hh-border)]/[0.06]",
      )}
    >
      <div className="flex items-center gap-3.5">
        <CategoryIcon iconKey={item.iconKey || DEFAULT_ICON} color={color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-semibold text-[var(--hh-text)]">{item.name}</span>
            <span className="shrink-0 text-xs font-medium text-[var(--hh-text-muted)]">{share}%</span>
          </div>
        </div>
        <HouseholdAmount
          value={item.total}
          showSign={false}
          masked={masked}
          className="shrink-0 text-sm font-medium text-[var(--hh-text)]"
        />
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--hh-border)]/[0.08]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${share}%`, backgroundColor: color }}
        />
      </div>
    </button>
  );
}

const buildEventTitle = (event: HouseholdEvent, categoryName?: string): string => {
  if (event.title.trim()) {
    return event.title;
  }
  if (categoryName) {
    return categoryName;
  }
  return "Gasto del hogar";
};

export function HouseholdCategoriesView({
  householdId,
  currentUid,
  categories,
  events,
  eventShares,
  debts,
  memberProfiles,
}: Props) {
  const { isSubmitting, error, resetError, create, update, archive, unarchive } = useHouseholdCategories();

  const [viewMode, setViewMode] = useState<ViewMode>("report");
  const [range, setRange] = useState<"month" | "year">("month");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "manage") {
        setViewMode("manage");
      }
    }
  }, []);

  const [mode, setMode] = useState<Mode>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", iconKey: DEFAULT_ICON, color: DEFAULT_HOUSEHOLD_CATEGORY_COLOR });
  const [submitted, setSubmitted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [selectedCategoryItem, setSelectedCategoryItem] = useState<CategoryBreakdownItem | null>(null);
  const [detailEvent, setDetailEvent] = useState<HouseholdEvent | null>(null);

  const activeCategories = categories.filter((c) => !c.archived);
  const archivedCategories = categories.filter((c) => c.archived);

  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);
  const masked = useUiPreferencesStore((state) => state.balancesHidden);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const movementDate = event.eventDate ?? event.createdAt;
      if (!movementDate) return false;

      if (range === "month") {
        return event.isActive && isSameMonthAndYear(movementDate, selectedPeriod);
      }
      return event.isActive && movementDate.getFullYear() === selectedPeriod.year;
    });
  }, [events, range, selectedPeriod]);

  const items = useMemo(() => groupCategoryBreakdown(filteredEvents, categories), [filteredEvents, categories]);
  const total = items.reduce((sum, item) => sum + item.total, 0);

  const categoryDetailEvents = useMemo(() => {
    if (!selectedCategoryItem) return [];
    return filteredEvents
      .filter((ev) => (ev.categoryId || "__none__") === selectedCategoryItem.categoryId)
      .sort((a, b) => {
        const da = a.eventDate ?? a.createdAt;
        const db = b.eventDate ?? b.createdAt;
        if (!da || !db) return 0;
        return db.getTime() - da.getTime();
      });
  }, [filteredEvents, selectedCategoryItem]);

  const nameError = submitted && !form.name.trim() ? "El nombre es obligatorio." : undefined;

  const resetForm = () => {
    setForm({ name: "", iconKey: DEFAULT_ICON, color: DEFAULT_HOUSEHOLD_CATEGORY_COLOR });
    setSubmitted(false);
    setEditingId(null);
    resetError();
  };

  const goList = () => {
    setMode("list");
    resetForm();
  };

  const goCreate = () => {
    resetForm();
    setMode("create");
  };

  const goEdit = (cat: HouseholdCategory) => {
    setForm({ name: cat.name, iconKey: cat.iconKey || DEFAULT_ICON, color: cat.color || DEFAULT_HOUSEHOLD_CATEGORY_COLOR });
    setEditingId(cat.id);
    setSubmitted(false);
    resetError();
    setMode("edit");
  };

  const handleArchive = async (cat: HouseholdCategory) => {
    setArchivingId(cat.id);
    await archive(cat.id);
    setArchivingId(null);
  };

  const handleUnarchive = async (cat: HouseholdCategory) => {
    setRestoringId(cat.id);
    await unarchive(cat.id);
    setRestoringId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!form.name.trim()) return;

    let ok = false;
    if (mode === "create") {
      ok = await create({
        householdId,
        createdByUserId: currentUid,
        name: form.name,
        iconKey: form.iconKey,
        color: form.color,
      });
    } else if (mode === "edit" && editingId) {
      ok = await update({ categoryId: editingId, name: form.name, iconKey: form.iconKey, color: form.color });
    }

    if (ok) goList();
  };

  return (
    <div className="space-y-6">
      {/* Segmented Control */}
      <div className="flex gap-2 rounded-2xl border border-[var(--hh-border)]/[0.08] bg-[var(--hh-surface-elevated)] p-1 w-full max-w-md mx-auto mb-2">
        <HouseholdButton
          className={cn(
            "flex-1 text-center justify-center rounded-xl py-2",
            viewMode === "report" ? "bg-[var(--hh-primary-action)] text-[var(--hh-surface)] font-semibold border border-[var(--hh-border)]" : "text-[var(--hh-text-muted)] border border-transparent"
          )}
          onClick={() => setViewMode("report")}
          size="sm"
          tone={viewMode === "report" ? "filled" : "text"}
          type="button"
          variant="ghost"
        >
          Distribución de gastos
        </HouseholdButton>
        <HouseholdButton
          className={cn(
            "flex-1 text-center justify-center rounded-xl py-2",
            viewMode === "manage" ? "bg-[var(--hh-primary-action)] text-[var(--hh-surface)] font-semibold border border-[var(--hh-border)]" : "text-[var(--hh-text-muted)] border border-transparent"
          )}
          onClick={() => setViewMode("manage")}
          size="sm"
          tone={viewMode === "manage" ? "filled" : "text"}
          type="button"
          variant="ghost"
        >
          Categorías del hogar
        </HouseholdButton>
      </div>

      {viewMode === "report" ? (
        <>
          <HouseholdCard variant="hero">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--hh-text-muted)]">
                  Total gastado {range === "month" ? "este mes" : "este año"}
                </p>
                <HouseholdAmount masked={masked} showSign={false} size="hero" value={total} variant="default" />
              </div>
              <div className="flex gap-2 rounded-2xl border border-[var(--hh-border)]/[0.08] bg-[var(--hh-surface-elevated)] p-1">
                <HouseholdButton
                  className={cn(range === "month" ? "bg-[var(--hh-primary-action)] text-[var(--hh-surface)] font-semibold border border-[var(--hh-border)]" : "border border-transparent")}
                  onClick={() => setRange("month")}
                  size="sm"
                  tone={range === "month" ? "filled" : "text"}
                  type="button"
                  variant="ghost"
                >
                  Mes
                </HouseholdButton>
                <HouseholdButton
                  className={cn(range === "year" ? "bg-[var(--hh-primary-action)] text-[var(--hh-surface)] font-semibold border border-[var(--hh-border)]" : "border border-transparent")}
                  onClick={() => setRange("year")}
                  size="sm"
                  tone={range === "year" ? "filled" : "text"}
                  type="button"
                  variant="ghost"
                >
                  Año
                </HouseholdButton>
              </div>
            </div>
          </HouseholdCard>

          <HouseholdCard variant="default" className="p-0 overflow-hidden">
            {!items.length ? (
              <HouseholdEmptyState title="Sin gastos agrupables" description="No hay gastos para este rango de tiempo." />
            ) : (
              <div className="flex flex-col">
                {items.map((item, index) => {
                  const share = total > 0 ? Math.round((item.total / total) * 100) : 0;
                  return (
                    <HouseholdCategoryBreakdownRow
                      key={item.categoryId}
                      item={item}
                      share={share}
                      masked={masked}
                      isFirst={index === 0}
                      onSelect={() => setSelectedCategoryItem(item)}
                    />
                  );
                })}
              </div>
            )}
          </HouseholdCard>
        </>
      ) : (
        <>
        <div className="space-y-6 rounded-[24px] border border-[var(--hh-border)]/[0.08] bg-[var(--hh-surface)] p-6 shadow-sm">
          <button
            type="button"
            onClick={goCreate}
            className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-[var(--hh-primary-action)]/40 px-4 py-3 text-sm font-medium text-[var(--hh-primary-action)] transition-colors hover:bg-[var(--hh-primary-action)]/[0.06]"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Nueva categoría
          </button>

          {activeCategories.length === 0 && (
            <p className="py-4 text-center text-sm text-[var(--hh-text-muted)]">
              No hay categorías activas. Crea la primera.
            </p>
          )}
          {activeCategories.length > 0 && (
            <div className="space-y-1.5">
              {activeCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 rounded-[14px] border border-[var(--hh-border)]/[0.05] bg-[var(--hh-surface-elevated)] px-3 py-2.5"
                >
                  <CategoryIcon iconKey={cat.iconKey} color={cat.color} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--hh-text)]">
                    {cat.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => goEdit(cat)}
                    aria-label={`Editar ${cat.name}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-transparent text-[var(--hh-text-muted)] transition-colors hover:border-[var(--hh-border)] hover:bg-[var(--hh-surface)] hover:text-[var(--hh-text)]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(cat)}
                    disabled={archivingId === cat.id}
                    aria-label={`Archivar ${cat.name}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-transparent text-[var(--hh-text-muted)] transition-colors hover:border-[var(--hh-border)] hover:bg-[var(--hh-surface)] hover:text-[var(--hh-destructive-border)] disabled:opacity-40"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {archivedCategories.length > 0 && (
            <div className="border-t border-[var(--hh-border)]/[0.06] pt-3">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="flex w-full items-center justify-between gap-2 py-1 text-xs font-medium text-[var(--hh-text-muted)] transition-colors hover:text-[var(--hh-text)]"
              >
                <span>Archivadas ({archivedCategories.length})</span>
                {showArchived ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {showArchived && (
                <div className="mt-2 space-y-1.5">
                  {archivedCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 rounded-[14px] border border-[var(--hh-border)]/[0.04] bg-[var(--hh-surface-elevated)] px-3 py-2.5 opacity-50"
                    >
                      <CategoryIcon iconKey={cat.iconKey} color={cat.color} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--hh-text-muted)] line-through">
                        {cat.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-[var(--hh-text-muted)]">Archivada</span>
                      <button
                        type="button"
                        onClick={() => handleUnarchive(cat)}
                        disabled={restoringId === cat.id}
                        aria-label={`Restaurar ${cat.name}`}
                        title="Restaurar categoría"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-transparent text-[var(--hh-text-muted)] transition-colors hover:border-[var(--hh-border)] hover:bg-[var(--hh-surface)] hover:text-[var(--hh-primary-action)] disabled:opacity-40"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <HouseholdDialog
          open={mode === "create" || mode === "edit"}
          onClose={goList}
          title={mode === "edit" ? "Editar categoría" : "Crear categoría"}
          subtitle={
            mode === "edit"
              ? "Actualiza nombre, color e ícono del hogar"
              : "Añadir nueva categoría de gasto del hogar"
          }
          size="wide"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label htmlFor="household-category-name" className="text-[14px] font-medium text-[var(--hh-text)]">
                  Nombre
                </label>
                <span className="rounded-full border border-[var(--hh-primary-action)]/40 bg-[var(--hh-primary-action)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--hh-primary-action)]">
                  Obligatorio
                </span>
              </div>
              <div className="relative">
                <input
                  id="household-category-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  autoFocus
                  placeholder="Ej: Mercado, Servicios, Arriendo…"
                  className="h-11 w-full rounded-[14px] border border-[var(--hh-border)] bg-[var(--hh-surface)] py-2 pl-3 pr-12 text-[16px] text-[var(--hh-text)] outline-none placeholder:text-[var(--hh-text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)] sm:text-[14px]"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border"
                  style={{ backgroundColor: `${form.color}22`, borderColor: `${form.color}55`, color: form.color }}
                >
                  {(() => {
                    const PreviewIcon = expenseIconCatalog[form.iconKey];
                    return PreviewIcon ? <PreviewIcon className="h-3.5 w-3.5" /> : null;
                  })()}
                </span>
              </div>
              {nameError ? (
                <p className="text-[12px] text-[var(--hh-destructive-content)]" role="alert">
                  {nameError}
                </p>
              ) : null}
            </div>

            <HouseholdIconSelect
              options={iconSelectOptions}
              groups={EXPENSE_ICON_GROUPS}
              colorPalette={HOUSEHOLD_CATEGORY_COLORS}
              selectedIconKey={form.iconKey}
              selectedColor={form.color}
              onSelectIcon={(v) => setForm((f) => ({ ...f, iconKey: v }))}
              onSelectColor={(v) => setForm((f) => ({ ...f, color: v }))}
            />

            {error && (
              <div className="rounded-[12px] border border-[var(--hh-destructive-border)] bg-[var(--hh-surface)] px-3 py-2.5 text-sm text-[var(--hh-destructive-border)]">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-[var(--hh-border)]/[0.06] pt-4">
              <HouseholdButton
                type="button"
                tone="text"
                variant="ghost"
                onClick={goList}
                disabled={isSubmitting}
                className="border border-[var(--hh-border)]"
              >
                Cancelar
              </HouseholdButton>
              <HouseholdButton
                type="submit"
                tone="filled"
                disabled={isSubmitting || !form.name.trim()}
                className="bg-[var(--hh-primary-action)] text-[var(--hh-surface)] shadow-none hover:bg-[color-mix(in_oklch,var(--hh-primary-action),white_8%)]"
              >
                {isSubmitting ? "Guardando…" : mode === "edit" ? "Guardar cambios" : "Crear categoría"}
              </HouseholdButton>
            </div>
          </form>
        </HouseholdDialog>
        </>
      )}

      {/* Detail dialog for a category */}
      <HouseholdDialog
        open={selectedCategoryItem !== null}
        onClose={() => setSelectedCategoryItem(null)}
        title={selectedCategoryItem?.name ?? "Categoría"}
        subtitle={`Gastos del hogar en ${range === "month" ? "este mes" : "este año"}`}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[var(--hh-surface)] rounded-2xl border border-[var(--hh-border)]/[0.06] p-4">
            <span className="text-sm font-medium text-[var(--hh-text-muted)]">Total gastado</span>
            <HouseholdAmount value={selectedCategoryItem?.total ?? 0} showSign={false} size="lg" />
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 pb-4">
            {categoryDetailEvents.map((event) => {
              const isEventCancelled = event.status === "cancelled" || event.status === "cancelado";
              const extraIndicator = isEventCancelled ? (
                <HouseholdChip variant="neutral" className="h-5 min-h-5 py-0 px-2 text-[10px]">
                  Cancelado
                </HouseholdChip>
              ) : null;
              return (
                <button
                  key={event.id}
                  type="button"
                  className="w-full text-left cursor-pointer rounded-[20px] transition-all hover:bg-[var(--hh-border)]/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-primary-action)]"
                  onClick={() => setDetailEvent(event)}
                >
                  <HouseholdTimelineItem
                    title={buildEventTitle(event, selectedCategoryItem?.name)}
                    subtitle={event.notes || selectedCategoryItem?.name || "Evento del hogar"}
                    amount={event.amount}
                    type="expense"
                    dateLabel={(event.eventDate ?? event.createdAt) ? formatDateEs((event.eventDate ?? event.createdAt)!) : "Sin fecha"}
                    metadata={selectedCategoryItem?.name || "Sin categoría"}
                    extraIndicator={extraIndicator}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </HouseholdDialog>

      <HouseholdEventDetailDialog
        open={detailEvent !== null}
        event={detailEvent}
        categories={categories}
        eventShares={eventShares}
        debts={debts}
        currentUid={currentUid}
        memberProfiles={memberProfiles}
        onClose={() => setDetailEvent(null)}
      />
    </div>
  );
}
