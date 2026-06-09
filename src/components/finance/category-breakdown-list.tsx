"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

import { Amount } from "@/components/finance/amount";
import { getCategoryVisual } from "@/lib/design/personal-visuals";
import type { ExpenseCategoryBreakdownItem } from "@/features/dashboard/lib/personal-view-model";

gsap.registerPlugin(useGSAP);

type CategoryBreakdownListProps = {
  items: ExpenseCategoryBreakdownItem[];
  masked?: boolean;
  compact?: boolean;
};

export function CategoryBreakdownList({
  items,
  masked = false,
  compact = false,
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
    <div ref={rootRef} className="space-y-4">
      {items.map((item, index) => {
        const visual = getCategoryVisual(item.name, index);
        const Icon = visual.icon;

        return (
          <article key={item.categoryId} className="space-y-3" data-category-item>
            <div className="flex items-center gap-3">
              <div
                className="grid h-10 w-10 place-items-center rounded-2xl border"
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
                  <p className="truncate font-[var(--font-display)] text-lg font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]">
                    {item.name}
                  </p>
                  <span className="text-sm text-[var(--fm-text-muted)]">{item.share}%</span>
                </div>
              </div>
              <Amount
                className={compact ? "text-base" : undefined}
                masked={masked}
                showSign={false}
                size={compact ? "sm" : "md"}
                value={item.amount}
              />
            </div>

            <div className="h-2 rounded-full bg-[rgba(37,48,71,0.88)]">
              <div
                className="h-full rounded-full"
                data-category-bar
                style={{
                  width: `${item.share}%`,
                  backgroundColor: visual.accent,
                }}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
