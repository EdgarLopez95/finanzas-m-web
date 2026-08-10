"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdCard } from "@/features/household/components/ui/household-card";
import { HouseholdTimelineItem } from "@/features/household/components/ui/household-timeline-item";
import { HouseholdChip } from "@/features/household/components/ui/household-chip";
import { HouseholdEmptyState } from "@/features/household/components/ui/household-empty-state";
import { HouseholdCategorySelect } from "@/features/household/components/ui/household-category-select";
import { formatDateEs, isSameMonthAndYear } from "@/lib/format/date";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { useAppContextStore } from "@/stores/app-context-store";
import { cn } from "@/lib/utils";
import type {
  HouseholdCategory,
  HouseholdEvent,
  HouseholdIncomeEntry,
} from "@/types/household";

type TimelineItemData = {
  id: string;
  type: "event" | "income";
  date: Date | null;
  data: HouseholdEvent | HouseholdIncomeEntry;
};

type Props = {
  events: HouseholdEvent[];
  incomeEntries: HouseholdIncomeEntry[];
  categories: HouseholdCategory[];
  onSelectEvent: (event: HouseholdEvent) => void;
};

const buildEventTitle = (event: HouseholdEvent, categoryName?: string): string => {
  if (event.title.trim().length > 0) return event.title;
  return categoryName ? `Gasto · ${categoryName}` : "Gasto del hogar";
};

