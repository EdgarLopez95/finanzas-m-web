import { useEffect, useMemo } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";
import { useAppContextStore } from "@/stores/app-context-store";
import { formatPeriodSummary } from "@/lib/format/date";
import type { HouseholdDebt, HouseholdIncomeEntry } from "@/types/household";
import {
  filterActiveMonthlyEvents,
  filterActiveMonthlyIncomeEntries,
  calculateMonthlyExpenseTotal,
  calculateMonthlyIncomeTotal,
  calculateMonthlyBalance,
  groupCategoryBreakdown,
  groupMemberResponsibilities,
  groupEventResponsibilities,
  selectEachPaysOwnEventIdsWithPendingShares,
} from "../lib/household-view-model";
import type { CategoryBreakdownItem, MemberResponsibility, EventResponsibility } from "../lib/household-view-model";
import { selectActiveHouseholdDebts } from "../lib/household-debt-lifecycle";
import { startHouseholdSessionSubscriptions } from "./use-household-session-subscriptions";
import { subscriptionRegistry } from "@/lib/firestore/subscription-registry";

export type { CategoryBreakdownItem, MemberResponsibility, EventResponsibility };

/**
 * Driver único de la carga de Hogar. Debe montarse en UN solo lugar (el shell).
 * Las páginas solo LEEN con `useHouseholdData()`.
 */
export const useHouseholdLoader = (uid: string | null, enabled: boolean) => {
  const load = useHouseholdDataStore((state) => state.load);
  const reset = useHouseholdDataStore((state) => state.reset);

  useEffect(() => {
    if (!uid || !enabled) {
      reset();
      return;
    }

    void load(uid).then(() => {
      const currentStore = useHouseholdDataStore.getState();
      if (currentStore.uid === uid && currentStore.status !== "error") {
        startHouseholdSessionSubscriptions(uid);
      }
    });

    return () => {
      subscriptionRegistry.unregister("household");
    };
  }, [enabled, load, reset, uid]);
};

/**
 * Lectura pura de la vista de Hogar desde el store global, persistente entre
 * navegaciones, con el resumen mensual memoizado y filtrado por selectedPeriod.
 */
export const useHouseholdData = () => {
  const status = useHouseholdDataStore((state) => state.status);
  const data = useHouseholdDataStore((state) => state.data);
  const error = useHouseholdDataStore((state) => state.error);
  const currentUid = useHouseholdDataStore((state) => state.uid);
  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);

  const summary = useMemo(() => {
    const monthlyEvents = filterActiveMonthlyEvents(data.events, selectedPeriod);
    const monthlyIncomeEntries = filterActiveMonthlyIncomeEntries(data.incomeEntries, selectedPeriod);

    const monthlyExpenseTotal = calculateMonthlyExpenseTotal(monthlyEvents);
    const monthlyIncomeTotal = calculateMonthlyIncomeTotal(monthlyIncomeEntries);
    const monthlyBalance = calculateMonthlyBalance(monthlyIncomeTotal, monthlyExpenseTotal);

    const categoryBreakdown = groupCategoryBreakdown(monthlyEvents, data.categories);

    // Recent events from all time, sorted by eventDate desc
    const recentEvents = [...data.events]
      .sort((a, b) => {
        const aTime = (a.eventDate ?? a.createdAt)?.getTime() ?? 0;
        const bTime = (b.eventDate ?? b.createdAt)?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, 8);

    // Recent income entries for this period, sorted by entryDate desc
    const recentIncomeEntries: HouseholdIncomeEntry[] = [...monthlyIncomeEntries]
      .sort((a, b) => {
        const aTime = (a.entryDate ?? a.createdAt)?.getTime() ?? 0;
        const bTime = (b.entryDate ?? b.createdAt)?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, 5);

    // Paridad Android: "Estado de aportes" de Home Hogar solo existe cuando
    // hay un aporte pendiente real — eachPaysOwn con al menos una share activa
    // pending_completion. advancedByPayer/invitation quedan excluidos siempre,
    // y un eachPaysOwn con todas las shares completadas deja de aparecer.
    const eachPaysOwnEventIdsWithPendingShares = selectEachPaysOwnEventIdsWithPendingShares(
      monthlyEvents,
      data.eventShares
    );
    const memberResponsibilities = groupMemberResponsibilities(
      data.eventShares,
      eachPaysOwnEventIdsWithPendingShares,
      currentUid
    );
    const eventResponsibilities = groupEventResponsibilities(
      data.eventShares,
      eachPaysOwnEventIdsWithPendingShares,
      data.events,
      data.categories
    ).slice(0, 3);

    // Debts scoped to current user: fromUserId == uid (I owe) or toUserId == uid (they owe me).
    // Solo deudas ACTIVAS (pending/payment_declared): paid y canceladas no
    // pertenecen a estos buckets (ver isActiveHouseholdDebtStatus).
    const debtsOwed: HouseholdDebt[] = currentUid
      ? selectActiveHouseholdDebts(data.debts.filter((d) => d.fromUserId === currentUid))
      : [];
    const debtsReceivable: HouseholdDebt[] = currentUid
      ? selectActiveHouseholdDebts(data.debts.filter((d) => d.toUserId === currentUid))
      : [];

    return {
      monthlyExpenseTotal,
      monthlyIncomeTotal,
      monthlyBalance,
      recentEvents,
      recentIncomeEntries,
      categoryBreakdown,
      memberResponsibilities,
      eventResponsibilities,
      debtsOwed,
      debtsReceivable,
      currentUid,
      memberProfiles: data.memberProfiles,
      memberCount: data.household?.memberCount ?? 0,
      periodLabel: formatPeriodSummary(selectedPeriod),
    };
  }, [
    currentUid,
    data.categories,
    data.debts,
    data.eventShares,
    data.events,
    data.household,
    data.incomeEntries,
    data.memberProfiles,
    selectedPeriod,
  ]);

  return {
    status,
    data,
    error,
    summary,
  };
};
