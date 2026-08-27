"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Amount } from "@/components/finance/amount";
import type { DashboardCategoryChartItem } from "@/features/movements/lib/personal-month-view-model";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

export interface PersonalCategoryChartProps {
  items: readonly DashboardCategoryChartItem[];
  mode: "expense" | "income";
  className?: string;
  onSelectCategory?: (categoryId: string, item: DashboardCategoryChartItem) => void;
}

export function PersonalCategoryChart({
  items,
  mode,
  className,
  onSelectCategory,
}: PersonalCategoryChartProps) {
  const router = useRouter();
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  if (items.length === 0) {
    return null;
  }

  const modeLabel = mode === "expense" ? "gastos" : "ingresos";
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  const handleCategoryClick = (item: DashboardCategoryChartItem) => {
    if (onSelectCategory) {
      onSelectCategory(item.id, item);
      return;
    }

    if (item.id === "other") {
      router.push(`/movements?type=${mode}`);
    } else {
      router.push(`/movements?categoryId=${encodeURIComponent(item.id)}&type=${mode}`);
    }
  };

  return (
    <div
      className={cn("w-full flex-1 min-h-0 flex flex-col justify-between pt-0.5", className)}
      role="region"
      aria-label={`Distribución de ${modeLabel} por categoría. Las barras comparan cada categoría con la de mayor valor.`}
    >
      {/* 1. Área de gráfica con Plot y Guías Horizontales que absorben la altura restante */}
      <div className="w-full flex-1 min-h-[220px] flex items-stretch pt-14 sm:pt-16">
        {/* Plot Principal con Líneas Guía de Comparación y Columnas */}
        <div className="flex-1 relative flex flex-col min-w-0 h-full">
          {/* Guías Horizontales de Referencia Relativa (Fondo de trazado) */}
          <div
            className="absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between pointer-events-none z-0"
            aria-hidden="true"
          >
            <div className="w-full border-b border-white/[0.06]" />
            <div className="w-full border-b border-white/[0.035]" />
            <div className="w-full border-b border-white/[0.035]" />
            <div className="w-full border-b border-white/[0.035]" />
            <div className="w-full border-b border-white/[0.08]" />
          </div>

          {/* Columnas de Categorías distribuidas responsivamente a todo el ancho y ocupando toda la altura */}
          <div className="relative z-10 flex items-stretch justify-around px-4 sm:px-10 md:px-16 w-full h-full pb-0">
            {items.map((item) => {
              const isActive = activeItemId === item.id;
              const hasActiveOther = activeItemId !== null && !isActive;
              const barHeight = Math.max(item.barScalePercent, item.amount > 0 ? 2.5 : 0);
              const barLabel = `${item.name}: $ ${item.amount.toLocaleString("es-CO")}, ${item.shareLabel} del total mensual. Clic para ver movimientos filtrados.`;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "relative flex flex-col items-center h-full justify-end select-none w-20 sm:w-24 shrink-0 pb-8 transition-opacity duration-150",
                    hasActiveOther ? "opacity-65" : "opacity-100",
                  )}
                >
                  {/* Track Vertical de la Barra */}
                  <div className="relative w-full flex-1 flex flex-col justify-end items-center px-1">
                    {/* Contenedor interactivo dinámico de la barra según su escala calculada */}
                    <div
                      tabIndex={0}
                      role="button"
                      aria-label={barLabel}
                      onClick={() => handleCategoryClick(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleCategoryClick(item);
                        }
                      }}
                      onMouseEnter={() => setActiveItemId(item.id)}
                      onMouseLeave={() => setActiveItemId(null)}
                      onFocus={() => setActiveItemId(item.id)}
                      onBlur={() => setActiveItemId(null)}
                      className={cn(
                        "group/bar relative w-full flex items-end justify-center cursor-pointer outline-none active:scale-[0.98] transition-transform",
                        "focus-visible:ring-2 focus-visible:ring-[var(--fm-pending)] focus-visible:rounded-xl",
                      )}
                      style={{
                        height: `${barHeight}%`,
                        minHeight: item.amount > 0 ? "8px" : "0px",
                      }}
                    >
                      {/* Tooltip de Detalle Flotante Siempre Anclado por Encima de los Valores */}
                      {isActive && (
                        <div
                          className="absolute bottom-[calc(100%+44px)] left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center min-w-[150px] max-w-[240px] animate-in fade-in zoom-in-95 duration-150"
                          role="tooltip"
                        >
                          <div className="w-full bg-[rgba(14,20,32,0.97)] backdrop-blur-md border border-white/12 rounded-xl px-3.5 py-2 shadow-2xl text-center space-y-0.5">
                            <p className="text-xs font-semibold text-[var(--fm-warm-paper)] truncate">
                              {item.name}
                            </p>
                            <p className="text-sm font-bold text-white font-[var(--font-display)] tracking-tight">
                              $ {item.amount.toLocaleString("es-CO")}
                            </p>
                            <p className="text-[11px] text-[var(--fm-text-muted)]">
                              {item.shareLabel} del {mode === "expense" ? "gasto" : "ingreso"} total
                            </p>
                          </div>
                          <div className="w-2 h-2 -mt-1 rotate-45 bg-[rgba(14,20,32,0.97)] border-r border-b border-white/12" />
                        </div>
                      )}

                      {/* Bloque Dinámico de Monto y Porcentaje posicionado justo encima de la barra con separación constante */}
                      <div className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 flex flex-col items-center justify-end text-center whitespace-nowrap pointer-events-none z-20">
                        <Amount
                          value={item.amount}
                          showSign={false}
                          size="sm"
                          className={cn(
                            "font-semibold text-xs sm:text-[13px] tracking-tight transition-colors drop-shadow-md",
                            isActive
                              ? "text-white"
                              : "text-[var(--fm-warm-paper)] group-hover/bar:text-white",
                          )}
                        />
                        <span
                          className={cn(
                            "text-[10px] sm:text-[11px] font-medium transition-colors drop-shadow-md",
                            isActive
                              ? "text-[var(--fm-text-soft)]"
                              : "text-[var(--fm-text-muted)] group-hover/bar:text-[var(--fm-text-soft)]",
                          )}
                        >
                          {item.shareLabel}
                        </span>
                      </div>

                      {/* Barra Vertical con textura sutil, radio contenido de 8-10px */}
                      <div
                        className={cn(
                          "w-11 sm:w-13 max-w-[52px] h-full rounded-t-lg relative overflow-hidden shadow-sm transition-all motion-safe:transition-[height] motion-safe:duration-300 ease-out",
                          isActive ? "brightness-125 scale-x-[1.03]" : "group-hover/bar:brightness-110",
                        )}
                        style={{
                          backgroundColor: item.color,
                          backgroundImage: `
                            linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0) 40%, rgba(0, 0, 0, 0.12) 100%),
                            repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255, 255, 255, 0.08) 3px, rgba(255, 255, 255, 0.08) 6px)
                          `,
                          boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Debajo de la baseline: Punto de color + Nombre centrado en UNA SOLA LÍNEA */}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleCategoryClick(item)}
                    onMouseEnter={() => setActiveItemId(item.id)}
                    onMouseLeave={() => setActiveItemId(null)}
                    className="w-full absolute bottom-0 inset-x-0 h-8 flex items-center justify-center gap-1.5 text-center px-1 cursor-pointer outline-none group/name"
                    aria-hidden="true"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full shadow-sm transition-transform",
                        isActive ? "scale-125" : "group-hover/name:scale-125",
                      )}
                      style={{ backgroundColor: item.color }}
                    />
                    <span
                      title={item.name}
                      className={cn(
                        "text-xs font-medium transition-colors truncate text-left max-w-[140px] sm:max-w-[180px]",
                        isActive
                          ? "text-[var(--fm-warm-paper)]"
                          : "text-[var(--fm-text-soft)] group-hover/name:text-white",
                      )}
                    >
                      {item.name}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* 2. Metadata Inferior con texto explicativo discreto */}
      <div className="pt-4 shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 mt-auto text-xs text-[var(--fm-text-muted)] select-none">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span>
            Mostrando {items.length} de {items.length} categorías
          </span>
          <span className="opacity-40">·</span>
          <span>
            Total: $ {totalAmount.toLocaleString("es-CO")}
          </span>
        </div>
        <p className="text-[11px] text-[var(--fm-text-muted)] opacity-70">
          Las barras comparan cada categoría con la de mayor valor
        </p>
      </div>
    </div>
  );
}
