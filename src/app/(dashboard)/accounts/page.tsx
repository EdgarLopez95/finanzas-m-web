"use client";

import { AccountsView } from "@/features/dashboard/components/personal-views";
import { usePersonalDashboardData } from "@/features/dashboard/hooks/use-personal-dashboard-data";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

export default function AccountsPage() {
  const personalData = usePersonalDashboardData();
  const masked = useUiPreferencesStore((state) => state.balancesHidden);

  return <AccountsView data={personalData.data} masked={masked} />;
}
