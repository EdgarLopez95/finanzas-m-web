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
      setState({ status: "idle", data: initialData, error: null });
      return;
    }

    let cancelled = false;

    const load = async () => {
      setState((prev) => ({ ...prev, status: "loading", error: null }));

      try {
        const accounts = await readPersonalAccounts(ownerId);
        const [pockets, categories, transactions] = await Promise.all([
          readAccountPockets(accounts.map((account) => account.id)),
          readPersonalCategories(ownerId),
          readPersonalTransactions(ownerId),
        ]);

        if (cancelled) {
          return;
        }

        setState({
          status: "success",
          error: null,
          data: { accounts, pockets, categories, transactions },
        });
      } catch {
        if (cancelled) {
          return;
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