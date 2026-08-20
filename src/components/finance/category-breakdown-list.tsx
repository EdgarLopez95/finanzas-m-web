"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

import { Amount } from "@/components/finance/amount";
import { getCategoryVisual } from "@/lib/design/personal-visuals";
import { cn } from "@/lib/utils";
export type ExpenseCategoryBreakdownItem = {
  categoryId: string;
  name: string;
  amount: number;
  share: number;
  color?: string;
  icon?: React.ComponentType<{ className?: string }> | string;
  iconKey?: string;
  percentage?: number;
};

gsap.registerPlugin(useGSAP);

type CategoryBreakdownListProps = {
  items: ExpenseCategoryBreakdownItem[];
  masked?: boolean;
  compact?: boolean;
  onItemClick?: (item: ExpenseCategoryBreakdownItem) => void;
  /**
   * Catálogo del que sale el icono. Los catálogos de ingreso y gasto son
   * distintos (contrato §24), así que sin esto un desglose de ingresos caería
   * al icono genérico. Por defecto `expense`, que es como se usaba hasta ahora.
   */
  type?: "expense" | "income";
};

export function CategoryBreakdownList({
  items,
  masked = false,
  compact = false,
  onItemClick,
  type = "expense",
}: CategoryBreakdownListProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          if (context.conditions?.reduceMotion) {
            return;
          }

          gsap.from("[data-category-item]", {
            y: 14,
            autoAlpha: 0,
            duration: 0.45,
            stagger: 0.06,
            ease: "power3.out",
          });

          gsap.from("[data-category-bar]", {
            scaleX: 0,
            duration: 0.55,
            stagger: 0.07,
            ease: "power3.out",
            transformOrigin: "left center",
          });
        },
      );

      return () => media.revert();
    },
    { scope: rootRef, dependencies: [items] },
  );

  return (
    <div ref={rootRef} className="divide-y divide-white/[0.05]">
      {items.map((item, index) => {
        const visual = getCategoryVisual(item.name, index, item.color, item.iconKey, type);
        const Icon = visual.icon;

        return (
          <article
            key={item.categoryId}
            onClick={() => onItemClick?.(item)}
            onKeyDown={(e) => {
              if (onItemClick && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onItemClick(item);
              }
            }}
            tabIndex={onItemClick ? 0 : undefined}
            role={onItemClick ? "button" : undefined}
            className={cn(
              "group py-4 first:pt-0 last:pb-0 space-y-2.5 transition-all outline-none rounded-xl px-2 -mx-2",
              compact && "py-3 space-y-2",
              onItemClick &&
                "cursor-pointer hover:bg-white/[0.02] focus-visible:ring-1 focus-visible:ring-white/20 active:scale-[0.995]"
            )}
            data-category-item
          >
            <div className="flex items-center gap-3.5">
              <div
                className="grid h-10 w-10 place-items-center rounded-xl border flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
                style={{
                  backgroundColor: visual.accentSoft,
                  borderColor: `${visual.accent}33`,
                  color: visual.accent,
                }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-[var(--font-display)] text-base font-semibold tracking-[-0.01em] text-[var(--fm-warm-paper)]">
                    {item.name}
                  </p>
                  <span className="text-xs font-medium text-[var(--fm-text-muted)]">{item.share}%</span>
                </div>
              </div>
              <Amount
                className={compact ? "text-sm" : undefined}
                masked={masked}
                showSign={false}
                size={compact ? "sm" : "md"}
                value={item.amount}
              />
            </div>

            <div className="relative h-2 rounded-full bg-[rgba(37,48,71,0.6)] overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                data-category-bar
                style={{
                  width: `${item.share}%`,
                  backgroundColor: visual.accent,
                  boxShadow: `0 0 8px ${visual.accent}66`,
                }}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
