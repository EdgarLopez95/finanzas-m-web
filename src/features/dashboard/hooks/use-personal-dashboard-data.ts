import { useEffect, useMemo } from "react";

import {
  usePersonalDataStore,
  type PersonalDashboardData,
  type PersonalDataStatus,
} from "@/stores/personal-data-store";
import { useAppContextStore } from "@/stores/app-context-store";
import { getLocalDate } from "@/lib/format/date";
import { groupConsumptionsByEntryId, getEntryPendingAmount } from "@/lib/finance/third-party-funds";
import { computeGrossBalance } from "@/lib/finance/accounts";
import { calculateAccountPhysicalBalances } from "@/lib/finance/account-balance-model";
import { startPersonalSubscriptions } from "./use-personal-data-subscriptions";
import { subscriptionRegistry } from "@/lib/firestore/subscription-registry";

export type { PersonalDashboardData } from "@/stores/personal-data-store";

export type PersonalDashboardState = {
  status: PersonalDataStatus;
  data: PersonalDashboardData;
  error: string | null;
};

/**
 * Driver único de la carga de datos personales. Debe montarse en UN solo lugar
 * (el shell del dashboard) para evitar que varios componentes disparen load/reset
 * en conflicto. Las páginas solo LEEN con `usePersonalDashboardData()`.
 */
export const usePersonalDataLoader = (ownerId: string | null, enabled: boolean) => {
  const load = usePersonalDataStore((state) => state.load);
  const reset = usePersonalDataStore((state) => state.reset);

  useEffect(() => {
    if (!ownerId || !enabled) {
      reset();
      return;
    }

    void load(ownerId).then(() => {
      const currentStore = usePersonalDataStore.getState();
      if (currentStore.status === "success" && currentStore.ownerId === ownerId) {
        startPersonalSubscriptions(ownerId);
      }
    });

    return () => {
      subscriptionRegistry.unregister("personal");
    };
  }, [enabled, load, ownerId, reset]);
};

/**
 * Lectura pura (sin efectos) de los datos personales desde el store global, más
 * los derivados memoizados y reconstruidos históricamente según el período seleccionado.
 * Persiste entre navegaciones; no vuelve a consultar Firestore en cada cambio de sección.
 * `refresh()` fuerza una recarga.
 */
