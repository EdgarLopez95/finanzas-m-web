import { create } from "zustand";
import { collection, getDocs, query, where } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { subscriptionRegistry } from "@/lib/firestore/subscription-registry";
import { groupConsumptionsByEntryId, getEntryPendingAmount } from "@/lib/finance/third-party-funds";
import { isSameMonthAndYear } from "@/lib/format/date";
import { computeNetPersonalExpenses } from "@/features/dashboard/lib/personal-view-model";
import { readPersonalAccounts } from "@/features/accounts/services/read-personal-accounts";
import { readPersonalCategories } from "@/features/categories/services/read-personal-categories";
import { ensurePersonalCategorySeed } from "@/features/categories/services/ensure-personal-category-seed";
import { readAccountPockets } from "@/features/pockets/services/read-account-pockets";
import { readAllPersonalTransactions } from "@/features/transactions/services/read-personal-transactions";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";
import type { Pocket } from "@/types/pocket";
import type { Transaction } from "@/types/transaction";
import type { ThirdPartyFundConsumption, ThirdPartyFundEntry, ThirdPartyFundEntryStatus } from "@/types/third-party-funds";

export type PersonalDatasetKey =
  | "accounts"
  | "pockets"
  | "categories"
  | "transactions"
  | "thirdPartyEntries"
  | "thirdPartyConsumptions";

export type PersonalDatasetStatus = "idle" | "loading" | "ready" | "stale" | "error";

export type PersonalDatasetState = {
  status: PersonalDatasetStatus;
  hasValue: boolean;
  error: string | null;
};

export type PersonalDataStatus = "idle" | "loading" | "success" | "partial" | "error";

export type PersonalAsyncContext = {
  ownerId: string;
  generation: number;
};

export type PocketBarrierContext = PersonalAsyncContext & {
  barrierId: number;
};

export type PersonalDataServices = {
  readAccounts: (ownerId: string) => Promise<Account[]>;
  readPockets: (accountIds: string[]) => Promise<Pocket[]>;
  readCategories: (ownerId: string) => Promise<Category[]>;
  readTransactions: (ownerId: string) => Promise<Transaction[]>;
  readThirdPartyEntries: (ownerId: string) => Promise<ThirdPartyFundEntry[]>;
  readThirdPartyConsumptions: (ownerId: string) => Promise<ThirdPartyFundConsumption[]>;
  startSubscriptions?: (ownerId: string) => void;
  /**
   * Bloque 2 (seed): helper dedicado, fuera del lector puro `readCategories`.
   * Se dispara desde `load()` SOLO tras una lectura de categorías exitosa
   * (fire-and-forget, deduplicado por ownerId dentro del propio helper) —
   * nunca desde el lector, nunca antes de la primera lectura confirmada.
   */
  ensureCategorySeed?: (ownerId: string, categories: Category[]) => Promise<boolean>;
};

export const defaultPersonalDataServices: PersonalDataServices = {
  readAccounts: (ownerId) => readPersonalAccounts(ownerId),
  readPockets: (accountIds) => readAccountPockets(accountIds),
  readCategories: (ownerId) => readPersonalCategories(ownerId),
  ensureCategorySeed: (ownerId, categories) => ensurePersonalCategorySeed(ownerId, categories),
  readTransactions: (ownerId) => readAllPersonalTransactions(ownerId),
  readThirdPartyEntries: async (ownerId) => {
    const db = getFirebaseDb();
    const snap = await getDocs(
      query(
        collection(db, "third_party_fund_entries"),
        where("ownerId", "==", ownerId),
        where("status", "in", ["open", "consumed"]),
      ),
    );
    return snap.docs.map((docItem) => {
      const data = docItem.data();
      return {
        id: docItem.id,
        ownerId: String(data.ownerId || ""),
        sourceIncomeTransactionId: String(data.sourceIncomeTransactionId || ""),
        originalAmount: Number(data.originalAmount || 0),
        status: (data.status as ThirdPartyFundEntryStatus) || "open",
        createdAt: data.createdAt?.toDate() || null,
        updatedAt: data.updatedAt?.toDate() || null,
      };
    });
  },
  readThirdPartyConsumptions: async (ownerId) => {
    const db = getFirebaseDb();
    const snap = await getDocs(
      query(collection(db, "third_party_fund_consumptions"), where("ownerId", "==", ownerId)),
    );
    return snap.docs.map((docItem) => {
      const data = docItem.data();
      return {
        id: docItem.id,
        ownerId: String(data.ownerId || ""),
        entryId: String(data.entryId || ""),
        consumerExpenseTransactionId: String(data.consumerExpenseTransactionId || ""),
        amount: Number(data.amount || 0),
        createdAt: data.createdAt?.toDate() || null,
        updatedAt: data.updatedAt?.toDate() || null,
      };
    });
  },
  startSubscriptions: (ownerId) => {
    import("@/features/dashboard/hooks/use-personal-data-subscriptions")
      .then((m) => m.startPersonalSubscriptions(ownerId))
      .catch((err) => console.error("Error starting live subscriptions:", err));
  },
};

