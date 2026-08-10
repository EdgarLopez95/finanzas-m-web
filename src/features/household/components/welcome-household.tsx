"use client";

import { useState } from "react";
import { Home, KeyRound, Loader2 } from "lucide-react";

import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdCard } from "@/features/household/components/ui/household-card";import { HouseholdTextField } from "@/features/household/components/ui/household-text-field";
import { useCreateHousehold } from "@/features/household/hooks/use-create-household";
import { useJoinHousehold } from "@/features/household/hooks/use-join-household";

type WelcomeHouseholdProps = {
  currentUid: string;
};

export function WelcomeHousehold({ currentUid }: WelcomeHouseholdProps) {
  // Estado para Crear Hogar
  const [householdName, setHouseholdName] = useState("");
  const {
    isSubmitting: isCreating,
    error: createError,
    submit: submitCreate,
    resetError: resetCreateError,
  } = useCreateHousehold();

  // Estado para Unirse a Hogar
  const [inviteCode, setInviteCode] = useState("");
  const {
    isSubmitting: isJoining,
    error: joinError,
    submit: submitJoin,
    resetError: resetJoinError,
  } = useJoinHousehold();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdName.trim()) return;
    resetCreateError();
    await submitCreate({
      name: householdName,
      uid: currentUid,
    });
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    resetJoinError();
    await submitJoin({
      inviteCode,
      uid: currentUid,
    });
  };

  // Normalizar el input de código en tiempo real
  const handleInviteCodeChange = (val: string) => {
    const normalized = val.trim().replace(/\s+/g, "").toUpperCase().slice(0, 8);
    setInviteCode(normalized);
  };

  const anyLoading = isCreating || isJoining;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-[28px] font-bold text-[var(--hh-text)]">
          Bienvenido a Hogar Compartido
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sincroniza y gestiona de forma segura los gastos y deudas de tu hogar con otro miembro.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Card 1: Crear mi Hogar */}
        <HouseholdCard
          title="Crear mi Hogar"
          subtitle="Comienza un nuevo espacio para tu casa"
          className="border-[var(--hh-border-soft)] bg-[var(--hh-surface-elevated)]"
        >
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <div className="flex justify-center py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--hh-border-soft)] text-[var(--hh-primary-action)]">
                <Home className="h-6 w-6" />
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Crea un hogar y serás el dueño administrador. Luego podrás invitar a otra persona.
            </p>

            <HouseholdTextField
              id="householdName"
              label="Nombre del Hogar"
              placeholder="Ej. Hogar Pérez"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              disabled={anyLoading}
              errorText={createError || undefined}
              required
            />

            <HouseholdButton
              type="submit"
              tone="filled"
              className="w-full bg-[var(--hh-primary-action)] text-[var(--hh-text)] hover:bg-[color-mix(in_oklch,var(--hh-primary-action),white_8%)]"
              disabled={anyLoading || !householdName.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear Hogar"
              )}
            </HouseholdButton>
          </form>
        </HouseholdCard>

        {/* Card 2: Unirme con código */}
        <HouseholdCard
          title="Unirme con código"
          subtitle="Ingresa la invitación de tu familiar"
          className="border-[var(--hh-border-soft)] bg-[var(--hh-surface-elevated)]"
        >
          <form onSubmit={handleJoin} className="mt-4 space-y-4">
            <div className="flex justify-center py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--hh-border-soft)] text-[var(--hh-border-strong)]">
                <KeyRound className="h-6 w-6" />
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Ingresa el código de 8 caracteres que te compartió el dueño del Hogar.
            </p>

            <HouseholdTextField
              id="inviteCode"
              label="Código de Invitación"
              placeholder="Ej. WF8B9K3X"
              value={inviteCode}
              onChange={(e) => handleInviteCodeChange(e.target.value)}
              disabled={anyLoading}
              errorText={joinError || undefined}
              maxLength={8}
              autoComplete="off"
              className="text-center font-mono tracking-widest text-[16px]"
              required
            />

            <HouseholdButton
              type="submit"
              tone="filled"
              className="w-full bg-[var(--hh-border-strong)] hover:bg-[color-mix(in_oklch,var(--hh-border-strong),white_8%)]"
              disabled={anyLoading || inviteCode.trim().length !== 8}
            >
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uniéndome...
                </>
              ) : (
                "Unirme al Hogar"
              )}
            </HouseholdButton>
          </form>
        </HouseholdCard>
      </div>
    </div>
  );
}
