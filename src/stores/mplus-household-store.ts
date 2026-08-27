import { create } from "zustand";

import {
  readMplusHouseholdExpenseCategories,
  subscribeMplusHouseholdExpenseCategories,
} from "@/features/household/services/mplus-household-categories-service";
import {
  readMplusCategoryMappings,
  readMplusHousehold,
  readMplusHouseholdActiveInvite,
  readMplusHouseholdMembers,
  readMplusMemberAccountLabels,
  readMplusMemberCategoryLabels,
  subscribeMplusCategoryMappings,
  subscribeMplusHousehold,
  subscribeMplusHouseholdActiveInvite,
  subscribeMplusHouseholdMembers,
  subscribeMplusMemberAccountLabels,
  subscribeMplusMemberCategoryLabels,
} from "@/features/household/services/mplus-household-service";
import {
  readHouseholdMonthMovements,
  subscribeHouseholdMonthMovements,
} from "@/features/household/services/read-household-movements";
import {
  resolveMonthRangeFor,
  type PersonalMonthRange,
} from "@/features/movements/services/read-personal-movements";
import { getFirebaseDb } from "@/lib/firebase/client";
import { subscriptionRegistry } from "@/lib/firestore/subscription-registry";
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
  /** Rango bogotano del mes cargado; decide si un movimiento confirmado entra. */
  range: PersonalMonthRange | null;
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
  /** Retira un movimiento eliminado fisicamente (purga). */
  removeMovement: (movementId: string) => void;
  applyCommittedMapping: (mapping: MplusCategoryMapping) => void;
};

const initialState = {
  status: "idle" as MplusHouseholdStatus,
  error: null as string | null,
  householdId: null as string | null,
  period: null as MplusHouseholdPeriod | null,
  range: null as PersonalMonthRange | null,
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
  subscribeHousehold?: (
    householdId: string,
    onUpdate: (household: MplusHousehold | null) => void,
    onError?: (error: Error) => void,
  ) => () => void;
  subscribeMembers?: (
    householdId: string,
    onUpdate: (members: MplusHouseholdMember[]) => void,
    onError?: (error: Error) => void,
  ) => () => void;
  subscribeActiveInvite?: (
    inviteId: string,
    onUpdate: (invite: MplusHouseholdInvite | null) => void,
    onError?: (error: Error) => void,
  ) => () => void;
  subscribeCategories?: (
    householdId: string,
    onUpdate: (categories: MplusHouseholdExpenseCategory[]) => void,
    onError?: (error: Error) => void,
  ) => () => void;
  subscribeMappings?: (
    householdId: string,
    onUpdate: (mappings: MplusCategoryMapping[]) => void,
    onError?: (error: Error) => void,
  ) => () => void;
  subscribeCategoryLabels?: (
    householdId: string,
    onUpdate: (labels: MplusMemberCategoryLabel[]) => void,
    onError?: (error: Error) => void,
  ) => () => void;
  subscribeAccountLabels?: (
    householdId: string,
    onUpdate: (labels: MplusMemberAccountLabel[]) => void,
    onError?: (error: Error) => void,
  ) => () => void;
  subscribeMovements?: (
    householdId: string,
    period: { year: number; month: number },
    onUpdate: (movements: MplusMovement[]) => void,
    onError?: (error: Error) => void,
  ) => () => void;
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
  subscribeHousehold: (householdId, onUpdate, onError) =>
    subscribeMplusHousehold(householdId, onUpdate, onError, getFirebaseDb()),
  subscribeMembers: (householdId, onUpdate, onError) =>
    subscribeMplusHouseholdMembers(householdId, onUpdate, onError, getFirebaseDb()),
  subscribeActiveInvite: (inviteId, onUpdate, onError) =>
    subscribeMplusHouseholdActiveInvite(inviteId, onUpdate, onError, getFirebaseDb()),
  subscribeCategories: (householdId, onUpdate, onError) =>
    subscribeMplusHouseholdExpenseCategories(householdId, onUpdate, onError, getFirebaseDb()),
  subscribeMappings: (householdId, onUpdate, onError) =>
    subscribeMplusCategoryMappings(householdId, onUpdate, onError, getFirebaseDb()),
  subscribeCategoryLabels: (householdId, onUpdate, onError) =>
    subscribeMplusMemberCategoryLabels(householdId, onUpdate, onError, getFirebaseDb()),
  subscribeAccountLabels: (householdId, onUpdate, onError) =>
    subscribeMplusMemberAccountLabels(householdId, onUpdate, onError, getFirebaseDb()),
  subscribeMovements: (householdId, period, onUpdate, onError) =>
    subscribeHouseholdMonthMovements(householdId, period, onUpdate, onError, getFirebaseDb()),
};

let activeServices: MplusHouseholdServices = defaultServices;

