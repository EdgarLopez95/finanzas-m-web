"use client";

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type HouseholdCategorySelectOption = {
  id: string;
  label: string;
  /** A hex color like "#EF4444" */
  color?: string;
  /** Optional React node to render as leading icon */
  icon?: React.ReactNode;
};

type HouseholdCategorySelectProps = {
  id?: string;
  options: HouseholdCategorySelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  searchPlaceholder?: string;
};

export function HouseholdCategorySelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  required,
  disabled = false,
  className,
  searchPlaceholder = "Buscar categoría…",
}: HouseholdCategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const [isPositioned, setIsPositioned] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);
  const menuId = `${id ?? "hh-cat-select"}-listbox`;
  const searchId = `${id ?? "hh-cat-select"}-search`;

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    if (!q) return options;
    return options.filter((opt) => opt.label.toLocaleLowerCase("es").includes(q));
  }, [options, query]);

  const closeMenu = () => {
    setIsOpen(false);
    setQuery("");
  };

  const openMenu = () => {
    if (disabled || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setIsPositioned(false);
    setQuery("");
    setIsOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Foco al buscador al abrir + navegación por teclado en opciones
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!menuRef.current) return;

      const items = Array.from(
        menuRef.current.querySelectorAll<HTMLButtonElement>('button[role="option"]'),
      );
      const activeEl = document.activeElement;
      const currentIndex = activeEl instanceof HTMLButtonElement ? items.indexOf(activeEl) : -1;
      const inSearch = activeEl === searchRef.current;

      if (e.key === "Escape") {
        // Cerrar solo el menú; no dejar que el modal padre también cierre.
        e.preventDefault();
        e.stopImmediatePropagation();
        closeMenu();
        triggerRef.current?.focus();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (items.length === 0) return;
        if (inSearch || currentIndex === -1) {
          items[0]?.focus();
          return;
        }
        items[(currentIndex + 1) % items.length]?.focus();
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (items.length === 0) return;
        if (inSearch) {
          searchRef.current?.focus();
          return;
        }
        if (currentIndex <= 0) {
          searchRef.current?.focus();
          return;
        }
        items[currentIndex - 1]?.focus();
        return;
      }

      if (e.key === "Tab") {
        closeMenu();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    const timeout = setTimeout(() => {
      searchRef.current?.focus();
    }, 50);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      clearTimeout(timeout);
    };
  }, [isOpen]);

  // Reposition if menu overflows viewport (también al filtrar)
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current || !menuRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuH = menuRef.current.getBoundingClientRect().height;
    const vH = window.innerHeight;
    const margin = 8;
    let top = rect.bottom + 4;
    if (top + menuH > vH - margin) {
      top = Math.max(margin, rect.top - menuH - 4);
    }
    setMenuStyle({ top, left: rect.left, width: rect.width });
    setIsPositioned(true);
  }, [isOpen, filteredOptions.length, query]);

  const handleSelect = (optId: string) => {
    onChange(optId);
    closeMenu();
  };

  const menu = isOpen ? (
    <div
      ref={menuRef}
      id={menuId}
      role="listbox"
      aria-label="Opciones"
      data-fm-context="household"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "fixed z-[200] overflow-hidden rounded-[16px] border border-[var(--hh-border)]",
        "bg-[var(--hh-surface-elevated)] shadow-[var(--hh-shadow-soft)]",
        isPositioned
          ? "animate-in fade-in slide-in-from-top-1 duration-150"
          : "pointer-events-none opacity-0"
      )}
      style={menuStyle ?? { top: 0, left: 0, width: 200 }}
    >
      <div className="border-b border-[var(--hh-border)] p-2">
        <label htmlFor={searchId} className="sr-only">
          Buscar categoría
        </label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--hh-text-muted)]"
          />
          <input
            ref={searchRef}
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
            className="h-9 w-full rounded-[12px] border border-[var(--hh-border)] bg-[var(--hh-surface)] py-2 pl-8 pr-3 text-[16px] text-[var(--hh-text)] outline-none placeholder:text-[var(--hh-text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)] sm:text-[13px]"
          />
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto py-1.5">
        {filteredOptions.map((opt) => {
          const isSelected = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => handleSelect(opt.id)}
              className={cn(
                "flex w-full cursor-pointer select-none items-center gap-2.5 px-3 py-2.5 text-left text-[13px] outline-none transition-colors",
                isSelected
                  ? "bg-[var(--hh-surface-hover)] text-[var(--hh-text)]"
                  : "text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-hover)] hover:text-[var(--hh-text)] focus-visible:bg-[var(--hh-surface-hover)]"
              )}
            >
              {opt.icon ? (
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border border-[var(--hh-border)]"
                  style={
                    opt.color
                      ? { backgroundColor: `${opt.color}22`, color: opt.color, borderColor: `${opt.color}44` }
                      : undefined
                  }
                >
                  {opt.icon}
                </span>
              ) : opt.color ? (
                <span
                  className="h-3 w-3 shrink-0 rounded-[4px] border border-[var(--hh-border-strong)]"
                  style={{ backgroundColor: opt.color }}
                />
              ) : null}

              <span className="flex-1 truncate font-medium">{opt.label}</span>

              {isSelected && (
                <Check className="h-3.5 w-3.5 shrink-0 text-[var(--hh-primary-action)]" />
              )}
            </button>
          );
        })}
        {filteredOptions.length === 0 && (
          <div className="px-4 py-3 text-[13px] text-[var(--hh-text-muted)]">
            {query.trim() ? "Sin resultados" : placeholder}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-required={required}
        disabled={disabled}
        onClick={openMenu}
        className={cn(
          "flex h-10 w-full cursor-pointer items-center justify-between gap-2.5 rounded-[16px] border border-[var(--hh-border)]",
          "bg-[var(--hh-surface-elevated)] px-3 text-left text-[16px] text-[var(--hh-text)] sm:text-[13px]",
          "outline-none transition-all",
          "focus-visible:ring-2 focus-visible:ring-[var(--hh-border-strong)]",
          "hover:bg-[var(--hh-surface-hover)]",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          {selected?.icon ? (
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border border-[var(--hh-border)]"
              style={
                selected.color
                  ? {
                      backgroundColor: `${selected.color}22`,
                      color: selected.color,
                      borderColor: `${selected.color}44`,
                    }
                  : undefined
              }
            >
              {selected.icon}
            </span>
          ) : selected?.color ? (
            <span
              className="h-3 w-3 shrink-0 rounded-[4px] border border-[var(--hh-border-strong)]"
              style={{ backgroundColor: selected.color }}
            />
          ) : null}

          <span className={cn("truncate text-[16px] sm:text-[13px]", !selected && "text-[var(--hh-text-muted)]")}>
            {selected?.label ?? placeholder}
          </span>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--hh-text-secondary)] transition-transform duration-150",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
