"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

/**
 * Algoritmo puro de ciclo Tab/Shift+Tab dentro de un contenedor modal. No toca el DOM: solo
 * decide, a partir del estado actual del foco, si hay que interceptar el Tab y hacia dónde
 * ("first"/"last"), o dejar pasar el comportamiento nativo del navegador (null).
 */
export function resolveFocusTrapTarget(params: {
  focusableCount: number;
  isActiveInsideContainer: boolean;
  isActiveFirst: boolean;
  isActiveLast: boolean;
  shiftKey: boolean;
}): "first" | "last" | null {
  const { focusableCount, isActiveInsideContainer, isActiveFirst, isActiveLast, shiftKey } = params;
  if (focusableCount === 0) return null;

  if (shiftKey) {
    if (!isActiveInsideContainer || isActiveFirst) return "last";
    return null;
  }

  if (!isActiveInsideContainer || isActiveLast) return "first";
  return null;
}

// Pila global de traps activos: en diálogos anidados, solo el trap más reciente (tope) debe
// capturar Tab; el/los trap(s) inferiores quedan en pausa hasta volver a ser el tope.
export function pushFocusTrap(stack: symbol[], id: symbol): symbol[] {
  return [...stack, id];
}

export function popFocusTrap(stack: symbol[], id: symbol): symbol[] {
  return stack.filter((existingId) => existingId !== id);
}

export function isTopFocusTrap(stack: symbol[], id: symbol): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id;
}

let activeFocusTrapStack: symbol[] = [];

/**
 * Atrapa el foco (Tab/Shift+Tab) dentro de `containerRef` mientras `active` es true, y
 * devuelve el foco al elemento que abrió el diálogo al cerrarse o desmontarse (si ese
 * elemento sigue montado). En diálogos anidados, solo el trap superior de la pila actúa;
 * al cerrar el hijo, el padre recupera la captura de Tab automáticamente.
 *
 * `onEscape` (opcional) reutiliza la MISMA pila: si se provee, el propio hook maneja Escape
 * en el mismo listener que Tab, invocando el callback solo cuando este diálogo es el tope de
 * la pila. Esto evita que, en diálogos anidados, una sola pulsación de Escape cierre a la vez
 * al hijo y al padre (cada uno con su propio listener independiente en `document`) — en vez
 * de eso, cada diálogo debe delegar su lógica de Escape aquí en lugar de registrar su propio
 * listener de `document`.
 *
 * No añade tabindex positivo ni depende de librerías externas: solo usa elementos nativos
 * focusables ya presentes en el DOM.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void
): void {
  const idRef = useRef<symbol | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;

    const id = Symbol("household-focus-trap");
    idRef.current = id;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    activeFocusTrapStack = pushFocusTrap(activeFocusTrapStack, id);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" && event.key !== "Escape") return;
      if (!isTopFocusTrap(activeFocusTrapStack, id)) return;

      if (event.key === "Escape") {
        if (onEscapeRef.current) {
          event.preventDefault();
          onEscapeRef.current();
        }
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      const focusables = getFocusableElements(container);
      const activeElement = document.activeElement;
      const isActiveInsideContainer =
        activeElement instanceof HTMLElement && container.contains(activeElement);

      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const target = resolveFocusTrapTarget({
        focusableCount: focusables.length,
        isActiveInsideContainer,
        isActiveFirst: activeElement === focusables[0],
        isActiveLast: activeElement === focusables[focusables.length - 1],
        shiftKey: event.shiftKey,
      });

      if (target === "first") {
        event.preventDefault();
        focusables[0].focus();
      } else if (target === "last") {
        event.preventDefault();
        focusables[focusables.length - 1].focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      activeFocusTrapStack = popFocusTrap(activeFocusTrapStack, id);

      const opener = openerRef.current;
      if (opener && document.body.contains(opener)) {
        opener.focus();
      }
      openerRef.current = null;
      idRef.current = null;
    };
  }, [active, containerRef]);
}
