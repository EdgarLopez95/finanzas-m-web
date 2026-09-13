import type { MplusComposerMode } from "@/stores/mplus-composer-store";

export interface ShouldConfirmExitParams {
  mode: MplusComposerMode;
  isSubmitting: boolean;
  isConfirmOpen?: boolean;
}

/**
 * Política pura de confirmación de salida para el formulario de alta o edición
 * de movimientos personales (§ Paridad Android f16a0b8 / Dev Log 2026-09-02,
 * espejo de PersonalMovementEntryBackPolicy).
 *
 * Reglas exactas:
 * 1. Si mode.kind === "closed": false (no hay formulario abierto).
 * 2. Si mode.kind === "trash": false (el flujo de Papelera tiene su propio diálogo y botones).
 * 3. Si isSubmitting === true: false (la salida está bloqueada mientras se guarda en remoto).
 * 4. Si isConfirmOpen === true: false (no apilar diálogos de confirmación si ya hay uno abierto).
 * 5. Si mode.kind === "create" || mode.kind === "edit": true (SIEMPRE requiere confirmación,
 *    independientemente de si isDirty es true o false, incluso con el formulario vacío).
 */
export function shouldConfirmExit({
  mode,
  isSubmitting,
  isConfirmOpen = false,
}: ShouldConfirmExitParams): boolean {
  if (mode.kind === "closed" || mode.kind === "trash") {
    return false;
  }
  if (isSubmitting || isConfirmOpen) {
    return false;
  }
  return mode.kind === "create" || mode.kind === "edit";
}

/**
 * Determina si la acción de salir está bloqueada por completo
 * (p. ej. mientras se está ejecutando la mutación remota en Firestore).
 */
export function isExitBlocked(isSubmitting: boolean): boolean {
  return isSubmitting;
}
