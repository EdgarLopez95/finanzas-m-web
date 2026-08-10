import { useEffect, useRef } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";
import { useAutoSettleDebtStore } from "@/stores/auto-settle-debt-store";
import {
  autoSettleDebtReception,
} from "@/features/household/services/auto-settle-debt-reception";
import {
  isAutoSettleResultStillApplicable,
  selectDebtIdsToReconcileAway,
  selectDebtsEligibleForAutoSettle,
} from "@/features/household/lib/auto-settle-debt";

/**
 * Observador de ciclo de vida Web del auto-settle de deudas (household-debt-auto-settle).
 * Paridad Android: HouseholdDebtAutoSettleObserver.kt — se monta una sola vez en
 * el shell autenticado (presente en rutas Personal y Hogar, igual que Android
 * observa desde Home sin importar el contexto activo) y reacciona al estado de
 * deudas ya cargado por los listeners de Hogar, sin polling ni temporizadores.
 *
 * Reintenta de forma natural: cada cambio de snapshot en `household-data-store`
 * dispara una nueva evaluación; el propio servicio (`autoSettleDebtReception`)
 * revalida dentro de la transacción, así que un reintento sobre una deuda ya
 * liquidada por otra pestaña/callback siempre resuelve `skipped`, nunca duplica.
 *
 * Cada evaluación también reconcilia el store de UI (`auto-settle-debt-store`)
 * contra el snapshot vigente: si una deuda que el store rastrea deja de ser
 * elegible (pasó a `paid`, recibió `incomingTransactionId` — p. ej. por la
 * acreditación manual del sheet — o dejó de ser del acreedor), su entry y su
 * descarte se limpian, evitando que el sheet manual se reabra con un estado
 * ya superado.
 */
export const useAutoSettleDebts = (uid: string | null, enabled: boolean): void => {
  const inFlightRef = useRef<Set<string>>(new Set());
  const setProcessing = useAutoSettleDebtStore((state) => state.setProcessing);
  const setNeedsManualAccount = useAutoSettleDebtStore((state) => state.setNeedsManualAccount);
  const clearEntry = useAutoSettleDebtStore((state) => state.clear);
  const resetEntries = useAutoSettleDebtStore((state) => state.reset);

  useEffect(() => {
    if (!uid || !enabled) {
      inFlightRef.current.clear();
      resetEntries();
      return;
    }

    let disposed = false;

    const attempt = async (debtId: string, attemptGeneration: number, attemptHouseholdId: string | null) => {
      if (inFlightRef.current.has(debtId)) return;
      inFlightRef.current.add(debtId);
      setProcessing(debtId);

      try {
        const result = await autoSettleDebtReception({ debtId, creditorUserId: uid });
        if (disposed) return;

        const store = useHouseholdDataStore.getState();
        const stillApplicable = isAutoSettleResultStillApplicable({
          attemptUid: uid,
          attemptGeneration,
          attemptHouseholdId,
          currentUid: store.uid,
          currentGeneration: store.generation,
          currentHouseholdId: store.data.activeHouseholdId,
        });
        if (!stillApplicable) return;

        if (result.kind === "needs_manual_account") {
          setNeedsManualAccount(debtId, result.reason);
        } else if (result.kind === "settled" || result.kind === "skipped") {
          clearEntry(debtId);
        } else {
          console.warn("autoSettleDebtReception fallo para debtId=" + debtId, result.reason);
        }
      } finally {
        inFlightRef.current.delete(debtId);
      }
    };

    const evaluate = () => {
      const store = useHouseholdDataStore.getState();
      if (store.uid !== uid) return;

      const attemptGeneration = store.generation;
      const attemptHouseholdId = store.data.activeHouseholdId;
      const eligible = selectDebtsEligibleForAutoSettle(store.data.debts, uid);
      const eligibleIds = new Set(eligible.map((debt) => debt.id));

      // Reconciliación: cualquier debtId que el store de UI sigue rastreando
      // pero que ya no es elegible en este snapshot (pasó a paid, recibió
      // incomingTransactionId por otra vía, o dejó de ser del acreedor) se
      // limpia — entry y descarte — sin tocar las deudas que siguen elegibles
      // (incluida una que sigue en needs_manual_account: su descarte se conserva).
      const autoSettleState = useAutoSettleDebtStore.getState();
      const trackedDebtIds = Array.from(
        new Set([...Object.keys(autoSettleState.entries), ...Object.keys(autoSettleState.dismissed)])
      );
      selectDebtIdsToReconcileAway(trackedDebtIds, eligibleIds).forEach((debtId) => {
        clearEntry(debtId);
      });

      eligible.forEach((debt) => {
        void attempt(debt.id, attemptGeneration, attemptHouseholdId);
      });
    };

    evaluate();
    const unsubscribeHousehold = useHouseholdDataStore.subscribe(evaluate);

    return () => {
      disposed = true;
      unsubscribeHousehold();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, enabled]);
};
