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
import { useTransactionPanelStore } from "@/stores/transaction-panel-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";
import { useHouseholdUiStore } from "@/stores/household-ui-store";

type AppContextState = {
  selectedPeriod: SelectedPeriod;
  setSelectedPeriod: (period: SelectedPeriod) => void;

  /**
   * Paso 6 — fuente única y explícita del contexto activo. Ningún componente
   * visual deriva el contexto por su cuenta: la URL respeta este
   * estado y redirige si no coincide (@/lib/navigation/app-context).
   * La URL no cambia el contexto.
   *
   * No se persiste: un contexto Hogar inválido nunca debe sobrevivir a una
   * recarga, a la pérdida de membresía ni al cambio de sesión.
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
   * redirección de ruta compartida (evita expulsar a `/dashboard` mientras
   * la suscripción de Hogar aún está cargando). No se persiste: cada carga
   * de página vuelve a evaluarlo una vez.
   */
  initialContextBootstrapResolved: boolean;
  /**
   * Evalúa la intención inicial de la URL una sola vez por sesión. No-op si
   * ya se resolvió. Mientras la suscripción de Hogar esté `idle`/`loading`,
   * no decide nada (queda pendiente para la siguiente llamada). Cuando
   * decide, aplica `setActiveContext("household")` solo si corresponde y
   * marca el bootstrap como resuelto — de ahí en adelante el store vuelve a
   * ser la única autoridad, sin sincronización continua.
   */
  settleInitialContext: (pathname: string | null | undefined, household: HouseholdSessionSnapshot) => void;

  /**
   * Corrección P1.1 Paso 10 — frontera de sesión. Ningún contexto Personal/
   * Hogar ni el bootstrap ya resuelto pueden sobrevivir a un logout o a un
   * cambio real de usuario autenticado sin recargar la pestaña. Vuelve
   * `activeContext` a `DEFAULT_APP_CONTEXT`, `initialContextBootstrapResolved`
   * a `false`, limpia el aviso de contexto y `householdLossNotifiedFor`, y
   * reutiliza la limpieza de frontera existente (`applyBoundaryCleanup`) para
   * las superficies efímeras (panel de movimiento Personal, selector de
   * período, edición de tablero, UI efímera de Hogar). No persiste en ningún
   * lado: cada carga de página empieza sin sesión previa que limpiar.
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
   * Limpieza al cruzar la frontera de contexto. Cierra el panel de
   * crear/editar/eliminar movimiento Personal, el selector de período y el modo
   * "Editar tablero". Las superficies Hogar (nuevo gasto, categorías, ajustes,
   * detalle de evento, historial) son estado local de `/household` y de
   * `household-overview`, por lo que se desmontan al cambiar de ruta.
   *
   * No borra datos cargados: los listeners y los puentes ya aprobados
   * (auto-settle, fallback manual, "Por anotar", deudas) siguen intactos.
   */
  const applyBoundaryCleanup = (previous: AppContext, next: AppContext) => {
    const cleanup = resolveContextBoundaryCleanup({ previous, next });

    if (cleanup.closePersonalTransactionPanel) {
      useTransactionPanelStore.getState().close();
    }
    if (cleanup.exitBoardEditing) {
      useUiPreferencesStore.getState().setEditingBoard(false);
    }
    if (cleanup.closePeriodPicker) {
      set({ periodPickerOpen: false });
    }
    // Reset household ephemeral UI state when exiting Household or losing membership
    useHouseholdUiStore.getState().reset();
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
      // Fuerza la limpieza completa de superficies efímeras (panel Personal,
      // selector de período, edición de tablero, UI efímera de Hogar) sin
      // importar cuál era el contexto real previo: se simula la transición
      // "peor caso" (household -> personal) para que `applyBoundaryCleanup`
      // dispare todas sus banderas (`crossed` y `closeHouseholdSurfaces`).
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
