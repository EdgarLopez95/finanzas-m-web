"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdCard } from "@/features/household/components/ui/household-card";
import { useClearActiveHousehold } from "@/features/household/hooks/use-clear-active-household";

type HouseholdDissolvedStateProps = {
  currentUid: string;
  householdName?: string;
};

export function HouseholdDissolvedState({ currentUid, householdName }: HouseholdDissolvedStateProps) {
  const router = useRouter();
  const { isSubmitting, error, submit } = useClearActiveHousehold();

  const handleExit = async () => {
    const success = await submit(currentUid);
    if (success) {
      router.push("/dashboard");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <HouseholdCard
        title="Hogar Disuelto"
        subtitle={householdName ? `El espacio "${householdName}" ya no está activo` : "Este espacio ya no está activo"}
        className="border-[var(--hh-destructive-border)] bg-[var(--hh-surface-elevated)] backdrop-blur-md shadow-[0_16px_36px_var(--hh-destructive-border)]"
      >
        <div className="mt-4 space-y-6">
          <div className="flex justify-center py-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--hh-destructive-content),transparent_90%)] text-[var(--hh-destructive-content)]">
              <AlertTriangle className="h-8 w-8" />
            </div>
          </div>

          <p className="text-center text-sm leading-relaxed text-muted-foreground">
            El dueño o los miembros de este Hogar compartido lo han disuelto. Los gastos y deudas compartidos ya no se pueden modificar.
          </p>

          <p className="text-center text-xs text-[var(--hh-text-muted)]">
            Al salir, tu perfil personal se desvinculará de este hogar y podrás crear uno nuevo o unirte a otro.
          </p>

          {error && (
            <p className="text-center text-xs font-medium text-[var(--hh-destructive-content)]">
              {error}
            </p>
          )}

          <HouseholdButton
            type="button"
            tone="filled"
            onClick={handleExit}
            className="w-full bg-[var(--hh-destructive-border)] text-[var(--hh-text)] hover:bg-[color-mix(in_oklch,var(--hh-destructive-border),white_8%)]"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Desvinculando...
              </>
            ) : (
              "Volver a Inicio (Personal)"
            )}
          </HouseholdButton>
        </div>
      </HouseholdCard>
    </div>
  );
}
