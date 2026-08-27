"use client";

import { useEffect, useId, useRef } from "react";
import { LogOut } from "lucide-react";

import { FinanceButton } from "@/components/finance/finance-button";
import { useFocusTrap } from "@/features/household/hooks/use-focus-trap";

export type RemoveFromHouseholdConfirmDialogProps = {
  open: boolean;
  onConfirmRemove: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
};

export function RemoveFromHouseholdConfirmDialog({
  open,
  onConfirmRemove,
  onCancel,
  isSubmitting,
}: RemoveFromHouseholdConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useFocusTrap(panelRef, open, onCancel);

  useEffect(() => {
    if (open) {
      removeButtonRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-[rgba(4,8,15,0.72)] px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="w-full max-w-sm rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(21,29,43,0.98),rgba(12,18,29,0.98))] p-5 shadow-[0_30px_70px_rgb(2_6_23/0.42)] outline-none animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
            <LogOut className="h-4 w-4" />
          </span>
          <h2
            id={titleId}
            className="font-[var(--font-display)] text-[18px] font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]"
          >
            Retirar de Hogar
          </h2>
        </div>

        <p id={descriptionId} className="mt-3 text-sm leading-relaxed text-[var(--fm-text-muted)]">
          Este movimiento dejará de verse en el Hogar, pero permanecerá intacto en tu historial personal.
        </p>

        <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-white/[0.08] pt-4">
          <FinanceButton
            type="button"
            tone="outlined"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="cursor-pointer select-none rounded-xl px-4 text-xs sm:text-sm"
          >
            Cancelar
          </FinanceButton>
          <FinanceButton
            ref={removeButtonRef}
            type="button"
            tone="destructive"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            onClick={onConfirmRemove}
            className="cursor-pointer select-none rounded-xl px-4 text-xs sm:text-sm font-semibold"
          >
            {isSubmitting ? "Retirando..." : "Retirar"}
          </FinanceButton>
        </div>
      </div>
    </div>
  );
}
