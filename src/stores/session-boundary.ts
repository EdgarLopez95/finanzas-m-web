import { useAppContextStore } from "@/stores/app-context-store";
import { useAutoSettleDebtStore } from "@/stores/auto-settle-debt-store";
import { useHouseholdDataStore } from "@/stores/household-data-store";
import { useHouseholdUiPreferencesStore } from "@/stores/household-ui-preferences-store";
import { useHouseholdUiStore } from "@/stores/household-ui-store";
import { usePersonalDataStore } from "@/stores/personal-data-store";
import { useTransactionPanelStore } from "@/stores/transaction-panel-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

/**
 * W1 — limpieza TOTAL de stores al cambiar de usuario.
 *
 * Antes, una frontera de sesión (logout, login de otra cuenta en la misma
 * pestaña) solo reiniciaba `app-context-store`. Los datos Personales y de
 * Hogar ya cargados seguían en memoria hasta que `load()` de la siguiente
 * sesión los desalojaba de forma perezosa: entre medio, la UI podía pintar
 * cifras del usuario anterior.
 *
 * Esta función es el único punto que ordena la limpieza. Cada store expone su
 * propio `reset`; aquí no se manipula estado ajeno a mano.
 *
 * Excluido a propósito:
 *
 * - `auth-store`, que lo gobierna el propio listener de Firebase Auth
 *   (`useAuthBootstrap`) y que ya distingue `clearSession` de `setSession`;
 * - las claves de `localStorage` de preferencias de tablero, que hoy son del
 *   dispositivo y no del usuario. Se reinicia su estado en memoria y se marcan
 *   como no hidratadas, pero borrarlas destruiría la configuración del propio
 *   usuario al volver a entrar. Convertirlas en preferencias por `uid` es un
 *   cambio del bloque de Ajustes (W4), no de W1.
 */
export const resetAllStoresForSessionBoundary = (): void => {
  // Datos remotos: lo primero, porque son los que exponen cifras ajenas.
  usePersonalDataStore.getState().reset();
  useHouseholdDataStore.getState().reset();

  // Superficies efímeras y contexto Personal/Hogar.
  useTransactionPanelStore.getState().close();
  useHouseholdUiStore.getState().reset();
  useAutoSettleDebtStore.getState().reset();
  useAppContextStore.getState().resetForSessionBoundary();

  // Preferencias de tablero: estado en memoria a valores por defecto.
  useUiPreferencesStore.getState().resetForSessionBoundary();
  useHouseholdUiPreferencesStore.getState().resetForSessionBoundary();
};