export const setMplusHouseholdServicesForTesting = (
  overrides?: Partial<MplusHouseholdServices> | null,
): void => {
  if (!overrides) {
    activeServices = defaultServices;
    return;
  }

  const fallbackSubscriptions: Partial<MplusHouseholdServices> = {};
  if (overrides.readHousehold && !overrides.subscribeHousehold) {
    fallbackSubscriptions.subscribeHousehold = (householdId, onUpdate, onError) => {
      overrides.readHousehold!(householdId).then(onUpdate).catch(onError);
      return () => {};
    };
  }
  if (overrides.readMembers && !overrides.subscribeMembers) {
    fallbackSubscriptions.subscribeMembers = (householdId, onUpdate, onError) => {
      overrides.readMembers!(householdId).then(onUpdate).catch(onError);
      return () => {};
    };
  }
  if (overrides.readActiveInvite && !overrides.subscribeActiveInvite) {
    fallbackSubscriptions.subscribeActiveInvite = (inviteId, onUpdate, onError) => {
      overrides.readActiveInvite!(inviteId).then(onUpdate).catch(onError);
      return () => {};
    };
  }
  if (overrides.readCategories && !overrides.subscribeCategories) {
    fallbackSubscriptions.subscribeCategories = (householdId, onUpdate, onError) => {
      overrides.readCategories!(householdId).then(onUpdate).catch(onError);
      return () => {};
    };
  }
  if (overrides.readMappings && !overrides.subscribeMappings) {
    fallbackSubscriptions.subscribeMappings = (householdId, onUpdate, onError) => {
      overrides.readMappings!(householdId).then(onUpdate).catch(onError);
      return () => {};
    };
  }
  if (overrides.readCategoryLabels && !overrides.subscribeCategoryLabels) {
    fallbackSubscriptions.subscribeCategoryLabels = (householdId, onUpdate, onError) => {
      overrides.readCategoryLabels!(householdId).then(onUpdate).catch(onError);
      return () => {};
    };
  }
  if (overrides.readAccountLabels && !overrides.subscribeAccountLabels) {
    fallbackSubscriptions.subscribeAccountLabels = (householdId, onUpdate, onError) => {
      overrides.readAccountLabels!(householdId).then(onUpdate).catch(onError);
      return () => {};
    };
  }
  if (overrides.readMovements && !overrides.subscribeMovements) {
    fallbackSubscriptions.subscribeMovements = (householdId, period, onUpdate, onError) => {
      overrides.readMovements!(householdId, period).then(onUpdate).catch(onError);
      return () => {};
    };
  }

  activeServices = { ...defaultServices, ...fallbackSubscriptions, ...overrides };
};

