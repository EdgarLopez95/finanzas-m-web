"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Home, X } from "lucide-react";

import { FinanceButton } from "@/components/finance/finance-button";
import { useFocusTrap } from "@/features/household/hooks/use-focus-trap";
import { resolveShareConfirmAction } from "@/features/movements/lib/resolve-share-confirm-action";
import type { MovementType } from "@/lib/mplus/enums";

export type ShareWithHouseholdConfirmDialogProps = {
  open: boolean;
  movementType?: MovementType;
  /** Compatibilidad hacia atrás si se pasa el draft */
  draft?: { type: MovementType };
  isSubmitting: boolean;
  errorMessage?: string | null;
  onConfirmShare: () => void;
  onSavePersonalOnly: () => void;
  onCancel: () => void;
};

/**
 * Diálogo modal centrado para confirmar el registro con "Contar en Hogar"
 * (§ Paridad Android HouseholdShareConfirmSheet / Dev Log 2026-09-02).
 *
 * Características:
 * - Modal centrado (no bottom sheet).
 * - Encabezado: Icono Home dorado + «Contar en Hogar» + subtítulo («Gasto compartido» / «Ingreso compartido») + botón X.
 * - Card interactiva con checkbox premarcado «Cuenta en Hogar».
 * - Microcopy dinámico:
 *   - checked: «Visible para ambos en las cuentas del Hogar.»
 *   - unchecked: «Solo visible para ti en tu espacio Personal.»
 * - Un solo botón primario «Confirmar» (o «Guardando...»).
 * - Si está marcado al confirmar -> onConfirmShare().
 * - Si está desmarcado al confirmar -> onSavePersonalOnly().
 * - Clic en X, backdrop o Escape -> onCancel() (no guarda nada).
 */
export function ShareWithHouseholdConfirmDialog({
  open,
  movementType,
  draft,
  isSubmitting,
  errorMessage,
  onConfirmShare,
  onSavePersonalOnly,
  onCancel,
}: ShareWithHouseholdConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const [countInHousehold, setCountInHousehold] = useState(true);

  const activeType: MovementType = movementType ?? draft?.type ?? "expense";
  const isExpense = activeType === "expense";

  // Reutiliza focus trap para accesibilidad y Escape -> onCancel
  useFocusTrap(panelRef, open, onCancel);

  // Al abrir el modal, premarcar siempre la casilla en true y enfocar el botón
  useEffect(() => {
    if (open) {
      setCountInHousehold(true);
      primaryButtonRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleConfirm = () => {
    const action = resolveShareConfirmAction(countInHousehold);
    if (action === "share") {
      onConfirmShare();
    } else {
      onSavePersonalOnly();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-[rgba(4,8,15,0.72)] px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onCancel();
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
        className="w-full max-w-sm rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(21,29,43,0.98),rgba(12,18,29,0.98))] p-5 shadow-[0_30px_70px_rgb(2_6_23/0.42)] outline-none animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-4"
      >
        {/* Encabezado con Icon Badge, Título, Subtítulo y Botón Cerrar (X) */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--fm-gold,#e5a93c)]/15 text-[var(--fm-gold,#e5a93c)]">
              <Home className="h-5 w-5" />
            </span>
            <div className="flex flex-col min-w-0">
              <h2
                id={titleId}
                className="font-[var(--font-display)] text-[16px] sm:text-[18px] font-bold tracking-[-0.01em] text-[var(--fm-warm-paper)] leading-tight"
              >
                Contar en Hogar
              </h2>
              <p className="text-xs text-[var(--fm-text-muted)] leading-tight mt-0.5">
                {isExpense ? "Gasto compartido" : "Ingreso compartido"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Cerrar"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] hover:bg-white/[0.06] transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Card interactiva con Checkbox + Microcopy dinámico */}
        <div
          role="button"
          tabIndex={isSubmitting ? -1 : 0}
          onClick={() => {
            if (!isSubmitting) setCountInHousehold((prev) => !prev);
          }}
          onKeyDown={(e) => {
            if (!isSubmitting && (e.key === " " || e.key === "Enter")) {
              e.preventDefault();
              setCountInHousehold((prev) => !prev);
            }
          }}
          className={
            "w-full rounded-[14px] p-3.5 flex items-center gap-3 transition-all select-none " +
            (isSubmitting ? "cursor-not-allowed opacity-60 " : "cursor-pointer ") +
            (countInHousehold
              ? "border border-[var(--fm-gold,#e5a93c)]/40 bg-white/[0.03]"
              : "border border-white/10 bg-white/[0.01]")
          }
        >
          <input
            type="checkbox"
            checked={countInHousehold}
            onChange={(e) => {
              if (!isSubmitting) setCountInHousehold(e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            disabled={isSubmitting}
            className="h-4 w-4 rounded accent-[var(--fm-gold,#e5a93c)] cursor-pointer"
            aria-labelledby={titleId + "-check-label"}
            aria-describedby={descriptionId}
          />
          <div className="flex flex-col min-w-0 flex-1">
            <span
              id={titleId + "-check-label"}
              className="text-sm font-semibold text-[var(--fm-warm-paper)]"
            >
              Cuenta en Hogar
            </span>
            <span
              id={descriptionId}
              className={
                "text-xs mt-0.5 leading-snug transition-colors " +
                (countInHousehold
                  ? "text-[var(--fm-text-muted)]"
                  : "text-[var(--fm-sage,#6c8e7f)]")
              }
            >
              {countInHousehold
                ? "Visible para ambos en las cuentas del Hogar."
                : "Solo visible para ti en tu espacio Personal."}
            </span>
          </div>
        </div>

        {/* Mensaje de error (opcional si existe) */}
        {errorMessage && (
          <p className="text-xs text-[var(--fm-danger,#f87171)] px-1 leading-snug">
            {errorMessage}
          </p>
        )}

        {/* Un solo botón primario «Confirmar» */}
        <FinanceButton
          ref={primaryButtonRef}
          type="button"
          tone="filled"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          onClick={handleConfirm}
          className="w-full cursor-pointer select-none rounded-xl py-2.5 text-sm font-semibold mt-1"
        >
          {isSubmitting ? "Guardando..." : "Confirmar"}
        </FinanceButton>
      </div>
    </div>
  );
}
