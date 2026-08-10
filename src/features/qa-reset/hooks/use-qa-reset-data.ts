/**
 * ============================================================================
 * HERRAMIENTA QA/DEBUG — SOLO PARA DESARROLLO. Retirar antes de producción.
 * ============================================================================
 *
 * Hook de UI para el reinicio de datos de prueba.
 *
 * Causa raíz del bug corregido aquí (skeleton infinito): `submit()` limpiaba
 * los stores (`reset()`) INMEDIATAMENTE al terminar el reset remoto, antes de
 * que el usuario pudiera leer el resultado. `DashboardShell` ve el store
 * personal en `idle` en el siguiente render y reemplaza TODO `children`
 * (incluida la superficie de Ajustes y este mismo diálogo) por
 * `<LoadingContent />` — el loader nunca vuelve a dispararse porque `uid` y
 * la sesión no cambiaron, así que la pantalla queda en skeleton para
 * siempre.
 *
 * Fix: `submit()` YA NO limpia stores. Solo ejecuta el reset remoto y publica
 * el resultado (`outcome`) — el diálogo permanece montado y el resultado
 * visible mientras el usuario no actúe. La limpieza local + remount solo
 * ocurre en `finish()`, llamada explícitamente por el usuario (botón
 * "Entendido"/"Cerrar"), y usa una recarga completa controlada
 * (`reloadFn`, inyectable para pruebas) hacia una ruta segura — nunca un
 * `store.reset()` seguido de esperar un re-render que compita con el shell.
 * La recarga real remonta `DashboardShell` desde cero: el auth bootstrap
 * vuelve a resolver la MISMA sesión Firebase ya persistida (no se cierra
 * sesión) y los loaders de personal/Hogar/auto-settle arrancan limpios sin
 * pasar nunca por un `idle` que la UI deba renderizar mientras el usuario
 * todavía está mirando el resultado.
 */
import { useRef, useState } from "react";

import { usePersonalDataStore } from "@/stores/personal-data-store";
import { useHouseholdDataStore } from "@/stores/household-data-store";
import { useAutoSettleDebtStore } from "@/stores/auto-settle-debt-store";
import {
  resetQaDataForCurrentUser,
  type ResetQaDataForCurrentUserResult,
} from "@/features/qa-reset/services/reset-qa-data-for-current-user";

export type QaResetOutcome =
  | { kind: "success"; result: ResetQaDataForCurrentUserResult }
  | { kind: "partial"; result: ResetQaDataForCurrentUserResult }
  | { kind: "error"; message: string };

export type UseQaResetDataDeps = {
  /** Recarga completa controlada hacia `path`. Por defecto, navegación real de página (no un router.push de Next). */
  reloadFn?: (path: string) => void;
};

const defaultReloadFn = (path: string) => {
  window.location.href = path;
};

/** Ruta segura donde dejar al usuario tras finalizar (éxito, o cierre sin reintentar). */
export const QA_RESET_SAFE_LANDING_PATH = "/dashboard";

export const useQaResetData = (deps: UseQaResetDataDeps = {}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<QaResetOutcome | null>(null);
  const isSubmittingRef = useRef(false);
  const hasFinishedRef = useRef(false);
  const reloadFn = deps.reloadFn ?? defaultReloadFn;

  /**
   * Limpia el estado local Web (personal, Hogar, auto-settle/fallback). Cada
   * `reset()` de store ya desuscribe sus listeners (`subscriptionRegistry`)
   * antes de limpiar el dato en memoria. No toca la sesión de Firebase Auth
   * ni el store de autenticación — nunca se llama `clearSession`/`signOutUser`
   * aquí.
   */
  const clearLocalState = () => {
    usePersonalDataStore.getState().reset();
    useHouseholdDataStore.getState().reset();
    useAutoSettleDebtStore.getState().reset();
  };

  const submit = async (uid: string): Promise<void> => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setOutcome(null);

    try {
      const result = await resetQaDataForCurrentUser({ uid });
      // No se limpia estado local aquí a propósito: el resultado debe quedar
      // visible y accionable (éxito/parcial/error + Reintentar) ANTES de
      // tocar ningún store. Limpiar aquí es exactamente la causa raíz del
      // skeleton infinito que este hook corrige.
      setOutcome(result.hadAnyFailure ? { kind: "partial", result } : { kind: "success", result });
    } catch (err) {
      setOutcome({
        kind: "error",
        message: err instanceof Error ? err.message : "No se pudo reiniciar los datos de prueba.",
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  /**
   * Finaliza el flujo: limpia los stores locales y ejecuta una recarga
   * completa controlada hacia una ruta segura (`/dashboard`), para que el
   * shell, los loaders y los listeners se remonten limpios sin pasar por un
   * `idle` visible. Debe llamarse SOLO por acción explícita del usuario
   * (nunca automáticamente tras `submit`), y una única vez por resultado.
   */
  const finish = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    clearLocalState();
    reloadFn(QA_RESET_SAFE_LANDING_PATH);
  };

  const resetOutcome = () => {
    hasFinishedRef.current = false;
    setOutcome(null);
  };

  return {
    isSubmitting,
    outcome,
    submit,
    finish,
    resetOutcome,
  };
};
