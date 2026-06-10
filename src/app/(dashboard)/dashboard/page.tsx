"use client";

import { HomeView } from "@/features/dashboard/components/personal-views";
import { usePersonalDashboardData } from "@/features/dashboard/hooks/use-personal-dashboard-data";
import { useHouseholdData } from "@/features/household/hooks/use-household-data";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

export default function DashboardPage() {
  const personalData = usePersonalDashboardData();
  const household = useHouseholdData();
  const masked = useUiPreferencesStore((state) => state.balancesHidden);

  return (
    <HomeView
      data={personalData.data}
      dineroPropio={personalData.dineroPropio}
      householdDebts={household.status === "success" ? household.data.debts : []}
      householdName={household.status === "success" ? household.data.household?.name : null}
      masked={masked}
      totalBalance={personalData.totalBalance}
      totalNoPropioPendiente={personalData.totalNoPropioPendiente}
    />
  );
}
