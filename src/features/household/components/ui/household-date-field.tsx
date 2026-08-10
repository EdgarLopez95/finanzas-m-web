"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

import {
  formatDateInputValue,
  getTodayDateInputValue,
  parseDateInputAsLocalDate,
} from "@/lib/format/date";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"] as const;

const MONTH_TITLE = (year: number, monthIndex: number): string => {
  const label = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(
    new Date(year, monthIndex, 1),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatDisplay = (value: string): string => {
  const parsed = parseDateInputAsLocalDate(value);
  if (!parsed) return value || "Elegir fecha";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
};

type HouseholdDateFieldProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Campo de fecha Hogar (`--hh-*`): al tocar el campo o el ícono abre un
 * calendario propio (día / mes / año) en tokens del hogar.
 */
export function HouseholdDateField({
  id,
  label = "Fecha",
  value,
  onChange,
  disabled = false,
  className,
}: HouseholdDateFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const panelId = `${fieldId}-calendar`;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = parseDateInputAsLocalDate(value);
  const initialCursor = selected ?? new Date();

  const [open, setOpen] = useState(false);
  const [cursorYear, setCursorYear] = useState(initialCursor.getFullYear());
  const [cursorMonth, setCursorMonth] = useState(initialCursor.getMonth());
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const [positioned, setPositioned] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = parseDateInputAsLocalDate(value) ?? new Date();
    setCursorYear(base.getFullYear());
    setCursorMonth(base.getMonth());
  }, [open, value]);

  const days = useMemo(() => {
    const first = new Date(cursorYear, cursorMonth, 1);
    // Lunes = 0 … Domingo = 6
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(cursorYear, cursorMonth + 1, 0).getDate();
    const cells: Array<{ day: number; dateValue: string } | null> = [];
    for (let i = 0; i < startOffset; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({
        day,
        dateValue: formatDateInputValue(new Date(cursorYear, cursorMonth, day)),
      });
    }
    return cells;
  }, [cursorYear, cursorMonth]);

  const openPanel = () => {
    if (disabled || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelStyle({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) });
    setPositioned(false);
    setOpen(true);
  };

  const closePanel = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        closePanel();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closePanel();
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelH = panelRef.current.getBoundingClientRect().height;
    const width = Math.max(rect.width, 280);
    const margin = 8;
    let top = rect.bottom + 4;
    if (top + panelH > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - panelH - 4);
    }
    let left = rect.left;
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - width - margin);
    }
    setPanelStyle({ top, left, width });
    setPositioned(true);
  }, [open, cursorMonth, cursorYear]);

  const goPrevMonth = () => {
    if (cursorMonth === 0) {
      setCursorMonth(11);
      setCursorYear((y) => y - 1);
      return;
    }
    setCursorMonth((m) => m - 1);
  };

  const goNextMonth = () => {
    if (cursorMonth === 11) {
      setCursorMonth(0);
      setCursorYear((y) => y + 1);
      return;
    }
    setCursorMonth((m) => m + 1);
  };

  const selectDay = (dateValue: string) => {
    onChange(dateValue);
    closePanel();
  };

  const todayValue = getTodayDateInputValue();

  const panel = open ? (
    <div
      ref={panelRef}
      id={panelId}
      role="dialog"
      aria-label="Elegir fecha"
      data-fm-context="household"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "fixed z-[200] rounded-[18px] border border-[var(--hh-border)] bg-[var(--hh-surface-elevated)] p-3 shadow-[var(--hh-shadow-soft)]",
        positioned
          ? "animate-in fade-in zoom-in-95 duration-150"
          : "pointer-events-none opacity-0",
      )}
      style={panelStyle ?? { top: 0, left: 0, width: 280 }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goPrevMonth}
          aria-label="Mes anterior"
          className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[var(--hh-text-muted)] outline-none transition-colors hover:bg-[var(--hh-surface-hover)] hover:text-[var(--hh-text)] focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-[13px] font-semibold text-[var(--hh-text)]">
          {MONTH_TITLE(cursorYear, cursorMonth)}
        </p>
        <button
          type="button"
          onClick={goNextMonth}
          aria-label="Mes siguiente"
          className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[var(--hh-text-muted)] outline-none transition-colors hover:bg-[var(--hh-surface-hover)] hover:text-[var(--hh-text)] focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <span
            key={day}
            className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--hh-text-muted)]"
          >
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((cell, index) => {
          if (!cell) {
            return <span key={`empty-${index}`} className="h-9" />;
          }
          const isSelected = cell.dateValue === value;
          const isToday = cell.dateValue === todayValue;
          return (
            <button
              key={cell.dateValue}
              type="button"
              onClick={() => selectDay(cell.dateValue)}
              className={cn(
                "flex h-9 items-center justify-center rounded-[10px] text-[13px] font-medium outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]",
                isSelected
                  ? "bg-[var(--hh-primary-action)] text-[var(--hh-on-primary)]"
                  : isToday
                    ? "border border-[var(--hh-primary-action)]/50 text-[var(--hh-primary-action)] hover:bg-[var(--hh-surface-hover)]"
                    : "text-[var(--hh-text)] hover:bg-[var(--hh-surface-hover)]",
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--hh-border)] pt-2">
        <button
          type="button"
          onClick={() => selectDay(todayValue)}
          className="rounded-[10px] px-2 py-1.5 text-[12px] font-semibold text-[var(--hh-primary-action)] outline-none hover:bg-[var(--hh-surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
        >
          Hoy
        </button>
        <button
          type="button"
          onClick={closePanel}
          className="rounded-[10px] px-2 py-1.5 text-[12px] font-medium text-[var(--hh-text-muted)] outline-none hover:bg-[var(--hh-surface-hover)] hover:text-[var(--hh-text)] focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
        >
          Cerrar
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <label htmlFor={fieldId} className="text-[14px] font-medium text-[var(--hh-text)]">
          {label}
        </label>
      ) : null}

      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? closePanel() : openPanel())}
        className={cn(
          "relative flex h-11 w-full items-center rounded-[14px] border border-[var(--hh-border)] bg-[var(--hh-surface)] px-3 pr-10 text-left text-[16px] text-[var(--hh-text)] outline-none sm:text-[14px]",
          "transition-colors hover:bg-[var(--hh-surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]",
          disabled && "cursor-not-allowed opacity-50",
          open && "border-[var(--hh-primary-action)]",
        )}
      >
        <span className="truncate">{formatDisplay(value)}</span>
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--hh-text-muted)]"
        >
          <Calendar className="h-4 w-4" />
        </span>
      </button>

      {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
