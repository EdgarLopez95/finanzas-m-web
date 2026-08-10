/**
 * Paso 6 — Evaluación de datos legacy de dinero no propio SIN ubicación
 * verificable.
 *
 * Reglas no negociables:
 * - Es PURA e IDEMPOTENTE: no escribe nada, no migra nada, no muta sus inputs.
 *   Llamarla dos veces con la misma entrada devuelve exactamente lo mismo.
 * - Si la ubicación puede demostrarse con los datos existentes, se clasifica de
 *   forma DERIVADA (`located`) — nunca se persiste esa derivación.
 * - Si NO puede demostrarse, el resultado obligatorio es `requiresReview`.
 *   Jamás se asume "mío", jamás se habilita una atribución o un movimiento
 *   riesgoso, y jamás se infiere ownership del hecho de que exista saldo físico.
 */

import type { MoneyLocation, ThirdPartyLocationEntry } from "@/lib/finance/third-party-location";

/** Copy canónico único mostrado cuando hay legado sin ubicación verificable. */
export const LEGACY_REVIEW_MESSAGE =
  "Tienes dinero no propio sin ubicación verificable. Requiere revisión antes de poder atribuirlo o moverlo.";

export type LegacyReviewReason =
  /** No hay transacción de ingreso resoluble que demuestre dónde entró el dinero. */
  | "location_not_resolvable"
  /** El monto remoto está corrupto (no finito o negativo): no se ignora en silencio. */
  | "invalid_amount";

export type LegacyEntryClassification =
  | { entryId: string; status: "located"; amount: number; location: MoneyLocation }
  | { entryId: string; status: "requiresReview"; amount: number; reason: LegacyReviewReason };

export type LegacyEvaluation = {
  entries: LegacyEntryClassification[];
  /** `true` si alguna entry quedó sin ubicación demostrable. Bloquea atribuciones. */
  requiresReview: boolean;
  /** Σ de montos sin ubicación demostrable. No se imputa a ninguna ubicación. */
  unlocatedAmount: number;
};

export const evaluateThirdPartyLegacy = (params: {
  entries: readonly ThirdPartyLocationEntry[];
}): LegacyEvaluation => {
  const classified: LegacyEntryClassification[] = params.entries.map((entry) => {
    const amount = entry.originalAmount;

    if (!Number.isFinite(amount) || amount < 0) {
      return { entryId: entry.entryId, status: "requiresReview", amount, reason: "invalid_amount" };
    }

    // La ubicación solo se considera demostrada si viene resuelta desde la
    // fuente canónica. La ausencia NO se rellena con heurísticas.
    if (entry.location === null) {
      return { entryId: entry.entryId, status: "requiresReview", amount, reason: "location_not_resolvable" };
    }

    return {
      entryId: entry.entryId,
      status: "located",
      amount,
      location: { accountId: entry.location.accountId, pocketId: entry.location.pocketId },
    };
  });

  const pending = classified.filter((item) => item.status === "requiresReview");

  return {
    entries: classified,
    // Un pendiente de monto 0 no bloquea nada: no hay dinero que atribuir mal.
    requiresReview: pending.some((item) => !Number.isFinite(item.amount) || item.amount > 0),
    unlocatedAmount: pending.reduce(
      (sum, item) => (Number.isFinite(item.amount) && item.amount > 0 ? sum + item.amount : sum),
      0,
    ),
  };
};
