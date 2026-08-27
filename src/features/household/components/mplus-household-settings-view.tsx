"use client";

import React from "react";
import { Bell, ChevronRight, Coins, Lock, LogOut, PauseCircle, Shield, Tags, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import { HouseholdCard } from "@/features/household/components/ui/household-card";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { cn } from "@/lib/utils";
import type {
  MplusHousehold,
  MplusHouseholdExpenseCategory,
  MplusHouseholdMember,
} from "@/lib/mplus/models";

export type HouseholdSettingItemProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function HouseholdSettingItem({
  icon,
  title,
  description,
  badge,
  onClick,
  disabled = false,
}: HouseholdSettingItemProps) {
  const isClickable = Boolean(onClick) && !disabled;
  const TagEl = isClickable ? "button" : "div";

  return (
    <TagEl
      type={isClickable ? "button" : undefined}
      onClick={isClickable ? onClick : undefined}
      className={cn(
        "w-full text-left flex items-center justify-between p-4 rounded-[20px] border transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)] min-h-[44px]",
        isClickable
          ? "border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] hover:bg-[var(--hh-surface-elevated)] active:bg-[var(--hh-surface-subtle)] cursor-pointer"
          : "border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] opacity-85 cursor-default",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--hh-sage-accent)]/15 text-[var(--hh-primary-action)]"
        >
          {icon}
        </div>
        <div className="min-w-0 text-left">
          <p className="font-semibold text-sm truncate text-[var(--hh-text)]">
            {title}
          </p>
          <p className="text-xs truncate text-[var(--hh-text-muted)]">
            {description}
          </p>
        </div>
      </div>

      {badge ? (
        <div className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider select-none shrink-0 border border-[var(--hh-border)] bg-[var(--hh-surface-elevated)] text-[var(--hh-text-secondary)]">
          {badge}
        </div>
      ) : (
        isClickable && (
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--hh-text-muted)] opacity-70" />
        )
      )}
    </TagEl>
  );
}

export type MplusHouseholdSettingsViewProps = {
  household: MplusHousehold;
  members: MplusHouseholdMember[];
  categories: MplusHouseholdExpenseCategory[];
  currentUid: string;
  userName?: string | null;
  userEmail?: string | null;
  userPhotoURL?: string | null;
};

export function MplusHouseholdSettingsView({
  household,
  members,
  categories,
  currentUid,
  userName,
  userEmail,
  userPhotoURL,
}: MplusHouseholdSettingsViewProps) {
  const router = useRouter();

  const activeCategoriesCount = categories.filter((c) => c.state === "active").length;

  return (
    <div className="w-full space-y-6">
      {/* 1. Hero unificado superior: Tu cuenta + Hogar compartido */}
      <section className="rounded-[20px] border border-[var(--hh-border)] bg-[var(--hh-surface)] px-6 py-6 sm:px-8 sm:py-7">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-stretch lg:gap-10">
          {/* Columna Izquierda: Tu cuenta */}
          <div className="flex min-w-0 items-center gap-5 lg:self-center">
            <ProfileAvatar
              name={userName}
              photoURL={userPhotoURL}
              size="xl"
              decorative
              className="bg-[var(--hh-primary)] font-[var(--font-display)] text-[var(--hh-text)] ring-1 ring-[var(--hh-border)]"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--hh-text-muted)]">
                Tu cuenta
              </p>
              <p className="mt-1 truncate font-[var(--font-display)] text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[var(--hh-text)]">
                {userName || "Usuario"}
              </p>
              <p className="mt-0.5 truncate text-sm text-[var(--hh-text-muted)]">
                {userEmail || "Cargando perfil..."}
              </p>
              <p className="mt-3 text-xs text-[var(--hh-text-muted)]">
                Moneda · <span className="font-semibold text-[var(--hh-text)]">COP</span>
              </p>
            </div>
          </div>

          {/* Columna Derecha: Hogar compartido */}
          <div className="min-w-0 border-t border-[var(--hh-border-soft)] pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--hh-text-muted)]">
                  Hogar compartido
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="font-[var(--font-display)] text-xl font-semibold text-[var(--hh-text)]">
                    {household.name || "Hogar compartido"}
                  </h3>
                </div>
              </div>
            </div>

            {/* Integrantes en lista vertical */}
            <div className="space-y-2">
              {members.map((member) => {
                const isSelf = member.userId === currentUid;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--hh-border-soft)] bg-[var(--hh-surface-subtle)] p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ProfileAvatar
                        className="bg-[var(--hh-primary)] text-[var(--hh-text)] shrink-0"
                        name={member.displayName}
                        photoURL={member.photoUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--hh-text)]">
                          {member.displayName} {isSelf ? "(Tú)" : ""}
                        </p>
                        <p className="text-xs text-[var(--hh-text-muted)]">
                          {member.state === "active" ? "Miembro activo" : "En pausa"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Acciones de salida/pausa coordinadas con Personal */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-[var(--hh-border-soft)]">
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--hh-text-muted)] hover:bg-white/5 hover:text-[var(--hh-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
              >
                <PauseCircle className="h-4 w-4" />
                Salir (pausa)
              </button>
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--hh-destructive-content)] hover:bg-[var(--hh-destructive-border)]/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
              >
                <LogOut className="h-4 w-4" />
                Salirme del todo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Grid de Ajustes: Preferencias + Organización */}
      <div className="grid items-stretch gap-6 md:grid-cols-2">
        {/* Preferencias de Hogar */}
        <HouseholdCard
          className="h-full"
          contentClassName="p-6"
          title="Preferencias"
          subtitle="Configuración y reglas de tu espacio compartido"
          variant="default"
        >
          <div className="space-y-3">
            <HouseholdSettingItem
              icon={<Lock className="h-5 w-5" />}
              title="Privacidad y modo incógnito"
              description="La protección de saldos es global y se gestiona en Personal."
              onClick={() => router.push("/settings")}
            />
            <HouseholdSettingItem
              icon={<Bell className="h-5 w-5" />}
              title="Notificaciones de gastos"
              description="Avisos compartidos disponibles en la aplicación móvil."
              badge="Móvil"
            />
            <HouseholdSettingItem
              icon={<Coins className="h-5 w-5" />}
              title="Moneda del hogar"
              description="Registro en Pesos colombianos (COP) para todos los miembros."
            />
          </div>
        </HouseholdCard>

        {/* Organización del Hogar */}
        <HouseholdCard
          className="h-full"
          contentClassName="p-6"
          title="Organización"
          subtitle="Estructura, catálogo y gobernanza del hogar"
          variant="default"
        >
          <div className="space-y-3">
            <HouseholdSettingItem
              icon={<Tags className="h-5 w-5" />}
              title="Categorías de gasto del hogar"
              description={`${activeCategoriesCount} categorías activas en el catálogo compartido.`}
              onClick={() => router.push("/household/categories")}
            />
            <HouseholdSettingItem
              icon={<Users className="h-5 w-5" />}
              title="Integrantes e invitaciones"
              description={`${members.length} de 2 miembros. Invita a tu pareja desde Ajustes Personal.`}
              onClick={() => router.push("/settings")}
            />
            <HouseholdSettingItem
              icon={<Shield className="h-5 w-5" />}
              title="Administrar el hogar"
              description="Renombrar, pausar o desvincular tu cuenta en Ajustes Personal."
              onClick={() => router.push("/settings")}
            />
          </div>
        </HouseholdCard>
      </div>
    </div>
  );
}
