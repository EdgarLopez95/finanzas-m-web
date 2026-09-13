/**
 * Determina la acción a ejecutar al confirmar el diálogo de compartir a Hogar
 * (§ Paridad Android HouseholdShareConfirmSheet / Dev Log 2026-09-02).
 *
 * - Si el checkbox «Cuenta en Hogar» está marcado -> "share" (onConfirmShare).
 * - Si está desmarcado -> "personalOnly" (onSavePersonalOnly).
 */
export function resolveShareConfirmAction(
  countInHousehold: boolean,
): "share" | "personalOnly" {
  return countInHousehold ? "share" : "personalOnly";
}
