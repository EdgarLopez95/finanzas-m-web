"use client";

import { useEffect, useId, useRef } from "react";

import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { useFocusTrap } from "@/features/household/hooks/use-focus-trap";

type HouseholdDiscardConfirmDialogProps = {
  open: boolean;
  /** Escape, backdrop o "Seguir editando": nunca descarta, solo cierra la confirmación. */
  onKeepEditing: () => void;
  /** Único camino que cierra el formulario original y descarta los datos. */
  onDiscard: () => void;
};

/**
 * Confirmación de descarte para "Nuevo gasto Hogar". Vive por encima del
 * `HouseholdDialog` que sigue montado detrás: nunca lo cierra, solo decide si
 * el usuario sigue editando o descarta.
 */
export function HouseholdDiscardConfirmDialog({
  open,
  onKeepEditing,
  onDiscard,
}: HouseholdDiscardConfirmDialogProps) {
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
      className="fixed inset-0 z-[110] grid place-items-center bg-[var(--hh-overlay)] px-4"
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
        className="w-full max-w-sm rounded-[24px] border border-[var(--hh-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--hh-surface-elevated)_96%,transparent),color-mix(in_srgb,var(--hh-surface)_98%,transparent))] p-5 shadow-[var(--hh-shadow)] outline-none animate-in fade-in zoom-in-95 duration-150"
      >
        <h2
          id={titleId}
          className="font-[var(--font-display)] text-[18px] font-semibold tracking-[-0.02em] text-[var(--hh-text)]"
        >
          ¿Cancelar registro?
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-snug text-[var(--hh-text-secondary)]">
          Se perderán los datos que has ingresado.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <HouseholdButton
            ref={keepEditingRef}
            type="button"
            tone="outlined"
            variant="outline"
            onClick={onKeepEditing}
            className="cursor-pointer select-none px-4"
          >
            Seguir editando
          </HouseholdButton>
          <HouseholdButton
            type="button"
            tone="destructive"
            onClick={onDiscard}
            className="cursor-pointer select-none px-4"
          >
            Sí, descartar
          </HouseholdButton>
        </div>
      </div>
    </div>
  );
}
