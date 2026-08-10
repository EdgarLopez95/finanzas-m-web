/**
 * ============================================================================
 * HERRAMIENTA QA/DEBUG — SOLO PARA DESARROLLO
 * Retirar obligatoriamente este módulo (y todo `src/features/qa-reset/**`)
 * antes del lanzamiento productivo. Ver `src/features/qa-reset/README` (nota
 * en el componente de UI) para el contrato exacto de aislamiento.
 * ============================================================================
 *
 * Resolución pura del rol del usuario actual frente al Hogar activo, para
 * decidir qué copy de confirmación mostrar y qué operación de Hogar ejecutar
 * durante el reinicio de datos de prueba (paridad funcional con
 * `DebugDataResetRepository.kt` de Android, adaptada al modelo Web de
 * "un solo Hogar activo por usuario a la vez").
 */
import type { Household } from "@/types/household";

export type QaResetRole = "none" | "owner" | "member";

export const resolveQaResetRole = (
  uid: string,
  household: Household | null | undefined,
): QaResetRole => {
  if (!uid || !household) return "none";
  if (household.ownerId === uid) return "owner";
  if (household.memberIds.includes(uid)) return "member";
  return "none";
};

/**
 * Copys de confirmación exactos pedidos por Felipe, uno por rol. El texto
 * nunca expone datos del otro miembro (ni nombre, ni cuenta, ni saldo).
 */
export const QA_RESET_CONFIRMATION_COPY: Record<QaResetRole, string> = {
  none: "Se eliminarán tus cuentas, bolsillos, categorías, movimientos y demás datos personales de prueba. Tu cuenta seguirá creada.",
  owner:
    "Se eliminarán tus datos personales y se disolverá el Hogar. También se borrarán sus eventos, categorías, ingresos compartidos, deudas e invitación. Esta acción afecta a todos los miembros.",
  member:
    "Se eliminarán tus datos personales y saldrás del Hogar. El Hogar y los datos del otro miembro permanecerán.",
};

export const resolveQaResetConfirmationCopy = (role: QaResetRole): string => QA_RESET_CONFIRMATION_COPY[role];
