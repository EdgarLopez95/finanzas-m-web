import { subscriptionRegistry } from "@/lib/firestore/subscription-registry";
import { useAppContextStore } from "@/stores/app-context-store";
import { useMplusComposerStore } from "@/stores/mplus-composer-store";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

/**
 * W1/W3/W4 — Limpieza TOTAL de stores al cambiar de usuario o cerrar sesión.
 *
 * Esta función es el único punto que ordena la limpieza. Cada store expone su
 * propio `reset`; aquí no se manipula estado ajeno a mano.
 */
export const resetAllStoresForSessionBoundary = (): void => {
  // Desuscripción total de listeners en tiempo real
  subscriptionRegistry.unregisterAll();

  // Datos remotos M+
  useMplusPersonalStore.getState().reset();
  useMplusHouseholdStore.getState().reset();

  // Superficies efímeras y contexto Personal/Hogar
  useMplusComposerStore.getState().close();
  useAppContextStore.getState().resetForSessionBoundary();
};
