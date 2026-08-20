"use client";

import { useAuthStore } from "@/stores/auth-store";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";
import { HouseholdEmptyState } from "@/features/household/components/ui/household-empty-state";
import { HouseholdShimmer } from "@/features/household/components/ui/household-shimmer";
import { MplusHouseholdSettingsView } from "@/features/household/components/mplus-household-settings-view";
import { HouseholdWaitingState } from "@/features/household/components/household-waiting-state";

export default function HouseholdSettingsPage() {
  const currentUid = useAuthStore((state) => state.user?.uid ?? "");
  const userProfile = useMplusPersonalStore((state) => state.profile);
  const status = useMplusHouseholdStore((state) => state.status);
  const error = useMplusHouseholdStore((state) => state.error);
  const household = useMplusHouseholdStore((state) => state.household);
  const members = useMplusHouseholdStore((state) => state.members);
  const categories = useMplusHouseholdStore((state) => state.categories);

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
        title="Error al cargar Ajustes de Hogar"
      />
    );
  }

  if (!userProfile?.householdId || !household) {
    return (
      <HouseholdEmptyState
        description="Tu usuario no tiene un hogar activo en este momento."
        title="Sin hogar activo"
      />
    );
  }

  if (household.status === "waiting") {
    return (
      <HouseholdWaitingState
        currentUid={currentUid}
        householdId={household.id}
        householdName={household.name ?? "Hogar"}
        inviteCode={household.activeInviteId}
        inviteCodeExpiresAt={null}
      />
    );
  }

  return (
    <MplusHouseholdSettingsView
      categories={categories}
      currentUid={currentUid}
      household={household}
      members={members}
    />
  );
}
