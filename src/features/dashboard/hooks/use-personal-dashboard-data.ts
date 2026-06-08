import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase/client";
import { groupConsumptionsByEntryId, getEntryPendingAmount } from "@/lib/finance/third-party-funds";
import { readPersonalAccounts } from "@/features/accounts/services/read-personal-accounts";
import { readPersonalCategories } from "@/features/categories/services/read-personal-categories";
import { readAccountPockets } from "@/features/pockets/services/read-account-pockets";
import { readAllPersonalTransactions } from "@/features/transactions/services/read-personal-transactions";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";
import type { Pocket } from "@/types/pocket";
import type { Transaction } from "@/types/transaction";
import type { ThirdPartyFundConsumption, ThirdPartyFundEntry, ThirdPartyFundEntryStatus } from "@/types/third-party-funds";

type PersonalDashboardData = {
  accounts: Account[];
  pockets: Pocket[];
  categories: Category[];
  transactions: Transaction[];
  totalNoPropioPendiente: number;
  hasThirdPartyInconsistency: boolean;
  ingresosRealesMes: number;
  gastosMes: number;
};

type PersonalDashboardState = {
  status: "idle" | "loading" | "success" | "error";
  data: PersonalDashboardData;
  error: string | null;
};

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

export const usePersonalDashboardData = (ownerId: string | null, enabled: boolean) => {
  const [state, setState] = useState<PersonalDashboardState>({
    status: "idle",
    data: initialData,
    error: null,
  });
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = async () => {
    setReloadKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (!ownerId || !enabled) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[dashboard-data] idle", { ownerId, enabled });
      }
      setState({ status: "idle", data: initialData, error: null });
      return;
    }

    let cancelled = false;

    const load = async () => {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[dashboard-data] loading:start", { ownerId });
      }
      setState((prev) => ({ ...prev, status: "loading", error: null }));

      try {
        const accounts = await withTimeout(readPersonalAccounts(ownerId), 12000, "cuentas");
        const db = getFirebaseDb();
        const [pocketsResult, categoriesResult, transactionsResult, entriesResult, consumptionsResult] = await Promise.allSettled([
          withTimeout(readAccountPockets(accounts.map((account) => account.id)), 12000, "bolsillos"),
          withTimeout(readPersonalCategories(ownerId), 12000, "categorias"),
          withTimeout(readAllPersonalTransactions(ownerId), 12000, "transacciones"),
          withTimeout(getDocs(query(collection(db, "third_party_fund_entries"), where("ownerId", "==", ownerId), where("status", "in", ["open", "consumed"]))), 12000, "entries"),
          withTimeout(getDocs(query(collection(db, "third_party_fund_consumptions"), where("ownerId", "==", ownerId))), 12000, "consumos"),
        ]);

        const pockets = pocketsResult.status === "fulfilled" ? pocketsResult.value : [];
        const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
        const transactions = transactionsResult.status === "fulfilled" ? transactionsResult.value : [];

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
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const currentMonthTransactions = transactions.filter((tx) => {
          const txDate = tx.date ?? tx.createdAt;
          return txDate && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
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

        if (cancelled) {
          return;
        }

        setState({
          status: "success",
          error: hasPartialFailures ? "Se cargaron datos parciales. Revisa reglas/permisos de Firestore." : null,
          data: {
            accounts,
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
          console.debug("[dashboard-data] loading:success", {
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
        if (cancelled) {
          return;
        }

        if (process.env.NODE_ENV !== "production") {
          console.debug("[dashboard-data] loading:error", { ownerId });
        }

        setState({
          status: "error",
          error: "No se pudieron cargar tus datos personales de Firestore.",
          data: initialData,
        });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, ownerId, reloadKey]);

  const totalBalance = useMemo(
    () => state.data.accounts.reduce((sum, account) => sum + account.balance, 0),
    [state.data.accounts]
  );

  const totalNoPropioPendiente = state.data.totalNoPropioPendiente;
  const hasThirdPartyInconsistency = state.data.hasThirdPartyInconsistency;

  const dineroPropio = useMemo(
    () => totalBalance - totalNoPropioPendiente,
    [totalBalance, totalNoPropioPendiente]
  );

  return {
    ...state,
    totalBalance,
    totalNoPropioPendiente,
    hasThirdPartyInconsistency,
    dineroPropio,
    refresh,
  };
};
