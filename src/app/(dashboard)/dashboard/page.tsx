"use client";

import { MplusHomeView } from "@/features/movements/components/personal-home-view";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

export default function DashboardPage() {
  const masked = useUiPreferencesStore((state) => state.balancesHidden);

  return <MplusHomeView masked={masked} />;
}
