"use client";

import { useEffect, useId, useRef } from "react";

import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { useFocusTrap } from "@/features/household/hooks/use-focus-trap";

export type HouseholdDiscardConfirmDialogProps = {
  open: boolean;
  /** Escape, backdrop o botón de quedarse: nunca descarta, solo cierra la confirmación. */
  onKeepEditing: () => void;
  /** Único camino que cierra el formulario original y descarta los datos. */
  onDiscard: () => void;
  /** Título del diálogo (por defecto: paridad Android "¿Seguro que quieres salir?"). */
  title?: string;
  /** Descripción del diálogo (por defecto: paridad Android "Se perderá lo que escribiste."). */
  description?: string;
  /** Texto del botón para permanecer editando (por defecto: "Cancelar"). */
  cancelButtonText?: string;
  /** Texto del botón para confirmar salida y descartar (por defecto: "Salir"). */
  exitButtonText?: string;
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
  title = "¿Seguro que quieres salir?",
  description = "Se perderá lo que escribiste.",
  cancelButtonText = "Cancelar",
  exitButtonText = "Salir",
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
        data-fm-context="household"
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
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-snug text-[var(--hh-text-secondary)]">
          {description}
        </p>
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <HouseholdButton
            ref={keepEditingRef}
            type="button"
            tone="outlined"
            variant="outline"
            size="sm"
            onClick={onKeepEditing}
            className="cursor-pointer select-none rounded-xl px-4"
          >
            {cancelButtonText}
          </HouseholdButton>
          <HouseholdButton
            type="button"
            tone="destructive"
            size="sm"
            onClick={onDiscard}
            className="cursor-pointer select-none rounded-xl px-4"
          >
            {exitButtonText}
          </HouseholdButton>
        </div>
      </div>
    </div>
  );
}
