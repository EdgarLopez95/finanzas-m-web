"use client";

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type IconSelectOption = {
  id: string;
  label: string;
  /** A hex color like "#EF4444" */
  color?: string;
  /** Optional React node to render as leading icon */
  icon?: React.ReactNode;
};

type IconSelectProps = {
  id?: string;
  options: IconSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /**
   * Buscador dentro del menú. Por defecto aparece solo cuando la lista es lo
   * bastante larga como para que recorrerla con la vista deje de ser cómodo.
   */
  searchable?: boolean;
  searchPlaceholder?: string;
};

/** Umbral a partir del cual una lista deja de escanearse de un vistazo. */
const SEARCHABLE_THRESHOLD = 7;

/** Marcas diacríticas combinantes que deja `normalize("NFD")`. */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Comparación tolerante a mayúsculas y tildes: "educacion" encuentra "Educación". */
const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "");

export function IconSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  required,
  disabled = false,
  className,
  searchable,
  searchPlaceholder = "Buscar...",
}: IconSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const [isPositioned, setIsPositioned] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);
  const menuId = `${id ?? "icon-select"}-listbox`;
  const searchId = `${id ?? "icon-select"}-search`;

  const showSearch = searchable ?? options.length >= SEARCHABLE_THRESHOLD;

  const filteredOptions = useMemo(() => {
    if (!showSearch) return options;
    const normalizedQuery = normalizeText(query.trim());
    if (!normalizedQuery) return options;
    return options.filter((option) => normalizeText(option.label).includes(normalizedQuery));
  }, [options, query, showSearch]);

  const openMenu = () => {
    if (disabled || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setIsPositioned(false);
    setQuery("");
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
    setQuery("");
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

  // Manejar navegación por teclado y escape para accesibilidad (WPP-110 a WPP-112)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!menuRef.current) return;

      const items = Array.from(menuRef.current.querySelectorAll("button")) as HTMLButtonElement[];

      if (e.key === "Escape") {
        e.preventDefault();
        // El diálogo contenedor también escucha Escape en `document`: cortar la
        // propagación evita que cerrar la lista cierre además el modal.
        e.stopImmediatePropagation();
        closeMenu();
        triggerRef.current?.focus();
        return;
      }

      if (e.key === "Tab") {
        closeMenu();
        return;
      }

      if (items.length === 0) return;

      const activeEl = document.activeElement as HTMLButtonElement;
      const currentIndex = items.indexOf(activeEl);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
        items[nextIndex].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
        items[prevIndex].focus();
      }
    };

    // Fase de captura: se ejecuta antes que los listeners de burbuja del
    // diálogo, para poder frenar el Escape antes de que cierre el modal.
    document.addEventListener("keydown", handleKeyDown, true);

    // Con buscador, el foco entra al campo de búsqueda (el caso frecuente es
    // teclear); sin buscador, al item seleccionado.
    const timeout = setTimeout(() => {
      if (showSearch) {
        searchRef.current?.focus();
        return;
      }
      const buttons = Array.from(menuRef.current?.querySelectorAll("button") || []) as HTMLButtonElement[];
      const selectedIndex = options.findIndex((opt) => opt.id === value);
      const targetButton = selectedIndex !== -1 && buttons[selectedIndex] ? buttons[selectedIndex] : buttons[0];
      targetButton?.focus();
    }, 50);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      clearTimeout(timeout);
    };
  }, [isOpen, options, value, showSearch]);

  // Reposition if menu overflows viewport
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
  }, [isOpen, filteredOptions.length]);

  const handleSelect = (optId: string) => {
    onChange(optId);
    closeMenu();
  };

  const menu = isOpen ? (
    <div
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "fixed z-[200] flex max-h-[19rem] flex-col overflow-hidden rounded-2xl border border-white/10",
        "bg-[linear-gradient(180deg,rgba(20,27,40,0.99),rgba(12,18,29,0.99))]",
        "shadow-[0_20px_60px_rgb(2_6_23/0.5)] backdrop-blur-md",
        isPositioned
          ? "animate-in fade-in slide-in-from-top-1 duration-150"
          : "pointer-events-none opacity-0"
      )}
      style={menuStyle ?? { top: 0, left: 0, width: 200 }}
    >
      {showSearch ? (
        <div className="relative shrink-0 border-b border-white/[0.06] p-1.5">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--fm-text-muted)]"
          />
          <input
            ref={searchRef}
            id={searchId}
            type="text"
            autoComplete="off"
            value={query}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            aria-controls={menuId}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter confirma el primer resultado: buscar y elegir en un gesto.
              if (e.key === "Enter") {
                e.preventDefault();
                const first = filteredOptions[0];
                if (first) {
                  handleSelect(first.id);
                }
              }
            }}
            className={cn(
              "h-9 w-full rounded-xl border border-transparent bg-white/[0.03] pl-8 pr-3",
              "text-sm text-[var(--fm-warm-paper)] outline-none transition-colors",
              "placeholder:text-[var(--fm-text-muted)] focus:border-white/10 focus:bg-white/[0.05]"
            )}
          />
        </div>
      ) : null}

      <div
        id={menuId}
        role="listbox"
        aria-label="Opciones"
        className="min-h-0 flex-1 overflow-y-auto py-1.5"
      >
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
                "w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer select-none",
                "transition-colors text-sm outline-none",
                isSelected
                  ? "bg-white/[0.06] text-[var(--fm-warm-paper)]"
                  : "text-[var(--fm-text-soft)] hover:bg-white/[0.04] hover:text-[var(--fm-warm-paper)]",
                "focus-visible:bg-white/[0.08] focus-visible:text-[var(--fm-warm-paper)]"
              )}
            >
              {/* Color dot or icon */}
              {opt.icon ? (
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10"
                  style={opt.color ? { backgroundColor: `${opt.color}22`, color: opt.color } : undefined}
                >
                  {opt.icon}
                </span>
              ) : opt.color ? (
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-white/15"
                  style={{ backgroundColor: opt.color }}
                />
              ) : null}

              <span className="flex-1 truncate font-medium">{opt.label}</span>

              {isSelected && (
                <Check className="h-3.5 w-3.5 shrink-0 text-[var(--fm-pending)]" />
              )}
            </button>
          );
        })}

        {filteredOptions.length === 0 && (
          <div className="px-4 py-3 text-xs text-[var(--fm-text-muted)]">
            {options.length === 0 ? placeholder : `Sin resultados para “${query.trim()}”`}
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
          "h-11 w-full flex items-center gap-2.5 rounded-xl border border-white/8",
          "bg-white/[0.02] px-3.5 text-sm text-[var(--fm-warm-paper)]",
          "transition-all cursor-pointer outline-none",
          "focus:border-[var(--fm-pending)]/50",
          "hover:bg-white/[0.04]",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {/* Leading icon/color of selected option */}
        {selected?.icon ? (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10"
            style={selected.color ? { backgroundColor: `${selected.color}22`, color: selected.color } : undefined}
          >
            {selected.icon}
          </span>
        ) : selected?.color ? (
          <span
            className="h-3 w-3 shrink-0 rounded-full border border-white/15"
            style={{ backgroundColor: selected.color }}
          />
        ) : null}

        <span className={cn("flex-1 truncate text-left", !selected && "text-[var(--fm-text-muted)]")}>
          {selected?.label ?? placeholder}
        </span>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--fm-text-muted)] transition-transform duration-150",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
