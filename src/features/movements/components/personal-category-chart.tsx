"use client";

import { Amount } from "@/components/finance/amount";
import type { DashboardCategoryChartItem } from "@/features/movements/lib/personal-month-view-model";
import { cn } from "@/lib/utils";

export interface PersonalCategoryChartProps {
  items: readonly DashboardCategoryChartItem[];
  mode: "expense" | "income";
  className?: string;
}

export function PersonalCategoryChart({
  items,
  mode,
  className,
}: PersonalCategoryChartProps) {
  if (items.length === 0) {
    return null;
  }

  const modeLabel = mode === "expense" ? "gastos" : "ingresos";
  const maxAmount = Math.max(...items.map((item) => item.amount), 1);

  return (
    <div className={cn("w-full space-y-6", className)}>
      {/* --- Vista Móvil (< md): Barras Horizontales --- */}
      <div
        className="flex flex-col gap-4 md:hidden"
        role="region"
        aria-label={`Distribución de ${modeLabel} por categoría en vista móvil`}
      >
        {items.map((item) => {
          const barLabel = `${item.name}: $ ${item.amount.toLocaleString("es-CO")}, ${item.share}% de ${modeLabel}`;
          // Escala relativa respecto a la categoría mayor para dinamismo visual
          const barWidthPercent = Math.max(
            4,
            Math.round((item.amount / maxAmount) * 100),
          );

          return (
            <div
              key={item.id}
              className="flex flex-col gap-1.5 w-full"
              role="img"
              aria-label={barLabel}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate font-medium text-[var(--fm-warm-paper)]">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Amount
                    value={item.amount}
                    showSign={false}
                    size="sm"
                    className="font-semibold text-[var(--fm-warm-paper)]"
                  />
                  <span className="text-[11px] font-bold text-[var(--fm-text-muted)] min-w-[2.5rem] text-right">
                    {item.share}%
                  </span>
                </div>
              </div>

              <div className="h-2 w-full rounded-full bg-white/6 overflow-hidden">
                <div
                  className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300"
                  style={{
                    width: `${barWidthPercent}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* --- Vista Escritorio (>= md): Barras Verticales --- */}
      <div
        className="hidden md:flex flex-col gap-4"
        role="region"
        aria-label={`Distribución de ${modeLabel} por categoría en vista escritorio`}
      >
        <div className="flex items-end justify-between gap-3 sm:gap-6 h-56 pt-8 pb-2 border-b border-white/8">
          {items.map((item) => {
            const barHeightPercent = Math.max(
              8,
              Math.round((item.amount / maxAmount) * 100),
            );
            const barLabel = `${item.name}: $ ${item.amount.toLocaleString("es-CO")}, ${item.share}% de ${modeLabel}`;

            return (
              <div
                key={item.id}
                className="flex flex-col items-center flex-1 min-w-0 h-full justify-end group"
                role="img"
                aria-label={barLabel}
              >
                {/* Monto y porcentaje visibles arriba de la barra */}
                <div className="flex flex-col items-center gap-0.5 mb-2 text-center">
                  <span className="text-[11px] font-bold text-[var(--fm-text-muted)]">
                    {item.share}%
                  </span>
                  <Amount
                    value={item.amount}
                    showSign={false}
                    size="sm"
                    className="font-semibold text-xs text-[var(--fm-warm-paper)]"
                  />
                </div>

                {/* Barra vertical con escala visual y color canónico */}
                <div
                  className="w-full max-w-[44px] rounded-t-xl motion-safe:transition-[height] motion-safe:duration-300"
                  style={{
                    height: `${barHeightPercent}%`,
                    backgroundColor: item.color,
                  }}
                />

                {/* Nombre de categoría */}
                <div className="w-full pt-2 flex items-center justify-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span
                    className="truncate text-xs font-medium text-[var(--fm-text-soft)] group-hover:text-[var(--fm-warm-paper)] transition-colors"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
