/**
 * Paso 6 — Disponibilidad y copys de las acciones del detalle de cuenta.
 *
 * Un único lugar decide qué acción está habilitada y POR QUÉ, para que la UI
 * nunca ofrezca algo que el servicio rechazaría y para que el motivo mostrado
 * sea siempre el mismo texto. Los servicios siguen siendo la barrera real:
 * esto es prevención de UX, no seguridad.
 */

import type { AccountComposition } from "@/lib/finance/account-ownership-composition";
import { LEGACY_REVIEW_MESSAGE, type LegacyEvaluation } from "@/lib/finance/third-party-legacy-evaluation";
import {
  OWNERSHIP_ERROR_ACTION_MESSAGE,
  OWNERSHIP_LOADING_ACTION_MESSAGE,
  type OwnershipStatus,
} from "@/features/accounts/lib/account-ownership-view-state";

export const CLOSED_ACCOUNT_ACTION_MESSAGE =
  "Esta cuenta está cerrada. Reábrela para volver a registrar movimientos.";

export const INCONSISTENT_ACCOUNT_ACTION_MESSAGE =
  "Esta cuenta tiene una inconsistencia entre su saldo físico y su dinero no propio. Requiere revisión antes de mover o atribuir dinero.";

export const ACCOUNT_HAS_POCKETS_MESSAGE =
  "Esta cuenta tiene bolsillos. Elimínalos primero para poder continuar.";

export const ACCOUNT_MUST_BE_CLOSED_MESSAGE =
  "Solo puedes eliminar una cuenta cerrada. Ciérrala primero.";

export const ACCOUNT_ALREADY_CLOSED_MESSAGE = "Esta cuenta ya está cerrada.";

export const ACCOUNT_NOT_CLOSED_MESSAGE = "Esta cuenta está activa; no hay nada que reabrir.";

export type AccountActionKey =
  | "moveThirdParty"
  | "adjustAvailable"
  | "createPocket"
  | "deletePocket"
  | "closeAccount"
  | "reopenAccount"
  | "deleteAccount";

export type ActionAvailability = { enabled: boolean; reason: string | null };

const allow = (): ActionAvailability => ({ enabled: true, reason: null });
const block = (reason: string): ActionAvailability => ({ enabled: false, reason });

/**
 * Motivo por el que una acción que MUEVE o ATRIBUYE dinero debe bloquearse.
 * Precedencia deliberada: el estado de la cuenta manda sobre el del ledger, y
 * un legado sin resolver manda sobre una inconsistencia (porque el legado
 * puede ser justamente la causa de esa inconsistencia).
 */
const resolveMoneyActionBlock = (params: {
  archived: boolean;
  composition: AccountComposition;
  legacy: LegacyEvaluation;
  ownershipStatus: OwnershipStatus;
}): string | null => {
  if (params.archived) return CLOSED_ACCOUNT_ACTION_MESSAGE;
  // P1/H1 — fail-closed: sin un snapshot de propiedad válido de ESTA cuenta no
  // se puede mover, atribuir, liberar ni gastar dinero. El error no se oculta.
  if (params.ownershipStatus === "loading") return OWNERSHIP_LOADING_ACTION_MESSAGE;
  if (params.ownershipStatus === "error") return OWNERSHIP_ERROR_ACTION_MESSAGE;
  if (params.legacy.requiresReview) return LEGACY_REVIEW_MESSAGE;
  if (params.composition.isInconsistent) return INCONSISTENT_ACCOUNT_ACTION_MESSAGE;
  return null;
};

export const resolveAccountActionAvailability = (params: {
  archived: boolean;
  composition: AccountComposition;
  legacy: LegacyEvaluation;
  pocketCount: number;
  /**
   * Estado de la lectura de propiedad. Por defecto `"ready"` para los callers
   * que no dependen de ella (p. ej. pruebas de ciclo de vida puro).
   */
  ownershipStatus?: OwnershipStatus;
}): Record<AccountActionKey, ActionAvailability> => {
  const { archived, pocketCount } = params;
  const moneyBlock = resolveMoneyActionBlock({ ...params, ownershipStatus: params.ownershipStatus ?? "ready" });
  const moneyAction = moneyBlock ? block(moneyBlock) : allow();

  return {
    // Acciones que mueven o atribuyen dinero: comparten exactamente el mismo gate.
    moveThirdParty: moneyAction,
    adjustAvailable: moneyAction,
    createPocket: moneyAction,
    deletePocket: moneyAction,

    // Ciclo de vida: no depende del ledger, sí de bolsillos y estado.
    closeAccount: archived
      ? block(ACCOUNT_ALREADY_CLOSED_MESSAGE)
      : pocketCount > 0
        ? block(ACCOUNT_HAS_POCKETS_MESSAGE)
        : allow(),

    reopenAccount: archived ? allow() : block(ACCOUNT_NOT_CLOSED_MESSAGE),

    deleteAccount:
      pocketCount > 0
        ? block(ACCOUNT_HAS_POCKETS_MESSAGE)
        : archived
          ? allow()
          : block(ACCOUNT_MUST_BE_CLOSED_MESSAGE),
  };
};

/**
 * G4 — la fórmula y el copy viven ahora en `own-funds-gate.ts`, junto a la
 * barrera dura de los servicios, para que formulario y servicio expliquen el
 * rechazo con el mismo texto. Se reexporta aquí por compatibilidad de imports.
 */
export { resolveInsufficientFundsMessage } from "@/lib/finance/own-funds-gate";
