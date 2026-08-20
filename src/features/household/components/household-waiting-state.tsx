"use client";

import { useState } from "react";
import { Copy, Check, RefreshCw, Loader2 } from "lucide-react";

import { HouseholdCard } from "@/features/household/components/ui/household-card";
import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdChip } from "@/features/household/components/ui/household-chip";
import { regenerateHouseholdInvite } from "@/features/household/services/mplus-household-service";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";

type HouseholdWaitingStateProps = {
  householdId?: string;
  currentUid: string;
  householdName: string;
  inviteCode?: string | null;
  inviteCodeExpiresAt?: Date | null;
};

export function HouseholdWaitingState({
  currentUid,
  householdName,
  inviteCode = null,
}: HouseholdWaitingStateProps) {
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const refresh = useMplusHouseholdStore((state) => state.refresh);

  const handleCopy = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Fallo al copiar código", err);
    }
  };

  const household = useMplusHouseholdStore((state) => state.household);

  const handleGenerateCode = async () => {
    if (!household || !currentUid) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const outcome = await regenerateHouseholdInvite({ household, currentUid });
      if (outcome.kind === "success") {
        await refresh();
      } else if (outcome.kind === "rejected") {
        setGenerateError(outcome.message);
      } else {
        setGenerateError("Conflicto al regenerar código. Reintenta.");
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl py-8 space-y-6">
      {/* Tarjeta Principal de Estado */}
      <HouseholdCard variant="hero" title={householdName} subtitle="Hogar registrado correctamente">
        <div className="flex flex-wrap items-center gap-2">
          <HouseholdChip variant="household">1 de 2 miembros</HouseholdChip>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklch,var(--hh-primary-action),transparent_85%)] px-3 py-1 text-xs font-medium text-[var(--hh-primary-action)] border border-[color-mix(in_oklch,var(--hh-primary-action),transparent_80%)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--hh-primary-action)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--hh-primary-action)]"></span>
            </span>
            Esperando al segundo miembro
          </span>
        </div>
      </HouseholdCard>

      {/* Tarjeta de Código de Invitación */}
      <HouseholdCard
        title="Código de Invitación"
        subtitle="Comparte este código con tu familiar para activar las funciones de Hogar"
        variant="elevated"
      >
        <div className="space-y-4 pt-2">
          {inviteCode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-[20px] border border-[var(--hh-border)] bg-[var(--hh-surface)] p-4">
                <div className="min-w-0">
                  <span className="text-xs text-[var(--hh-text-secondary)] uppercase tracking-wider block font-semibold">
                    Código de acceso
                  </span>
                  <span className="font-mono text-3xl font-bold text-[var(--hh-primary-action)] tracking-widest select-all">
                    {inviteCode}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <HouseholdButton
                  type="button"
                  tone="filled"
                  onClick={handleCopy}
                  className="flex-1 bg-[var(--hh-primary-action)] text-[var(--hh-text)] hover:bg-[color-mix(in_oklch,var(--hh-primary-action),white_8%)] min-h-11 cursor-pointer rounded-[16px] text-sm font-semibold"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copiado al portapapeles
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar código
                    </>
                  )}
                </HouseholdButton>

                <HouseholdButton
                  type="button"
                  tone="outlined"
                  variant="outline"
                  onClick={handleGenerateCode}
                  disabled={isGenerating}
                  className="min-h-11 px-4 cursor-pointer rounded-[16px] border-[var(--hh-border)] hover:bg-[var(--hh-surface-elevated)]"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerar
                    </>
                  )}
                </HouseholdButton>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-center py-4">
              <p className="text-sm text-[var(--hh-text-muted)]">
                No hay un código de invitación activo en este momento.
              </p>
              <HouseholdButton
                type="button"
                tone="filled"
                onClick={handleGenerateCode}
                disabled={isGenerating}
                className="bg-[var(--hh-primary-action)] text-[var(--hh-text)] min-h-11 px-6 rounded-[16px] font-semibold"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generar código de invitación
                  </>
                )}
              </HouseholdButton>
            </div>
          )}

          {generateError && (
            <p className="text-xs text-[var(--hh-destructive-border)]" role="alert">
              {generateError}
            </p>
          )}

          <div className="rounded-[16px] border border-[var(--hh-border)]/[0.06] bg-[var(--hh-surface)] p-4 text-xs text-[var(--hh-text-secondary)] space-y-1">
            <p className="font-medium text-[var(--hh-text)]">¿Qué sucederá después?</p>
            <p>En cuanto tu familiar ingrese este código desde su aplicación, ambos tendrán acceso inmediato al panel compartido y los gastos divididos.</p>
          </div>
        </div>
      </HouseholdCard>
    </div>
  );
}
