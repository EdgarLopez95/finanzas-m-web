/**
 * Vigencia del código de invitación del Hogar.
 *
 * El servicio (`generate-household-invite-code.ts`) escribe un vencimiento a 7
 * días. Estas dos funciones puras son la única lectura de ese campo en la UI:
 * antes vivían duplicadas en `household-waiting-state.tsx` y
 * `household-overview.tsx`, y Ajustes de Hogar no las tenía — por eso Ajustes
 * era la única superficie que no mostraba la expiración.
 */

/** Sin fecha de expiración se considera expirado: no hay código vigente que mostrar. */
export const isInviteCodeExpired = (expiryDate: Date | null | undefined): boolean =>
  expiryDate ? new Date(expiryDate).getTime() < Date.now() : true;

/** Etiqueta corta de vigencia. Cadena vacía cuando no hay fecha. */
export const getInviteCodeExpiryLabel = (expiryDate: Date | null | undefined): string => {
  if (!expiryDate) return "";
  const diffMs = new Date(expiryDate).getTime() - Date.now();
  if (diffMs <= 0) return "Expirado";
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Expira hoy";
  if (diffDays === 1) return "Expira mañana";
  return `Expira en ${diffDays} días`;
};
