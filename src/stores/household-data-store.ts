import { create } from "zustand";

import { readHousehold } from "@/features/household/services/read-household";
import { readHouseholdCategories } from "@/features/household/services/read-household-categories";
import { readHouseholdDebts } from "@/features/household/services/read-household-debts";
import { readHouseholdEvents } from "@/features/household/services/read-household-events";
import { readHouseholdIncomeEntries } from "@/features/household/services/read-household-income-entries";
import { readActiveHouseholdId } from "@/features/household/services/read-household-user";
import type {
  Household,
  HouseholdCategory,
  HouseholdDebt,
  HouseholdEvent,
  HouseholdIncomeEntry,
} from "@/types/household";

export type HouseholdData = {
  activeHouseholdId: string | null;
  household: Household | null;
  categories: HouseholdCategory[];
  debts: HouseholdDebt[];
  events: HouseholdEvent[];
  incomeEntries: HouseholdIncomeEntry[];
};

export type HouseholdStatus = "idle" | "loading" | "empty" | "success" | "error";

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

type HouseholdDataState = {
  status: HouseholdStatus;
  data: HouseholdData;
  error: string | null;
  uid: string | null;
  inFlight: Promise<void> | null;
  load: (uid: string, options?: { force?: boolean }) => Promise<void>;
  reset: () => void;
};

export const useHouseholdDataStore = create<HouseholdDataState>((set, get) => ({
  status: "idle",
  data: initialData,
  error: null,
  uid: null,
  inFlight: null,

  reset: () => {
    set({ status: "idle", data: initialData, error: null, uid: null, inFlight: null });
  },

  load: async (uid, options) => {
    const force = options?.force ?? false;
    const state = get();

    // Cache hit: ya cargado con éxito (o vacío) para este uid -> no re-consultar.
    if (!force && state.uid === uid && (state.status === "success" || state.status === "empty")) {
      return;
    }

    if (!force && state.inFlight && state.uid === uid) {
      return state.inFlight;
    }

    const run = async () => {
      set({ status: "loading", error: null, uid });

      try {
        const activeHouseholdId = await withTimeout(readActiveHouseholdId(uid), 12000, "users");

        if (!activeHouseholdId) {
          if (get().uid === uid) {
            set({
              status: "empty",
              data: { ...initialData, activeHouseholdId: null },
              error: null,
              uid,
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

        if (get().uid !== uid) {
          return;
        }

        set({
          status: "success",
          error: null,
          uid,
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
        if (get().uid !== uid) {
          return;
        }

        set({
          status: "error",
          data: initialData,
          uid,
          error: error instanceof Error ? error.message : "No se pudo cargar la vista de Hogar.",
        });
      }
    };

    const promise = run().finally(() => {
      if (get().inFlight === promise) {
        set({ inFlight: null });
      }
    });

    set({ inFlight: promise });
    return promise;
  },
}));
