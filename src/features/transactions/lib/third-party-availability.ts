/**
 * src/features/transactions/lib/third-party-availability.ts
 *
 * Helpers puros (sin Firebase, sin React) para calcular la disponibilidad de
 * dinero no propio en una ubicación dada y determinar si el botón OCC debe
 * bloquearse.
 *
 * La lógica se extrae aquí para que sea testeable sin necesidad de RTL ni
 * entorno de browser.
 */

import { projectThirdPartyHeldAtLocation } from "@/lib/finance/third-party-location";
import type { MoneyLocation, ThirdPartyLocationEntry, ThirdPartyLocationMove, ThirdPartyLocationConsumption } from "@/lib/finance/third-party-location";

export type ThirdPartyAvailabilitySnapshot = {
  entries: ThirdPartyLocationEntry[];
  moves: ThirdPartyLocationMove[];
  consumptions: ThirdPartyLocationConsumption[];
};

/**
 * Calcula cuánto dinero no propio está disponible en una ubicación concreta.
 * Devuelve 0 si la ubicación no existe o el snapshot está vacío.
 */
export const computeThirdPartyAvailability = (
  location: MoneyLocation,
  snapshot: ThirdPartyAvailabilitySnapshot,
): number =>
  projectThirdPartyHeldAtLocation(
    location,
    snapshot.entries,
    snapshot.moves,
    snapshot.consumptions,
  );

/**
 * Determina si el botón de envío OCC debe estar bloqueado y por qué.
 *
 * Devuelve `null` si NO hay razón de bloqueo (el envío puede proceder).
 * Devuelve un string con el mensaje de bloqueo si el envío debe impedirse.
 *
 * Solo aplica cuando `movesThirdPartyFunds === true`.
 */
export const getOccSubmitBlockReason = (params: {
  movesThirdPartyFunds: boolean;
  isLoading: boolean;
  loadError: string | null;
  thirdPartyAvailable: number;
  parsedAmount: number;
}): string | null => {
  if (!params.movesThirdPartyFunds) return null;
  if (params.isLoading) return "Calculando dinero no propio disponible…";
  if (params.loadError !== null) return params.loadError;
  if (params.parsedAmount > 0 && params.thirdPartyAvailable < params.parsedAmount) {
    return "El origen no tiene suficiente dinero no propio para esta transferencia.";
  }
  return null;
};

/**
 * Determina el texto informativo de disponibilidad OCC.
 * Devuelve `null` si el toggle está apagado (no mostrar nada).
 */
export const getThirdPartyAvailabilityLabel = (params: {
  movesThirdPartyFunds: boolean;
  isLoading: boolean;
  loadError: string | null;
  thirdPartyAvailable: number;
}): string | null => {
  if (!params.movesThirdPartyFunds) return null;
  if (params.isLoading) return "Calculando dinero no propio disponible…";
  if (params.loadError !== null)
    return "No se pudo verificar el dinero no propio disponible. Intenta nuevamente.";
  return `Disponible no propio en el origen: $ ${params.thirdPartyAvailable.toLocaleString("es-CO")}`;
};
