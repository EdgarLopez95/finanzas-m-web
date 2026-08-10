/**
 * G3 — Inmutabilidad de movimientos que tocan el ledger de dinero no propio.
 *
 * Fuente ÚNICA de verdad para la UI (lista, detalle, panel de edición y
 * store). Antes cada superficie reimplementaba su propio `if`, con el
 * resultado de que la lista ofrecía acciones que el servicio rechazaba.
 *
 * Módulo puro: sin React, sin Firestore.
 */

import { isTechnicalTransaction } from "@/features/transactions/lib/technical-transactions";

export type PersonalMovementMutabilityInput = {
  type: string;
  title?: string | null;
  consumesThirdPartyFunds?: boolean;
  movesThirdPartyFunds?: boolean;
};

export const IMMUTABLE_CONSUMES_MESSAGE =
  "Este gasto usó dinero no propio y no se puede editar ni eliminar.";
export const IMMUTABLE_MOVES_MESSAGE =
  "Esta transferencia movió dinero no propio y no se puede editar ni eliminar.";
export const IMMUTABLE_TECHNICAL_EDIT_MESSAGE =
  "Este movimiento técnico no se puede editar.";
export const IMMUTABLE_TYPE_MESSAGE =
  "Este tipo de movimiento no se puede editar ni eliminar.";

const ACTIONABLE_TYPES = ["expense", "income", "transfer"];

export function getPersonalMovementEditBlockReason(
  tx: PersonalMovementMutabilityInput,
): string | null {
  if (tx.consumesThirdPartyFunds === true) return IMMUTABLE_CONSUMES_MESSAGE;
  if (tx.movesThirdPartyFunds === true) return IMMUTABLE_MOVES_MESSAGE;
  if (isTechnicalTransaction(tx.title)) return IMMUTABLE_TECHNICAL_EDIT_MESSAGE;
  if (!ACTIONABLE_TYPES.includes(tx.type)) return IMMUTABLE_TYPE_MESSAGE;
  return null;
}

export function getPersonalMovementDeleteBlockReason(
  tx: PersonalMovementMutabilityInput,
): string | null {
  if (tx.consumesThirdPartyFunds === true) return IMMUTABLE_CONSUMES_MESSAGE;
  if (tx.movesThirdPartyFunds === true) return IMMUTABLE_MOVES_MESSAGE;
  // Los técnicos son eliminables si no consumen ni mueven fondos de terceros.
  if (!ACTIONABLE_TYPES.includes(tx.type)) return IMMUTABLE_TYPE_MESSAGE;
  return null;
}

export function isPersonalMovementEditable(tx: PersonalMovementMutabilityInput): boolean {
  return getPersonalMovementEditBlockReason(tx) === null;
}

export function isPersonalMovementDeletable(tx: PersonalMovementMutabilityInput): boolean {
  return getPersonalMovementDeleteBlockReason(tx) === null;
}

/**
 * @deprecated Usar isPersonalMovementEditable o isPersonalMovementDeletable según la acción específica
 */
export function isPersonalMovementMutable(tx: PersonalMovementMutabilityInput): boolean {
  return isPersonalMovementEditable(tx);
}
