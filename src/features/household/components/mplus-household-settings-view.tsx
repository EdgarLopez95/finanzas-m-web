"use client";

import { ChevronRight, Home, Info, Tags, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import { HouseholdCard } from "@/features/household/components/ui/household-card";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { formatDateEs } from "@/lib/format/date";
import type {
  MplusHousehold,
  MplusHouseholdExpenseCategory,
  MplusHouseholdMember,
} from "@/lib/mplus/models";

type Props = {
  household: MplusHousehold;
  members: MplusHouseholdMember[];
  categories: MplusHouseholdExpenseCategory[];
  currentUid: string;
};

export function MplusHouseholdSettingsView({
  household,
  members,
  categories,
  currentUid,
}: Props) {
  const router = useRouter();

  const activeCategoriesCount = categories.filter((c) => c.state === "active").length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Tarjeta de Información del Hogar */}
      <HouseholdCard className="space-y-6 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--hh-border-soft)] pb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--hh-sage-accent)]/20 text-[var(--hh-primary-action)] ring-1 ring-[var(--hh-border)]">
              <Home className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--hh-text-muted)]">
                Espacio compartido
              </p>
              <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--hh-text)]">
                {household.name || "Hogar compartido"}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--hh-text-secondary)]">
                Creado el {formatDateEs(new Date(household.createdAtMillis))} · Estado activo
              </p>
            </div>
          </div>
        </div>

        {/* Integrantes del Hogar */}
        <div>
          <h3 className="mb-3 font-[var(--font-display)] text-sm font-bold text-[var(--hh-text)] flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--hh-primary-action)]" /> Integrantes ({members.length} de 2)
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {members.map((member) => {
              const isSelf = member.userId === currentUid;
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3.5 rounded-2xl border border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] p-4"
                >
                  <ProfileAvatar
                    className="h-11 w-11 bg-[var(--hh-primary)] text-[var(--hh-text)]"
                    name={member.displayName}
                    photoURL={member.photoUrl}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--hh-text)]">
                      {member.displayName} {isSelf ? "(Tú)" : ""}
                    </p>
                    <p className="text-xs text-[var(--hh-text-muted)]">
                      {member.state === "active" ? "Miembro activo" : "En pausa"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Acceso a Categorías de Hogar */}
        <div className="border-t border-[var(--hh-border-soft)] pt-5">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] p-4 text-left transition-colors hover:bg-[var(--hh-surface-elevated)]"
            onClick={() => router.push("/household/categories")}
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--hh-sage-accent)]/15 text-[var(--hh-primary-action)]">
                <Tags className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--hh-text)]">
                  Categorías de gasto del hogar
                </p>
                <p className="text-xs text-[var(--hh-text-muted)]">
                  {activeCategoriesCount} categorías activas en el catálogo compartido
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[var(--hh-text-muted)]" />
          </button>
        </div>
      </HouseholdCard>

      {/* Nota informativa de gobernanza (DEC-078) */}
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--hh-border)] bg-[var(--hh-surface)] p-4 text-xs text-[var(--hh-text-secondary)]">
        <Info className="h-5 w-5 shrink-0 text-[var(--hh-primary-action)]" />
        <p>
          Para renombrar el hogar, gestionar invitaciones, pausar o desvincular tu cuenta, ve a{" "}
          <button
            type="button"
            className="font-semibold text-[var(--hh-primary-action)] underline hover:text-[var(--hh-text)]"
            onClick={() => router.push("/settings")}
          >
            Ajustes de tu cuenta Personal
          </button>
          .
        </p>
      </div>
    </div>
  );
}
