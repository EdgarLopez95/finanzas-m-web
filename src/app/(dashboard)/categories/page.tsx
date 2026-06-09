"use client";

import { CategoriesView } from "@/features/dashboard/components/personal-views";
import { usePersonalDashboardData } from "@/features/dashboard/hooks/use-personal-dashboard-data";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

export default function CategoriesPage() {
  const personalData = usePersonalDashboardData();
  const masked = useUiPreferencesStore((state) => state.balancesHidden);

  return <CategoriesView data={personalData.data} masked={masked} />;
}
