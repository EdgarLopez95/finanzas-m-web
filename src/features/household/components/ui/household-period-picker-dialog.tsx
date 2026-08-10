"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { HouseholdDialog } from "@/features/household/components/ui/household-dialog";
import { formatPeriodSummary, type SelectedPeriod } from "@/lib/format/date";
import { cn } from "@/lib/utils";

/**
 * Selector de período del libro compartido. Espejo funcional del
 * `PeriodPickerDialog` de Finance: mismo comportamiento de año temporal,
 * bloqueo de meses futuros, tope en el año actual y cierre al elegir mes.
 * Solo consume roles `--hh-*` y el `HouseholdDialog` del kit Hogar.
 */
type HouseholdPeriodPickerDialogProps = {
  open: boolean;
  onClose: () => void;
  selectedPeriod: SelectedPeriod;
  onSelectPeriod: (period: SelectedPeriod) => void;
};

const MONTH_ABBREVIATIONS = [
  "Ene", "Feb", "Mar", "Abr",
  "May", "Jun", "Jul", "Ago",
  "Sep", "Oct", "Nov", "Dic",
];

export function HouseholdPeriodPickerDialog({
  open,
  onClose,
  selectedPeriod,
  onSelectPeriod,
}: HouseholdPeriodPickerDialogProps) {
  const [tempYear, setTempYear] = useState(selectedPeriod.year);

  // Sincronizar el año temporal cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      setTempYear(selectedPeriod.year);
    }
  }, [open, selectedPeriod.year]);

  const now = new Date();
  const currentRealYear = now.getFullYear();

  const handlePrevYear = () => {
    setTempYear((prev) => prev - 1);
  };

  const handleNextYear = () => {
    if (tempYear < currentRealYear) {
      setTempYear((prev) => prev + 1);
    }
  };

  const handleSelectMonth = (monthIndex: number) => {
    onSelectPeriod({ year: tempYear, month: monthIndex });
    onClose();
  };

  const currentViewedPeriodSummary = formatPeriodSummary({
    year: tempYear,
    month: selectedPeriod.month,
  });

  return (
    <HouseholdDialog
      open={open}
      onClose={onClose}
      title="Elegir período"
      subtitle={currentViewedPeriodSummary}
    >
      <div className="flex flex-col gap-2">
        {/* Selector de año */}
        <div className="mx-auto my-1 flex w-fit items-center justify-between gap-4 rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-elevated)] px-3 py-1.5">
          <button
            onClick={handlePrevYear}
            className="cursor-pointer rounded-lg p-1 text-[var(--hh-text-secondary)] transition-colors hover:text-[var(--hh-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--hh-focus-ring)]"
            aria-label="Año anterior"
            type="button"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[3.5rem] select-none text-center text-base font-bold tracking-tight text-[var(--hh-text)]">
            {tempYear}
          </span>
          <button
            onClick={handleNextYear}
            disabled={tempYear >= currentRealYear}
            className="cursor-pointer rounded-lg p-1 text-[var(--hh-text-secondary)] transition-colors hover:text-[var(--hh-text)] disabled:pointer-events-none disabled:opacity-20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--hh-focus-ring)]"
            aria-label="Año siguiente"
            type="button"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Grid de meses */}
        <div className="mt-4 grid grid-cols-4 gap-2.5">
          {MONTH_ABBREVIATIONS.map((abb, idx) => {
            const isSelected = selectedPeriod.year === tempYear && selectedPeriod.month === idx;
            const today = new Date();
            const isFuture = tempYear === today.getFullYear() && idx > today.getMonth();

            return (
              <button
                key={abb}
                onClick={() => handleSelectMonth(idx)}
                type="button"
                disabled={isFuture}
                className={cn(
                  "cursor-pointer rounded-[16px] border py-3 text-center text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]",
                  isSelected
                    ? "border-[var(--hh-primary-action)] bg-[var(--hh-primary-action)] text-[var(--hh-on-primary)] shadow-[var(--hh-shadow-soft)]"
                    : isFuture
                      ? "pointer-events-none cursor-not-allowed border-transparent bg-transparent text-[var(--hh-text-muted)] opacity-30"
                      : "border-[var(--hh-border)] bg-[var(--hh-surface)] text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-hover)] hover:text-[var(--hh-text)]"
                )}
              >
                {abb}
              </button>
            );
          })}
        </div>
      </div>
    </HouseholdDialog>
  );
}
