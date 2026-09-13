"use client";

import { cn } from "@/lib/utils";
import type { CategoryDisplayMode } from "@/features/movements/lib/category-display-mode";

export type CategoryDisplayModeToggleProps = {
  mode: CategoryDisplayMode;
  onChange: (mode: CategoryDisplayMode) => void;
  theme?: "personal" | "household";
  className?: string;
};

/**
 * Selector segmentado compacto (% / $) para las tarjetas de categorías
 * (§ Paridad Android SegmentedDisplayModeSelector / Dev Log 2026-09-02).
 */
export function CategoryDisplayModeToggle({
  mode,
  onChange,
  theme = "personal",
  className,
}: CategoryDisplayModeToggleProps) {
  const isPersonal = theme === "personal";

  return (
    <div
      role="group"
      aria-label="Modo de visualización de categorías"
      className={cn(
        "flex items-center rounded-xl p-0.5 select-none transition-colors",
        isPersonal
          ? "bg-white/4 border border-white/6"
          : "bg-white/4 border border-[var(--hh-border-soft)]",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Ver en porcentaje"
        aria-pressed={mode === "percentage"}
        onClick={() => onChange("percentage")}
        className={cn(
          "cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-150 outline-none select-none",
          isPersonal
            ? cn(
                "focus-visible:ring-2 focus-visible:ring-[var(--fm-pending)]",
                mode === "percentage"
                  ? "bg-[var(--fm-pending,#e4b363)] text-[var(--fm-ink,#111827)] font-bold shadow-sm"
                  : "text-[var(--fm-text-muted)] hover:bg-white/[0.04] hover:text-[var(--fm-warm-paper)]",
              )
            : cn(
                "focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]",
                mode === "percentage"
                  ? "bg-[var(--hh-primary-action,#4ade80)] text-[var(--hh-surface,#111827)] font-bold shadow-sm"
                  : "text-[var(--hh-text-muted)] hover:bg-white/[0.04] hover:text-[var(--hh-text)]",
              ),
        )}
      >
        %
      </button>

      <button
        type="button"
        aria-label="Ver en monto"
        aria-pressed={mode === "amount"}
        onClick={() => onChange("amount")}
        className={cn(
          "cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-150 outline-none select-none",
          isPersonal
            ? cn(
                "focus-visible:ring-2 focus-visible:ring-[var(--fm-pending)]",
                mode === "amount"
                  ? "bg-[var(--fm-pending,#e4b363)] text-[var(--fm-ink,#111827)] font-bold shadow-sm"
                  : "text-[var(--fm-text-muted)] hover:bg-white/[0.04] hover:text-[var(--fm-warm-paper)]",
              )
            : cn(
                "focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]",
                mode === "amount"
                  ? "bg-[var(--hh-primary-action,#4ade80)] text-[var(--hh-surface,#111827)] font-bold shadow-sm"
                  : "text-[var(--hh-text-muted)] hover:bg-white/[0.04] hover:text-[var(--hh-text)]",
              ),
        )}
      >
        $
      </button>
    </div>
  );
}
