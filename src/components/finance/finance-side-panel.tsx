"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

import { FinanceButton } from "@/components/finance/finance-button";

gsap.registerPlugin(useGSAP);

type FinanceSidePanelProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function FinanceSidePanel({
  open,
  title,
  subtitle,
  onClose,
  children,
}: FinanceSidePanelProps) {
  const [mounted, setMounted] = useState(open);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setMounted(true);
    }
  }, [open]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const focusables = panel.querySelectorAll<HTMLElement>(focusableSelector);
    focusables[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const availableFocusables = panel.querySelectorAll<HTMLElement>(focusableSelector);
      const first = availableFocusables[0];
      const last = availableFocusables[availableFocusables.length - 1];

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [mounted, onClose]);

  useGSAP(
    () => {
      if (!mounted || !overlayRef.current || !panelRef.current) {
        return;
      }

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (open) {
        if (reduceMotion) {
          gsap.set(overlayRef.current, { autoAlpha: 1 });
          gsap.set(panelRef.current, { autoAlpha: 1, xPercent: 0 });
          return;
        }

        gsap.killTweensOf([overlayRef.current, panelRef.current]);
        gsap.set(overlayRef.current, { autoAlpha: 0 });
        gsap.set(panelRef.current, { autoAlpha: 0, xPercent: 8 });

        const timeline = gsap.timeline();
        timeline.to(overlayRef.current, {
          autoAlpha: 1,
          duration: 0.2,
          ease: "power2.out",
        });
        timeline.to(
          panelRef.current,
          {
            xPercent: 0,
            autoAlpha: 1,
            duration: 0.32,
            ease: "power3.out",
            clearProps: "transform",
          },
          0,
        );
        return;
      }

      if (reduceMotion) {
        setMounted(false);
        return;
      }

      gsap.killTweensOf([overlayRef.current, panelRef.current]);

      const timeline = gsap.timeline({
        onComplete: () => {
          setMounted(false);
        },
      });

      timeline.to(panelRef.current, {
        xPercent: 6,
        autoAlpha: 0,
        duration: 0.22,
        ease: "power3.in",
      });
      timeline.to(
        overlayRef.current,
        {
          autoAlpha: 0,
          duration: 0.18,
          ease: "power2.inOut",
        },
        0,
      );
    },
    { dependencies: [mounted, open], scope: overlayRef },
  );

  if (!mounted) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      aria-hidden={false}
      className="fixed inset-0 z-[90] flex justify-end bg-[rgba(4,8,15,0.68)] backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        aria-describedby={subtitle ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="h-full w-full max-w-[min(92vw,38rem)] border-l border-white/10 bg-[linear-gradient(180deg,rgba(18,24,38,0.98),rgba(11,17,28,0.98))] px-5 py-5 shadow-[0_28px_80px_rgb(2_6_23/0.44)]"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2
              id={titleId}
              className="font-[var(--font-display)] text-[24px] font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]"
            >
              {title}
            </h2>
            {subtitle ? (
              <p id={descriptionId} className="max-w-[42ch] text-sm text-[var(--fm-text-muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <FinanceButton
            aria-label="Cerrar panel"
            onClick={onClose}
            size="icon"
            tone="text"
            type="button"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </FinanceButton>
        </div>

        <div className="mt-6 overflow-y-auto pb-8">{children}</div>
      </div>
    </div>
  );
}
