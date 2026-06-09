"use client";

import { MovementsView } from "@/features/dashboard/components/personal-views";
import { usePersonalDashboardData } from "@/features/dashboard/hooks/use-personal-dashboard-data";
import { useTransactionPanelStore } from "@/stores/transaction-panel-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

export default function MovementsPage() {
  const personalData = usePersonalDashboardData();
  const masked = useUiPreferencesStore((state) => state.balancesHidden);
  const openEdit = useTransactionPanelStore((state) => state.openEdit);
  const openDelete = useTransactionPanelStore((state) => state.openDelete);

  return (
    <MovementsView
      data={personalData.data}
      masked={masked}
      onDeleteMovement={openDelete}
      onEditMovement={openEdit}
    />
  );
}
