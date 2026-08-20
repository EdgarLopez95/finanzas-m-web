"use client";

import { useRouter } from "next/navigation";

import { MplusSettingsView } from "@/features/settings/components/mplus-settings-view";
import { signOutUser } from "@/features/auth/auth-service";
import { useAuthStore } from "@/stores/auth-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";
import { resetAllStoresForSessionBoundary } from "@/stores/session-boundary";

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
    // Corrección P1.1 Paso 10 + W1: nada de la sesión anterior puede sobrevivir
    // al logout — ni datos Personales/Hogar, ni contexto, ni bootstrap resuelto,
    // ni superficies efímeras. `resetAllStoresForSessionBoundary` es el único
    // punto que ordena esa limpieza, el mismo que usa `useAuthBootstrap` cuando
    // Firebase Auth reporta un cambio real de uid.
    resetAllStoresForSessionBoundary();
    router.replace("/");
  };

  return (
    <MplusSettingsView
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
