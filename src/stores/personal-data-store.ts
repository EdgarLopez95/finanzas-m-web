import { create } from "zustand";
import { collection, getDocs, query, where } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { groupConsumptionsByEntryId, getEntryPendingAmount } from "@/lib/finance/third-party-funds";
import { calculateAccountTotalBalance } from "@/lib/finance/accounts";
import { isSameMonthAndYear } from "@/lib/format/date";
import { readPersonalAccounts } from "@/features/accounts/services/read-personal-accounts";
import { readPersonalCategories } from "@/features/categories/services/read-personal-categories";
import { readAccountPockets } from "@/features/pockets/services/read-account-pockets";
import { readAllPersonalTransactions } from "@/features/transactions/services/read-personal-transactions";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";
import type { Pocket } from "@/types/pocket";
import type { Transaction } from "@/types/transaction";
import type { ThirdPartyFundConsumption, ThirdPartyFundEntry, ThirdPartyFundEntryStatus } from "@/types/third-party-funds";

export type PersonalDashboardData = {
  accounts: Account[];
  pockets: Pocket[];
  categories: Category[];
  transactions: Transaction[];
  totalNoPropioPendiente: number;
  hasThirdPartyInconsistency: boolean;
  ingresosRealesMes: number;
  gastosMes: number;
};

export type PersonalDataStatus = "idle" | "loading" | "success" | "error";

