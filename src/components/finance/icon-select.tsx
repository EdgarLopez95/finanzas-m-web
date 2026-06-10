"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
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
};

export function IconSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  required,
  disabled = false,
  className,
}: IconSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const [isPositioned, setIsPositioned] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);
  const menuId = `${id ?? "icon-select"}-listbox`;

  const openMenu = () => {
    if (disabled || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setIsPositioned(false);
    setIsOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

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
  }, [isOpen]);

  const handleSelect = (optId: string) => {
    onChange(optId);
    setIsOpen(false);
  };

  const menu = isOpen ? (
    <div
      ref={menuRef}
      id={menuId}
      role="listbox"
      aria-label="Opciones"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "fixed z-[200] overflow-y-auto max-h-56 rounded-2xl border border-white/10",
        "bg-[linear-gradient(180deg,rgba(20,27,40,0.99),rgba(12,18,29,0.99))]",
        "shadow-[0_20px_60px_rgb(2_6_23/0.5)] backdrop-blur-md py-1.5",
        isPositioned
          ? "animate-in fade-in slide-in-from-top-1 duration-150"
          : "pointer-events-none opacity-0"
      )}
      style={menuStyle ?? { top: 0, left: 0, width: 200 }}
    >
      {options.map((opt) => {
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
              "transition-colors text-sm",
              isSelected
                ? "bg-white/[0.06] text-[var(--fm-warm-paper)]"
                : "text-[var(--fm-text-soft)] hover:bg-white/[0.04] hover:text-[var(--fm-warm-paper)]"
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
      {options.length === 0 && (
        <div className="px-4 py-3 text-xs text-[var(--fm-text-muted)]">{placeholder}</div>
      )}
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
