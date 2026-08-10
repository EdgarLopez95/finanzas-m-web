import { create } from "zustand";

import { subscriptionRegistry } from "@/lib/firestore/subscription-registry";

import { readHousehold } from "@/features/household/services/read-household";
import { readHouseholdCategories } from "@/features/household/services/read-household-categories";
import { ensureHouseholdCategorySeed } from "@/features/household/services/ensure-household-category-seed";
import { readHouseholdDebts } from "@/features/household/services/read-household-debts";
import { readHouseholdEventShares } from "@/features/household/services/read-household-event-shares";
import { readHouseholdEvents } from "@/features/household/services/read-household-events";
import { readHouseholdIncomeEntries } from "@/features/household/services/read-household-income-entries";
import { readHouseholdMemberProfiles } from "@/features/household/services/read-household-member-profiles";
import { readActiveHouseholdId } from "@/features/household/services/read-household-user";
import type {
  Household,
  HouseholdCategory,
  HouseholdDebt,
  HouseholdEvent,
  HouseholdEventShare,
  HouseholdIncomeEntry,
  HouseholdMemberProfile,
} from "@/types/household";

export type HouseholdData = {
  activeHouseholdId: string | null;
  household: Household | null;
  categories: HouseholdCategory[];
  debts: HouseholdDebt[];
  events: HouseholdEvent[];
  eventShares: HouseholdEventShare[];
  incomeEntries: HouseholdIncomeEntry[];
  memberProfiles: Record<string, HouseholdMemberProfile>;
};

export type HouseholdStatus = "idle" | "loading" | "empty" | "success" | "error" | "dissolved";

const initialData: HouseholdData = {
  activeHouseholdId: null,
  household: null,
  categories: [],
  debts: [],
  events: [],
  eventShares: [],
  incomeEntries: [],
  memberProfiles: {},
};

export type HouseholdDataServices = {
  readActiveHouseholdId: (uid: string) => Promise<string | null>;
  readHousehold: (householdId: string, uid: string) => Promise<Household | null>;
  readHouseholdEvents: (householdId: string) => Promise<HouseholdEvent[]>;
  readHouseholdEventShares: (householdId: string) => Promise<HouseholdEventShare[]>;
  readHouseholdCategories: (householdId: string) => Promise<HouseholdCategory[]>;
  readHouseholdDebts: (householdId: string) => Promise<HouseholdDebt[]>;
  readHouseholdIncomeEntries: (householdId: string) => Promise<HouseholdIncomeEntry[]>;
  readHouseholdMemberProfiles: (memberIds: string[], currentUid: string) => Promise<Record<string, HouseholdMemberProfile>>;
  startSessionSubscriptions?: (uid: string) => void;
  /**
   * Bloque 2 (seed): helper dedicado, fuera del lector puro
   * `readHouseholdCategories`. Se dispara desde `load()` SOLO tras confirmar
   * Hogar activo (no disuelto) y membresía del uid actual (ya garantizado en
   * este punto por `readHousehold`) — fire-and-forget, deduplicado por
   * householdId dentro del propio helper.
   */
  ensureCategorySeed?: (householdId: string, createdByUserId: string, categories: HouseholdCategory[]) => Promise<boolean>;
};

export const defaultHouseholdDataServices: HouseholdDataServices = {
  readActiveHouseholdId: (uid) => readActiveHouseholdId(uid),
  readHousehold: async (householdId, uid) => {
    try {
      return await readHousehold(householdId, uid);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isPermissionOrNotFound =
        msg.includes("permission-denied") ||
        msg.includes("no existe") ||
        msg.includes("No tienes permiso");

      if (isPermissionOrNotFound) {
        // Re-lectura autoritativa para confirmar si es un error transitorio o borrado real
        for (let attempt = 0; attempt < 2; attempt++) {
          await new Promise((res) => setTimeout(res, 200));
          try {
            const reconfirmed = await readHousehold(householdId, uid);
            if (reconfirmed) {
              return reconfirmed; // Error transitorio recuperado
            }
          } catch (retryErr: unknown) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            if (!retryMsg.includes("permission-denied") && !retryMsg.includes("no existe") && !retryMsg.includes("No tienes permiso")) {
              throw retryErr; // Error de red u otro: no declarar borrado
            }
          }
        }
        return null; // Ausencia o denegación confirmada tras reintentos
      }

      // Errores de red u otros: re-lanzar sin declarar disolución o vacío
      throw err;
    }
  },
  readHouseholdEvents: (householdId) => readHouseholdEvents(householdId),
  readHouseholdEventShares: (householdId) => readHouseholdEventShares(householdId),
  readHouseholdCategories: (householdId) => readHouseholdCategories(householdId),
  ensureCategorySeed: (householdId, createdByUserId, categories) =>
    ensureHouseholdCategorySeed(householdId, createdByUserId, categories),
  readHouseholdDebts: (householdId) => readHouseholdDebts(householdId),
  readHouseholdIncomeEntries: (householdId) => readHouseholdIncomeEntries(householdId),
  readHouseholdMemberProfiles: (memberIds, uid) =>
    readHouseholdMemberProfiles(memberIds, uid).catch(() => ({})),
  startSessionSubscriptions: (uid) => {
    import("@/features/household/hooks/use-household-session-subscriptions")
      .then((m) => m.startHouseholdSessionSubscriptions(uid))
      .catch((err) => console.error("Error starting household live subscriptions:", err));
  },
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

