"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import {
  resolveCategoryIcon,
  expenseIconOptions,
  incomeIconOptions,
  EXPENSE_ICON_GROUPS,
  INCOME_ICON_GROUPS,
  CATEGORY_COLOR_PALETTE,
} from "@/lib/categories/category-icons";
type CategoryIconColorPickerProps = {
  kind: "expense" | "income";
  selectedIconKey: string;
  selectedColor: string;
  onSelectIcon: (iconKey: string) => void;
  onSelectColor: (color: string) => void;
};

/**
 * Picker Personal (`--fm-*`): grupos en una fila; color | íconos en 2 columnas.
 * La selección aplica al instante; el guardado lo hace el formulario padre.
 */
export function CategoryIconColorPicker({
  kind,
  selectedIconKey,
  selectedColor,
  onSelectIcon,
  onSelectColor,
}: CategoryIconColorPickerProps) {
  const [selectedGroup, setSelectedGroup] = useState("Todos");

  const options = kind === "income" ? incomeIconOptions : expenseIconOptions;
  const groups = kind === "income" ? INCOME_ICON_GROUPS : EXPENSE_ICON_GROUPS;
  const groupTitles = useMemo(() => ["Todos", ...groups.map((g) => g.title)], [groups]);

  const filteredOptions = useMemo(() => {
    const activeGroup = groups.find((g) => g.title === selectedGroup);
    if (!activeGroup) return options;
    return options.filter((opt) => activeGroup.iconKeys.includes(opt.iconKey));
  }, [options, groups, selectedGroup]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--fm-text-soft)]">Grupo</span>
        <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 scrollbar-none">
          {groupTitles.map((title) => {
            const isSelected = selectedGroup === title;
            return (
              <button
                key={title}
                type="button"
                onClick={() => setSelectedGroup(title)}
                className={cn(
                  "shrink-0 cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold outline-none transition-colors",
                  isSelected
                    ? "border-amber-500/35 bg-amber-500/12 text-amber-300"
                    : "border-white/8 bg-white/[0.02] text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]"
                )}
              >
                {title}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--fm-text-soft)]">Color</span>
          <div className="grid w-[3.75rem] grid-cols-2 gap-1.5">
            {CATEGORY_COLOR_PALETTE.map((color) => {
              const isSelected = selectedColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => onSelectColor(color)}
                  className={cn(
                    "relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-white/10 outline-none transition-transform hover:scale-110",
                    isSelected && "scale-105"
                  )}
                  style={
                    isSelected
                      ? { backgroundColor: color, boxShadow: `0 0 0 2px rgba(18,25,39,0.98), 0 0 0 3px ${color}` }
                      : { backgroundColor: color }
                  }
                  aria-label={`Seleccionar color ${color}`}
                >
                  {isSelected ? <span className="h-1 w-1 rounded-full bg-white" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--fm-text-soft)]">Íconos</span>
            <span className="text-[10px] tabular-nums text-[var(--fm-text-muted)]">{filteredOptions.length}</span>
          </div>
          {filteredOptions.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-[var(--fm-text-muted)]">
              Sin resultados
            </div>
          ) : (
            <div className="max-h-[14rem] overflow-y-auto rounded-xl border border-white/8 bg-white/[0.02] p-1.5">
              <div className="grid grid-cols-6 gap-1 sm:grid-cols-7">
                {filteredOptions.map((opt) => {
                  const Icon = resolveCategoryIcon(opt.iconKey, kind);
                  const isSelected = selectedIconKey === opt.iconKey;
                  return (
                    <button
                      key={opt.iconKey}
                      type="button"
                      onClick={() => onSelectIcon(opt.iconKey)}
                      className={cn(
                        "flex aspect-square max-h-11 w-full cursor-pointer items-center justify-center rounded-lg border outline-none transition-colors",
                        isSelected
                          ? "font-bold"
                          : "border-transparent text-[var(--fm-text-muted)] hover:bg-white/[0.05] hover:text-[var(--fm-warm-paper)]"
                      )}
                      style={
                        isSelected
                          ? {
                              borderColor: `${selectedColor}77`,
                              backgroundColor: `${selectedColor}18`,
                              color: selectedColor,
                            }
                          : undefined
                      }
                      title={opt.label}
                      aria-label={`Seleccionar icono ${opt.label}`}
                    >
                      <Icon className="h-6 w-6" strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