export const useMplusHouseholdStore = create<MplusHouseholdState>((set, get) => ({
  ...initialState,

  load: async (householdId, period, options) => {
    if (!householdId) {
      subscriptionRegistry.unregister("household");
      set({
        ...initialState,
        status: "success",
        householdId: null,
        period,
        range: resolveMonthRangeFor(period.year, period.month),
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

    if (state.householdId !== null && state.householdId !== householdId) {
      subscriptionRegistry.unregister("household");
      set({ ...initialState });
    }

    const currentGeneration = state.generation + 1;
    const currentHouseholdId = householdId;
    const currentPeriod = period;
    const range = resolveMonthRangeFor(period.year, period.month);
    set({
      status: "loading",
      error: null,
      householdId,
      period,
      range,
      generation: currentGeneration,
    });

    const handleError = (err: Error) => {
      if (get().generation !== currentGeneration) return;
      const message = err instanceof Error ? err.message : "Error al cargar datos del hogar.";
      set({ status: "error", error: message });
    };

    // 1. Documento del Hogar en tiempo real
    const unsubHousehold = (activeServices.subscribeHousehold ?? defaultServices.subscribeHousehold!)(
      householdId,
      (household) => {
        const s = get();
        if (s.generation !== currentGeneration || s.householdId !== currentHouseholdId) return;
        if (!household) {
          subscriptionRegistry.unregister("household");
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

        set({ household, status: "success", error: null });

        // Gestión reactiva del listener de invitación activa
        if (household.activeInviteId) {
          const unsubInvite = (activeServices.subscribeActiveInvite ?? defaultServices.subscribeActiveInvite!)(
            household.activeInviteId,
            (invite) => {
              const current = get();
              if (current.generation !== currentGeneration || current.householdId !== currentHouseholdId) return;
              set({ activeInvite: invite });
            },
            handleError,
          );
          subscriptionRegistry.register("household", "active-invite", unsubInvite);
        } else {
          subscriptionRegistry.unregister("household", "active-invite");
          set({ activeInvite: null });
        }
      },
      handleError,
    );
    subscriptionRegistry.register("household", "household-doc", unsubHousehold);

    // 2. Integrantes en tiempo real
    const unsubMembers = (activeServices.subscribeMembers ?? defaultServices.subscribeMembers!)(
      householdId,
      (members) => {
        const s = get();
        if (s.generation !== currentGeneration || s.householdId !== currentHouseholdId) return;
        set({ members, status: "success", error: null });
      },
      handleError,
    );
    subscriptionRegistry.register("household", "members", unsubMembers);

    // 3. Categorías de gasto en tiempo real
    const unsubCats = (activeServices.subscribeCategories ?? defaultServices.subscribeCategories!)(
      householdId,
      (categories) => {
        const s = get();
        if (s.generation !== currentGeneration || s.householdId !== currentHouseholdId) return;
        set({ categories, status: "success", error: null });
      },
      handleError,
    );
    subscriptionRegistry.register("household", "expense-categories", unsubCats);

    // 4. Mapeos de categorías en tiempo real
    const unsubMappings = (activeServices.subscribeMappings ?? defaultServices.subscribeMappings!)(
      householdId,
      (mappings) => {
        const s = get();
        if (s.generation !== currentGeneration || s.householdId !== currentHouseholdId) return;
        set({ mappings, status: "success", error: null });
      },
      handleError,
    );
    subscriptionRegistry.register("household", "category-mappings", unsubMappings);

    // 5. Etiquetas de categoría de miembros en tiempo real
    const unsubCatLabels = (activeServices.subscribeCategoryLabels ?? defaultServices.subscribeCategoryLabels!)(
      householdId,
      (categoryLabels) => {
        const s = get();
        if (s.generation !== currentGeneration || s.householdId !== currentHouseholdId) return;
        set({ categoryLabels, status: "success", error: null });
      },
      handleError,
    );
    subscriptionRegistry.register("household", "member-category-labels", unsubCatLabels);

    // 6. Etiquetas de cuenta de miembros en tiempo real
    const unsubAccLabels = (activeServices.subscribeAccountLabels ?? defaultServices.subscribeAccountLabels!)(
      householdId,
      (accountLabels) => {
        const s = get();
        if (s.generation !== currentGeneration || s.householdId !== currentHouseholdId) return;
        set({ accountLabels, status: "success", error: null });
      },
      handleError,
    );
    subscriptionRegistry.register("household", "member-account-labels", unsubAccLabels);

    // 7. Movimientos compartidos del mes en tiempo real
    const unsubMovements = (activeServices.subscribeMovements ?? defaultServices.subscribeMovements!)(
      householdId,
      period,
      (movements) => {
        const s = get();
        if (
          s.generation !== currentGeneration ||
          s.householdId !== currentHouseholdId ||
          !samePeriod(s.period, currentPeriod)
        ) {
          return;
        }
        set({ movements: sortByOccurredAtDesc(movements), status: "success", error: null });
      },
      handleError,
    );
    subscriptionRegistry.register("household", "movements", unsubMovements);
  },

  refresh: async () => {
    const { householdId, period, load } = get();
    if (householdId && period) {
      await load(householdId, period, { force: true });
    }
  },

  reset: () => {
    subscriptionRegistry.unregister("household");
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

  /**
   * Refleja en el tablero compartido un movimiento que el servidor YA confirmo.
   *
   * Lo llaman las dos superficies que pueden mover un documento compartido: la
   * correccion de categoria desde Hogar (§9.4) y las mutaciones Personales
   * (crear, editar, Papelera, restaurar), porque un movimiento marcado
   * "Contar en Hogar" nace en Personal pero vive tambien aqui.
   *
   * Un documento solo entra si cumple LAS TRES condiciones de la consulta
   * canonica §19.3: pertenece a este Hogar, esta `active` y su `occurredAt`
   * cae dentro del mes cargado. Si deja de cumplir alguna —se dejo de
   * compartir, se mando a Papelera o se movio a otro mes— sale del tablero.
   */
  applyCommittedMovement: (movement) => {
    set((state) => {
      const range = state.range;
      const belongs =
        movement.householdId !== null &&
        movement.householdId === state.householdId &&
        movement.lifecycleState === "active" &&
        range !== null &&
        movement.occurredAtMillis >= range.startMillis &&
        movement.occurredAtMillis < range.endMillis;

      const index = state.movements.findIndex((m) => m.id === movement.id);

      if (!belongs) {
        // Sin cambio real: no se crea un array nuevo para no re-renderizar
        // Hogar en cada mutacion Personal no compartida.
        return index >= 0
          ? { movements: state.movements.filter((m) => m.id !== movement.id) }
          : {};
      }

      const next = index >= 0
        ? state.movements.map((m, i) => (i === index ? movement : m))
        : [movement, ...state.movements];
      return { movements: sortByOccurredAtDesc(next) };
    });
  },

  removeMovement: (movementId) => {
    set((state) =>
      state.movements.some((m) => m.id === movementId)
        ? { movements: state.movements.filter((m) => m.id !== movementId) }
        : {},
    );
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