export const canSubmitPersonalData = (personalStatus: PersonalDataStatus): boolean => {
  return personalStatus === "success";
};

export class PocketFanoutController {
  private activeAccountIds: string[] = [];
  private sessionContext: PersonalAsyncContext | null = null;
  private currentBarrierId = 0;
  private accountStates = new Map<string, { pockets: Pocket[]; isReady: boolean; isFailed: boolean }>();

  reset(activeAccountIds: string[], sessionContext: PersonalAsyncContext): PocketBarrierContext {
    this.activeAccountIds = activeAccountIds;
    this.sessionContext = sessionContext;
    this.currentBarrierId++;
    this.accountStates.clear();
    for (const id of activeAccountIds) {
      this.accountStates.set(id, { pockets: [], isReady: false, isFailed: false });
    }
    return {
      ...sessionContext,
      barrierId: this.currentBarrierId,
    };
  }

  isFailed(): boolean {
    return Array.from(this.accountStates.values()).some((s) => s.isFailed);
  }

  isBarrierActive(barrierContext: PocketBarrierContext): boolean {
    return (
      this.sessionContext !== null &&
      this.sessionContext.ownerId === barrierContext.ownerId &&
      this.sessionContext.generation === barrierContext.generation &&
      this.currentBarrierId === barrierContext.barrierId
    );
  }

  onAccountSnapshot(accountId: string, pockets: Pocket[], barrierContext: PocketBarrierContext): Pocket[] | null {
    if (!this.isBarrierActive(barrierContext)) {
      return null;
    }

    const state = this.accountStates.get(accountId);
    if (!state) return null;

    state.pockets = pockets;
    state.isReady = true;

    if (this.isFailed()) {
      return null;
    }

    const allReady = Array.from(this.accountStates.values()).every((s) => s.isReady);
    if (!allReady) {
      return null;
    }

    const combined: Pocket[] = [];
    for (const id of this.activeAccountIds) {
      const accState = this.accountStates.get(id);
      if (accState) combined.push(...accState.pockets);
    }
    return combined;
  }

  onAccountError(accountId: string, barrierContext: PocketBarrierContext): boolean {
    if (!this.isBarrierActive(barrierContext)) {
      return false;
    }

    const state = this.accountStates.get(accountId);
    if (state) {
      state.isFailed = true;
    }
    return true;
  }
}

export type PersonalDashboardData = {
  accounts: Account[];
  archivedAccounts: Account[];
  pockets: Pocket[];
  categories: Category[];
  transactions: Transaction[];
  allTransactions: Transaction[];
  totalNoPropioPendiente: number;
  hasThirdPartyInconsistency: boolean;
  ingresosRealesMes: number;
  gastosMes: number;
  thirdPartyEntries: ThirdPartyFundEntry[];
  thirdPartyConsumptions: ThirdPartyFundConsumption[];
};

const initialData: PersonalDashboardData = {
  accounts: [],
  archivedAccounts: [],
  pockets: [],
  categories: [],
  transactions: [],
  allTransactions: [],
  totalNoPropioPendiente: 0,
  hasThirdPartyInconsistency: false,
  ingresosRealesMes: 0,
  gastosMes: 0,
  thirdPartyEntries: [],
  thirdPartyConsumptions: [],
};

