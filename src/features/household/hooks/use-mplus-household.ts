"use client";

import { useEffect } from "react";

import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";
import { useAppContextStore } from "@/stores/app-context-store";

/**
 * Driver de carga y sincronización de Hogar M+.
 *
 * Se monta en el DashboardShell y se actualiza cuando:
 * 1. Cambia el período seleccionado en `useAppContextStore`.
 * 2. Cambia el `householdId` del perfil M+.
 */
export function useMplusHouseholdLoader(authenticated: boolean): void {
  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);
  const householdId = useMplusPersonalStore((state) => state.profile?.householdId ?? null);
  const load = useMplusHouseholdStore((state) => state.load);
  const reset = useMplusHouseholdStore((state) => state.reset);

  useEffect(() => {
    if (!authenticated) {
      reset();
      return;
    }
    const period = { year: selectedPeriod.year, month: selectedPeriod.month };
    void load(householdId, period);
  }, [authenticated, householdId, selectedPeriod.year, selectedPeriod.month, load, reset]);
}
