"use client";

import { useEffect, useId, useRef } from "react";

import { FinanceButton } from "@/components/finance/finance-button";
import { useFocusTrap } from "@/features/household/hooks/use-focus-trap";

type DiscardConfirmDialogProps = {
  open: boolean;
  /** Escape, backdrop o "Seguir editando": nunca descarta, solo cierra la confirmación. */
  onKeepEditing: () => void;
  /** Único camino que cierra el formulario original y descarta los datos. */
  onDiscard: () => void;
};

/**
 * Confirmación de descarte para los composers de creación (Personal). Vive
 * por encima del `FinanceDialog` que sigue montado detrás: nunca lo cierra,
 * solo decide si el usuario sigue editando o descarta.
 */
export function DiscardConfirmDialog({ open, onKeepEditing, onDiscard }: DiscardConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Reutiliza la pila de traps de foco: al ser el diálogo más reciente, es el
  // único que reacciona a Escape/Tab mientras está abierto (el formulario de
  // atrás queda en pausa sin necesidad de desmontarlo).
  useFocusTrap(panelRef, open, onKeepEditing);

  useEffect(() => {
    if (open) {
      keepEditingRef.current?.focus();
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
          onKeepEditing();
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
          ¿Cancelar registro?
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-snug text-[var(--fm-text-muted)]">
          Se perderán los datos que has ingresado.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <FinanceButton
            ref={keepEditingRef}
            type="button"
            tone="outlined"
            variant="outline"
            onClick={onKeepEditing}
            className="cursor-pointer select-none rounded-xl px-4"
          >
            Seguir editando
          </FinanceButton>
          <FinanceButton
            type="button"
            tone="destructive"
            onClick={onDiscard}
            className="cursor-pointer select-none rounded-xl px-4"
          >
            Sí, descartar
          </FinanceButton>
        </div>
      </div>
    </div>
  );
}
