import { create } from "zustand";

import { readMplusHouseholdExpenseCategories } from "@/features/household/services/mplus-household-categories-service";
import {
  readMplusCategoryMappings,
  readMplusHousehold,
  readMplusHouseholdActiveInvite,
  readMplusHouseholdMembers,
  readMplusMemberAccountLabels,
  readMplusMemberCategoryLabels,
} from "@/features/household/services/mplus-household-service";
import { readHouseholdMonthMovements } from "@/features/household/services/read-household-movements";
import type {
  MplusCategoryMapping,
  MplusHousehold,
  MplusHouseholdExpenseCategory,
  MplusHouseholdInvite,
  MplusHouseholdMember,
  MplusMemberAccountLabel,
  MplusMemberCategoryLabel,
  MplusMovement,
} from "@/lib/mplus/models";

export type MplusHouseholdStatus = "idle" | "loading" | "success" | "error";

export type MplusHouseholdPeriod = Readonly<{ year: number; month: number }>;

export type MplusHouseholdState = {
  status: MplusHouseholdStatus;
  error: string | null;
  householdId: string | null;
  period: MplusHouseholdPeriod | null;
  household: MplusHousehold | null;
  members: MplusHouseholdMember[];
  activeInvite: MplusHouseholdInvite | null;
  categories: MplusHouseholdExpenseCategory[];
  mappings: MplusCategoryMapping[];
  categoryLabels: MplusMemberCategoryLabel[];
  accountLabels: MplusMemberAccountLabel[];
  movements: MplusMovement[];
  generation: number;

  load: (
    householdId: string | null,
    period: MplusHouseholdPeriod,
    options?: { force?: boolean },
  ) => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;

  applyCommittedHousehold: (household: MplusHousehold | null) => void;
  applyCommittedMember: (member: MplusHouseholdMember) => void;
  applyCommittedCategory: (category: MplusHouseholdExpenseCategory) => void;
  applyCommittedMovement: (movement: MplusMovement) => void;
  applyCommittedMapping: (mapping: MplusCategoryMapping) => void;
};

const initialState = {
  status: "idle" as MplusHouseholdStatus,
  error: null as string | null,
  householdId: null as string | null,
  period: null as MplusHouseholdPeriod | null,
  household: null as MplusHousehold | null,
  members: [] as MplusHouseholdMember[],
  activeInvite: null as MplusHouseholdInvite | null,
  categories: [] as MplusHouseholdExpenseCategory[],
  mappings: [] as MplusCategoryMapping[],
  categoryLabels: [] as MplusMemberCategoryLabel[],
  accountLabels: [] as MplusMemberAccountLabel[],
  movements: [] as MplusMovement[],
  generation: 0,
};

const samePeriod = (
  left: MplusHouseholdPeriod | null,
  right: MplusHouseholdPeriod,
): boolean => left !== null && left.year === right.year && left.month === right.month;

const sortByOccurredAtDesc = (movements: MplusMovement[]): MplusMovement[] =>
  [...movements].sort((a, b) => b.occurredAtMillis - a.occurredAtMillis);

export type MplusHouseholdServices = {
  readHousehold: typeof readMplusHousehold;
  readMembers: typeof readMplusHouseholdMembers;
  readActiveInvite: typeof readMplusHouseholdActiveInvite;
  readCategories: typeof readMplusHouseholdExpenseCategories;
  readMappings: typeof readMplusCategoryMappings;
  readCategoryLabels: typeof readMplusMemberCategoryLabels;
  readAccountLabels: typeof readMplusMemberAccountLabels;
  readMovements: typeof readHouseholdMonthMovements;
};

const defaultServices: MplusHouseholdServices = {
  readHousehold: readMplusHousehold,
  readMembers: readMplusHouseholdMembers,
  readActiveInvite: readMplusHouseholdActiveInvite,
  readCategories: readMplusHouseholdExpenseCategories,
  readMappings: readMplusCategoryMappings,
  readCategoryLabels: readMplusMemberCategoryLabels,
  readAccountLabels: readMplusMemberAccountLabels,
  readMovements: readHouseholdMonthMovements,
};

