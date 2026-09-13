import { create } from "zustand";

import {
  readMplusAccounts,
  subscribeMplusAccounts,
} from "@/features/accounts/services/mplus-account-service";
import {
  readMplusCategories,
  subscribeMplusCategories,
} from "@/features/categories/services/mplus-category-service";
import {
  readPersonalMonthMovements,
  readPersonalTrashedMovements,
  resolveMonthRangeFor,
  subscribePersonalMonthMovements,
  subscribePersonalTrashedMovements,
  type PersonalMonthRange,
} from "@/features/movements/services/read-personal-movements";
import { getFirebaseDb } from "@/lib/firebase/client";
import { subscriptionRegistry } from "@/lib/firestore/subscription-registry";
import type {
  MplusMovement,
  MplusPersonalAccount,
  MplusPersonalCategory,
  MplusUserProfile,
} from "@/lib/mplus/models";
import {
  readMplusUserProfile,
  subscribeMplusUserProfile,
} from "@/lib/mplus/user-bootstrap";
import { completeResetSessionExit } from "@/features/auth/session-exit";
import { resumeAccountResetIfNeeded } from "@/features/settings/services/mplus-account-reset-service";

/**
 * Estado Personal del contrato v1.
 *
 * Convive con `personal-data-store` (legacy) a proposito: la regla 6 de
 * `docs/12` prohibe retirar el circuito anterior antes de conectar, probar y
 * aceptar visualmente su sustitucion. Este store alimenta las superficies ya
 * migradas a M+; el legacy sigue sirviendo a las que aun no lo estan.
 *
 * Principios que impone:
 *
 * - **Online-only & Real-time**: suscripciones en vivo vía Firestore onSnapshot
 *   gestionadas por `subscriptionRegistry`. Si la lectura falla, el estado queda en
 *   `error` y la UI lo muestra.
 * - **Descarte de callbacks obsoletos**: cada carga/cambio incrementa `generation`,
 *   evitando que respuestas tardías de un usuario o período anterior pisen el estado.
 * - **Reconciliación idempotente**: `applyCommittedMovement` y los snapshots
 *   reconcilian por ID y mantienen el orden canónico.
 * - **Mes explicito**: el tablero y el historial siempre saben que rango
 *   estan mostrando; cambiar de periodo actualiza el listener de movimientos.
 */

export type MplusPersonalStatus = "idle" | "loading" | "success" | "error";

export type MplusPersonalPeriod = Readonly<{ year: number; month: number }>;

export type MplusPersonalLoadSource =
  | "profile"
  | "accounts"
  | "categories"
  | "movements"
  | "trashed";

type MplusPersonalSourceStatus = "idle" | "loading" | "success" | "error";

type MplusPersonalSourceStatuses = Record<MplusPersonalLoadSource, MplusPersonalSourceStatus>;

const personalLoadSources: readonly MplusPersonalLoadSource[] = [
  "profile",
  "accounts",
  "categories",
  "movements",
  "trashed",
];

const sourceStatusesFor = (status: MplusPersonalSourceStatus): MplusPersonalSourceStatuses => ({
  profile: status,
  accounts: status,
  categories: status,
  movements: status,
  trashed: status,
});

const resolveAggregateLoadStatus = (
  sourceStatuses: MplusPersonalSourceStatuses,
): MplusPersonalStatus => {
  if (personalLoadSources.some((source) => sourceStatuses[source] === "error")) return "error";
  if (personalLoadSources.every((source) => sourceStatuses[source] === "success")) return "success";
  return "loading";
};

const resolveAggregateLoadError = (
  sourceErrors: Partial<Record<MplusPersonalLoadSource, string>>,
): string | null => {
  for (const source of personalLoadSources) {
    const error = sourceErrors[source];
    if (error) return error;
  }
  return null;
};

