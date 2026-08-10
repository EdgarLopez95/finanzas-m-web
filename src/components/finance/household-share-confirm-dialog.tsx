"use client";

import { useEffect, useId, useRef } from "react";

import { FinanceButton } from "@/components/finance/finance-button";
import { ToggleRow, toneStyle } from "@/features/transactions/components/composer/composer-primitives";
import { useFocusTrap } from "@/features/household/hooks/use-focus-trap";

type HouseholdShareConfirmDialogProps = {
  open: boolean;
  shareWithHousehold: boolean;
  onShareWithHouseholdChange: (next: boolean) => void;
  isSubmitting: boolean;
  /** Escape, backdrop o "Volver a editar": cierra solo esta confirmación, sin guardar. */
  onReturnToEdit: () => void;
  onConfirm: () => void;
};

/**
 * Confirmación previa al guardar de "Crear gasto Personal" cuando el Hogar es
 * elegible: decide, con el switch como única fuente de verdad, si el gasto
 * también se registra en Hogar. Vive por encima del `FinanceDialog` que sigue
 * montado detrás: nunca lo cierra, solo decide entre volver a editar o
 * confirmar y guardar.
 */
export function HouseholdShareConfirmDialog({
  open,
  shareWithHousehold,
  onShareWithHouseholdChange,
  isSubmitting,
  onReturnToEdit,
  onConfirm,
}: HouseholdShareConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnToEditRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Reutiliza la pila de traps de foco: al ser el diálogo más reciente, es el
  // único que reacciona a Escape/Tab mientras está abierto (el formulario de
  // atrás queda en pausa sin necesidad de desmontarlo).
  useFocusTrap(panelRef, open, onReturnToEdit);

  useEffect(() => {
    if (open) {
      returnToEditRef.current?.focus();
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
          onReturnToEdit();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        style={toneStyle("expense")}
        className="w-full max-w-sm rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(21,29,43,0.98),rgba(12,18,29,0.98))] p-5 shadow-[0_30px_70px_rgb(2_6_23/0.42)] outline-none animate-in fade-in zoom-in-95 duration-150"
      >
        <h2
          id={titleId}
          className="font-[var(--font-display)] text-[18px] font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]"
        >
          ¿También registrar en Hogar?
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-snug text-[var(--fm-text-muted)]">
          Este gasto se verá en tu Hogar y no volverá a mover el saldo de tu cuenta.
        </p>

        <div className="mt-4">
          <ToggleRow
            id="householdShareConfirmToggle"
            title="Ver también en Hogar"
            description={
              shareWithHousehold
                ? "Se registrará también en Hogar."
                : "Solo se registrará en tu cuenta personal."
            }
            checked={shareWithHousehold}
            onChange={onShareWithHouseholdChange}
            disabled={isSubmitting}
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <FinanceButton
            ref={returnToEditRef}
            type="button"
            tone="outlined"
            variant="outline"
            onClick={onReturnToEdit}
            disabled={isSubmitting}
            className="cursor-pointer select-none rounded-xl px-4"
          >
            Volver a editar
          </FinanceButton>
          <FinanceButton
            type="button"
            tone="filled"
            onClick={onConfirm}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="cursor-pointer select-none rounded-xl px-4"
          >
            {isSubmitting ? "Guardando…" : "Confirmar y guardar"}
          </FinanceButton>
        </div>
      </div>
    </div>
  );
}
