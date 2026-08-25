/**
 * Paso 6 — P1/H3: primitivas puras de foco para diálogos del contexto Personal.
 *
 * Se mantienen aquí (y no se consolidan con la copia del contexto Hogar) a
 * propósito: esta corrección tiene prohibido tocar Hogar, y unificar ambas
 * exigiría modificar sus hooks y sus pruebas. Estas funciones son puras y
 * pequeñas; la deuda de consolidación queda anotada, no escondida.
 *
 * Consumidor actual: `FinanceDialog`, para elegir el primer control útil al
 * abrir. El ciclado de Tab (`resolveDialogFocusTarget`) y el ciclo de vida por
 * fase (`dialog-focus-lifecycle.ts`) existían solo para el modal de detalle de
 * cuenta y se eliminaron al convertirlo en la pantalla `/accounts/[accountId]`.
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const isDisabled = (element: HTMLElement): boolean =>
  (element as unknown as { disabled?: boolean }).disabled === true ||
  element.hasAttribute("hidden") ||
  element.getAttribute?.("aria-hidden") === "true";

/** Controles realmente enfocables dentro del contenedor (excluye deshabilitados/ocultos). */
export const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !isDisabled(element),
  );

/**
 * Determina qué elemento dentro del drawer móvil debe recibir el foco inicial al abrirse.
 * Prioridad 1: Botón de cierre ("Cerrar menú de navegación").
 * Prioridad 2: Primer control focusable dentro del contenedor.
 * Fallback: El propio contenedor.
 */
export const resolveInitialDrawerFocus = (container: HTMLElement | null): HTMLElement | null => {
  if (!container) return null;
  const closeBtn = container.querySelector<HTMLElement>('button[aria-label="Cerrar menú de navegación"]');
  if (closeBtn && !isDisabled(closeBtn)) return closeBtn;

  const focusables = getFocusableElements(container);
  return focusables[0] ?? container;
};