export type HouseholdDataState = {
  status: HouseholdStatus;
  data: HouseholdData;
  error: string | null;
  uid: string | null;
  generation: number;
  inFlight: Promise<void> | null;
  syncMode: "pull" | "live";

  setSyncMode: (mode: "pull" | "live") => void;
  applyHouseholdSnapshot: (partial: Partial<HouseholdData>, snapshotUid?: string) => void;
  load: (uid: string, options?: { force?: boolean }) => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
};

export const createHouseholdDataStore = (customServices?: Partial<HouseholdDataServices>) => {
  const rawServices: HouseholdDataServices = {
    ...defaultHouseholdDataServices,
    ...customServices,
  };

  const services: HouseholdDataServices = {
    ...rawServices,
    readHousehold: async (householdId, uid) => {
      try {
        return await rawServices.readHousehold(householdId, uid);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const isPermissionOrNotFound =
          msg.includes("permission-denied") ||
          msg.includes("no existe") ||
          msg.includes("No tienes permiso");

        if (isPermissionOrNotFound) {
          // Re-lectura autoritativa para confirmar si es un error transitorio o borrado real
          for (let attempt = 0; attempt < 2; attempt++) {
            await new Promise((res) => setTimeout(res, 50));
            try {
              const reconfirmed = await rawServices.readHousehold(householdId, uid);
              if (reconfirmed) {
                return reconfirmed;
              }
            } catch (retryErr: unknown) {
              const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
              if (!retryMsg.includes("permission-denied") && !retryMsg.includes("no existe") && !retryMsg.includes("No tienes permiso")) {
                throw retryErr;
              }
            }
          }
          return null;
        }

        throw err;
      }
    },
  };

  return create<HouseholdDataState>((set, get) => ({
    status: "idle",
    data: initialData,
    error: null,
    uid: null,
    generation: 0,
    inFlight: null,
    syncMode: "pull",

    setSyncMode: (mode) => set({ syncMode: mode }),

    applyHouseholdSnapshot: (partial, snapshotUid) => {
      const currentUid = get().uid;
      if (snapshotUid && currentUid !== snapshotUid) {
        return;
      }

      set((state) => {
        // 1. activeHouseholdId cambia a null -> status "empty". H4.2: NO se usa
        // subscriptionRegistry.unregister("household") (scope completo) porque eso también
        // desuscribe "user-doc" y "household-session-watcher" — los listeners de CONTROL DE
        // SESIÓN de use-household-session-subscriptions.ts, cuyo propósito es justamente
        // seguir vigilando activeHouseholdId para detectar que el usuario entra a un hogar
        // NUEVO (leave/dissolve -> join/create) sin recargar la página. Solo se detiene el
        // listener del hogar puntual (household-doc) y los 5 listeners de datos del hogar que
        // se está dejando; el mismo patrón de desuscripción puntual por key ya usado más abajo
        // (rama 3) para household === null.
        if ("activeHouseholdId" in partial && partial.activeHouseholdId === null) {
          subscriptionRegistry.unregister("household", "household-doc");
          subscriptionRegistry.unregister("household", "events");
          subscriptionRegistry.unregister("household", "event-shares");
          subscriptionRegistry.unregister("household", "debts");
          subscriptionRegistry.unregister("household", "income-entries");
          subscriptionRegistry.unregister("household", "categories");
          return {
            status: "empty",
            data: {
              ...initialData,
              activeHouseholdId: null,
            },
          };
        }

        // 2. Cambia activeHouseholdId a un ID distinto -> limpiar datos previos
        if ("activeHouseholdId" in partial && partial.activeHouseholdId !== state.data.activeHouseholdId) {
          return {
            status: "loading",
            data: {
              ...initialData,
              activeHouseholdId: partial.activeHouseholdId ?? null,
            },
          };
        }

        // 3. Viene household metadata
        if ("household" in partial) {
          const hh = partial.household;
          if (!hh) {
            subscriptionRegistry.unregister("household", "events");
            subscriptionRegistry.unregister("household", "event-shares");
            subscriptionRegistry.unregister("household", "debts");
            subscriptionRegistry.unregister("household", "income-entries");
            subscriptionRegistry.unregister("household", "categories");
            return {
              status: "empty",
              data: {
                ...initialData,
                activeHouseholdId: null,
              },
            };
          }

          if (hh.status === "dissolved") {
            subscriptionRegistry.unregister("household", "events");
            subscriptionRegistry.unregister("household", "event-shares");
            subscriptionRegistry.unregister("household", "debts");
            subscriptionRegistry.unregister("household", "income-entries");
            subscriptionRegistry.unregister("household", "categories");
            return {
              status: "dissolved",
              data: {
                ...initialData,
                activeHouseholdId: state.data.activeHouseholdId,
                household: hh,
              },
            };
          }

          const nextStatus =
            (state.status === "idle" || state.status === "loading" || state.status === "dissolved")
              ? "success"
              : state.status;

          return {
            status: nextStatus,
            data: {
              ...state.data,
              household: hh,
            },
          };
        }

        const effectiveHousehold = "household" in partial ? partial.household : state.data.household;
        const nextStatus =
          (state.status === "idle" || state.status === "loading") && effectiveHousehold !== null
            ? "success"
            : state.status;

        return {
          data: { ...state.data, ...partial },
          status: nextStatus,
        };
      });
    },

    refresh: async () => {
      if (get().syncMode === "live") return;
      const { uid, load } = get();
      if (!uid) return;
      await load(uid, { force: true });
    },

    reset: () => {
      subscriptionRegistry.unregister("household");
      const nextGen = get().generation + 1;
      set({ status: "idle", data: initialData, error: null, uid: null, generation: nextGen, inFlight: null, syncMode: "pull" });
    },

    load: async (uid, options) => {
      const force = options?.force ?? false;
      const state = get();

      if (state.uid && state.uid !== uid) {
        get().reset();
      }

      if (!force && get().uid === uid && (get().status === "success" || get().status === "empty")) {
        return;
      }

      if (!force && get().inFlight && get().uid === uid) {
        return get().inFlight!;
      }

      const nextGen = get().generation + 1;

      const run = async () => {
        set({ status: "loading", error: null, uid, generation: nextGen });

        try {
          const activeHouseholdId = await withTimeout(services.readActiveHouseholdId(uid), 12000, "users");

          if (!activeHouseholdId) {
            if (get().uid === uid && get().generation === nextGen) {
              set({
                status: "empty",
                data: { ...initialData, activeHouseholdId: null },
                error: null,
                uid,
              });
            }
            return;
          }

          const household = await withTimeout(services.readHousehold(activeHouseholdId, uid), 12000, "households");

          if (!household) {
            if (get().uid === uid && get().generation === nextGen) {
              set({
                status: "empty",
                data: { ...initialData, activeHouseholdId: null },
                error: null,
                uid,
              });
            }
            return;
          }

          if (household.status === "dissolved") {
            if (get().uid === uid && get().generation === nextGen) {
              set({
                status: "dissolved",
                data: {
                  ...initialData,
                  activeHouseholdId,
                  household,
                },
                error: null,
                uid,
              });
            }
            return;
          }

          const [events, eventShares, categories, debts, incomeEntries, memberProfiles] = await Promise.all([
            withTimeout(services.readHouseholdEvents(activeHouseholdId), 12000, "household_events"),
            withTimeout(services.readHouseholdEventShares(activeHouseholdId), 12000, "household_event_shares"),
            withTimeout(services.readHouseholdCategories(activeHouseholdId), 12000, "household_categories"),
            withTimeout(services.readHouseholdDebts(activeHouseholdId), 12000, "household_debts"),
            withTimeout(services.readHouseholdIncomeEntries(activeHouseholdId), 12000, "household_income_entries"),
            services.readHouseholdMemberProfiles(household.memberIds, uid),
          ]);

          if (get().uid !== uid || get().generation !== nextGen) {
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
              eventShares,
              categories,
              debts,
              incomeEntries,
              memberProfiles,
            },
          });

          // Bloque 2 (seed): helper dedicado fuera del lector puro, disparado
          // SOLO aquí — Hogar ya confirmado activo (no disuelto) y `uid` ya
          // confirmado miembro por `readHousehold` más arriba. Fire-and-forget:
          // no bloquea el load() y el listener de categorías (o un refresh
          // posterior) reflejará lo que el seed haya creado/backfilleado.
          void services.ensureCategorySeed?.(activeHouseholdId, uid, categories).catch(() => {});
        } catch (error) {
          if (get().uid !== uid || get().generation !== nextGen) {
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
};

export const useHouseholdDataStore = createHouseholdDataStore();
