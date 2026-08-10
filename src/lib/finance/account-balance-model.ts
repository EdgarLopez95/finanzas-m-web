/**
 * Núcleo financiero puro (Paso 1 de paridad Android/Web — cuentas, bolsillos
 * y dinero propio/no propio). Sin React, sin Firestore: solo tipos y
 * funciones puras que formalizan el contrato no negociable documentado en
 * `docs/superpowers/plans/2026-08-04-account-pocket-money-parity.md`:
 *
 *   Disponible físico de cuenta = accounts/{id}.currentBalance
 *   Total físico de cuenta      = Disponible + Σ bolsillo.balance
 *   Propio por ubicación        = físico ubicación − no propio ubicación
 *
 * Existe para que ningún servicio de escritura (mutador) pueda recibir un
 * total visual enriquecido y tratarlo como si fuera el Disponible físico de
 * la cuenta — ese es exactamente el bug que este archivo hace imposible de
 * repetir por accidente: `AccountPhysicalBalances` nombra los tres valores
 * por separado, nunca los confunde bajo un único campo `balance`.
 *
 * Nunca clampea ("Math.max(0, ...)" o similar): una inconsistencia (no propio
 * mayor al físico) debe seguir siendo visible/calculable, no invisibilizada
 * detrás de un cero inventado.
 */

/** Identificador canónico de una ubicación de dinero dentro de una cuenta. */
export type MoneyLocation = {
  accountId: string;
  /** `null` = Disponible de la cuenta (no un bolsillo). */
  pocketId: string | null;
};

/** Forma mínima de un bolsillo para este cálculo — evita acoplar el modelo al tipo `Pocket` completo. */
export type PocketBalanceLike = {
  balance: number;
};

/**
 * Los tres saldos físicos de una cuenta, nombrados sin ambigüedad.
 * `availableBalance` es SIEMPRE `accounts/{id}.currentBalance` — nunca un
 * total. `totalBalance` es SIEMPRE derivado, nunca una fuente de escritura.
 */
export type AccountPhysicalBalances = {
  availableBalance: number;
  pocketsBalance: number;
  totalBalance: number;
};

/**
 * Alias con nombre orientado a consumidores visuales — la "vista enriquecida"
 * de una cuenta que un componente/hook arma localmente (cuenta + sus
 * bolsillos) para mostrar Disponible/bolsillos/Total con semántica explícita.
 * Misma forma que `AccountPhysicalBalances` a propósito: no se duplica el
 * tipo, solo se documenta el propósito de consumo bajo un nombre más claro
 * para código de UI (`AccountPocketCard`, `AccountDetailDialog`, etc.).
 */
export type AccountDisplayBalances = AccountPhysicalBalances;

/**
 * Composición de propiedad de una ubicación (Disponible o un bolsillo
 * puntual). `ownBalance` puede ser negativo — eso ES la inconsistencia, no un
 * error a esconder.
 */
export type LocationOwnershipComposition = {
  physicalBalance: number;
  thirdPartyBalance: number;
  ownBalance: number;
  isInconsistent: boolean;
};

function assertFiniteAmount(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} debe ser un número finito (recibido: ${String(value)}).`);
  }
}

/**
 * `totalBalance = availableBalance + Σ pockets.balance`. El Disponible NUNCA
 * se reduce por los bolsillos: es la fuente (`currentBalance`), no un
 * derivado de restar nada.
 */
export function calculateAccountPhysicalBalances(
  availableBalance: number,
  pockets: PocketBalanceLike[],
): AccountPhysicalBalances {
  assertFiniteAmount(availableBalance, "El disponible de la cuenta");

  const pocketsBalance = pockets.reduce((sum, pocket) => {
    assertFiniteAmount(pocket.balance, "El saldo de un bolsillo");
    return sum + pocket.balance;
  }, 0);

  return {
    availableBalance,
    pocketsBalance,
    totalBalance: availableBalance + pocketsBalance,
  };
}

/**
 * Saldo físico de UNA ubicación: si es un bolsillo, su propio `balance`; si
 * es Disponible (`pocket` ausente/null), el `currentBalance` de la cuenta.
 * Nunca resta bolsillos del Disponible ni sepende del total enriquecido.
 */
export function resolveLocationPhysicalBalance(params: {
  availableBalance: number;
  pocket?: PocketBalanceLike | null;
}): number {
  if (params.pocket != null) {
    assertFiniteAmount(params.pocket.balance, "El saldo del bolsillo");
    return params.pocket.balance;
  }
  assertFiniteAmount(params.availableBalance, "El disponible de la cuenta");
  return params.availableBalance;
}

/**
 * `ownBalance = physicalBalance - thirdPartyBalance`. `isInconsistent` es
 * verdadero cuando lo no propio excede el físico — en ese caso `ownBalance`
 * queda negativo A PROPÓSITO. Ningún caller debe clampear este resultado.
 */
export function calculateLocationOwnershipComposition(params: {
  physicalBalance: number;
  thirdPartyBalance: number;
}): LocationOwnershipComposition {
  assertFiniteAmount(params.physicalBalance, "El saldo físico de la ubicación");
  assertFiniteAmount(params.thirdPartyBalance, "El saldo no propio de la ubicación");

  const ownBalance = params.physicalBalance - params.thirdPartyBalance;
  const isInconsistent = params.thirdPartyBalance > params.physicalBalance;

  return {
    physicalBalance: params.physicalBalance,
    thirdPartyBalance: params.thirdPartyBalance,
    ownBalance,
    isInconsistent,
  };
}

/** Clave estable para usar `MoneyLocation` como llave de Map/Set o dependencia de memo. */
export function moneyLocationKey(location: MoneyLocation): string {
  return `${location.accountId}::${location.pocketId ?? "available"}`;
}
