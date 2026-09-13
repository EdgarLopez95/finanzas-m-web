"use client";

import { useEffect, useMemo } from "react";

import {
  buildCategoryBreakdown,
  buildMplusMovementRows,
  buildPersonalMonthKpis,
  type CategoryBreakdownItem,
  type MplusMovementRow,
  type PersonalMonthKpis,
} from "@/features/movements/lib/personal-month-view-model";
import { splitTrashByExpiry } from "@/features/movements/services/read-personal-movements";
import { toContractPeriod } from "@/lib/mplus/period";
import { useAuthStore } from "@/stores/auth-store";
import { useAppContextStore } from "@/stores/app-context-store";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";
import type {
  MplusHousehold,
  MplusHouseholdMember,
  MplusUserProfile,
} from "@/lib/mplus/models";

/**
 * Acceso de la UI al estado Personal del contrato v1.
 *
 * Mismo reparto de responsabilidades que el circuito legacy: UN solo driver
 * monta la carga (`useMplusPersonalLoader`, en el shell del dashboard) y las
 * paginas solo LEEN (`useMplusPersonal`). Asi ninguna pantalla dispara
 * load/reset en conflicto con otra.
 */

/**
 * Driver unico de la carga Personal M+. Debe montarse en UN solo lugar.
 * Recarga cuando cambia el usuario o el periodo seleccionado.
 *
 * `SelectedPeriod` usa mes 0-indexado; el contrato y las consultas, 1-12. La
 * traduccion (`toContractPeriod`) es compartida con el driver de Hogar para
 * que las dos superficies no puedan volver a divergir.
 */
export const useMplusPersonalLoader = (ownerId: string | null, enabled: boolean) => {
  const load = useMplusPersonalStore((state) => state.load);
  const reset = useMplusPersonalStore((state) => state.reset);
  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);

  const year = selectedPeriod.year;
  const month = selectedPeriod.month;

  useEffect(() => {
    if (!ownerId || !enabled) {
      reset();
      return;
    }
    void load(ownerId, toContractPeriod({ year, month }));
  }, [enabled, load, month, ownerId, reset, year]);
};

export type MplusPersonalView = Readonly<{
  status: ReturnType<typeof useMplusPersonalStore.getState>["status"];
  error: string | null;
  /** `true` mientras no hay un mes cargado con exito. */
  isLoading: boolean;
  kpis: PersonalMonthKpis;
  expenseBreakdown: CategoryBreakdownItem[];
  incomeBreakdown: CategoryBreakdownItem[];
  rows: MplusMovementRow[];
  trashRows: MplusMovementRow[];
  /** Documentos de Papelera ya vencidos: no se muestran, se purgan. */
  expiredTrashIds: string[];
  hasMovements: boolean;
}>;

const EMPTY_KPIS: PersonalMonthKpis = { income: 0, expense: 0, difference: 0 };

/**
 * Lectura pura (sin efectos) del mes Personal, con los derivados memoizados.
 * Los totales salen del nucleo compartido del contrato §25.
 */
export const useMplusPersonal = (): MplusPersonalView => {
  const status = useMplusPersonalStore((state) => state.status);
  const error = useMplusPersonalStore((state) => state.error);
  const movements = useMplusPersonalStore((state) => state.movements);
  const trashed = useMplusPersonalStore((state) => state.trashed);
  const categories = useMplusPersonalStore((state) => state.categories);
  const accounts = useMplusPersonalStore((state) => state.accounts);

  return useMemo(() => {
    const kpis = status === "success" ? buildPersonalMonthKpis(movements) : EMPTY_KPIS;
    const rows =
      status === "success" ? buildMplusMovementRows(movements, categories, accounts) : [];

    // La Papelera oculta lo vencido (contrato §9.5) pero conserva sus IDs para
    // que la purga pueda dispararse sobre los mismos documentos.
    const { visible, expired } =
      status === "success"
        ? splitTrashByExpiry(trashed, Date.now())
        : { visible: [], expired: [] };

    return {
      status,
      error,
      isLoading: status === "loading" || status === "idle",
      kpis,
      expenseBreakdown:
        status === "success" ? buildCategoryBreakdown(movements, categories, "expense") : [],
      incomeBreakdown:
        status === "success" ? buildCategoryBreakdown(movements, categories, "income") : [],
      rows,
      trashRows: buildMplusMovementRows(visible, categories, accounts),
      expiredTrashIds: expired.map((movement) => movement.id),
      hasMovements: movements.length > 0,
    };
  }, [accounts, categories, error, movements, status, trashed]);
};