let activeServices: MplusHouseholdServices = defaultServices;

export const setMplusHouseholdServicesForTesting = (
  overrides?: Partial<MplusHouseholdServices> | null,
): void => {
  activeServices = overrides ? { ...defaultServices, ...overrides } : defaultServices;
};

export const useMplusHouseholdStore = create<MplusHouseholdState>((set, get) => ({
  ...initialState,

  load: async (householdId, period, options) => {
    if (!householdId) {
      set({
        ...initialState,
        status: "success",
        householdId: null,
        period,
      });
      return;
    }

    const state = get();
    if (
      !options?.force &&
      state.status === "success" &&
      state.householdId === householdId &&
      samePeriod(state.period, period)
    ) {
      return;
    }

    const currentGeneration = state.generation + 1;
    set({
      status: "loading",
      error: null,
      householdId,
      period,
      generation: currentGeneration,
    });

    try {
      const household = await activeServices.readHousehold(householdId);
      if (!household) {
        if (get().generation !== currentGeneration) return;
        set({
          status: "success",
          household: null,
          members: [],
          activeInvite: null,
          categories: [],
          mappings: [],
          categoryLabels: [],
          accountLabels: [],
          movements: [],
        });
        return;
      }

      const [members, activeInvite, categories, mappings, categoryLabels, accountLabels, movements] =
        await Promise.all([
          activeServices.readMembers(householdId),
          activeServices.readActiveInvite(household.activeInviteId),
          activeServices.readCategories(householdId),
          activeServices.readMappings(householdId),
          activeServices.readCategoryLabels(householdId),
          activeServices.readAccountLabels(householdId),
          activeServices.readMovements(householdId, period),
        ]);

      if (get().generation !== currentGeneration) return;

      set({
        status: "success",
        error: null,
        household,
        members,
        activeInvite,
        categories,
        mappings,
        categoryLabels,
        accountLabels,
        movements: sortByOccurredAtDesc(movements),
      });
    } catch (err) {
      if (get().generation !== currentGeneration) return;
      const message = err instanceof Error ? err.message : "Error al cargar datos del hogar.";
      set({ status: "error", error: message });
    }
  },

  refresh: async () => {
    const { householdId, period, load } = get();
    if (householdId && period) {
      await load(householdId, period, { force: true });
    }
  },

  reset: () => {
    set({
      ...initialState,
      generation: get().generation + 1,
    });
  },

  applyCommittedHousehold: (household) => {
    set({
      household,
      householdId: household ? household.id : null,
    });
  },

  applyCommittedMember: (member) => {
    set((state) => {
      const index = state.members.findIndex((m) => m.userId === member.userId);
      const next = index >= 0
        ? state.members.map((m, i) => (i === index ? member : m))
        : [...state.members, member];
      return { members: next };
    });
  },

  applyCommittedCategory: (category) => {
    set((state) => {
      const index = state.categories.findIndex((c) => c.id === category.id);
      const next = index >= 0
        ? state.categories.map((c, i) => (i === index ? category : c))
        : [...state.categories, category];
      return { categories: next.sort((a, b) => a.sortOrder - b.sortOrder) };
    });
  },

  applyCommittedMovement: (movement) => {
    set((state) => {
      if (!movement.householdId || movement.householdId !== state.householdId) {
        return {
          movements: state.movements.filter((m) => m.id !== movement.id),
        };
      }
      const index = state.movements.findIndex((m) => m.id === movement.id);
      const next = index >= 0
        ? state.movements.map((m, i) => (i === index ? movement : m))
        : [movement, ...state.movements];
      return { movements: sortByOccurredAtDesc(next) };
    });
  },

  applyCommittedMapping: (mapping) => {
    set((state) => {
      const index = state.mappings.findIndex((m) => m.id === mapping.id);
      const next = index >= 0
        ? state.mappings.map((m, i) => (i === index ? mapping : m))
        : [...state.mappings, mapping];
      return { mappings: next };
    });
  },
}));
