"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { FinanceDialog } from "@/components/finance/finance-dialog";
import { formatPeriodSummary, type SelectedPeriod } from "@/lib/format/date";
import { cn } from "@/lib/utils";

type PeriodPickerDialogProps = {
  open: boolean;
  onClose: () => void;
  selectedPeriod: SelectedPeriod;
  onSelectPeriod: (period: SelectedPeriod) => void;
};

const MONTH_ABBREVIATIONS = [
  "Ene", "Feb", "Mar", "Abr",
  "May", "Jun", "Jul", "Ago",
  "Sep", "Oct", "Nov", "Dic"
];

export function PeriodPickerDialog({
  open,
  onClose,
  selectedPeriod,
  onSelectPeriod,
}: PeriodPickerDialogProps) {
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
    onSelectPeriod({
      year: tempYear,
      month: monthIndex,
    });
    onClose();
  };

  // Mostrar como subtítulo el mes seleccionado pero con el año actual en visualización
  const currentViewedPeriodSummary = formatPeriodSummary({
    year: tempYear,
    month: selectedPeriod.month,
  });

  return (
    <FinanceDialog
      open={open}
      onClose={onClose}
      title="Elegir período"
      subtitle={currentViewedPeriodSummary}
    >
      <div className="flex flex-col gap-2">
        {/* Selector de año */}
        <div className="flex items-center justify-between border border-white/8 bg-[rgba(20,27,40,0.84)] rounded-xl py-1.5 px-3 w-fit mx-auto gap-4 my-1">
          <button
            onClick={handlePrevYear}
            className="p-1 text-[var(--fm-text-soft)] hover:text-[var(--fm-warm-paper)] transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--fm-transfer)] cursor-pointer"
            aria-label="Año anterior"
            type="button"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-base font-bold tracking-tight text-[var(--fm-warm-paper)] select-none min-w-[3.5rem] text-center">
            {tempYear}
          </span>
          <button
            onClick={handleNextYear}
            disabled={tempYear >= currentRealYear}
            className="p-1 text-[var(--fm-text-soft)] hover:text-[var(--fm-warm-paper)] transition-colors rounded-lg disabled:opacity-20 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--fm-transfer)] cursor-pointer"
            aria-label="Año siguiente"
            type="button"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Grid de meses */}
        <div className="grid grid-cols-4 gap-2.5 mt-4">
          {MONTH_ABBREVIATIONS.map((abb, idx) => {
            const isSelected = selectedPeriod.year === tempYear && selectedPeriod.month === idx;
            const now = new Date();
            const isFuture = tempYear === now.getFullYear() && idx > now.getMonth();

            return (
              <button
                key={abb}
                onClick={() => handleSelectMonth(idx)}
                type="button"
                disabled={isFuture}
                className={cn(
                  "border font-semibold rounded-[16px] py-3 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)] cursor-pointer text-sm",
                  isSelected
                    ? "border-[var(--fm-pending)] text-[var(--fm-pending)] bg-[rgba(228,179,99,0.08)] shadow-[0_0_12px_rgba(228,179,99,0.15)]"
                    : isFuture
                    ? "border-transparent bg-transparent text-white/10 cursor-not-allowed pointer-events-none"
                    : "border-white/8 bg-[rgba(20,27,40,0.4)] text-[var(--fm-text-soft)] hover:bg-[rgba(28,38,57,0.8)] hover:text-[var(--fm-warm-paper)]"
                )}
              >
                {abb}
              </button>
            );
          })}
        </div>
      </div>
    </FinanceDialog>
  );
}
