"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { cn } from "@/lib/utils";

type HouseholdDialogProps = {
  open: boolean;
  title: React.ReactNode;
  subtitle?: string;
  onClose: () => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  /**
   * `wide` = editores densos (categorías) en desktop.
   * `composer` = formulario por etapas con pares horizontales (720px).
   * `composer-lg` = workspace horizontal denso, dos columnas reales (960px) —
   * nuevo gasto Hogar V2.
   */
  size?: "default" | "wide" | "composer" | "composer-lg";
  /**
   * Ref opcional al panel real del diálogo. Los llamadores que usan
   * `useFocusTrap(dialogRef, ...)` para atrapar Tab necesitan un nodo montado
   * de verdad — sin esto, su `dialogRef` nunca apunta a nada porque este
   * componente no reenviaba el suyo. No reemplaza el manejo interno de foco
   * inicial/Escape de este diálogo; solo expone el nodo para que el trap de
   * Tab del llamador tenga contenedor sobre el cual operar.
   */
  panelRef?: React.Ref<HTMLDivElement>;
};

export function HouseholdDialog({
  open,
  title,
  subtitle,
  onClose,
  headerActions,
  children,
  size = "default",
  panelRef,
}: HouseholdDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const setPanelRef = (node: HTMLDivElement | null) => {
    dialogRef.current = node;
    if (typeof panelRef === "function") {
      panelRef(node);
    } else if (panelRef && "current" in panelRef) {
      (panelRef as React.RefObject<HTMLDivElement | null>).current = node;
    }
  };
  const titleId = useId();
  const descriptionId = useId();

  // `onClose` casi siempre llega como flecha inline: su identidad cambia en
  // cada render (p. ej. al tipear el monto). Guardarlo en un ref permite que
  // el efecto de apertura dependa SOLO de `open` — si no, cada tecla reenfoca
  // el control inicial y el usuario no puede bajar al título u otros campos.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Un diálogo puede declarar su control de entrada (p. ej. el monto del
    // nuevo gasto); si no lo hace, se mantiene el primer botón como antes.
    const declaredInitialFocus = dialogRef.current?.querySelector<HTMLElement>(
      '[data-hh-dialog-initial-focus="true"]',
    );
    (declaredInitialFocus ?? dialogRef.current?.querySelector<HTMLElement>("button"))?.focus();

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
      role="presentation"
      className="fixed inset-0 z-[95] grid place-items-center bg-[var(--hh-overlay)] px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={setPanelRef}
        data-fm-context="household"
        aria-describedby={subtitle ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          "w-full rounded-[28px] border border-[var(--hh-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--hh-surface-elevated)_96%,transparent),color-mix(in_srgb,var(--hh-surface)_98%,transparent))] p-5 shadow-[var(--hh-shadow)] outline-none animate-in fade-in zoom-in-95 duration-200",
          size === "composer-lg" && "max-w-[960px]",
          size === "composer" && "max-w-[720px]",
          size === "wide" && "max-w-2xl",
          size === "default" && "max-w-lg"
        )}
        role="dialog"
        // -1: foco programático solamente (p. ej. el fallback de
        // `dialogRef.current?.focus()` de un llamador con `panelRef`), no un
        // parada de Tab — no altera el orden de tabulación existente.
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            {typeof title === "string" ? (
              <h2
                id={titleId}
                className="font-[var(--font-display)] text-[24px] font-semibold tracking-[-0.03em] text-[var(--hh-text)]"
              >
                {title}
              </h2>
            ) : (
              <div id={titleId} className="flex-1">{title}</div>
            )
            }
            {subtitle ? (
              <p id={descriptionId} className="mt-1 text-sm text-[var(--hh-text-secondary)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            <HouseholdButton
              aria-label="Cerrar"
              onClick={onClose}
              size="icon"
              tone="text"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </HouseholdButton>
          </div>
        </div>
        <div className="mt-5">
          {children}
        </div>
      </div>
    </div>
  );
}
