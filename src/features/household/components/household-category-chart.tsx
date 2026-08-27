"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { HouseholdAmount } from "@/features/household/components/ui/household-amount";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type {
  HouseholdDashboardChartItem,
  HouseholdIncomeCategoryChartItem,
} from "@/features/household/lib/household-dashboard-view-model";
import { cn } from "@/lib/utils";

export interface HouseholdCategoryChartProps {
  /** Items para modo 'expense' (o compatibilidad previa) */
  items?: readonly HouseholdDashboardChartItem[];
  /** Items para modo 'expense' */
  expenseItems?: readonly HouseholdDashboardChartItem[];
  /** Items planos para modo 'income' */
  incomeItems?: readonly HouseholdIncomeCategoryChartItem[];
  mode: "expense" | "income";
  periodLabel?: string;
  className?: string;
  onSelectCategory?: (categoryId: string, item: HouseholdDashboardChartItem) => void;
  onSelectIncomeCategory?: (categoryId: string, memberId: string, item: HouseholdIncomeCategoryChartItem) => void;
}

export function HouseholdCategoryChart({
  items,
  expenseItems,
  incomeItems = [],
  mode,
  periodLabel,
  className,
  onSelectCategory,
  onSelectIncomeCategory,
}: HouseholdCategoryChartProps) {
  const router = useRouter();
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const displayExpenseItems = expenseItems && expenseItems.length > 0 ? expenseItems : (items ?? []);
  const displayIncomeItems = incomeItems;

  if (mode === "expense" && displayExpenseItems.length === 0) {
    return null;
  }

  if (mode === "income" && displayIncomeItems.length === 0) {
    return null;
  }

  const totalExpenseAmount = displayExpenseItems.reduce((sum, item) => sum + item.amount, 0);
  const totalIncomeAmount = displayIncomeItems.reduce((sum, item) => sum + item.amount, 0);

  const handleExpenseItemClick = (item: HouseholdDashboardChartItem) => {
    if (onSelectCategory) {
      onSelectCategory(item.id, item);
      return;
    }

    if (item.id === "other") {
      router.push("/household/movements?type=expense");
    } else if (item.id === "unclassified" || item.isUnclassified) {
      router.push("/household/movements?categoryId=unclassified&type=expense");
    } else {
      router.push(`/household/movements?categoryId=${encodeURIComponent(item.id)}&type=expense`);
    }
  };

  const handleIncomeItemClick = (item: HouseholdIncomeCategoryChartItem) => {
    if (onSelectIncomeCategory) {
      onSelectIncomeCategory(item.categoryId, item.ownerId, item);
      return;
    }

    router.push(
      `/household/movements?categoryId=${encodeURIComponent(item.categoryId)}&memberId=${encodeURIComponent(item.ownerId)}&type=income`,
    );
  };

  return (
    <div
      className={cn("w-full flex-1 min-h-0 flex flex-col justify-between pt-0.5", className)}
      role="region"
      aria-label={
        mode === "expense"
          ? `Distribución de gastos compartidos en ${periodLabel ?? "el período"}. Las barras comparan cada categoría con la de mayor valor.`
          : `Distribución de ingresos por categoría en ${periodLabel ?? "el período"}. Las barras comparan cada categoría con la de mayor valor.`
      }
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
            <div className="w-full border-b border-[var(--hh-border)]/40" />
            <div className="w-full border-b border-[var(--hh-border)]/20" />
            <div className="w-full border-b border-[var(--hh-border)]/20" />
            <div className="w-full border-b border-[var(--hh-border)]/20" />
            <div className="w-full border-b border-[var(--hh-border)]/60" />
          </div>

          {/* ========================================================================= */}
          {/* MODO GASTOS: Una barra por categoría compartida de Hogar                   */}
          {/* ========================================================================= */}
          {mode === "expense" && (
            <div className="relative z-10 flex items-stretch justify-around px-4 sm:px-10 md:px-16 w-full h-full pb-0">
              {displayExpenseItems.map((item) => {
                const isActive = activeItemId === item.id;
                const hasActiveOther = activeItemId !== null && !isActive;
                const barHeight = Math.max(item.barScalePercent, item.amount > 0 ? 2.5 : 0);
                const barLabel = `${item.name}: $ ${item.amount.toLocaleString("es-CO")}, ${item.shareLabel} del total compartido. Clic para ver movimientos filtrados.`;

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
                        onClick={() => handleExpenseItemClick(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleExpenseItemClick(item);
                          }
                        }}
                        onMouseEnter={() => setActiveItemId(item.id)}
                        onMouseLeave={() => setActiveItemId(null)}
                        onFocus={() => setActiveItemId(item.id)}
                        onBlur={() => setActiveItemId(null)}
                        className={cn(
                          "group/bar relative w-full flex items-end justify-center cursor-pointer outline-none active:scale-[0.98] transition-transform",
                          "focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)] focus-visible:rounded-xl",
                        )}
                        style={{
                          height: `${barHeight}%`,
                          minHeight: item.amount > 0 ? "8px" : "0px",
                        }}
                      >
                        {/* Tooltip de Detalle Flotante */}
                        {isActive && (
                          <div
                            className="absolute bottom-[calc(100%+44px)] left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center min-w-[150px] max-w-[240px] animate-in fade-in zoom-in-95 duration-150"
                            role="tooltip"
                          >
                            <div className="w-full bg-[var(--hh-surface-elevated)]/98 backdrop-blur-md border border-[var(--hh-border-strong)] rounded-xl px-3.5 py-2 shadow-2xl text-center space-y-0.5">
                              <p className="text-xs font-semibold text-[var(--hh-text)] truncate">
                                {item.name}
                              </p>
                              <p className="text-sm font-bold text-white font-[var(--font-display)] tracking-tight">
                                $ {item.amount.toLocaleString("es-CO")}
                              </p>
                              <p className="text-[11px] text-[var(--hh-text-muted)]">
                                {item.shareLabel} del gasto compartido
                              </p>
                            </div>
                            <div className="w-2 h-2 -mt-1 rotate-45 bg-[var(--hh-surface-elevated)] border-r border-b border-[var(--hh-border-strong)]" />
                          </div>
                        )}

                        {/* Bloque Dinámico de Monto y Porcentaje arriba de la barra */}
                        <div className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 flex flex-col items-center justify-end text-center whitespace-nowrap pointer-events-none z-20">
                          <HouseholdAmount
                            value={item.amount}
                            showSign={false}
                            size="sm"
                            className={cn(
                              "font-semibold text-xs sm:text-[13px] tracking-tight transition-colors drop-shadow-md",
                              isActive
                                ? "text-white"
                                : "text-[var(--hh-text)] group-hover/bar:text-white",
                            )}
                          />
                          <span
                            className={cn(
                              "text-[10px] sm:text-[11px] font-medium transition-colors drop-shadow-md",
                              isActive
                                ? "text-[var(--hh-text-secondary)]"
                                : "text-[var(--hh-text-muted)] group-hover/bar:text-[var(--hh-text-secondary)]",
                            )}
                          >
                            {item.shareLabel}
                          </span>
                        </div>

                        {/* Barra Vertical con textura sutil */}
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

                    {/* Debajo de la baseline: Punto de color + Nombre centrado en una sola línea */}
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => handleExpenseItemClick(item)}
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
                            ? "text-[var(--hh-text)]"
                            : "text-[var(--hh-text-secondary)] group-hover/name:text-[var(--hh-text)]",
                        )}
                      >
                        {item.name}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODO INGRESOS: Barras por categoría planas, ordenadas descendentemente     */}
          {/* ========================================================================= */}
          {mode === "income" && (
            <div className="relative z-10 flex items-stretch justify-around px-4 sm:px-10 md:px-16 w-full h-full pb-0">
              {displayIncomeItems.map((item) => {
                const isActive = activeItemId === item.id;
                const hasActiveOther = activeItemId !== null && !isActive;
                const barHeight = Math.max(item.barScalePercent, item.amount > 0 ? 2.5 : 0);
                const barLabel = `${item.name} de ${item.ownerLabel}: $ ${item.amount.toLocaleString("es-CO")}, ${item.shareLabel} del total compartido. Clic para ver movimientos filtrados.`;

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
                      <div
                        tabIndex={0}
                        role="button"
                        aria-label={barLabel}
                        onClick={() => handleIncomeItemClick(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleIncomeItemClick(item);
                          }
                        }}
                        onMouseEnter={() => setActiveItemId(item.id)}
                        onMouseLeave={() => setActiveItemId(null)}
                        onFocus={() => setActiveItemId(item.id)}
                        onBlur={() => setActiveItemId(null)}
                        className={cn(
                          "group/bar relative w-full flex items-end justify-center cursor-pointer outline-none active:scale-[0.98] transition-transform",
                          "focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)] focus-visible:rounded-xl",
                        )}
                        style={{
                          height: `${barHeight}%`,
                          minHeight: item.amount > 0 ? "8px" : "0px",
                        }}
                      >
                        {/* Tooltip con Jerarquía Clara: Avatar + Responsable, Categoría, Monto, % del total compartido */}
                        {isActive && (
                          <div
                            className="absolute bottom-[calc(100%+44px)] left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center min-w-[170px] max-w-[280px] animate-in fade-in zoom-in-95 duration-150"
                            role="tooltip"
                          >
                            <div className="w-full bg-[var(--hh-surface-elevated)]/98 backdrop-blur-md border border-[var(--hh-border-strong)] rounded-xl px-3.5 py-2.5 shadow-2xl space-y-1">
                              {/* Fila 1: Avatar + Responsable */}
                              <div className="flex items-center justify-center gap-1.5 min-w-0">
                                <ProfileAvatar
                                  name={item.ownerLabel}
                                  photoURL={item.photoUrl}
                                  size="sm"
                                  decorative
                                  className="h-4 w-4 text-[9px] border border-[var(--hh-primary-action)]/30 bg-[var(--hh-primary-action)]/10 text-[var(--hh-primary-action)]"
                                />
                                <span className="text-[11px] font-semibold text-[var(--hh-primary-action)] truncate">
                                  {item.ownerLabel}
                                </span>
                              </div>

                              {/* Fila 2: Categoría */}
                              <p className="text-xs font-semibold text-[var(--hh-text)] text-center truncate" title={item.name}>
                                {item.name}
                              </p>

                              {/* Fila 3: Monto */}
                              <p className="text-sm font-bold text-white font-[var(--font-display)] tracking-tight text-center">
                                $ {item.amount.toLocaleString("es-CO")}
                              </p>

                              {/* Fila 4: Porcentaje sobre el total global */}
                              <p className="text-[11px] text-[var(--hh-text-muted)] text-center whitespace-nowrap">
                                {item.shareLabel} del total de ingresos compartidos
                              </p>
                            </div>
                            <div className="w-2 h-2 -mt-1 rotate-45 bg-[var(--hh-surface-elevated)] border-r border-b border-[var(--hh-border-strong)]" />
                          </div>
                        )}

                        {/* Bloque Dinámico de Monto y Porcentaje arriba de la barra */}
                        <div className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 flex flex-col items-center justify-end text-center whitespace-nowrap pointer-events-none z-20">
                          <HouseholdAmount
                            value={item.amount}
                            showSign={false}
                            size="sm"
                            className={cn(
                              "font-semibold text-xs sm:text-[13px] tracking-tight transition-colors drop-shadow-md",
                              isActive
                                ? "text-white"
                                : "text-[var(--hh-text)] group-hover/bar:text-white",
                            )}
                          />
                          <span
                            className={cn(
                              "text-[10px] sm:text-[11px] font-medium transition-colors drop-shadow-md",
                              isActive
                                ? "text-[var(--hh-text-secondary)]"
                                : "text-[var(--hh-text-muted)] group-hover/bar:text-[var(--hh-text-secondary)]",
                            )}
                          >
                            {item.shareLabel}
                          </span>
                        </div>

                        {/* Barra Vertical con su color de categoría */}
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

                    {/* Debajo de la baseline: Punto de color + Nombre de Categoría */}
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => handleIncomeItemClick(item)}
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
                            ? "text-[var(--hh-text)]"
                            : "text-[var(--hh-text-secondary)] group-hover/name:text-[var(--hh-text)]",
                        )}
                      >
                        {item.name}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Metadata Inferior con texto explicativo discreto */}
      <div className="pt-4 shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 mt-auto text-xs text-[var(--hh-text-muted)] select-none">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 opacity-70" />
          {mode === "expense" ? (
            <>
              <span>
                Mostrando {displayExpenseItems.length} de {displayExpenseItems.length} categorías
              </span>
              <span className="opacity-40">·</span>
              <span>
                Total: $ {totalExpenseAmount.toLocaleString("es-CO")}
              </span>
            </>
          ) : (
            <>
              <span>
                Mostrando {displayIncomeItems.length} de {displayIncomeItems.length} categorías
              </span>
              <span className="opacity-40">·</span>
              <span>
                Total: $ {totalIncomeAmount.toLocaleString("es-CO")}
              </span>
            </>
          )}
        </div>
        <p className="text-[11px] text-[var(--hh-text-muted)] opacity-70">
          Las barras comparan cada categoría con la de mayor valor
        </p>
      </div>
    </div>
  );
}
