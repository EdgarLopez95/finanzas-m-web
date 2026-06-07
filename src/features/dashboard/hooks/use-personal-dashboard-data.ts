import { useEffect, useMemo, useState } from "react";

import { readPersonalAccounts } from "@/features/accounts/services/read-personal-accounts";
import { readPersonalCategories } from "@/features/categories/services/read-personal-categories";
import { readAccountPockets } from "@/features/pockets/services/read-account-pockets";
import { readPersonalTransactions } from "@/features/transactions/services/read-personal-transactions";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";
import type { Pocket } from "@/types/pocket";
import type { Transaction } from "@/types/transaction";

type PersonalDashboardData = {
  accounts: Account[];
  pockets: Pocket[];
  categories: Category[];
  transactions: Transaction[];
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
        const [pocketsResult, categoriesResult, transactionsResult] = await Promise.allSettled([
          withTimeout(readAccountPockets(accounts.map((account) => account.id)), 12000, "bolsillos"),
          withTimeout(readPersonalCategories(ownerId), 12000, "categorias"),
          withTimeout(readPersonalTransactions(ownerId), 12000, "transacciones"),
        ]);

        const pockets = pocketsResult.status === "fulfilled" ? pocketsResult.value : [];
        const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
        const transactions = transactionsResult.status === "fulfilled" ? transactionsResult.value : [];
        const hasPartialFailures =
          pocketsResult.status === "rejected" ||
          categoriesResult.status === "rejected" ||
          transactionsResult.status === "rejected";

        if (cancelled) {
          return;
        }

        setState({
          status: "success",
          error: hasPartialFailures ? "Se cargaron datos parciales. Revisa reglas/permisos de Firestore." : null,
          data: { accounts, pockets, categories, transactions },
        });

        if (process.env.NODE_ENV !== "production") {
          console.debug("[dashboard-data] loading:success", {
            accounts: accounts.length,
            pockets: pockets.length,
            categories: categories.length,
            transactions: transactions.length,
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

  return {
    ...state,
    totalBalance,
    refresh,
  };
};