export const usePersonalDashboardData = () => {
  const status = usePersonalDataStore((state) => state.status);
  const data = usePersonalDataStore((state) => state.data);
  const error = usePersonalDataStore((state) => state.error);
  const refresh = usePersonalDataStore((state) => state.refresh);
  const retry = usePersonalDataStore((state) => state.retry);

  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);

  const reconstructed = useMemo(() => {
    if (status !== "success" || !data) {
      return {
        accounts: data.accounts || [],
        pockets: data.pockets || [],
        totalBalance: 0,
        totalNoPropioPendiente: 0,
        hasThirdPartyInconsistency: false,
        dineroPropio: 0,
      };
    }

    const startOfNextMonth = new Date(selectedPeriod.year, selectedPeriod.month + 1, 1, 0, 0, 0, 0);

    // 1. Filtrar transacciones futuras (posteriores al mes seleccionado)
    const futureTransactions = data.transactions.filter((tx) => {
      const txDate = tx.date ?? tx.createdAt;
      if (!txDate) return false;
      return getLocalDate(txDate).getTime() >= startOfNextMonth.getTime();
    });

    // 2. Copiar saldos actuales en mapas
    const pocketBalances = new Map<string, number>();
    for (const pocket of data.pockets) {
      pocketBalances.set(pocket.id, pocket.balance);
    }

    // Paso 1 (cierre): `account.balance` ya es el Disponible crudo (el store
    // nunca lo sobrescribe con el Total) — la línea base histórica es
    // directamente ese valor, sin restarle los bolsillos (eso sería
    // descontarlos una segunda vez).
    const accountAvailableBalances = new Map<string, number>();
    for (const account of data.accounts) {
      accountAvailableBalances.set(account.id, account.balance);
    }

    // 3. Reversar el impacto de transacciones futuras
    const sortedFutureTxs = [...futureTransactions].sort((a, b) => {
      const aDate = a.date ?? a.createdAt;
      const bDate = b.date ?? b.createdAt;
      return (bDate?.getTime() ?? 0) - (aDate?.getTime() ?? 0);
    });

    for (const tx of sortedFutureTxs) {
      const amount = tx.amount;
      if (tx.type === "income") {
        if (tx.pocketId) {
          pocketBalances.set(tx.pocketId, (pocketBalances.get(tx.pocketId) ?? 0) - amount);
        } else {
          accountAvailableBalances.set(tx.accountId, (accountAvailableBalances.get(tx.accountId) ?? 0) - amount);
        }
      } else if (tx.type === "expense") {
        if (tx.pocketId) {
          pocketBalances.set(tx.pocketId, (pocketBalances.get(tx.pocketId) ?? 0) + amount);
        } else {
          accountAvailableBalances.set(tx.accountId, (accountAvailableBalances.get(tx.accountId) ?? 0) + amount);
        }
      } else if (tx.type === "transfer") {
        if (tx.pocketId) {
          pocketBalances.set(tx.pocketId, (pocketBalances.get(tx.pocketId) ?? 0) + amount);
        } else {
          accountAvailableBalances.set(tx.accountId, (accountAvailableBalances.get(tx.accountId) ?? 0) + amount);
        }
        if (tx.targetPocketId) {
          pocketBalances.set(tx.targetPocketId, (pocketBalances.get(tx.targetPocketId) ?? 0) - amount);
        } else if (tx.targetAccountId) {
          accountAvailableBalances.set(tx.targetAccountId, (accountAvailableBalances.get(tx.targetAccountId) ?? 0) - amount);
        }
      }
    }

    // 4. Construir bolsillos y cuentas históricos.
    // Paso 1 (cierre): `historicalAccounts[i].balance` sigue siendo
    // Disponible (histórico), NUNCA Total — igual que la cuenta "actual" del
    // store, nunca se reenriquece aquí. Cualquier pantalla que necesite el
    // Total de ese período debe derivarlo con
    // `calculateAccountPhysicalBalances(account.balance, susBolsillos)`.
    const historicalPockets = data.pockets.map((p) => ({
      ...p,
      balance: pocketBalances.get(p.id) ?? 0,
    }));

    const historicalAccounts = data.accounts.map((acc) => ({
      ...acc,
      balance: accountAvailableBalances.get(acc.id) ?? 0,
    }));

    // WPP-012 — respetar includeInTotal=false: igual que Android excluye esas cuentas del bruto.
    // Paso 1 (cierre final): `computeGrossBalance` ya NO recibe `Account[]` —
    // nunca se vuelve a construir aquí un `Account` enriquecido cuyo campo
    // `balance` termine significando el Total (eso reabriría exactamente la
    // ambigüedad que este cierre elimina). Se le pasan entradas explícitas y
    // tipadas (`GrossBalanceEntry`) con el Total físico ya derivado del
    // núcleo puro.
    const grossBalanceEntries = historicalAccounts.map((acc) => {
      const accPockets = historicalPockets.filter((p) => p.accountId === acc.id);
      const { totalBalance } = calculateAccountPhysicalBalances(acc.balance, accPockets);
      return { includeInTotal: acc.includeInTotal !== false, totalBalance };
    });
    const totalBalance = computeGrossBalance(grossBalanceEntries);

    // 5. Reconstruir dinero no propio históricamente
    const txMap = new Map(data.transactions.map((tx) => [tx.id, tx]));
    const isFutureTxIdOrDate = (txId: string | null | undefined, fallbackDate: Date | null | undefined): boolean => {
      const tx = txId ? txMap.get(txId) : null;
      const date = tx ? (tx.date ?? tx.createdAt) : fallbackDate;
      if (!date) return false;
      return getLocalDate(date).getTime() >= startOfNextMonth.getTime();
    };

    const historicalEntries = (data.thirdPartyEntries ?? []).filter((entry) => {
      return !isFutureTxIdOrDate(entry.sourceIncomeTransactionId, entry.createdAt);
    });

    const historicalConsumptions = (data.thirdPartyConsumptions ?? []).filter((con) => {
      return !isFutureTxIdOrDate(con.consumerExpenseTransactionId, con.createdAt);
    });

    const grouped = groupConsumptionsByEntryId(historicalConsumptions);
    let hasThirdPartyInconsistency = false;
    let totalNoPropioPendiente = 0;

    for (const entry of historicalEntries) {
      const pending = getEntryPendingAmount(entry, grouped);
      if (pending < 0) {
        hasThirdPartyInconsistency = true;
      }
      if (pending > 0) {
        totalNoPropioPendiente += pending;
      }
    }

    const knownEntryIds = new Set(historicalEntries.map((entry) => entry.id));
    for (const con of historicalConsumptions) {
      if (con.entryId && !knownEntryIds.has(con.entryId)) {
        hasThirdPartyInconsistency = true;
        break;
      }
    }

    const dineroPropio = totalBalance - totalNoPropioPendiente;

    return {
      pockets: historicalPockets,
      accounts: historicalAccounts,
      totalBalance,
      totalNoPropioPendiente,
      hasThirdPartyInconsistency,
      dineroPropio,
    };
  }, [data, status, selectedPeriod]);

  const finalData = useMemo(() => {
    return {
      ...data,
      accounts: reconstructed.accounts,
      pockets: reconstructed.pockets,
    };
  }, [data, reconstructed.accounts, reconstructed.pockets]);

  return {
    status,
    data: finalData,
    error,
    totalBalance: reconstructed.totalBalance,
    totalNoPropioPendiente: reconstructed.totalNoPropioPendiente,
    hasThirdPartyInconsistency: reconstructed.hasThirdPartyInconsistency,
    dineroPropio: reconstructed.dineroPropio,
    refresh,
    retry,
  };
};

