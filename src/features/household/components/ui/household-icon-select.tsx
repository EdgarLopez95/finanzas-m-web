"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Picker Hogar (`--hh-*`): grupos 1 fila; color | íconos en 2 columnas.
 * Sin buscador (filtro por grupo).
 */
export type HouseholdIconSelectOption = {
  id: string;
  label: string;
  keywords?: string[];
  icon?: React.ReactNode;
};

export type HouseholdIconSelectGroup = {
  title: string;
  iconKeys: string[];
};

type HouseholdIconSelectProps = {
  options: HouseholdIconSelectOption[];
  groups: HouseholdIconSelectGroup[];
  colorPalette: string[];
  selectedIconKey: string;
  selectedColor: string;
  onSelectIcon: (iconKey: string) => void;
  onSelectColor: (color: string) => void;
  searchPlaceholder?: string;
  searchInputId?: string;
};

export function HouseholdIconSelect({
  options,
  groups,
  colorPalette,
  selectedIconKey,
  selectedColor,
  onSelectIcon,
  onSelectColor,
}: HouseholdIconSelectProps) {
  const [selectedGroup, setSelectedGroup] = useState("Todos");

  const groupTitles = useMemo(() => ["Todos", ...groups.map((g) => g.title)], [groups]);

  const filteredOptions = useMemo(() => {
    const activeGroup = groups.find((g) => g.title === selectedGroup);
    if (!activeGroup) return options;
    return options.filter((opt) => activeGroup.iconKeys.includes(opt.id));
  }, [options, groups, selectedGroup]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hh-text-secondary)]">Grupo</span>
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
                    ? "border-[var(--hh-primary-action)]/40 bg-[var(--hh-primary-action)]/12 text-[var(--hh-primary-action)]"
                    : "border-[var(--hh-border)] bg-[var(--hh-surface)] text-[var(--hh-text-muted)] hover:text-[var(--hh-text)]"
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
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hh-text-secondary)]">Color</span>
          <div className="grid w-[3.75rem] grid-cols-2 gap-1.5">
            {colorPalette.map((hex) => {
              const isSelected = selectedColor === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onSelectColor(hex)}
                  aria-label={`Seleccionar color ${hex}`}
                  className={cn(
                    "relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-[var(--hh-border)] outline-none transition-transform hover:scale-110",
                    isSelected && "scale-105"
                  )}
                  style={{
                    backgroundColor: hex,
                    ...(isSelected ? { boxShadow: `0 0 0 2px var(--hh-surface-elevated), 0 0 0 3px ${hex}` } : {}),
                  }}
                >
                  {isSelected ? <span className="h-1 w-1 rounded-full bg-[var(--hh-on-primary)]" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hh-text-secondary)]">Íconos</span>
            <span className="text-[10px] tabular-nums text-[var(--hh-text-muted)]">{filteredOptions.length}</span>
          </div>
          {filteredOptions.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-[var(--hh-border)] text-xs text-[var(--hh-text-muted)]">
              Sin resultados
            </div>
          ) : (
            <div className="max-h-[14rem] overflow-y-auto rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface)] p-1.5">
              <div className="grid grid-cols-6 gap-1 sm:grid-cols-7">
                {filteredOptions.map((opt) => {
                  const isSelected = opt.id === selectedIconKey;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => onSelectIcon(opt.id)}
                      title={opt.label}
                      aria-label={`Seleccionar icono ${opt.label}`}
                      className={cn(
                        "flex aspect-square max-h-11 w-full cursor-pointer items-center justify-center rounded-lg border outline-none transition-colors",
                        isSelected
                          ? "font-bold"
                          : "border-transparent text-[var(--hh-text-muted)] hover:bg-[var(--hh-surface-elevated)] hover:text-[var(--hh-text)]"
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
                    >
                      <span className="[&_svg]:h-6 [&_svg]:w-6">{opt.icon}</span>
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