export const createInitialDatasetState = (): PersonalDatasetState => ({
  status: "idle",
  hasValue: false,
  error: null,
});

export const createInitialDatasets = (): Record<PersonalDatasetKey, PersonalDatasetState> => ({
  accounts: createInitialDatasetState(),
  pockets: createInitialDatasetState(),
  categories: createInitialDatasetState(),
  transactions: createInitialDatasetState(),
  thirdPartyEntries: createInitialDatasetState(),
  thirdPartyConsumptions: createInitialDatasetState(),
});

export const computeOverallStatus = (
  datasets: Record<PersonalDatasetKey, PersonalDatasetState>
): PersonalDataStatus => {
  const keys: PersonalDatasetKey[] = [
    "accounts",
    "pockets",
    "categories",
    "transactions",
    "thirdPartyEntries",
    "thirdPartyConsumptions",
  ];

  const allReady = keys.every((k) => datasets[k].status === "ready");
  if (allReady) {
    return "success";
  }

  if (datasets.accounts.status === "error") {
    return "error";
  }

  const allInitialErrors = keys.every((k) => datasets[k].status === "error");
  if (allInitialErrors) {
    return "error";
  }

  const hasAnyErrorOrStale = keys.some(
    (k) => datasets[k].status === "error" || datasets[k].status === "stale"
  );
  if (hasAnyErrorOrStale) {
    return "partial";
  }

  const hasAnyLoading = keys.some((k) => datasets[k].status === "loading");
  if (hasAnyLoading) {
    return "loading";
  }

  return "idle";
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

export const classifyTransactionsByAccount = (
  transactions: Transaction[],
  allAccounts: Account[],
): { activeTransactions: Transaction[]; orphanedTransactions: Transaction[] } => {
  const allAccountIds = new Set(allAccounts.map((a) => a.id));
  const activeAccountIds = new Set(
    allAccounts.filter((a) => !a.archived).map((a) => a.id),
  );

  const activeTransactions: Transaction[] = [];
  const orphanedTransactions: Transaction[] = [];

  for (const tx of transactions) {
    if (activeAccountIds.has(tx.accountId)) {
      activeTransactions.push(tx);
    } else if (!allAccountIds.has(tx.accountId)) {
      orphanedTransactions.push(tx);
    }
  }

  return { activeTransactions, orphanedTransactions };
};

export const recomputePersonalDerivedFields = (
  data: PersonalDashboardData,
  rawAccounts: Account[]
): PersonalDashboardData => {
  const activeAccounts = rawAccounts.filter((account) => !account.archived);
  const archivedAccounts = rawAccounts.filter((account) => account.archived);

  const activeAccountIds = new Set(activeAccounts.map((a) => a.id));
  const validTransactions = data.transactions.filter((tx) => activeAccountIds.has(tx.accountId));

  const grouped = groupConsumptionsByEntryId(data.thirdPartyConsumptions);
  let hasThirdPartyInconsistency = false;
  let totalNoPropioPendiente = 0;

  for (const entry of data.thirdPartyEntries) {
    const pending = getEntryPendingAmount(entry, grouped);
    if (pending < 0) {
      hasThirdPartyInconsistency = true;
    }
    if (pending > 0) {
      totalNoPropioPendiente += pending;
    }
  }

  const knownEntryIds = new Set(data.thirdPartyEntries.map((entry) => entry.id));
  for (const consumption of data.thirdPartyConsumptions) {
    if (consumption.entryId && !knownEntryIds.has(consumption.entryId)) {
      hasThirdPartyInconsistency = true;
      break;
    }
  }

  const now = new Date();
  const currentMonthTransactions = validTransactions.filter((tx) => {
    const txDate = tx.date ?? tx.createdAt;
    return isSameMonthAndYear(txDate, now);
  });

  const ingresosRealesMes = currentMonthTransactions
    .filter((tx) => tx.type === "income" && tx.countsAsRealIncome !== false)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const gastosMes = computeNetPersonalExpenses(currentMonthTransactions);

  return {
    ...data,
    accounts: activeAccounts,
    archivedAccounts,
    transactions: validTransactions,
    allTransactions: data.transactions,
    totalNoPropioPendiente,
    hasThirdPartyInconsistency,
    ingresosRealesMes,
    gastosMes,
  };
};

export type PersonalDataState = {
  status: PersonalDataStatus;
  data: PersonalDashboardData;
  datasets: Record<PersonalDatasetKey, PersonalDatasetState>;
  error: string | null;
  ownerId: string | null;
  generation: number;
  inFlightContext: PersonalAsyncContext | null;
  inFlightPromise: Promise<void> | null;
  syncMode: "pull" | "live";
  rawAccounts: Account[];

  setSyncMode: (mode: "pull" | "live") => void;
  isContextActive: (context: PersonalAsyncContext) => boolean;
  getAsyncContext: () => PersonalAsyncContext | null;
  setDatasetState: (
    key: PersonalDatasetKey,
    update: Partial<PersonalDatasetState>,
    context: PersonalAsyncContext
  ) => void;
  applyPersonalSnapshot: (
    partial: Partial<PersonalDashboardData>,
    datasetKey: PersonalDatasetKey | undefined,
    context: PersonalAsyncContext
  ) => void;
  reportDatasetError: (
    key: PersonalDatasetKey,
    error: string | Error,
    context: PersonalAsyncContext
  ) => void;
  load: (ownerId: string, options?: { force?: boolean }) => Promise<void>;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
};

export const createPersonalDataStore = (customServices?: Partial<PersonalDataServices>) => {
  const services: PersonalDataServices = {
    ...defaultPersonalDataServices,
    ...customServices,
  };

  return create<PersonalDataState>((set, get) => ({
    status: "idle",
    data: initialData,
    datasets: createInitialDatasets(),
    error: null,
    ownerId: null,
    generation: 0,
    inFlightContext: null,
    inFlightPromise: null,
    syncMode: "pull",
    rawAccounts: [],

    setSyncMode: (mode) => set({ syncMode: mode }),

    isContextActive: (context) => {
      const state = get();
      return (
        state.ownerId !== null &&
        state.ownerId === context.ownerId &&
        state.generation === context.generation
      );
    },

    getAsyncContext: () => {
      const { ownerId, generation } = get();
      if (!ownerId) return null;
      return { ownerId, generation };
    },

    setDatasetState: (key, update, context) => {
      if (!get().isContextActive(context)) {
        return;
      }
      set((state) => {
        const current = state.datasets[key] || createInitialDatasetState();
        const updatedDataset = { ...current, ...update };
        const nextDatasets = {
          ...state.datasets,
          [key]: updatedDataset,
        };
        const nextOverallStatus = computeOverallStatus(nextDatasets);
        return {
          datasets: nextDatasets,
          status: nextOverallStatus,
        };
      });
    },

    applyPersonalSnapshot: (partial, datasetKey, context) => {
      if (!get().isContextActive(context)) {
        return;
      }

      set((state) => {
        let newRawAccounts = state.rawAccounts || [];
        const dataCopy = { ...state.data };
        const nextDatasets = { ...state.datasets };

        if ("accounts" in partial) {
          newRawAccounts = (partial.accounts as Account[]) || [];
          const rest = { ...partial };
          delete rest.accounts;
          Object.assign(dataCopy, rest);
          nextDatasets.accounts = { status: "ready", hasValue: true, error: null };
        } else {
          Object.assign(dataCopy, partial);
        }

        if ("pockets" in partial) {
          nextDatasets.pockets = { status: "ready", hasValue: true, error: null };
        }
        if ("categories" in partial) {
          nextDatasets.categories = { status: "ready", hasValue: true, error: null };
        }
        if ("transactions" in partial) {
          nextDatasets.transactions = { status: "ready", hasValue: true, error: null };
        }
        if ("thirdPartyEntries" in partial) {
          nextDatasets.thirdPartyEntries = { status: "ready", hasValue: true, error: null };
        }
        if ("thirdPartyConsumptions" in partial) {
          nextDatasets.thirdPartyConsumptions = { status: "ready", hasValue: true, error: null };
        }

        if (datasetKey) {
          nextDatasets[datasetKey] = { status: "ready", hasValue: true, error: null };
        }

        const recomputedData = recomputePersonalDerivedFields(dataCopy, newRawAccounts);
        const nextOverallStatus = computeOverallStatus(nextDatasets);

        let nextError = state.error;
        if (nextOverallStatus === "success") {
          nextError = null;
        } else if (nextOverallStatus === "partial") {
          nextError = "Se cargaron datos parciales. Revisa tu conexión o permisos de Firestore.";
        }

        return {
          rawAccounts: newRawAccounts,
          data: recomputedData,
          datasets: nextDatasets,
          status: nextOverallStatus,
          error: nextError,
        };
      });
    },

    reportDatasetError: (key, error, context) => {
      if (!get().isContextActive(context)) {
        return;
      }

      const errMsg = typeof error === "string" ? error : error?.message || "Error al cargar dataset";
      set((state) => {
        const currentDS = state.datasets[key] || createInitialDatasetState();
        const isStale = currentDS.hasValue;
        const nextDS: PersonalDatasetState = {
          status: isStale ? "stale" : "error",
          hasValue: currentDS.hasValue,
          error: errMsg,
        };

        const nextDatasets = {
          ...state.datasets,
          [key]: nextDS,
        };

        const nextOverallStatus = computeOverallStatus(nextDatasets);
        const overallErrorMessage =
          nextOverallStatus === "error"
            ? "No se pudieron cargar tus datos personales."
            : "Se cargaron datos parciales. Intenta reintentar la conexión.";

        return {
          datasets: nextDatasets,
          status: nextOverallStatus,
          error: overallErrorMessage,
        };
      });
    },

    reset: () => {
      subscriptionRegistry.unregister("personal");
      const nextGen = get().generation + 1;
      set({
        status: "idle",
        data: initialData,
        datasets: createInitialDatasets(),
        error: null,
        ownerId: null,
        generation: nextGen,
        inFlightContext: null,
        inFlightPromise: null,
        syncMode: "pull",
        rawAccounts: [],
      });
    },

    refresh: async () => {
      if (get().syncMode === "live") return;
      const ownerId = get().ownerId;
      if (ownerId) {
        await get().load(ownerId, { force: true });
      }
    },

    retry: async () => {
      const ownerId = get().ownerId;
      if (!ownerId) return;

      if (get().inFlightPromise && get().inFlightContext?.ownerId === ownerId) {
        await get().inFlightPromise;
        return;
      }

      subscriptionRegistry.unregister("personal");
      const nextGen = get().generation + 1;
      set({
        syncMode: "pull",
        generation: nextGen,
        inFlightContext: null,
        inFlightPromise: null,
      });
      await get().load(ownerId, { force: true });

      if (get().status === "success" && get().ownerId === ownerId && services.startSubscriptions) {
        services.startSubscriptions(ownerId);
      }
    },

    load: async (ownerId, options) => {
      const force = options?.force ?? false;
      const state = get();

      if (state.ownerId && state.ownerId !== ownerId) {
        get().reset();
      }

      if (!force && get().ownerId === ownerId && get().status === "success") {
        return;
      }

      if (get().inFlightPromise && get().inFlightContext?.ownerId === ownerId) {
        await get().inFlightPromise;
        return;
      }

      const nextGen = get().generation + 1;
      const currentContext: PersonalAsyncContext = { ownerId, generation: nextGen };

      const currentDS = get().datasets;
      const loadingDS = { ...currentDS };
      (Object.keys(loadingDS) as PersonalDatasetKey[]).forEach((k) => {
        loadingDS[k] = {
          ...loadingDS[k],
          status: loadingDS[k].hasValue ? "stale" : "loading",
        };
      });

      set({
        status: "loading",
        error: null,
        ownerId,
        generation: nextGen,
        datasets: loadingDS,
        inFlightContext: currentContext,
      });

      const run = async () => {
        if (process.env.NODE_ENV !== "production") {
          console.debug("[personal-data] loading:start", { ownerId, force, generation: nextGen });
        }

        try {
          const accountsPromise = withTimeout(services.readAccounts(ownerId), 12000, "cuentas");
          const categoriesPromise = withTimeout(services.readCategories(ownerId), 12000, "categorias");
          const transactionsPromise = withTimeout(services.readTransactions(ownerId), 12000, "transacciones");
          const entriesPromise = withTimeout(services.readThirdPartyEntries(ownerId), 12000, "entries");
          const consumptionsPromise = withTimeout(services.readThirdPartyConsumptions(ownerId), 12000, "consumos");

          let accounts: Account[] | null = null;
          let accountsFailed = false;

          try {
            accounts = await accountsPromise;
            if (get().isContextActive(currentContext)) {
              get().applyPersonalSnapshot({ accounts }, "accounts", currentContext);
            }
          } catch (err: unknown) {
            accountsFailed = true;
            if (get().isContextActive(currentContext)) {
              get().reportDatasetError("accounts", err instanceof Error ? err : String(err), currentContext);
              get().reportDatasetError("pockets", "Accounts fetch failed", currentContext);
            }
          }

          const pocketsPromise = !accountsFailed && accounts
            ? withTimeout(services.readPockets(accounts.map((account) => account.id)), 12000, "bolsillos")
            : Promise.reject(new Error("Accounts failed, skipping pockets read"));

          const [pocketsResult, categoriesResult, transactionsResult, entriesResult, consumptionsResult] =
            await Promise.allSettled([
              pocketsPromise,
              categoriesPromise,
              transactionsPromise,
              entriesPromise,
              consumptionsPromise,
            ]);

          if (!get().isContextActive(currentContext)) {
            return;
          }

          if (!accountsFailed && pocketsResult.status === "fulfilled") {
            get().applyPersonalSnapshot({ pockets: pocketsResult.value }, "pockets", currentContext);
          } else if (!accountsFailed && pocketsResult.status === "rejected") {
            get().reportDatasetError("pockets", pocketsResult.reason, currentContext);
          }

          if (categoriesResult.status === "fulfilled") {
            get().applyPersonalSnapshot({ categories: categoriesResult.value }, "categories", currentContext);
            void services.ensureCategorySeed?.(ownerId, categoriesResult.value).catch(() => {});
          } else {
            get().reportDatasetError("categories", categoriesResult.reason, currentContext);
          }

          if (transactionsResult.status === "fulfilled") {
            const { activeTransactions: validTransactions } = classifyTransactionsByAccount(
              transactionsResult.value,
              get().rawAccounts,
            );
            get().applyPersonalSnapshot({ transactions: validTransactions }, "transactions", currentContext);
          } else {
            get().reportDatasetError("transactions", transactionsResult.reason, currentContext);
          }

          if (entriesResult.status === "fulfilled") {
            get().applyPersonalSnapshot({ thirdPartyEntries: entriesResult.value }, "thirdPartyEntries", currentContext);
          } else {
            get().reportDatasetError("thirdPartyEntries", entriesResult.reason, currentContext);
          }

          if (consumptionsResult.status === "fulfilled") {
            get().applyPersonalSnapshot({ thirdPartyConsumptions: consumptionsResult.value }, "thirdPartyConsumptions", currentContext);
          } else {
            get().reportDatasetError("thirdPartyConsumptions", consumptionsResult.reason, currentContext);
          }
        } catch {
          if (!get().isContextActive(currentContext)) {
            return;
          }

          (Object.keys(get().datasets) as PersonalDatasetKey[]).forEach((k) => {
            get().reportDatasetError(k, "No se pudieron cargar tus datos personales de Firestore.", currentContext);
          });
        }
      };

      const promise = run().finally(() => {
        if (get().inFlightPromise === promise) {
          set({ inFlightContext: null, inFlightPromise: null });
        }
      });

      set({ inFlightPromise: promise });
      await promise;
    },
  }));
};

export const usePersonalDataStore = createPersonalDataStore();
