"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

import { FinanceButton } from "@/components/finance/finance-button";
import { getFocusableElements } from "@/lib/a11y/dialog-focus";
import { cn } from "@/lib/utils";

type FinanceDialogProps = {
  open: boolean;
  title: React.ReactNode;
  subtitle?: string;
  onClose: () => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  /**
   * `wide` = editores densos (categorías) en desktop.
   * `composer` = panel de operación con relaciones horizontales (+ Nuevo).
   */
  size?: "default" | "wide" | "composer";
};

export function FinanceDialog({
  open,
  title,
  subtitle,
  onClose,
  headerActions,
  children,
  size = "default",
}: FinanceDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  // `onClose` casi siempre llega como flecha inline: su identidad cambia en
  // cada render. Guardarlo en un ref permite que el efecto de apertura dependa
  // SOLO de `open` — antes, cada re-render (p. ej. una tecla en un input)
  // reejecutaba el efecto y le robaba el foco al campo.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // El primer `button` del diálogo es la X de cerrar: enfocarla convierte
    // "abrir" en "estar a punto de cerrar". Se prefiere el primer control útil
    // (campo o acción); si no hay ninguno, el propio panel (`tabIndex={-1}`),
    // que mantiene el foco dentro del diálogo sin sugerir el cierre.
    const container = dialogRef.current;
    // Un diálogo puede declarar su control de entrada (p. ej. el monto del
    // composer) con `data-finance-dialog-initial-focus`; si no, se usa el
    // primer control útil.
    const declaredInitialFocus = container?.querySelector<HTMLElement>(
      '[data-finance-dialog-initial-focus="true"]',
    );
    const firstUsefulControl = container
      ? getFocusableElements(container).find((element) => element.dataset.financeDialogClose !== "true")
      : undefined;
    (declaredInitialFocus ?? firstUsefulControl ?? container)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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
        className={cn(
          "flex w-full max-h-[90vh] flex-col rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(21,29,43,0.98),rgba(12,18,29,0.98))] p-5 shadow-[0_30px_70px_rgb(2_6_23/0.42)] animate-in fade-in zoom-in-95 duration-200",
          size === "composer" && "max-w-[720px]",
          size === "wide" && "max-w-2xl",
          size === "default" && "max-w-lg"
        )}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between gap-4 shrink-0">
          <div className="flex-1 min-w-0">
            {typeof title === "string" ? (
              <h2
                id={titleId}
                className="font-[var(--font-display)] text-[24px] font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]"
              >
                {title}
              </h2>
            ) : (
              <div id={titleId} className="flex-1">{title}</div>
            )}
            {subtitle ? (
              <p id={descriptionId} className="mt-1 text-sm text-[var(--fm-text-muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            <FinanceButton
              aria-label="Cerrar confirmacion"
              data-finance-dialog-close="true"
              onClick={onClose}
              size="icon"
              tone="text"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </FinanceButton>
          </div>
        </div>
        <div className="mt-5 overflow-y-auto overflow-x-hidden px-1 -mx-1">
          {children}
        </div>
      </div>
    </div>
  );
}