const initialData: PersonalDashboardData = {
  accounts: [],
  pockets: [],
  categories: [],
  transactions: [],
  totalNoPropioPendiente: 0,
  hasThirdPartyInconsistency: false,
  ingresosRealesMes: 0,
  gastosMes: 0,
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

type PersonalDataState = {
  status: PersonalDataStatus;
  data: PersonalDashboardData;
  error: string | null;
  /** Dueño cuyos datos están cargados/en curso. Permite servir cache entre navegaciones. */
  ownerId: string | null;
  /** Carga en vuelo, para deduplicar peticiones concurrentes. */
  inFlight: Promise<void> | null;
  /**
   * Carga los datos personales. Si ya hay datos exitosos del mismo dueño y no se
   * fuerza, no vuelve a pegarle a Firestore (este es el fix de "recarga en cada
   * cambio de sección"). force=true se usa tras crear/editar/borrar movimientos.
   */
  load: (ownerId: string, options?: { force?: boolean }) => Promise<void>;
  /** Recarga forzada del dueño actual (tras crear/editar/borrar movimientos). */
  refresh: () => Promise<void>;
  reset: () => void;
};

export const usePersonalDataStore = create<PersonalDataState>((set, get) => ({
  status: "idle",
  data: initialData,
  error: null,
  ownerId: null,
  inFlight: null,

  reset: () => {
    set({ status: "idle", data: initialData, error: null, ownerId: null, inFlight: null });
  },

  refresh: async () => {
    const ownerId = get().ownerId;
    if (ownerId) {
      await get().load(ownerId, { force: true });
    }
  },

  load: async (ownerId, options) => {
    const force = options?.force ?? false;
    const state = get();

    // Cache hit: mismos datos ya cargados con éxito y sin forzar -> instantáneo.
    if (!force && state.ownerId === ownerId && state.status === "success") {
      return;
    }

    // Deduplicación: si ya hay una carga en curso para el mismo dueño, reusarla.
    if (!force && state.inFlight && state.ownerId === ownerId) {
      return state.inFlight;
    }

    const run = async () => {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[personal-data] loading:start", { ownerId, force });
      }

      set({ status: "loading", error: null, ownerId });

      try {
        const db = getFirebaseDb();

        // Las consultas independientes del listado de cuentas se lanzan en
        // paralelo desde el inicio (sin esperar a accounts). Solo los bolsillos
        // dependen de los IDs de cuenta, así que se resuelven en una segunda ola.
        const accountsPromise = withTimeout(readPersonalAccounts(ownerId), 12000, "cuentas");
        const categoriesPromise = withTimeout(readPersonalCategories(ownerId), 12000, "categorias");
        const transactionsPromise = withTimeout(readAllPersonalTransactions(ownerId), 12000, "transacciones");
        const entriesPromise = withTimeout(
          getDocs(
            query(
              collection(db, "third_party_fund_entries"),
              where("ownerId", "==", ownerId),
              where("status", "in", ["open", "consumed"]),
            ),
          ),
          12000,
          "entries",
        );
        const consumptionsPromise = withTimeout(
          getDocs(query(collection(db, "third_party_fund_consumptions"), where("ownerId", "==", ownerId))),
          12000,
          "consumos",
        );

        const accounts = await accountsPromise;
        const pocketsPromise = withTimeout(
          readAccountPockets(accounts.map((account) => account.id)),
          12000,
          "bolsillos",
        );

        const [pocketsResult, categoriesResult, transactionsResult, entriesResult, consumptionsResult] =
          await Promise.allSettled([
            pocketsPromise,
            categoriesPromise,
            transactionsPromise,
            entriesPromise,
            consumptionsPromise,
          ]);

        const pockets = pocketsResult.status === "fulfilled" ? pocketsResult.value : [];
        const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
        const transactions = transactionsResult.status === "fulfilled" ? transactionsResult.value : [];

        // Calcular saldos totales de cuentas sumando bolsillos
        const accountsWithPockets = accounts.map((account) => {
          const accountPockets = pockets.filter((p) => p.accountId === account.id);
          const totalBalance = calculateAccountTotalBalance(account.balance, accountPockets);
          return {
            ...account,
            balance: totalBalance,
          };
        });

        // Parsear entries y consumos
        const entriesDocs = entriesResult.status === "fulfilled" ? entriesResult.value.docs : [];
        const consumptionsDocs = consumptionsResult.status === "fulfilled" ? consumptionsResult.value.docs : [];

        const entries: ThirdPartyFundEntry[] = entriesDocs.map((docItem) => {
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

        const consumptions: ThirdPartyFundConsumption[] = consumptionsDocs.map((docItem) => {
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

        const grouped = groupConsumptionsByEntryId(consumptions);
        let hasThirdPartyInconsistency = false;
        let totalNoPropioPendiente = 0;

        for (const entry of entries) {
          const pending = getEntryPendingAmount(entry, grouped);
          if (pending < 0) {
            hasThirdPartyInconsistency = true;
          }
          if (pending > 0) {
            totalNoPropioPendiente += pending;
          }
        }

        // Consumos huerfanos: apuntan a una entry cancelada o inexistente (no esta
        // en el set open/consumed). Es dinero no propio ya gastado que dejaria de
        // contarse silenciosamente; lo marcamos como inconsistencia para revisarlo.
        const knownEntryIds = new Set(entries.map((entry) => entry.id));
        for (const consumption of consumptions) {
          if (consumption.entryId && !knownEntryIds.has(consumption.entryId)) {
            hasThirdPartyInconsistency = true;
            break;
          }
        }

        // Calcular ingresos y gastos del mes en curso
        const now = new Date();
        const currentMonthTransactions = transactions.filter((tx) => {
          const txDate = tx.date ?? tx.createdAt;
          return isSameMonthAndYear(txDate, now);
        });

        const ingresosRealesMes = currentMonthTransactions
          .filter((tx) => tx.type === "income" && tx.countsAsRealIncome !== false)
          .reduce((sum, tx) => sum + tx.amount, 0);

        const gastosMes = currentMonthTransactions
          .filter((tx) => tx.type === "expense")
          .reduce((sum, tx) => sum + tx.amount, 0);

        const hasPartialFailures =
          pocketsResult.status === "rejected" ||
          categoriesResult.status === "rejected" ||
          transactionsResult.status === "rejected" ||
          entriesResult.status === "rejected" ||
          consumptionsResult.status === "rejected";

        // Si otra carga (de otro dueño) arrancó mientras esperábamos, descartamos
        // este resultado para no pisar datos más recientes.
        if (get().ownerId !== ownerId) {
          return;
        }

        set({
          status: "success",
          error: hasPartialFailures
            ? "Se cargaron datos parciales. Revisa reglas/permisos de Firestore."
            : null,
          ownerId,
          data: {
            accounts: accountsWithPockets,
            pockets,
            categories,
            transactions,
            totalNoPropioPendiente,
            hasThirdPartyInconsistency,
            ingresosRealesMes,
            gastosMes,
          },
        });

        if (process.env.NODE_ENV !== "production") {
          console.debug("[personal-data] loading:success", {
            accounts: accounts.length,
            pockets: pockets.length,
            categories: categories.length,
            transactions: transactions.length,
            totalNoPropioPendiente,
            hasThirdPartyInconsistency,
            hasPartialFailures,
          });
        }
      } catch {
        if (get().ownerId !== ownerId) {
          return;
        }

        if (process.env.NODE_ENV !== "production") {
          console.debug("[personal-data] loading:error", { ownerId });
        }

        set({
          status: "error",
          error: "No se pudieron cargar tus datos personales de Firestore.",
          ownerId,
          data: initialData,
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
