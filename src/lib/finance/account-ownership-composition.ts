/**
 * Paso 6 — Composición de propiedad de una cuenta y de cada una de sus
 * ubicaciones, para presentarla sin ambigüedad en el detalle Web.
 *
 * Separa los cuatro conceptos que nunca deben confundirse:
 *   Total físico  = Disponible + Σ bolsillos
 *   Disponible    = accounts/{id}.currentBalance (jamás el `balance` enriquecido)
 *   Dinero no propio = proyección FIFO localizada
 *   Mi dinero     = físico − no propio   (SIN clamp: puede ser negativo)
 *
 * Módulo puro: sin React, sin Firestore. No muta sus inputs.
 */

import {
  projectThirdPartyHeldAtLocation,
  type MoneyLocation,
  type ThirdPartyLocationConsumption,
  type ThirdPartyLocationEntry,
  type ThirdPartyLocationMove,
} from "@/lib/finance/third-party-location";

export type LocationComposition = {
  location: MoneyLocation;
  /** Saldo físico real de la ubicación. */
  physical: number;
  /** Dinero de terceros alojado en esta ubicación. */
  thirdParty: number;
  /** `physical - thirdParty`. Puede ser negativo — eso ES la inconsistencia. */
  own: number;
  isInconsistent: boolean;
};

export type PocketPhysical = { id: string; balance: number };

export type AccountComposition = {
  accountId: string;
  totalPhysical: number;
  available: number;
  pocketsTotal: number;
  thirdParty: number;
  own: number;
  isInconsistent: boolean;
  byLocation: LocationComposition[];
};

type ProjectionSources = {
  entries: readonly ThirdPartyLocationEntry[];
  moves: readonly ThirdPartyLocationMove[];
  consumptions: readonly ThirdPartyLocationConsumption[];
};

/**
 * Una ubicación es inconsistente si su físico es negativo, si el no propio
 * proyectado es negativo, o si el no propio supera al físico. Nunca se
 * "corrige" el resultado: se marca para que la UI lo muestre tal cual.
 */
const isLocationInconsistent = (physical: number, thirdParty: number): boolean =>
  physical < 0 || thirdParty < 0 || thirdParty > physical;

export const resolveLocationComposition = (params: {
  location: MoneyLocation;
  physical: number;
} & ProjectionSources): LocationComposition => {
  const { location, physical, entries, moves, consumptions } = params;

  const thirdParty = projectThirdPartyHeldAtLocation(
    location,
    entries as ThirdPartyLocationEntry[],
    moves as ThirdPartyLocationMove[],
    consumptions as ThirdPartyLocationConsumption[],
  );

  return {
    location,
    physical,
    thirdParty,
    own: physical - thirdParty,
    isInconsistent: isLocationInconsistent(physical, thirdParty),
  };
};

/**
 * Composición agregada de una cuenta. El Disponible y CADA bolsillo son
 * ubicaciones distintas: un bolsillo expone su propio dinero no propio, nunca
 * el global de la cuenta. Basta una ubicación inconsistente para marcar la
 * cuenta completa.
 */
export const resolveAccountComposition = (params: {
  accountId: string;
  /** `currentBalance` crudo. NUNCA un total enriquecido. */
  availableBalance: number;
  pockets: readonly PocketPhysical[];
} & Partial<ProjectionSources>): AccountComposition => {
  const { accountId, availableBalance, pockets } = params;
  const entries = params.entries ?? [];
  const moves = params.moves ?? [];
  const consumptions = params.consumptions ?? [];

  const byLocation: LocationComposition[] = [
    resolveLocationComposition({
      location: { accountId, pocketId: null },
      physical: availableBalance,
      entries,
      moves,
      consumptions,
    }),
    ...pockets.map((pocket) =>
      resolveLocationComposition({
        location: { accountId, pocketId: pocket.id },
        physical: pocket.balance,
        entries,
        moves,
        consumptions,
      }),
    ),
  ];

  const pocketsTotal = pockets.reduce((sum, pocket) => sum + pocket.balance, 0);
  const totalPhysical = availableBalance + pocketsTotal;
  const thirdParty = byLocation.reduce((sum, location) => sum + location.thirdParty, 0);

  return {
    accountId,
    totalPhysical,
    available: availableBalance,
    pocketsTotal,
    thirdParty,
    own: totalPhysical - thirdParty,
    isInconsistent: byLocation.some((location) => location.isInconsistent),
    byLocation,
  };
};

/** Fila de composición LOCALIZADA de un bolsillo — nunca el agregado de la cuenta. */
export type PocketCompositionRow = {
  pocketId: string;
  name: string;
  physical: number;
  own: number;
  thirdParty: number;
  isInconsistent: boolean;
};

/**
 * Paso 6 (P1/H3): composición por bolsillo para mostrarla junto a cada uno.
 * Cada fila usa la ubicación del bolsillo concreto, de modo que un bolsillo
 * nunca repite el "Dinero no propio" global de la cuenta.
 */
export const buildPocketCompositionRows = (
  composition: AccountComposition,
  pockets: readonly { id: string; name: string }[],
): PocketCompositionRow[] =>
  pockets.map((pocket) => {
    const location = composition.byLocation.find((item) => item.location.pocketId === pocket.id);
    return {
      pocketId: pocket.id,
      name: pocket.name,
      physical: location?.physical ?? 0,
      own: location?.own ?? 0,
      thirdParty: location?.thirdParty ?? 0,
      isInconsistent: location?.isInconsistent ?? false,
    };
  });
