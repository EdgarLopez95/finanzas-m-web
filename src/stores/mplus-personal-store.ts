import { create } from "zustand";

import { readMplusAccounts } from "@/features/accounts/services/mplus-account-service";
import { readMplusCategories } from "@/features/categories/services/mplus-category-service";
import {
  readPersonalMonthMovements,
  readPersonalTrashedMovements,
  resolveMonthRangeFor,
  type PersonalMonthRange,
} from "@/features/movements/services/read-personal-movements";
import { getFirebaseDb } from "@/lib/firebase/client";
import type {
  MplusMovement,
  MplusPersonalAccount,
  MplusPersonalCategory,
  MplusUserProfile,
} from "@/lib/mplus/models";
import { readMplusUserProfile } from "@/lib/mplus/user-bootstrap";

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
 * - **Online-only** (contrato §22): sin cache funcional ni cola. Si la lectura
 *   falla, el estado queda en `error` y la UI lo muestra; no se sirve un mes
 *   viejo como si fuera bueno.
 * - **Nada de exito anticipado**: `applyCommittedMovement` solo se llama con
 *   el documento que el servidor YA confirmo. El store no predice escrituras.
 * - **Mes explicito**: el tablero y el historial siempre saben que rango
 *   estan mostrando; cambiar de periodo es una recarga, no un filtro local.
 */

export type MplusPersonalStatus = "idle" | "loading" | "success" | "error";

export type MplusPersonalPeriod = Readonly<{ year: number; month: number }>;

export type MplusPersonalState = {
  status: MplusPersonalStatus;
  error: string | null;
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
};

const defaultServices: MplusPersonalServices = {
  readAccounts: readMplusAccounts,
  readCategories: readMplusCategories,
  readMonthMovements: readPersonalMonthMovements,
  readTrashed: readPersonalTrashedMovements,
  readProfile: (uid) => readMplusUserProfile(getFirebaseDb(), uid),
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

      // Cambiar de usuario invalida todo lo cargado antes de pedir nada.
      if (state.ownerId !== null && state.ownerId !== ownerId) {
        set({ ...initialState });
      }

      const generation = state.generation + 1;
      const range = resolveMonthRangeFor(period.year, period.month);
      set({ status: "loading", error: null, ownerId, period, range, generation });

      try {
        const [profile, accounts, categories, movements, trashed] = await Promise.all([
          services.readProfile(ownerId),
          services.readAccounts(ownerId),
          services.readCategories(ownerId),
          services.readMonthMovements(ownerId, range),
          services.readTrashed(ownerId),
        ]);

        // Una respuesta de una carga anterior nunca pisa a la vigente.
        if (get().generation !== generation) return;

        set({
          status: "success",
          error: null,
          profile,
          accounts,
          categories,
          movements: sortByOccurredAtDesc(movements),
          trashed: sortByPurgeAsc(trashed),
        });
      } catch (error) {
        if (get().generation !== generation) return;
        set({
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "No se pudieron cargar tus datos. Revisa tu conexion.",
        });
      }
    },

    refresh: async () => {
      const { ownerId, period, load } = get();
      if (!ownerId || !period) return;
      await load(ownerId, period, { force: true });
    },

    reset: () => {
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
