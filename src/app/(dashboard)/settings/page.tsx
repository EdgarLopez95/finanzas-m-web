"use client";

import { useRouter } from "next/navigation";

import { SettingsView } from "@/features/dashboard/components/personal-views";
import { signOutUser } from "@/features/auth/auth-service";
import { useAuthStore } from "@/stores/auth-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

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
    />
  );
}