export type MplusPersonalState = {
  status: MplusPersonalStatus;
  error: string | null;
  sourceStatuses: MplusPersonalSourceStatuses;
  sourceErrors: Partial<Record<MplusPersonalLoadSource, string>>;
  ownerId: string | null;
  period: MplusPersonalPeriod | null;
  range: PersonalMonthRange | null;
  /** Perfil del contrato (§6): decide si se puede compartir y si se puede escribir. */
  profile: MplusUserProfile | null;
  accounts: MplusPersonalAccount[];
  categories: MplusPersonalCategory[];
  /** Movimientos `active` del mes cargado. */
  movements: MplusMovement[];
  /** Papelera completa del dueño (incluye vencidos: la UI decide). */
  trashed: MplusMovement[];
  /** Se incrementa en cada carga para descartar respuestas obsoletas. */
  generation: number;

  load: (ownerId: string, period: MplusPersonalPeriod, options?: { force?: boolean }) => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
  /** Refleja un documento ya confirmado por el servidor. */
  applyCommittedMovement: (movement: MplusMovement) => void;
  /** Retira un movimiento eliminado fisicamente (purga). */
  removeMovement: (movementId: string) => void;
  applyCommittedAccount: (account: MplusPersonalAccount) => void;
  applyCommittedCategory: (category: MplusPersonalCategory) => void;
};

const initialState = {
  status: "idle" as MplusPersonalStatus,
  error: null as string | null,
  sourceStatuses: sourceStatusesFor("idle"),
  sourceErrors: {} as Partial<Record<MplusPersonalLoadSource, string>>,
  ownerId: null as string | null,
  period: null as MplusPersonalPeriod | null,
  range: null as PersonalMonthRange | null,
  profile: null as MplusUserProfile | null,
  accounts: [] as MplusPersonalAccount[],
  categories: [] as MplusPersonalCategory[],
  movements: [] as MplusMovement[],
  trashed: [] as MplusMovement[],
};

const samePeriod = (
  left: MplusPersonalPeriod | null,
  right: MplusPersonalPeriod,
): boolean => left !== null && left.year === right.year && left.month === right.month;

const sortByOccurredAtDesc = (movements: MplusMovement[]): MplusMovement[] =>
  [...movements].sort((a, b) => b.occurredAtMillis - a.occurredAtMillis);

const sortByPurgeAsc = (movements: MplusMovement[]): MplusMovement[] =>
  [...movements].sort((a, b) => (a.purgeAfterMillis ?? 0) - (b.purgeAfterMillis ?? 0));

export type MplusPersonalServices = {
  readAccounts: typeof readMplusAccounts;
  readCategories: typeof readMplusCategories;
  readMonthMovements: typeof readPersonalMonthMovements;
  readTrashed: typeof readPersonalTrashedMovements;
  readProfile: (uid: string) => Promise<MplusUserProfile | null>;
  subscribeProfile?: (
    uid: string,
    onUpdate: (profile: MplusUserProfile | null) => void,
    onError?: (error: Error) => void,
  ) => () => void;
  subscribeAccounts?: (
    ownerId: string,
    onUpdate: (accounts: MplusPersonalAccount[]) => void,
    onError?: (error: Error) => void,
  ) => () => void;
  subscribeCategories?: (
    ownerId: string,
    onUpdate: (categories: MplusPersonalCategory[]) => void,
    onError?: (error: Error) => void,
  ) => () => void;
  subscribeMonthMovements?: (
    ownerId: string,
    range: PersonalMonthRange,
    onUpdate: (movements: MplusMovement[]) => void,
    onError?: (error: Error) => void,
  ) => () => void;
  subscribeTrashed?: (
    ownerId: string,
    onUpdate: (trashed: MplusMovement[]) => void,
    onError?: (error: Error) => void,
  ) => () => void;
};

