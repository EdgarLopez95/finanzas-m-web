"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

import { FinanceButton } from "@/components/finance/finance-button";

type FinanceDialogProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function FinanceDialog({
  open,
  title,
  subtitle,
  onClose,
  children,
}: FinanceDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[95] grid place-items-center bg-[rgba(4,8,15,0.72)] px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        aria-describedby={subtitle ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(21,29,43,0.98),rgba(12,18,29,0.98))] p-5 shadow-[0_30px_70px_rgb(2_6_23/0.42)]"
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
              <p id={descriptionId} className="text-sm text-[var(--fm-text-muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <FinanceButton
            aria-label="Cerrar confirmacion"
            onClick={onClose}
            size="icon"
            tone="text"
            type="button"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </FinanceButton>
        </div>
        <div className="mt-5">
          {children}
        </div>
      </div>
    </div>
  );
}
