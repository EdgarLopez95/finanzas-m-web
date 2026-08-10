"use client";

import { useRouter } from "next/navigation";

import { SettingsView } from "@/features/dashboard/components/personal-views";
import { signOutUser } from "@/features/auth/auth-service";
import { useAuthStore } from "@/stores/auth-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";
import { usePersonalDataStore } from "@/stores/personal-data-store";
import { useHouseholdDataStore } from "@/stores/household-data-store";
import { useAppContextStore } from "@/stores/app-context-store";

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  const masked = useUiPreferencesStore((state) => state.balancesHidden);
  const notificationsEnabled = useUiPreferencesStore((state) => state.notificationsEnabled);
  const toggleMasked = useUiPreferencesStore((state) => state.toggleBalancesHidden);
  const toggleNotifications = useUiPreferencesStore((state) => state.toggleNotifications);

  const handleLogout = async () => {
    await signOutUser();
    clearSession();
    usePersonalDataStore.getState().reset();
    useHouseholdDataStore.getState().reset();
    // Corrección P1.1 Paso 10: ningún contexto Personal/Hogar ni el bootstrap
    // ya resuelto pueden sobrevivir al logout — evita que un segundo usuario
    // en la misma pestaña herede el contexto Hogar del anterior.
    useAppContextStore.getState().resetForSessionBoundary();
    router.replace("/");
  };

  return (
    <SettingsView
      masked={masked}
      notificationsEnabled={notificationsEnabled}
      onLogout={handleLogout}
      onToggleMasked={toggleMasked}
      onToggleNotifications={toggleNotifications}
      userEmail={user?.email}
      userName={user?.displayName}
      userPhotoURL={user?.photoUrl}
    />
  );
}
