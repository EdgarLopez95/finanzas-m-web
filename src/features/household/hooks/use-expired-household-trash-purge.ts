"use client";

import { useEffect, useRef } from "react";

import { purgeHouseholdExpense } from "@/features/household/services/household-expense-mutations";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";

/**
 * Purga oportunista de la Papelera de Hogar (contrato §9.5, §19).
 *
 * Al abrir sesión conectada, purga físicamente los gastos de Hogar vencidos
 * (`now >= purgeAfterMillis`), eliminando atómicamente la fuente y sus derivadas.
 */
export const useExpiredHouseholdTrashPurge = (enabled: boolean) => {
  const trashedExpenses = useMplusHouseholdStore((state) => state.trashedExpenses);
  const household = useMplusHouseholdStore((state) => state.household);
  const removeHouseholdExpense = useMplusHouseholdStore((state) => state.removeHouseholdExpense);
  const attemptedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !household || trashedExpenses.length === 0) {
      return;
    }

    const now = Date.now();
    const expired = trashedExpenses.filter(
      (expense) => expense.purgeAfterMillis !== null && expense.purgeAfterMillis <= now,
    );
    const pending = expired.filter((expense) => !attemptedIdsRef.current.has(expense.id));
    if (pending.length === 0) {
      return;
    }

    let cancelled = false;

    const purgeAll = async () => {
      for (const expense of pending) {
        attemptedIdsRef.current.add(expense.id);
        try {
          const outcome = await purgeHouseholdExpense(expense, household);
          if (cancelled) return;
          if (outcome.kind === "success") {
            removeHouseholdExpense(expense.id);
          }
        } catch (error) {
          console.warn("No se pudo purgar un gasto de Hogar vencido.", error);
        }
      }
    };

    void purgeAll();

    return () => {
      cancelled = true;
    };
  }, [enabled, household, removeHouseholdExpense, trashedExpenses]);
};
