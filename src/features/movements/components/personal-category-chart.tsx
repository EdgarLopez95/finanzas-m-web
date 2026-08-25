"use client";

import { Amount } from "@/components/finance/amount";
import type { DashboardCategoryChartItem } from "@/features/movements/lib/personal-month-view-model";
import { cn } from "@/lib/utils";

export interface PersonalCategoryChartProps {
  items: readonly DashboardCategoryChartItem[];
  mode: "expense" | "income";
  masked?: boolean;
  className?: string;
}

export function PersonalCategoryChart({
  items,
  mode,
  masked = false,
  className,
}: PersonalCategoryChartProps) {
  if (items.length === 0) {
    return null;
  }

  const modeLabel = mode === "expense" ? "gastos" : "ingresos";
  const maxAmount = Math.max(...items.map((item) => item.amount), 1);
  const isCompactDesktop = items.length <= 3;

  return (
    <div className={cn("w-full space-y-6", className)}>
      {/* --- Vista Móvil (< md): Barras Horizontales --- */}
      <div
        className="flex flex-col gap-4 md:hidden"
        role="region"
        aria-label={`Distribución de ${modeLabel} por categoría en vista móvil`}
      >
        {items.map((item) => {
          const barLabel = masked
            ? `${item.name}: monto oculto, ${item.share}% de ${modeLabel}`
            : `${item.name}: $ ${item.amount.toLocaleString("es-CO")}, ${item.share}% de ${modeLabel}`;

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
              <div className="flex items-start justify-between gap-3 text-xs">
                {/* Nombre de categoría con wrap multilínea sin truncate */}
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-[var(--fm-warm-paper)] break-words leading-tight">
                    {item.name}
                  </span>
                </div>

                {/* Monto y porcentaje a la derecha */}
                <div className="flex items-center gap-2 shrink-0 self-start pt-0.5">
                  <Amount
                    value={item.amount}
                    masked={masked}
                    showSign={false}
                    size="sm"
                    className="font-semibold text-[var(--fm-warm-paper)]"
                  />
                  <span className="text-[11px] font-bold text-[var(--fm-text-muted)] min-w-[2.5rem] text-right">
                    {item.share}%
                  </span>
                </div>
              </div>

              {/* Pista y barra horizontal */}
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

      {/* --- Vista Escritorio (>= md): Barras Verticales con Composición Adaptativa --- */}
      <div
        className="hidden md:flex flex-col gap-4"
        role="region"
        aria-label={`Distribución de ${modeLabel} por categoría en vista escritorio`}
      >
        <div
          className={cn(
            "flex items-end h-64 pt-2 pb-2",
            isCompactDesktop
              ? "justify-start gap-8 sm:gap-12"
              : "justify-between gap-3 sm:gap-4",
          )}
        >
          {items.map((item) => {
            const barHeightPercent = Math.max(
              8,
              Math.round((item.amount / maxAmount) * 100),
            );
            const barLabel = masked
              ? `${item.name}: monto oculto, ${item.share}% de ${modeLabel}`
              : `${item.name}: $ ${item.amount.toLocaleString("es-CO")}, ${item.share}% de ${modeLabel}`;

            return (
              <div
                key={item.id}
                className={cn(
                  "flex flex-col items-center h-full justify-between group",
                  isCompactDesktop
                    ? "w-28 sm:w-32 max-w-[140px] shrink-0"
                    : "flex-1 min-w-0",
                )}
                role="img"
                aria-label={barLabel}
              >
                {/* Zona 1: Monto y porcentaje visibles arriba */}
                <div className="flex flex-col items-center justify-end gap-0.5 mb-2 text-center h-10 shrink-0 w-full">
                  <span className="text-[11px] font-bold text-[var(--fm-text-muted)]">
                    {item.share}%
                  </span>
                  <Amount
                    value={item.amount}
                    masked={masked}
                    showSign={false}
                    size="sm"
                    className="font-semibold text-xs text-[var(--fm-warm-paper)]"
                  />
                </div>

                {/* Zona 2: Área de trazado flexible y acotada para la barra vertical */}
                <div className="relative w-full flex-1 flex items-end justify-center px-1 min-h-[120px]">
                  <div
                    className="w-full max-w-[40px] rounded-t-xl motion-safe:transition-[height] motion-safe:duration-300"
                    style={{
                      height: `${barHeightPercent}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>

                {/* Zona 3: Etiqueta de categoría debajo con wrap controlado */}
                <div className="w-full pt-2.5 mt-1 flex items-center justify-center gap-1.5 min-h-[2.5rem] text-center border-t border-white/8 shrink-0">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs font-medium text-[var(--fm-text-soft)] group-hover:text-[var(--fm-warm-paper)] transition-colors break-words leading-tight line-clamp-2">
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