const defaultServices: MplusPersonalServices = {
  readAccounts: readMplusAccounts,
  readCategories: readMplusCategories,
  readMonthMovements: readPersonalMonthMovements,
  readTrashed: readPersonalTrashedMovements,
  readProfile: (uid) => readMplusUserProfile(getFirebaseDb(), uid),
  subscribeProfile: (uid, onUpdate, onError) =>
    subscribeMplusUserProfile(getFirebaseDb(), uid, onUpdate, onError),
  subscribeAccounts: (ownerId, onUpdate, onError) =>
    subscribeMplusAccounts(ownerId, onUpdate, onError, getFirebaseDb()),
  subscribeCategories: (ownerId, onUpdate, onError) =>
    subscribeMplusCategories(ownerId, onUpdate, onError, getFirebaseDb()),
  subscribeMonthMovements: (ownerId, range, onUpdate, onError) =>
    subscribePersonalMonthMovements(ownerId, range, onUpdate, onError, getFirebaseDb()),
  subscribeTrashed: (ownerId, onUpdate, onError) =>
    subscribePersonalTrashedMovements(ownerId, onUpdate, onError, getFirebaseDb()),
};

export const createMplusPersonalStore = (overrides?: Partial<MplusPersonalServices>) => {
  const services: MplusPersonalServices = { ...defaultServices, ...overrides };

  return create<MplusPersonalState>((set, get) => ({
    ...initialState,
    generation: 0,

    load: async (ownerId, period, options) => {
      const state = get();
      const force = options?.force ?? false;

      if (
        !force &&
        state.status === "success" &&
        state.ownerId === ownerId &&
        samePeriod(state.period, period)
      ) {
        return;
      }

      // Cambiar de usuario invalida suscripciones y datos anteriores
      if (state.ownerId !== null && state.ownerId !== ownerId) {
        subscriptionRegistry.unregister("personal");
        set({ ...initialState });
      }

      const generation = state.generation + 1;
      const currentOwnerId = ownerId;
      const currentPeriod = period;
      const range = resolveMonthRangeFor(period.year, period.month);
      set({
        status: "loading",
        error: null,
        sourceStatuses: sourceStatusesFor("loading"),
        sourceErrors: {},
        ownerId,
        period,
        range,
        generation,
      });

      const resolveSourceSuccess = (
        source: MplusPersonalLoadSource,
        data: Partial<
          Pick<MplusPersonalState, "profile" | "accounts" | "categories" | "movements" | "trashed">
        >,
      ) => {
        set((current) => {
          const sourceStatuses = { ...current.sourceStatuses, [source]: "success" as const };
          const sourceErrors = { ...current.sourceErrors };
          delete sourceErrors[source];
          const status = resolveAggregateLoadStatus(sourceStatuses);
          return {
            ...data,
            sourceStatuses,
            sourceErrors,
            status,
            error: resolveAggregateLoadError(sourceErrors),
          };
        });
      };

      const handleError = (source: MplusPersonalLoadSource, error: Error) => {
        if (get().generation !== generation) return;
        set((current) => {
          const sourceStatuses = { ...current.sourceStatuses, [source]: "error" as const };
          const sourceErrors = {
            ...current.sourceErrors,
            [source]: error.message || "No se pudieron cargar tus datos. Revisa tu conexión.",
          };
          return {
            sourceStatuses,
            sourceErrors,
            status: resolveAggregateLoadStatus(sourceStatuses),
            error: resolveAggregateLoadError(sourceErrors),
          };
        });
      };

      // 1. Perfil de usuario en tiempo real
      const unsubProfile = (services.subscribeProfile ?? defaultServices.subscribeProfile!)(
        ownerId,
        (profile) => {
          const s = get();
          if (s.generation !== generation || s.ownerId !== currentOwnerId) return;
          resolveSourceSuccess("profile", { profile });

          if (profile?.status === "resetting") {
            // Contrato §17.2: si el perfil está en resetting, reanudar inmediatamente el reinicio
            void resumeAccountResetIfNeeded(getFirebaseDb(), ownerId)
              .then(async (res) => {
                if (res?.deletedUserProfile) {
                  await completeResetSessionExit();
                } else if (res && !res.deletedUserProfile) {
                  void get().refresh();
                }
              })
              .catch(() => {
                // Si falla la reanudación, DashboardShell ofrece reintentar o cerrar sesión
              });
          }
        },
        (error) => handleError("profile", error),
      );
      subscriptionRegistry.register("personal", "user-profile", unsubProfile);

      // 2. Cuentas personales en tiempo real
      const unsubAccounts = (services.subscribeAccounts ?? defaultServices.subscribeAccounts!)(
        ownerId,
        (accounts) => {
          const s = get();
          if (s.generation !== generation || s.ownerId !== currentOwnerId) return;
          resolveSourceSuccess("accounts", { accounts });
        },
        (error) => handleError("accounts", error),
      );
      subscriptionRegistry.register("personal", "accounts", unsubAccounts);

      // 3. Categorías personales en tiempo real
      const unsubCategories = (services.subscribeCategories ?? defaultServices.subscribeCategories!)(
        ownerId,
        (categories) => {
          const s = get();
          if (s.generation !== generation || s.ownerId !== currentOwnerId) return;
          resolveSourceSuccess("categories", { categories });
        },
        (error) => handleError("categories", error),
      );
      subscriptionRegistry.register("personal", "categories", unsubCategories);

      // 4. Movimientos del mes en tiempo real
      const unsubMovements = (services.subscribeMonthMovements ?? defaultServices.subscribeMonthMovements!)(
        ownerId,
        range,
        (movements) => {
          const s = get();
          if (
            s.generation !== generation ||
            s.ownerId !== currentOwnerId ||
            !samePeriod(s.period, currentPeriod)
          ) {
            return;
          }
          resolveSourceSuccess("movements", { movements: sortByOccurredAtDesc(movements) });
        },
        (error) => handleError("movements", error),
      );
      subscriptionRegistry.register("personal", "movements", unsubMovements);

      // 5. Papelera en tiempo real
      const unsubTrashed = (services.subscribeTrashed ?? defaultServices.subscribeTrashed!)(
        ownerId,
        (trashed) => {
          const s = get();
          if (s.generation !== generation || s.ownerId !== currentOwnerId) return;
          resolveSourceSuccess("trashed", { trashed: sortByPurgeAsc(trashed) });
        },
        (error) => handleError("trashed", error),
      );
      subscriptionRegistry.register("personal", "trashed", unsubTrashed);
    },

    refresh: async () => {
      const { ownerId, period, load } = get();
      if (!ownerId || !period) return;
      await load(ownerId, period, { force: true });
    },

    reset: () => {
      subscriptionRegistry.unregister("personal");
      set((state) => ({ ...initialState, generation: state.generation + 1 }));
    },

    applyCommittedMovement: (movement) => {
      set((state) => {
        const range = state.range;
        const belongsToMonth =
          range !== null &&
          movement.occurredAtMillis >= range.startMillis &&
          movement.occurredAtMillis < range.endMillis;

        const inMonth = state.movements.filter((item) => item.id !== movement.id);
        const inTrash = state.trashed.filter((item) => item.id !== movement.id);

        if (movement.lifecycleState === "trashed") {
          return { movements: inMonth, trashed: sortByPurgeAsc([...inTrash, movement]) };
        }

        return {
          movements: belongsToMonth
            ? sortByOccurredAtDesc([...inMonth, movement])
            : inMonth,
          trashed: inTrash,
        };
      });
    },

    removeMovement: (movementId) => {
      set((state) => ({
        movements: state.movements.filter((item) => item.id !== movementId),
        trashed: state.trashed.filter((item) => item.id !== movementId),
      }));
    },

    applyCommittedAccount: (account) => {
      set((state) => {
        const rest = state.accounts.filter((item) => item.id !== account.id);
        return {
          accounts: [...rest, account].sort((left, right) =>
            left.name.localeCompare(right.name, "es-CO"),
          ),
        };
      });
    },

    applyCommittedCategory: (category) => {
      set((state) => {
        const rest = state.categories.filter((item) => item.id !== category.id);
        return {
          categories: [...rest, category].sort(
            (left, right) =>
              left.sortOrder - right.sortOrder ||
              left.name.localeCompare(right.name, "es-CO"),
          ),
        };
      });
    },
  }));
};

export const useMplusPersonalStore = createMplusPersonalStore();
