"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type DropdownItem = {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  iconClassName?: string;
  onClick: () => void;
  variant?: "default" | "destructive";
};

type FinanceDropdownProps = {
  items: DropdownItem[];
  align?: "left" | "right";
  className?: string;
  trigger?: React.ReactNode;
  menuClassName?: string;
  itemLayout?: "compact" | "rich";
  menuWidth?: number;
};

export function FinanceDropdown({
  items,
  align = "right",
  className,
  trigger,
  menuClassName,
  itemLayout = "compact",
  menuWidth,
}: FinanceDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null);
  const [isPositioned, setIsPositioned] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const resolvedMenuWidth = menuWidth ?? (itemLayout === "rich" ? 260 : 128);

  const openMenu = () => {
    if (!containerRef.current) {
      setIsOpen(true);
      return;
    }

    const triggerRect = containerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const margin = 12;
    let left =
      align === "right"
        ? triggerRect.right - resolvedMenuWidth
        : triggerRect.left;

    left = Math.min(Math.max(left, margin), viewportWidth - resolvedMenuWidth - margin);

    setMenuStyle({
      top: triggerRect.bottom + 6,
      left,
    });
    setIsPositioned(true);
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedTrigger = containerRef.current?.contains(target) ?? false;
      const clickedMenu = menuRef.current?.contains(target) ?? false;

      if (!clickedTrigger && !clickedMenu) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      setIsPositioned(false);
    }
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current) {
      return;
    }

    const updatePosition = () => {
      if (!containerRef.current || !menuRef.current) {
        return;
      }

      const triggerRect = containerRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 12;

      let left =
        align === "right"
          ? triggerRect.right - menuRect.width
          : triggerRect.left;
      let top = triggerRect.bottom + 6;

      left = Math.min(Math.max(left, margin), viewportWidth - menuRect.width - margin);

      if (top + menuRect.height > viewportHeight - margin) {
        top = Math.max(margin, triggerRect.top - menuRect.height - 6);
      }

      setMenuStyle({
        top,
        left,
      });
      setIsPositioned(true);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, isOpen]);

  const menu = isOpen ? (
    <div
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "fixed z-[120] rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,27,40,0.98),rgba(12,18,29,0.98))] shadow-[0_28px_70px_rgb(2_6_23/0.42)] backdrop-blur-md",
        itemLayout === "rich" ? "w-[260px] p-3" : "w-32 p-1",
        isPositioned
          ? "animate-in fade-in slide-in-from-top-1 duration-150"
          : "pointer-events-none opacity-0",
        menuClassName
      )}
      style={menuStyle ?? { top: 0, left: 0 }}
      role="menu"
    >
      {items.map((item, idx) => (
        <button
          key={idx}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            item.onClick();
            setIsOpen(false);
          }}
          className={cn(
            "w-full text-left transition-colors cursor-pointer select-none",
            itemLayout === "rich"
              ? "rounded-[18px] px-3 py-3"
              : "rounded-lg px-3 py-1.5 text-xs font-medium",
            item.variant === "destructive"
              ? "text-[var(--fm-expense)] hover:bg-[rgba(239,68,68,0.12)]"
              : "text-[var(--fm-warm-paper)] hover:bg-white/5"
          )}
          role="menuitem"
        >
          {itemLayout === "rich" ? (
            <div className="flex items-start gap-3">
              {item.icon ? (
                <div
                  className={cn(
                    "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border",
                    item.iconClassName
                      ? item.iconClassName
                      : item.variant === "destructive"
                        ? "border-[rgba(248,113,113,0.24)] bg-[rgba(248,113,113,0.08)] text-[var(--fm-expense)]"
                        : "border-white/10 bg-white/[0.04] text-[var(--fm-text-soft)]"
                  )}
                >
                  {item.icon}
                </div>
              ) : null}
              <div className="min-w-0">
                <div className="text-[1.02rem] font-semibold leading-5 text-[var(--fm-warm-paper)]">
                  {item.label}
                </div>
                {item.description ? (
                  <div className="mt-1 text-[0.92rem] leading-5 text-[var(--fm-text-muted)]">
                    {item.description}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            item.label
          )}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className={cn("relative inline-block text-left", className)} ref={containerRef}>
      {trigger ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) {
              setIsOpen(false);
              return;
            }
            openMenu();
          }}
          className="cursor-pointer"
        >
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) {
              setIsOpen(false);
              return;
            }
            openMenu();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fm-text-muted)] hover:bg-white/5 hover:text-[var(--fm-warm-paper)] transition-all focus:outline-none focus:ring-1 focus:ring-white/20 cursor-pointer"
          aria-haspopup="true"
          aria-expanded={isOpen}
          title="Más opciones"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      )}

      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
