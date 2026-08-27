"use client";

import { useState } from "react";

import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { SettingsLayout } from "@/components/layout/settings-layout";
import {
  SettingsOrganizationCard,
  SettingsFooter,
} from "@/components/finance/settings-blocks";
import { useAuthStore } from "@/stores/auth-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";
import { MplusHouseholdLifecycleCard } from "./mplus-household-lifecycle-card";
import { MplusResetConfirmDialog } from "./mplus-reset-confirm-dialog";
import { QaDiagnosticsCard } from "@/features/qa-reset";

/**
 * Puerta de las herramientas de QA, escrita INLINE y a nivel de módulo a
 * propósito.
 *
 * Next.js sustituye `process.env.NODE_ENV` y las `NEXT_PUBLIC_*` por literales
 * antes de minificar, así que en una compilación de producción sin bandera esto
 * es literalmente `false || undefined === "1"`: el minificador lo pliega a
 * `false`, elimina las ramas y deja de arrastrar el panel y el diálogo.
 *
 * NO puede reemplazarse por una llamada a una función de otro módulo (como
 * una función de `@/lib/qa/qa-tools`): comprobado contra el bundle real, esa forma NO se
 * pliega y los textos del panel y del reinicio terminaban publicados. La misma
 * decisión, ya en forma pura y probable, vive en `@/lib/qa/qa-tools`.
 */
const QA_TOOLS_ENABLED =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_MPLUS_QA_TOOLS === "1";

export type MplusSettingsViewProps = {
  userName?: string | null;
  userEmail?: string | null;
  userPhotoURL?: string | null;
  onLogout: () => void;
};

export function MplusSettingsView({
  userName,
  userEmail,
  userPhotoURL,
  onLogout,
}: MplusSettingsViewProps) {
  const currentUid = useAuthStore((state) => state.user?.uid ?? "");
  const userProfile = useMplusPersonalStore((state) => state.profile);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const hasHousehold = Boolean(userProfile?.householdId);


  const unifiedHero = (
    <section className="rounded-[var(--fm-radius-card-medium)] border border-white/8 bg-[rgba(18,25,39,0.96)] px-6 py-6 sm:px-8 sm:py-7">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-stretch lg:gap-10">
        {/* Cuenta personal de Google */}
        <div className="flex min-w-0 items-center gap-5 lg:self-center">
          <ProfileAvatar
            name={userName}
            photoURL={userPhotoURL}
            size="xl"
            decorative
            className="bg-[linear-gradient(180deg,rgba(85,104,138,0.92),rgba(41,53,80,0.92))] font-[var(--font-display)] text-[var(--fm-warm-paper)] ring-1 ring-white/10"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--fm-text-soft)]">
              Tu cuenta
            </p>
            <p className="mt-1 truncate font-[var(--font-display)] text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[var(--fm-warm-paper)]">
              {userName || "Usuario"}
            </p>
            <p className="mt-0.5 truncate text-sm text-[var(--fm-text-muted)]">
              {userEmail || "Cargando perfil..."}
            </p>
            <p className="mt-3 text-xs text-[var(--fm-text-muted)]">
              Moneda · <span className="font-semibold text-[var(--fm-warm-paper)]">COP</span>
            </p>
          </div>
        </div>

        {/* Hogar M+: Card unificada de ciclo de vida (DEC-073...080) */}
        <div className="min-w-0 border-t border-white/6 pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <MplusHouseholdLifecycleCard
            currentUid={currentUid}
            userName={userName}
            userPhotoURL={userPhotoURL}
          />
        </div>
      </div>
    </section>
  );

  return (
    <>
      <SettingsLayout
        profileBlock={unifiedHero}
        organizationBlock={<SettingsOrganizationCard />}
        qaBlock={QA_TOOLS_ENABLED ? <QaDiagnosticsCard /> : null}
        footerBlock={
          <SettingsFooter
            onOpenReset={() => setIsResetDialogOpen(true)}
            onLogout={onLogout}
          />
        }
      />
      {currentUid && (
        <MplusResetConfirmDialog
          open={isResetDialogOpen}
          onClose={() => setIsResetDialogOpen(false)}
          uid={currentUid}
          hasHousehold={hasHousehold}
        />
      )}
    </>
  );
}
