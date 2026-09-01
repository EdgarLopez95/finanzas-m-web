"use client";

import { useRouter } from "next/navigation";

import { MplusSettingsView } from "@/features/settings/components/mplus-settings-view";
import { completeResetSessionExit } from "@/features/auth/session-exit";
import { useAuthStore } from "@/stores/auth-store";

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const handleLogout = async () => {
    await completeResetSessionExit({ navigate: (href) => router.replace(href) });
  };

  return (
    <MplusSettingsView
      onLogout={handleLogout}
      userEmail={user?.email}
      userName={user?.displayName}
      userPhotoURL={user?.photoUrl}
    />
  );
}
