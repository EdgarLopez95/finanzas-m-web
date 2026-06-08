import { useEffect, useMemo, useState } from "react";

import { readHousehold } from "@/features/household/services/read-household";
import { readHouseholdCategories } from "@/features/household/services/read-household-categories";
import { readHouseholdDebts } from "@/features/household/services/read-household-debts";
import { readHouseholdEvents } from "@/features/household/services/read-household-events";
import { readHouseholdIncomeEntries } from "@/features/household/services/read-household-income-entries";
import { readActiveHouseholdId } from "@/features/household/services/read-household-user";
import type { Household, HouseholdCategory, HouseholdDebt, HouseholdEvent, HouseholdIncomeEntry } from "@/types/household";

type HouseholdData = {
  activeHouseholdId: string | null;
  household: Household | null;
  categories: HouseholdCategory[];
  debts: HouseholdDebt[];
  events: HouseholdEvent[];
  incomeEntries: HouseholdIncomeEntry[];
};

type HouseholdState = {
  status: "idle" | "loading" | "empty" | "success" | "error";
  data: HouseholdData;
  error: string | null;
};

const initialData: HouseholdData = {
  activeHouseholdId: null,
  household: null,
  categories: [],
  debts: [],
  events: [],
  incomeEntries: [],
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Tiempo de espera agotado cargando ${label}.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

const isSameMonth = (value: Date | null, now: Date): boolean => {
  if (!value) {
    return false;
  }

  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
};

export const useHouseholdData = (uid: string | null, enabled: boolean) => {
  const [state, setState] = useState<HouseholdState>({
    status: "idle",
    data: initialData,
    error: null,
  });

  useEffect(() => {
    if (!uid || !enabled) {
      setState({ status: "idle", data: initialData, error: null });
      return;
    }

    let cancelled = false;

    const load = async () => {
      setState((prev) => ({ ...prev, status: "loading", error: null }));

      try {
        const activeHouseholdId = await withTimeout(readActiveHouseholdId(uid), 12000, "users");

        if (!activeHouseholdId) {
          if (!cancelled) {
            setState({
              status: "empty",
              data: { ...initialData, activeHouseholdId: null },
              error: null,
            });
          }
          return;
        }

        const household = await withTimeout(readHousehold(activeHouseholdId, uid), 12000, "households");
        const [events, categories, debts, incomeEntries] = await Promise.all([
          withTimeout(readHouseholdEvents(activeHouseholdId), 12000, "household_events"),
          withTimeout(readHouseholdCategories(activeHouseholdId), 12000, "household_categories"),
          withTimeout(readHouseholdDebts(activeHouseholdId), 12000, "household_debts"),
          withTimeout(readHouseholdIncomeEntries(activeHouseholdId), 12000, "household_income_entries"),
        ]);

        if (cancelled) {
          return;
        }

        setState({
          status: "success",
          error: null,
          data: {
            activeHouseholdId,
            household,
            events,
            categories,
            debts,
            incomeEntries,
          },
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          status: "error",
          data: initialData,
          error: error instanceof Error ? error.message : "No se pudo cargar la vista de Hogar.",
        });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, uid]);

  const summary = useMemo(() => {
    const now = new Date();
    const monthlyEvents = state.data.events.filter((event) => event.isActive && isSameMonth(event.createdAt, now));
    const monthlyIncomeEntries = state.data.incomeEntries.filter((entry) => isSameMonth(entry.createdAt, now));

    const monthlyExpenseTotal = monthlyEvents.reduce((sum, event) => sum + Math.max(event.amount, 0), 0);
    const monthlyIncomeTotal = monthlyIncomeEntries.reduce((sum, entry) => sum + Math.max(entry.amount, 0), 0);
    const monthlyBalance = monthlyIncomeTotal - monthlyExpenseTotal;

    const recentEvents = [...state.data.events]
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, 8);

    return {
      monthlyExpenseTotal,
      monthlyIncomeTotal,
      monthlyBalance,
      recentEvents,
      memberCount: state.data.household?.memberCount ?? 0,
    };
  }, [state.data.events, state.data.household?.memberCount, state.data.incomeEntries]);

  return {
    ...state,
    summary,
  };
};
