import { create } from "zustand";

import type { AutoSettleDebtUiEntry } from "@/features/household/lib/auto-settle-debt";

export type { AutoSettleDebtUiEntry };

type AutoSettleDebtState = {
  entries: Record<string, AutoSettleDebtUiEntry>;
  /** debtId -> el usuario cerró el sheet manual con "Ahora no" para el estado actual. */
  dismissed: Record<string, true>;
  setProcessing: (debtId: string) => void;
  setNeedsManualAccount: (debtId: string, reason: string) => void;
  dismiss: (debtId: string) => void;
  /** Deshace el descarte manual (acción explícita del usuario, ej. botón inline "Acreditar reembolso"). */
  undismiss: (debtId: string) => void;
  /** Limpia la entry Y el descarte: solo debe llamarse en un cambio real (settled/skipped). */
  clear: (debtId: string) => void;
  reset: () => void;
};

/**
 * Estado mínimo expuesto a la UI del observador de auto-settle (household-debt-auto-settle).
 * El observador (montado una sola vez en el shell autenticado) escribe aquí;
 * la UI de Hogar solo lee para decidir cuándo abrir automáticamente el sheet
 * de acreditación manual y cuándo mantenerlo descartado. No contiene lógica
 * financiera: solo refleja el resultado del servicio.
 *
 * `dismissed` solo se limpia en `clear()` (deuda liquidada/saltada) o `reset()`
 * (cambio de sesión) — nunca automáticamente por reevaluar el mismo snapshot,
 * para no reabrir el sheet en bucle tras "Ahora no".
 */
export const useAutoSettleDebtStore = create<AutoSettleDebtState>((set) => ({
  entries: {},
  dismissed: {},
  setProcessing: (debtId) =>
    set((state) => ({ entries: { ...state.entries, [debtId]: { status: "processing" } } })),
  setNeedsManualAccount: (debtId, reason) =>
    set((state) => ({
      entries: { ...state.entries, [debtId]: { status: "needs_manual_account", reason } },
    })),
  dismiss: (debtId) =>
    set((state) => ({ dismissed: { ...state.dismissed, [debtId]: true } })),
  undismiss: (debtId) =>
    set((state) => {
      if (!(debtId in state.dismissed)) return state;
      const nextDismissed = { ...state.dismissed };
      delete nextDismissed[debtId];
      return { dismissed: nextDismissed };
    }),
  clear: (debtId) =>
    set((state) => {
      const hadEntry = debtId in state.entries;
      const hadDismissed = debtId in state.dismissed;
      if (!hadEntry && !hadDismissed) return state;
      const nextEntries = { ...state.entries };
      delete nextEntries[debtId];
      const nextDismissed = { ...state.dismissed };
      delete nextDismissed[debtId];
      return { entries: nextEntries, dismissed: nextDismissed };
    }),
  reset: () => set({ entries: {}, dismissed: {} }),
}));
