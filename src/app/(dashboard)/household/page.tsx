"use client";

import { useAuthStore } from "@/stores/auth-store";
import { useAppContextStore } from "@/stores/app-context-store";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";
import { formatPeriodLabel } from "@/lib/format/date";
import { HouseholdEmptyState } from "@/features/household/components/ui/household-empty-state";
import { HouseholdShimmer } from "@/features/household/components/ui/household-shimmer";
import { MplusHouseholdOverview } from "@/features/household/components/mplus-household-overview";
import { HouseholdWaitingState } from "@/features/household/components/household-waiting-state";

export default function HouseholdPage() {
  const currentUid = useAuthStore((state) => state.user?.uid ?? "");
  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);
  const periodLabel = `${formatPeriodLabel(selectedPeriod)} ${selectedPeriod.year}`;

  const userProfile = useMplusPersonalStore((state) => state.profile);
  const status = useMplusHouseholdStore((state) => state.status);
  const error = useMplusHouseholdStore((state) => state.error);
  const household = useMplusHouseholdStore((state) => state.household);
  const members = useMplusHouseholdStore((state) => state.members);
  const categories = useMplusHouseholdStore((state) => state.categories);
  const categoryLabels = useMplusHouseholdStore((state) => state.categoryLabels);
  const movements = useMplusHouseholdStore((state) => state.movements);

  if (status === "loading" && !household) {
    return (
      <div className="space-y-4">
        <HouseholdShimmer className="h-40 w-full rounded-[32px]" />
        <HouseholdShimmer className="h-64 w-full rounded-[32px]" />
      </div>
    );
  }

  if (status === "error" && !household) {
    return (
      <HouseholdEmptyState
        description={error ?? "Intenta recargar esta vista."}
        title="Error al cargar Hogar"
      />
    );
  }

  if (!userProfile?.householdId || !household) {
    return (
      <HouseholdEmptyState
        description="Tu usuario no tiene un hogar activo en este momento. Puedes crear o unirte a uno desde Ajustes de tu cuenta Personal."
        title="Sin hogar todavía"
      />
    );
  }

  if (household.status === "waiting") {
    return (
      <HouseholdWaitingState
        currentUid={currentUid}
        householdId={household.id}
        householdName={household.name ?? "Hogar compartido"}
        inviteCode={household.activeInviteId}
        inviteCodeExpiresAt={null}
      />
    );
  }

  return (
    <MplusHouseholdOverview
      categories={categories}
      categoryLabels={categoryLabels}
      currentUid={currentUid}
      household={household}
      members={members}
      movements={movements}
      periodLabel={periodLabel}
    />
  );
}
