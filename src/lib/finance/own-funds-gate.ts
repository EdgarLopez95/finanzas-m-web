/**
 * Barrera local de dinero propio (paridad Android / transferencias normales).
 * Sin clamp: composición inconsistente (no propio > físico) se rechaza, no se oculta.
 *
 * G4 — fuente ÚNICA de la semántica y del copy de "no alcanza": tanto la
 * barrera de los servicios (`assertSufficientOwnFunds`) como el panel de
 * composición de los formularios (`resolveOwnFundsCompositionFeedback`) salen
 * de aquí, para que el usuario no vea dos explicaciones distintas del mismo
 * rechazo. Contrato: `docs/18_NON_OWN_MONEY_CONTRACT.md` §1.
 */

import { formatCurrencyCop } from "@/lib/format/currency";

export const INCONSISTENT_COMPOSITION_MESSAGE =
  "La composición de dinero propio en el origen es inconsistente.";

/**
 * Diferencia explícitamente los dos motivos de "no alcanza":
 * - el saldo FÍSICO no da  → problema de saldo;
 * - el saldo físico da pero parte es de terceros → problema de PROPIEDAD.
 * Devuelve `null` cuando la operación cabe dentro de "Mi dinero".
 */
export const resolveInsufficientFundsMessage = (params: {
  requested: number;
  physical: number;
  own: number;
}): string | null => {
  const { requested, physical, own } = params;

  if (requested <= own) return null;

  if (requested <= physical) {
    return `Tienes ${formatCurrencyCop(physical)} en esta ubicación, pero solo ${formatCurrencyCop(own)} es tu dinero: el resto es dinero no propio y no puedes gastarlo como propio.`;
  }

  return `Saldo insuficiente: esta ubicación tiene ${formatCurrencyCop(physical)}.`;
};

export type OwnFundsCompositionKind =
  | "ok"
  | "insufficient_own"
  | "insufficient_physical"
  | "inconsistent";

export type OwnFundsCompositionFeedback = {
  physical: number;
  held: number;
  /** `physical - held`, SIN clamp: puede ser negativo cuando hay inconsistencia. */
  own: number;
  kind: OwnFundsCompositionKind;
  /** `null` solo cuando `kind === "ok"`. */
  message: string | null;
};

/**
 * Evalúa un débito con dinero PROPIO contra la composición de su ubicación.
 * Devuelve los tres montos que el usuario necesita ver (físico / retenido no
 * propio / propio usable) más el motivo exacto del rechazo.
 *
 * Orden deliberado: la inconsistencia manda sobre todo (no se puede razonar
 * sobre una composición imposible), y la falta de saldo físico manda sobre la
 * de propiedad (si no hay plata, la propiedad es irrelevante).
 */
export const resolveOwnFundsCompositionFeedback = (params: {
  physical: number;
  held: number;
  amount: number;
}): OwnFundsCompositionFeedback => {
  const { physical, held, amount } = params;

  if (
    !Number.isFinite(physical) ||
    !Number.isFinite(held) ||
    !Number.isFinite(amount) ||
    held < 0 ||
    held > physical
  ) {
    // `own` se reporta igual (puede quedar negativo o NaN): la UI lo muestra
    // tal cual, nunca lo "arregla".
    return {
      physical,
      held,
      own: physical - held,
      kind: "inconsistent",
      message: INCONSISTENT_COMPOSITION_MESSAGE,
    };
  }

  const own = physical - held;

  // Monto no positivo: el formulario ya lo valida por su cuenta; aquí no hay
  // nada que objetar sobre la composición.
  if (amount <= 0) {
    return { physical, held, own, kind: "ok", message: null };
  }

  if (amount > physical) {
    return {
      physical,
      held,
      own,
      kind: "insufficient_physical",
      message: resolveInsufficientFundsMessage({ requested: amount, physical, own }),
    };
  }

  if (amount > own) {
    return {
      physical,
      held,
      own,
      kind: "insufficient_own",
      message: resolveInsufficientFundsMessage({ requested: amount, physical, own }),
    };
  }

  return { physical, held, own, kind: "ok", message: null };
};

export type AssertSufficientOwnFundsInput = {
  physicalBalance: number;
  thirdPartyHeld: number;
  amount: number;
};

/**
 * Barrera dura de los servicios. Delega en `resolveOwnFundsCompositionFeedback`
 * para que el error lanzado sea EXACTAMENTE el mismo texto que el panel de
 * composición ya mostró en el formulario.
 */
export const assertSufficientOwnFunds = ({
  physicalBalance,
  thirdPartyHeld,
  amount,
}: AssertSufficientOwnFundsInput): void => {
  const feedback = resolveOwnFundsCompositionFeedback({
    physical: physicalBalance,
    held: thirdPartyHeld,
    amount,
  });

  if (feedback.kind !== "ok") {
    throw new Error(feedback.message ?? INCONSISTENT_COMPOSITION_MESSAGE);
  }
};
