"use client";

import { MplusMovementsView } from "@/features/movements/components/movements-view";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

export default function MovementsPage() {
  const masked = useUiPreferencesStore((state) => state.balancesHidden);

  return <MplusMovementsView masked={masked} />;
}
