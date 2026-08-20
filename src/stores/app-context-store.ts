import { create } from "zustand";

import type { SelectedPeriod } from "@/lib/format/date";
import {
  DEFAULT_APP_CONTEXT,
  resolveContextBoundaryCleanup,
  resolveContextSwitch,
  resolveInitialContextBootstrap,
  type AppContext,
  type ContextSwitchDecision,
  type HouseholdSessionSnapshot,
} from "@/lib/navigation/app-context";
import { useMplusComposerStore } from "@/stores/mplus-composer-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

type AppContextState = {
  selectedPeriod: SelectedPeriod;
  setSelectedPeriod: (period: SelectedPeriod) => void;

  /**
   * Paso 6 — fuente única y explícita del contexto activo. Ningún componente
   * visual deriva el contexto por su cuenta: la URL respeta este
   * estado y redirige si no coincide (@/lib/navigation/app-context).
   * La URL no cambia el contexto.
   */
  activeContext: AppContext;
  /** Selector de período: diálogo global Personal, cerrado al cruzar la frontera. */
  periodPickerOpen: boolean;
  /** Aviso de contexto (p. ej. pérdida de Hogar), mostrado con el banner ya existente. */
  contextNotice: string | null;
  /** Hogar para el que ya se avisó la pérdida — evita avisos repetidos y bucles. */
  householdLossNotifiedFor: string | null;

  openPeriodPicker: () => void;
  closePeriodPicker: () => void;
  setContextNotice: (notice: string | null) => void;
  markHouseholdLossNotified: (householdId: string | null) => void;

  /** Aplica un contexto ya decidido y ejecuta la limpieza de frontera. */
  setActiveContext: (next: AppContext) => boolean;
  /** Cambio explícito de contexto (switch de la sidebar). Devuelve a dónde navegar. */
  requestContextSwitch: (target: AppContext, pathname?: string | null) => ContextSwitchDecision;

  /**
   * Corrección P1 Paso 10 — se vuelve `true` la primera vez que se resuelve
   * la intención inicial de contexto de la sesión (URL + confirmación de
   * Hogar). Antes de resolverse, `DashboardShell` no debe aplicar la
   * redirección de ruta compartida.
   */
  initialContextBootstrapResolved: boolean;
  settleInitialContext: (pathname: string | null | undefined, household: HouseholdSessionSnapshot) => void;

  /**
   * Corrección P1.1 Paso 10 — frontera de sesión.
   */
  resetForSessionBoundary: () => void;
};

const getInitialPeriod = (): SelectedPeriod => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
  };
};

export const useAppContextStore = create<AppContextState>((set, get) => {
  /**
   * Limpieza al cruzar la frontera de contexto. Cierra el composer,
   * el selector de período y el modo "Editar tablero".
   */
  const applyBoundaryCleanup = (previous: AppContext, next: AppContext) => {
    const cleanup = resolveContextBoundaryCleanup({ previous, next });

    if (cleanup.closePersonalTransactionPanel) {
      useMplusComposerStore.getState().close();
    }
    if (cleanup.exitBoardEditing) {
      useUiPreferencesStore.getState().setEditingBoard(false);
    }
    if (cleanup.closePeriodPicker) {
      set({ periodPickerOpen: false });
    }
  };

  return {
    selectedPeriod: getInitialPeriod(),
    setSelectedPeriod: (period) => set({ selectedPeriod: period }),

    activeContext: DEFAULT_APP_CONTEXT,
    periodPickerOpen: false,
    contextNotice: null,
    householdLossNotifiedFor: null,
    initialContextBootstrapResolved: false,

    openPeriodPicker: () => set({ periodPickerOpen: true }),
    closePeriodPicker: () => set({ periodPickerOpen: false }),
    setContextNotice: (notice) => set({ contextNotice: notice }),
    markHouseholdLossNotified: (householdId) => set({ householdLossNotifiedFor: householdId }),

    setActiveContext: (next) => {
      const previous = get().activeContext;
      if (previous === next) {
        return false;
      }

      set({ activeContext: next });
      applyBoundaryCleanup(previous, next);
      return true;
    },

    requestContextSwitch: (target, pathname) => {
      const decision = resolveContextSwitch({
        current: get().activeContext,
        target,
        pathname: pathname ?? null,
      });

      get().setActiveContext(decision.context);
      return decision;
    },

    settleInitialContext: (pathname, household) => {
      if (get().initialContextBootstrapResolved) {
        return;
      }

      const decision = resolveInitialContextBootstrap({ pathname, household });
      if (decision.kind === "pending") {
        return;
      }

      if (decision.kind === "use-household") {
        get().setActiveContext("household");
      }

      set({ initialContextBootstrapResolved: true });
    },

    resetForSessionBoundary: () => {
      applyBoundaryCleanup("household", "personal");

      set({
        activeContext: DEFAULT_APP_CONTEXT,
        initialContextBootstrapResolved: false,
        contextNotice: null,
        householdLossNotifiedFor: null,
      });
    },
  };
});
