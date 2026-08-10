/**
 * Paso 6 — P1/H1: estado de la lectura de propiedad en el detalle de cuenta.
 *
 * Regla central: la composición "Mi dinero / Dinero no propio" SOLO puede
 * usarse cuando existe un snapshot válido **de esta misma cuenta**. Mientras
 * tanto el estado es `loading` (nunca se deriva desde arrays vacíos como si
 * fueran datos reales) y las acciones que mueven dinero fallan cerradas.
 *
 * Módulo puro: sin React, sin Firestore.
 */

import type { ActionAvailability } from "@/features/accounts/lib/account-action-availability";
import type {
  ThirdPartyLocationConsumption,
  ThirdPartyLocationEntry,
  ThirdPartyLocationMove,
} from "@/lib/finance/third-party-location";

export const OWNERSHIP_LOADING_ACTION_MESSAGE =
  "Estamos calculando cuánto de este dinero es tuyo. Espera un momento antes de mover o atribuir dinero.";

export const OWNERSHIP_ERROR_ACTION_MESSAGE =
  "No pudimos calcular tu dinero propio. Por seguridad no puedes mover ni atribuir dinero hasta reintentar.";

/** Snapshot etiquetado con la cuenta a la que pertenece, para no reutilizarlo en otra. */
export type OwnershipSnapshot = {
  accountId: string;
  entries: ThirdPartyLocationEntry[];
  moves: ThirdPartyLocationMove[];
  consumptions: ThirdPartyLocationConsumption[];
};

export type OwnershipViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: OwnershipSnapshot };

export type OwnershipStatus = OwnershipViewState["status"];

/**
 * Un snapshot solo se considera listo si:
 *   - la lectura ya terminó (`loading === false`),
 *   - no hubo error,
 *   - existe, y
 *   - pertenece EXACTAMENTE a la cuenta que se está viendo.
 * Cualquier otro caso es `loading`/`error` — jamás se degrada a "datos vacíos".
 */
export const resolveOwnershipViewState = (params: {
  accountId: string;
  loading: boolean;
  error: string | null;
  snapshot: OwnershipSnapshot | null;
}): OwnershipViewState => {
  const { accountId, loading, error, snapshot } = params;

  if (loading) return { status: "loading" };
  if (error) return { status: "error", message: error };
  if (!snapshot || snapshot.accountId !== accountId) return { status: "loading" };

  return { status: "ready", snapshot };
};

export const isOwnershipReady = (state: OwnershipViewState): state is { status: "ready"; snapshot: OwnershipSnapshot } =>
  state.status === "ready";

/**
 * Ejecuta la acción SOLO si el gate la permite. Impide que un disparador
 * bloqueado abra un diálogo o dispare una mutación aunque el `disabled` visual
 * se evada. No sustituye las validaciones de los servicios: éstas siguen siendo
 * la barrera real de seguridad.
 */
export const runIfAllowed = (availability: ActionAvailability, action: () => void): void => {
  if (availability.enabled) action();
};
