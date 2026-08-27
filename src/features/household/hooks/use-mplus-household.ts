"use client";

import { useEffect, useRef } from "react";

import { ensureHouseholdExpenseSeed } from "@/features/household/services/mplus-household-categories-service";
import { reconcileOrphanHouseholdLink } from "@/features/household/services/mplus-household-service";
import { toContractPeriod } from "@/lib/mplus/period";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";
import { useAppContextStore } from "@/stores/app-context-store";

/**
 * Driver de carga y sincronización de Hogar M+.
 *
 * Se monta en el DashboardShell y se actualiza cuando:
 * 1. Cambia el período seleccionado en `useAppContextStore`.
 * 2. Cambia el `householdId` del perfil M+.
 *
 * El período viaja SIEMPRE por `toContractPeriod`: `selectedPeriod` es
 * 0-indexado y la consulta §19.3 exige mes calendario 1-12. Saltarse esa
 * traducción hacía que Hogar consultara el mes anterior al que rotulaba.
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
    const period = toContractPeriod({
      year: selectedPeriod.year,
      month: selectedPeriod.month,
    });
    void load(householdId, period);
  }, [authenticated, householdId, selectedPeriod.year, selectedPeriod.month, load, reset]);
}

/**
 * Auto-reparación del vínculo de Hogar (contrato §16.3).
 *
 * Si el perfil apunta a un Hogar que ya no existe —porque el compañero ejecutó
 * un reinicio profundo (DEC-080) o porque el Hogar se cerró— este cliente lo
 * limpia en su PROPIO `users/{uid}`. Es el único camino posible: Rules solo
 * permiten escribir el documento propio, así que quien reinicia no puede
 * desvincular a nadie más.
 *
 * Sin esto el compañero quedaba con un `householdId` colgado que le impedía
 * crear o unirse a un Hogar nuevo.
 */
export function useMplusOrphanHouseholdReconciler(authenticated: boolean): void {
  const uid = useMplusPersonalStore((state) => state.profile?.uid ?? null);
  const profileHouseholdId = useMplusPersonalStore(
    (state) => state.profile?.householdId ?? null,
  );
  const householdStatus = useMplusHouseholdStore((state) => state.status);
  const household = useMplusHouseholdStore((state) => state.household);
  const loadedHouseholdId = useMplusHouseholdStore((state) => state.householdId);
  const refreshPersonal = useMplusPersonalStore((state) => state.refresh);

  /** Un solo intento por Hogar huérfano: la reparación no debe entrar en bucle. */
  const reconciledFor = useRef<string | null>(null);

  useEffect(() => {
    if (!authenticated || !uid || !profileHouseholdId) return;

    // El store debe haber intentado cargar ESTE Hogar. Sin esta comprobación se
    // colaba una carrera real: en el primer render el perfil todavía no está,
    // el driver llama a `load(null, ...)` y el store queda en
    // `success` + `household: null`; cuando el perfil llega con su
    // `householdId`, esta condición ya se cumplía con un estado que no
    // hablaba de ese Hogar, y la reparación salía a "arreglar" un Hogar que
    // nadie había leído todavía.
    if (loadedHouseholdId !== profileHouseholdId) return;

    // Solo cuando la carga terminó bien Y confirmó que el Hogar no está.
    if (householdStatus !== "success" || household !== null) return;
    if (reconciledFor.current === profileHouseholdId) return;

    reconciledFor.current = profileHouseholdId;

    void (async () => {
      try {
        const outcome = await reconcileOrphanHouseholdLink({ uid });
        if (outcome.kind === "success" && outcome.value) {
          // El perfil cambió en el servidor: reléelo para que la UI deje de
          // ofrecer un Hogar que ya no existe.
          await refreshPersonal();
        }
      } catch (error) {
        // Una reparación de fondo NUNCA puede tumbar la pantalla. Sin este
        // catch, un rechazo de Firestore salía como unhandled rejection y Next
        // lo mostraba como error de runtime sobre una página que funcionaba.
        console.warn(
          "[Hogar] no se pudo reconciliar el vínculo huérfano; se reintenta en la próxima sesión:",
          error,
        );
      }
    })();
  }, [
    authenticated,
    household,
    householdStatus,
    loadedHouseholdId,
    profileHouseholdId,
    refreshPersonal,
    uid,
  ]);
}

/**
 * Siembra el catálogo de gasto del Hogar al detectar que está `active`.
 *
 * No se puede sembrar al crear el Hogar: las Rules exigen
 * `currentUserIsActiveMember` y `household.status == 'active'`, y un Hogar
 * nace `waiting` con la membresía creándose en ese mismo batch. Intentarlo ahí
 * hacía que el servidor rechazara la creación entera — por eso crear un Hogar
 * funcionaba en Android y no en Web.
 *
 * Android hace exactamente esto mismo (`MplusHouseholdCategoryRepository`),
 * disparado por la transición a activo.
 */
export function useMplusHouseholdSeeder(authenticated: boolean): void {
  const uid = useMplusPersonalStore((state) => state.profile?.uid ?? null);
  const household = useMplusHouseholdStore((state) => state.household);
  const categoriesCount = useMplusHouseholdStore((state) => state.categories.length);
  const refreshHousehold = useMplusHouseholdStore((state) => state.refresh);

  /** Un intento por Hogar: la siembra no debe reintentarse en bucle. */
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    if (!authenticated || !uid || !household) return;
    if (household.status !== "active") return;
    // Si ya hay catálogo cargado, no hay nada que sembrar.
    if (categoriesCount > 0) return;
    if (seededFor.current === household.id) return;

    seededFor.current = household.id;

    void (async () => {
      try {
        const created = await ensureHouseholdExpenseSeed({
          householdId: household.id,
          createdBy: uid,
        });
        if (created.length > 0) {
          await refreshHousehold();
        }
      } catch (error) {
        // Una siembra de fondo no puede tumbar la pantalla. Se reintenta en la
        // próxima sesión; el Hogar sigue usable con `Por clasificar`.
        console.warn(
          "[Hogar] no se pudo sembrar el catálogo de gasto compartido:",
          error,
        );
      }
    })();
  }, [authenticated, categoriesCount, household, refreshHousehold, uid]);
}

/**
 * Nota: El sondeo por temporizador de 4s fue reemplazado por la suscripción en tiempo real
 * centralizada al documento del Hogar en `useMplusHouseholdStore` / `useMplusHouseholdLoader`.
 * Esta función se mantiene por compatibilidad sin temporizadores de sondeo.
 */
export function useMplusHouseholdWaitingWatcher(): void {
  // Sin efecto: el listener reactivo de `households/{householdId}` sincroniza el estado en vivo.
}