/** Catalogos activos para los selectores del composer. */
export const useMplusCatalogs = () => {
  const categories = useMplusPersonalStore((state) => state.categories);
  const accounts = useMplusPersonalStore((state) => state.accounts);

  return useMemo(
    () => ({
      expenseCategories: categories.filter(
        (category) => category.type === "expense" && category.state === "active",
      ),
      incomeCategories: categories.filter(
        (category) => category.type === "income" && category.state === "active",
      ),
      allCategories: categories,
      activeAccounts: accounts.filter((account) => account.state === "active"),
      allAccounts: accounts,
    }),
    [accounts, categories],
  );
};

export type HouseholdSharingEligibilityInput = Readonly<{
  authUid: string | null;
  profile: MplusUserProfile | null;
  household: MplusHousehold | null;
  members: readonly MplusHouseholdMember[];
}>;

export type HouseholdSharingEligibilityResult = Readonly<{
  canShare: boolean;
  householdId: string | null;
  isResetting: boolean;
  reason: string | null;
}>;

/**
 * Evalúa las condiciones locales de elegibilidad para compartir con Hogar
 * de forma coherente con las Rules del servidor (§6.2, §9.2, §18.1).
 */
export const checkHouseholdSharingEligibility = ({
  authUid,
  profile,
  household,
  members,
}: HouseholdSharingEligibilityInput): HouseholdSharingEligibilityResult => {
  const isResetting = profile?.status === "resetting";
  if (isResetting) {
    return {
      canShare: false,
      householdId: profile?.householdId ?? null,
      isResetting: true,
      reason: "La cuenta se encuentra en proceso de reinicio.",
    };
  }

  if (!profile || profile.status !== "ready") {
    return {
      canShare: false,
      householdId: profile?.householdId ?? null,
      isResetting: false,
      reason: "El perfil de usuario no está en estado activo.",
    };
  }

  if (!profile.householdId || profile.householdMembershipState !== "active") {
    return {
      canShare: false,
      householdId: profile.householdId ?? null,
      isResetting: false,
      reason: "No tienes una membresía activa de Hogar.",
    };
  }

  if (!household || household.status !== "active") {
    return {
      canShare: false,
      householdId: profile.householdId,
      isResetting: false,
      reason: "El Hogar no se encuentra activo.",
    };
  }

  if (household.id !== profile.householdId) {
    return {
      canShare: false,
      householdId: profile.householdId,
      isResetting: false,
      reason: "El identificador del Hogar no coincide con tu perfil.",
    };
  }

  if (!authUid || (household.memberAId !== authUid && household.memberBId !== authUid)) {
    return {
      canShare: false,
      householdId: profile.householdId,
      isResetting: false,
      reason: "No estás registrado como miembro canónico de este Hogar.",
    };
  }

  const isMemberActive = members.some(
    (member) => member.userId === authUid && member.state === "active",
  );
  if (!isMemberActive) {
    return {
      canShare: false,
      householdId: profile.householdId,
      isResetting: false,
      reason: "Tu membresía en el Hogar no está activa.",
    };
  }

  return {
    canShare: true,
    householdId: profile.householdId,
    isResetting: false,
    reason: null,
  };
};

/**
 * Estado de Hogar del perfil (contrato §6.2): decide si el composer puede
 * ofrecer "Contar en Hogar". Verifica coherencia completa de perfil, hogar y
 * subcolección de miembros.
 */
export const useMplusHouseholdSharing = (explicitUid?: string | null) => {
  const authUserUid = useAuthStore((state) => state.user?.uid);
  const authUid = explicitUid ?? authUserUid ?? null;
  const profile = useMplusPersonalStore((state) => state.profile);
  const household = useMplusHouseholdStore((state) => state.household);
  const members = useMplusHouseholdStore((state) => state.members);

  return useMemo(
    () =>
      checkHouseholdSharingEligibility({
        authUid,
        profile,
        household,
        members,
      }),
    [authUid, profile, household, members],
  );
};
