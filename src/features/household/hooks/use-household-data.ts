import { useEffect, useMemo } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";

const isSameMonth = (value: Date | null, now: Date): boolean => {
  if (!value) {
    return false;
  }

  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
};

/**
 * Driver único de la carga de Hogar. Debe montarse en UN solo lugar (el shell).
 * Las páginas solo LEEN con `useHouseholdData()`.
 */
export const useHouseholdLoader = (uid: string | null, enabled: boolean) => {
  const load = useHouseholdDataStore((state) => state.load);
  const reset = useHouseholdDataStore((state) => state.reset);

  useEffect(() => {
    if (!uid || !enabled) {
      reset();
      return;
    }

    void load(uid);
  }, [enabled, load, reset, uid]);
};

/**
 * Lectura pura de la vista de Hogar desde el store global, persistente entre
 * navegaciones, con el resumen mensual memoizado.
 */
export const useHouseholdData = () => {
  const status = useHouseholdDataStore((state) => state.status);
  const data = useHouseholdDataStore((state) => state.data);
  const error = useHouseholdDataStore((state) => state.error);

  const summary = useMemo(() => {
    const now = new Date();
    const monthlyEvents = data.events.filter((event) => event.isActive && isSameMonth(event.createdAt, now));
    const monthlyIncomeEntries = data.incomeEntries.filter((entry) => isSameMonth(entry.createdAt, now));

    const monthlyExpenseTotal = monthlyEvents.reduce((sum, event) => sum + Math.max(event.amount, 0), 0);
    const monthlyIncomeTotal = monthlyIncomeEntries.reduce((sum, entry) => sum + Math.max(entry.amount, 0), 0);
    const monthlyBalance = monthlyIncomeTotal - monthlyExpenseTotal;

    const recentEvents = [...data.events]
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, 8);

    return {
      monthlyExpenseTotal,
      monthlyIncomeTotal,
      monthlyBalance,
      recentEvents,
      memberCount: data.household?.memberCount ?? 0,
    };
  }, [data.events, data.household?.memberCount, data.incomeEntries]);

  return {
    status,
    data,
    error,
    summary,
  };
};
