"use client";

import { useEffect, useId, useRef } from "react";

import { FinanceButton } from "@/components/finance/finance-button";
import { useFocusTrap } from "@/features/household/hooks/use-focus-trap";

export type PermanentDeleteConfirmDialogProps = {
  open: boolean;
  isDeleting: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Diálogo modal centrado para confirmar la eliminación permanente de un movimiento en Papelera.
 * (§ Paridad Android PersonalTrashScreen / Dev Log 2026-09-02).
 *
 * Textos y comportamiento canónico:
 * - Título: "¿Eliminar permanentemente?"
 * - Cuerpo: "Este movimiento se eliminará para siempre y no se podrá recuperar."
 * - Primario: "Eliminar" / "Eliminando…"
 * - Secundario: "Cancelar"
 * - Mientras isDeleting: no dismiss por backdrop/Escape.
 */
export function PermanentDeleteConfirmDialog({
  open,
  isDeleting,
  errorMessage,
  onConfirm,
  onCancel,
}: PermanentDeleteConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Durante la mutación de borrado activo, no se permite cerrar por Escape
  useFocusTrap(panelRef, open, isDeleting ? () => {} : onCancel);

  useEffect(() => {
    if (open) {
      cancelButtonRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-[rgba(4,8,15,0.72)] px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) {
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
        <h2
          id={titleId}
          className="font-[var(--font-display)] text-[18px] font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]"
        >
          ¿Eliminar permanentemente?
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-snug text-[var(--fm-text-muted)]">
          Este movimiento se eliminará para siempre y no se podrá recuperar.
        </p>

        {errorMessage && (
          <p className="mt-3 text-xs text-[var(--fm-danger,#f87171)]">
            {errorMessage}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <FinanceButton
            ref={cancelButtonRef}
            type="button"
            tone="outlined"
            variant="outline"
            disabled={isDeleting}
            onClick={onCancel}
            className="cursor-pointer select-none rounded-xl px-4"
          >
            Cancelar
          </FinanceButton>
          <FinanceButton
            type="button"
            tone="destructive"
            disabled={isDeleting}
            aria-busy={isDeleting}
            onClick={onConfirm}
            className="cursor-pointer select-none rounded-xl px-4"
          >
            {isDeleting ? "Eliminando…" : "Eliminar"}
          </FinanceButton>
        </div>
      </div>
    </div>
  );
}
