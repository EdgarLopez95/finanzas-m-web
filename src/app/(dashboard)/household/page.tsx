"use client";


import { HouseholdEmptyState } from "@/features/household/components/ui/household-empty-state";
import { HouseholdShimmer } from "@/features/household/components/ui/household-shimmer";
import { HouseholdOverview } from "@/features/household/components/household-overview";
import { WelcomeHousehold } from "@/features/household/components/welcome-household";
import { HouseholdDissolvedState } from "@/features/household/components/household-dissolved-state";
import { HouseholdWaitingState } from "@/features/household/components/household-waiting-state";
import { useHouseholdData } from "@/features/household/hooks/use-household-data";
import { resolveHouseholdViewMode } from "@/features/household/lib/household-view-model";

export default function HouseholdPage() {
  const household = useHouseholdData();

  const viewMode = resolveHouseholdViewMode({
    status: household.status,
    household: household.data.household,
    error: household.error,
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
    return (
      <WelcomeHousehold currentUid={household.summary.currentUid ?? ""} />
    );
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

  return (
    <>
      {household.error && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between rounded-2xl bg-[color-mix(in_oklch,var(--hh-destructive-border),transparent_85%)] p-4 text-xs font-medium text-[var(--hh-text)] border border-[color-mix(in_oklch,var(--hh-destructive-border),transparent_70%)]"
        >
          <span>{household.error}</span>
        </div>
      )}



      <HouseholdOverview
        allDebts={household.data.debts}
        allEventShares={household.data.eventShares}
        categories={household.data.categories}
        categoryBreakdown={household.summary.categoryBreakdown}
        currentUid={household.summary.currentUid}
        memberProfiles={household.summary.memberProfiles}
        monthlyExpenseTotal={household.summary.monthlyExpenseTotal}
        monthlyIncomeTotal={household.summary.monthlyIncomeTotal}
        periodLabel={household.summary.periodLabel}
        allEvents={household.data.events}
        recentIncomeEntries={household.summary.recentIncomeEntries}
        householdId={household.data.activeHouseholdId ?? ""}
        inviteCode={household.data.household.inviteCode}
        inviteCodeExpiresAt={household.data.household.inviteCodeExpiresAt}
        memberIds={household.data.household.memberIds}
      />
    </>
  );
}