export function HouseholdMovementsView({
  events,
  incomeEntries,
  categories,
  onSelectEvent,
}: Props) {
  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "cancelled">("all");
  // Paridad Android: MovementsViewModel.kt expone "Tipo de movimiento"
  // (Todos/Gastos/Ingresos) también en contexto Hogar.
  const [selectedType, setSelectedType] = useState<"all" | "expense" | "income">("all");

  const categoryNames = useMemo(() => {
    return new Map(categories.map((cat) => [cat.id, cat.name]));
  }, [categories]);

  const categoriesForSelect = useMemo(() => {
    const active = categories.filter((c) => !c.archived);
    const referencedArchived = categories.filter(
      (c) => c.archived && events.some((e) => e.categoryId === c.id)
    );
    return [...active, ...referencedArchived];
  }, [categories, events]);

  const filteredTimeline = useMemo(() => {
    const combined: TimelineItemData[] = [
      ...events.map((e) => ({
        id: `event-${e.id}`,
        type: "event" as const,
        date: e.eventDate ?? e.createdAt,
        data: e,
      })),
      ...incomeEntries.map((e) => ({
        id: `income-${e.id}`,
        type: "income" as const,
        date: e.entryDate ?? e.createdAt,
        data: e,
      })),
    ];

    return combined
      .filter((item) => {
        if (!item.date || !isSameMonthAndYear(item.date, selectedPeriod)) {
          return false;
        }

        if (selectedType !== "all") {
          if (selectedType === "expense" && item.type !== "event") return false;
          if (selectedType === "income" && item.type !== "income") return false;
        }

        if (selectedCategoryId !== "all") {
          if (item.type === "income") return false;
          const event = item.data as HouseholdEvent;
          if (event.categoryId !== selectedCategoryId) {
            return false;
          }
        }

        if (selectedStatus !== "all") {
          if (item.type === "income") {
            if (selectedStatus === "cancelled") return false;
          } else {
            const event = item.data as HouseholdEvent;
            const isCancelled =
              event.status === "cancelled" ||
              event.status === "cancelado" ||
              event.status === "canceled";
            if (selectedStatus === "active" && (!event.isActive || isCancelled)) {
              return false;
            }
            if (selectedStatus === "cancelled" && !isCancelled) {
              return false;
            }
          }
        }

        return true;
      })
      .sort((a, b) => {
        const aTime = a.date?.getTime() ?? 0;
        const bTime = b.date?.getTime() ?? 0;
        return bTime - aTime;
      });
  }, [events, incomeEntries, selectedPeriod, selectedCategoryId, selectedStatus, selectedType]);

  const activeFilterCount = [
    selectedType !== "all",
    selectedStatus !== "all",
    selectedCategoryId !== "all",
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setSelectedType("all");
    setSelectedStatus("all");
    setSelectedCategoryId("all");
  };

  return (
    <div className="space-y-6">
      <HouseholdCard variant="default">
        <div className="flex flex-col xl:flex-row xl:items-center gap-4 xl:gap-5 flex-wrap">
          {/* 1. Tipo — pills como Personal */}
          <div
            id="household-history-type"
            className="flex flex-wrap gap-2 shrink-0"
            role="group"
            aria-label="Tipo de movimiento"
          >
            {(
              [
                ["all", "Todos"],
                ["expense", "Gastos"],
                ["income", "Ingresos"],
              ] as const
            ).map(([value, label]) => {
              const active = selectedType === value;
              return (
                <HouseholdButton
                  key={value}
                  type="button"
                  size="sm"
                  tone={active ? "filled" : "text"}
                  variant={active ? "default" : "ghost"}
                  onClick={() => setSelectedType(value)}
                  className={cn(
                    "h-9",
                    active
                      ? "bg-[var(--hh-surface-hover)] text-[var(--hh-text)] border border-[var(--hh-border)]"
                      : "text-[var(--hh-text-muted)] hover:text-[var(--hh-text)]"
                  )}
                >
                  {label}
                </HouseholdButton>
              );
            })}
          </div>

          {/* 2. Estado */}
          <div
            id="household-history-status"
            className="flex flex-wrap items-center gap-2 xl:border-l xl:border-[var(--hh-border)] xl:pl-5 shrink-0"
            role="group"
            aria-label="Estado"
          >
            <span className="text-[11px] font-semibold text-[var(--hh-text-muted)] uppercase tracking-wider sr-only xl:not-sr-only xl:mr-1">
              Estado:
            </span>
            {(
              [
                ["all", "Todos"],
                ["active", "Activos"],
                ["cancelled", "Cancelados"],
              ] as const
            ).map(([value, label]) => {
              const active = selectedStatus === value;
              return (
                <HouseholdButton
                  key={value}
                  type="button"
                  size="sm"
                  tone={active ? "filled" : "text"}
                  variant={active ? "default" : "ghost"}
                  onClick={() => setSelectedStatus(value)}
                  className={cn(
                    "h-9",
                    active
                      ? "bg-[var(--hh-surface-hover)] text-[var(--hh-text)] border border-[var(--hh-border)]"
                      : "text-[var(--hh-text-muted)] hover:text-[var(--hh-text)]"
                  )}
                >
                  {label}
                </HouseholdButton>
              );
            })}
          </div>

          {/* 3. Categoría */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 xl:border-l xl:border-[var(--hh-border)] xl:pl-5 shrink-0">
            <div className="w-full sm:w-48">
              <label htmlFor="household-history-category" className="sr-only">
                Categoría
              </label>
              <HouseholdCategorySelect
                id="household-history-category"
                value={selectedCategoryId}
                onChange={setSelectedCategoryId}
                className="h-9 text-[16px] sm:text-[12px] rounded-xl"
                options={[
                  { id: "all", label: "Todas las categorías" },
                  ...categoriesForSelect.map((cat) => {
                    const Icon = resolveCategoryIcon(cat.iconKey ?? "", "expense");
                    return {
                      id: cat.id,
                      label: cat.name + (cat.archived ? " (Archivada)" : ""),
                      color: cat.color,
                      icon: <Icon className="h-3.5 w-3.5" />,
                    };
                  }),
                ]}
              />
            </div>
          </div>

          {/* 4. Limpiar */}
          {activeFilterCount > 0 && (
            <div className="xl:ml-auto w-full xl:w-auto flex justify-end">
              <button
                type="button"
                onClick={handleClearFilters}
                aria-label="Limpiar filtros"
                className="flex w-full xl:w-auto shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface)] px-3 h-9 text-xs text-[var(--hh-text-muted)] hover:text-[var(--hh-text)] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                <span>Limpiar</span>
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--hh-primary-action)] text-[9px] font-bold text-[var(--hh-on-primary)]">
                  {activeFilterCount}
                </span>
              </button>
            </div>
          )}
        </div>
      </HouseholdCard>

      <HouseholdCard variant="default">
        {filteredTimeline.length > 0 ? (
          <div className="space-y-2 w-full">
            {filteredTimeline.map((item) => {
              if (item.type === "event") {
                const event = item.data as HouseholdEvent;
                const categoryName = categoryNames.get(event.categoryId);

                let extraIndicator: React.ReactNode = null;
                const isEventCancelled =
                  event.status === "cancelled" ||
                  event.status === "cancelado" ||
                  event.status === "canceled";

                if (isEventCancelled) {
                  extraIndicator = (
                    <HouseholdChip variant="neutral" className="h-5 min-h-5 py-0 px-2 text-[10px]">
                      Evento Cancelado
                    </HouseholdChip>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full text-left cursor-pointer rounded-[20px] transition-all hover:bg-[var(--hh-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-primary-action)]"
                    onClick={() => onSelectEvent(event)}
                  >
                    <HouseholdTimelineItem
                      title={buildEventTitle(event, categoryName)}
                      subtitle={event.notes || categoryName || "Evento del hogar"}
                      amount={event.amount}
                      type="expense"
                      dateLabel={item.date ? formatDateEs(item.date) : "Sin fecha"}
                      metadata={categoryName || "Sin categoría"}
                      extraIndicator={extraIndicator}
                    />
                  </button>
                );
              }

              const entry = item.data as HouseholdIncomeEntry;
              return (
                <div key={item.id} className="w-full">
                  <HouseholdTimelineItem
                    title={entry.visibleDescription || "Ingreso compartido"}
                    subtitle="Aporte de Hogar"
                    amount={entry.amount}
                    type="income"
                    dateLabel={item.date ? formatDateEs(item.date) : "Sin fecha"}
                    metadata="Ingreso"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <HouseholdEmptyState
            title="Sin resultados"
            description="No hay movimientos que coincidan con los filtros seleccionados."
          />
        )}
      </HouseholdCard>
    </div>
  );
}
