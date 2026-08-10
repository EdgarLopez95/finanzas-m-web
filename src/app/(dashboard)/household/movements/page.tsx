"use client";

import { useState } from 'react';
import { HouseholdEventDetailDialog } from '@/features/household/components/household-event-detail-dialog';
import { HouseholdEmptyState } from "@/features/household/components/ui/household-empty-state";
import { HouseholdShimmer } from "@/features/household/components/ui/household-shimmer";
import { WelcomeHousehold } from "@/features/household/components/welcome-household";
import { HouseholdDissolvedState } from "@/features/household/components/household-dissolved-state";
import { HouseholdWaitingState } from "@/features/household/components/household-waiting-state";
import { useHouseholdData } from "@/features/household/hooks/use-household-data";
import { resolveHouseholdViewMode } from "@/features/household/lib/household-view-model";
import { canOpenHouseholdAction } from "@/lib/navigation/app-context";
import { HouseholdMovementsView } from "@/features/household/components/views/household-movements-view";

export default function HouseholdMovementsPage() {
  const household = useHouseholdData();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = household.data.events.find(e => e.id === selectedEventId);

  const viewMode = resolveHouseholdViewMode({
    status: household.status,
    household: household.data.household,
    error: household.error,
  });

  const householdActionsEnabled = canOpenHouseholdAction({
    context: "household",
    hasActiveHousehold: Boolean(household.data.activeHouseholdId && household.data.household),
    householdViewMode: viewMode,
  });

  if (viewMode === "loading") {
    return (
      <div className="space-y-4">
        <HouseholdShimmer className="h-40 w-full rounded-[32px]" />
        <HouseholdShimmer className="h-64 w-full rounded-[32px]" />
      </div>
    );
  }

  if (viewMode === "error") {
    return (
      <HouseholdEmptyState
        description={household.error ?? "Intenta recargar esta vista."}
        title="Error al cargar Hogar"
      />
    );
  }

  if (viewMode === "empty") {
    return <WelcomeHousehold currentUid={household.summary.currentUid ?? ""} />;
  }

  if (viewMode === "dissolved") {
    return (
      <HouseholdDissolvedState
        currentUid={household.summary.currentUid ?? ""}
        householdName={household.data.household?.name}
      />
    );
  }

  if (viewMode === "not_found" || !household.data.household) {
    return (
      <HouseholdEmptyState
        description="Tu usuario no tiene un hogar activo disponible en este momento."
        title="No se encontró el hogar"
      />
    );
  }

  if (viewMode === "waiting_for_members") {
    return (
      <HouseholdWaitingState
        householdId={household.data.activeHouseholdId ?? ""}
        currentUid={household.summary.currentUid ?? ""}
        householdName={household.data.household.name}
        inviteCode={household.data.household.inviteCode}
        inviteCodeExpiresAt={household.data.household.inviteCodeExpiresAt}
      />
    );
  }

  if (!householdActionsEnabled) {
    return null;
  }

  return (
    <div className="fade-in">
      <HouseholdMovementsView
        events={household.data.events}
        incomeEntries={household.data.incomeEntries}
        categories={household.data.categories}
        onSelectEvent={(event) => setSelectedEventId(event.id)}
      />
      <HouseholdEventDetailDialog
        open={!!selectedEvent}
        onClose={() => setSelectedEventId(null)}
        event={selectedEvent || null}
        categories={household.data.categories}
        eventShares={household.data.eventShares}
        debts={household.data.debts}
        currentUid={household.summary.currentUid ?? ""}
        memberProfiles={household.summary.memberProfiles}
      />
    </div>
  );
}
