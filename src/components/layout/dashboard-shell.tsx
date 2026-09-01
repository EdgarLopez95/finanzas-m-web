"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Calendar, ChevronDown, Loader2, Plus, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDropdown } from "@/components/finance/finance-dropdown";
import { FinanceShimmer } from "@/components/finance/finance-shimmer";
import { HouseholdShimmer } from "@/features/household/components/ui/household-shimmer";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthRedirectPath } from "@/features/auth/auth-routing";
import { completeResetSessionExit } from "@/features/auth/session-exit";
import { useAuthBootstrap } from "@/features/auth/use-auth-bootstrap";
import { MovementComposerDialog } from "@/features/movements/components/movement-composer-dialog";
import {
  useMplusHouseholdLoader,
  useMplusHouseholdSeeder,
  useMplusOrphanHouseholdReconciler,
} from "@/features/household/hooks/use-mplus-household";
import { useMplusPersonalLoader } from "@/features/movements/hooks/use-mplus-personal";
import { useExpiredTrashPurge } from "@/features/movements/hooks/use-expired-trash-purge";
import {
  resumeAccountResetIfNeeded,
  MplusAccountResetError,
} from "@/features/settings/services/mplus-account-reset-service";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useMplusComposerStore } from "@/stores/mplus-composer-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useAppContextStore } from "@/stores/app-context-store";
import { PeriodPickerDialog } from "@/components/finance/period-picker-dialog";
import { HouseholdPeriodPickerDialog } from "@/features/household/components/ui/household-period-picker-dialog";
import {
  canOpenPersonalMoneyAction,
  resolveContextRedirection,
  shouldMountPersonalMoneyDialogs,
} from "@/lib/navigation/app-context";
import { formatPeriodLabel, type SelectedPeriod } from "@/lib/format/date";

type ViewKey = "home" | "movements" | "accounts" | "categories" | "settings" | "household";

const VIEW_BY_PATH: Record<string, ViewKey> = {
  "/dashboard": "home",
  "/movements": "movements",
  "/accounts": "accounts",
  "/categories": "categories",
  "/settings": "settings",
  "/household": "household",
  "/household/settings": "settings",
  "/household/movements": "movements",
  "/household/categories": "categories",
};

const getTopBarCopy = (view: ViewKey, userName: string | null | undefined, period: SelectedPeriod, isHousehold?: boolean) => {
  const firstName = userName?.split(" ").find(Boolean) ?? "usuario";
  const monthLabel = formatPeriodLabel(period);
  const yearLabel = String(period.year);

  if (isHousehold) {
    switch (view) {
      case "household":
        return { title: "Inicio", subtitle: `Resumen de tu hogar en ${monthLabel} ${yearLabel}` };
      case "movements":
        return { title: "Movimientos", subtitle: "Historial de gastos e ingresos compartidos" };
      case "categories":
        return { title: "Categorías del hogar", subtitle: "Gastos compartidos por categoría este mes" };
      case "settings":
        return { title: "Ajustes", subtitle: "Información del hogar e integrantes" };
      default:
        return { title: "Hogar", subtitle: "" };
    }
  }

  switch (view) {
    case "home":
      return { title: "Inicio", subtitle: `Hola, ${firstName} - resumen de ${monthLabel} ${yearLabel}` };
    case "movements":
      return { title: "Movimientos", subtitle: "Historial completo de gastos e ingresos" };
    case "accounts":
      return { title: "Cuentas", subtitle: "Tus cuentas personales" };
    case "categories":
      return { title: "Gastos por categoría", subtitle: "En qué se te está yendo la plata este mes" };
    default:
      return { title: "Ajustes", subtitle: "Perfil, preferencias y personalización" };
  }
};

const PersonalLoadingContent = () => (
  <>
    <FinanceShimmer className="h-40 w-full rounded-[32px]" />
    <FinanceShimmer className="h-72 w-full rounded-[32px]" />
  </>
);

const HouseholdLoadingContent = () => (
  <>
    <HouseholdShimmer className="h-40 w-full rounded-[32px]" />
    <HouseholdShimmer className="h-72 w-full rounded-[32px]" />
  </>
);

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const view = VIEW_BY_PATH[pathname] ?? "home";

  const storeContext = useAppContextStore((state) => state.activeContext);
  const activeContext = storeContext;
  const isHousehold = activeContext === "household";
  const personalDialogsMounted = shouldMountPersonalMoneyDialogs(activeContext);

  const settleInitialContext = useAppContextStore((state) => state.settleInitialContext);
  const initialContextBootstrapResolved = useAppContextStore((state) => state.initialContextBootstrapResolved);
  const mplusProfile = useMplusPersonalStore((state) => state.profile);
  const activeHouseholdId = mplusProfile?.householdId ?? null;
  const mplusHousehold = useMplusHouseholdStore((state) => state.household);
  const mplusHouseholdStatus = useMplusHouseholdStore((state) => state.status);

  useEffect(() => {
    settleInitialContext(pathname, { activeHouseholdId, status: mplusHouseholdStatus });
  }, [pathname, activeHouseholdId, mplusHouseholdStatus, settleInitialContext]);

  const sharedRouteFallback = resolveContextRedirection({ pathname, context: activeContext });

  const { status, user } = useAuthBootstrap();
  const authenticated = status === "authenticated";

  useMplusPersonalLoader(user?.uid ?? null, authenticated);
  useMplusHouseholdLoader(authenticated);
  // Contrato §16.3: si el Hogar del perfil ya no existe (p. ej. la pareja
  // reinició su cuenta), este cliente limpia su propio vínculo.
  useMplusOrphanHouseholdReconciler(authenticated);
  // Contrato §13.1: el catálogo de gasto del Hogar se siembra cuando el Hogar
  // pasa a `active`, no al crearlo (las Rules lo rechazan en `waiting`).
  useMplusHouseholdSeeder(authenticated);
  useExpiredTrashPurge(authenticated);

  const mplusStatus = useMplusPersonalStore((state) => state.status);
  const mplusError = useMplusPersonalStore((state) => state.error);
  const mplusRefresh = useMplusPersonalStore((state) => state.refresh);
  const mplusMovementCount = useMplusPersonalStore((state) => state.movements.length);

  const openMplusCreate = useMplusComposerStore((state) => state.openCreate);

  const [loadingGuardTriggered, setLoadingGuardTriggered] = useState(false);
  const [isResumingReset, setIsResumingReset] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const handleLogout = async () => {
    await completeResetSessionExit();
  };

  const handleResumeReset = async () => {
    if (!user?.uid || isResumingReset) return;
    setIsResumingReset(true);
    setResumeError(null);
    try {
      const db = getFirebaseDb();
      const res = await resumeAccountResetIfNeeded(db, user.uid);
      if (res?.deletedUserProfile) {
        await completeResetSessionExit();
        return;
      }
      await mplusRefresh();
    } catch (err) {
      const msg =
        err instanceof MplusAccountResetError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error al reanudar el reinicio de la cuenta.";
      setResumeError(msg);
      await mplusRefresh();
    } finally {
      setIsResumingReset(false);
    }
  };

  useEffect(() => {
    const redirectPath = getAuthRedirectPath({ area: "protected", status });
    if (redirectPath) {
      router.replace(redirectPath);
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== "loading") {
      setLoadingGuardTriggered(false);
      return;
    }

    const timeout = setTimeout(() => {
      setLoadingGuardTriggered(true);
    }, 10000);

    return () => clearTimeout(timeout);
  }, [status]);

  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);
  const setSelectedPeriod = useAppContextStore((state) => state.setSelectedPeriod);
  const isPeriodPickerOpen = useAppContextStore((state) => state.periodPickerOpen);
  const openPeriodPicker = useAppContextStore((state) => state.openPeriodPicker);
  const closePeriodPicker = useAppContextStore((state) => state.closePeriodPicker);
  const contextNotice = useAppContextStore((state) => state.contextNotice);
  const setContextNotice = useAppContextStore((state) => state.setContextNotice);

  const sharedFallbackHref = sharedRouteFallback.replaceHref;
  useEffect(() => {
    if (!initialContextBootstrapResolved) {
      return;
    }
    if (sharedFallbackHref) {
      router.replace(sharedFallbackHref);
    }
  }, [sharedFallbackHref, router, initialContextBootstrapResolved]);

  const isHouseholdOperative = isHousehold && Boolean(mplusHousehold && (mplusHousehold.status === "active" || mplusHousehold.status === "waiting_return"));

  const monthLabel = formatPeriodLabel(selectedPeriod);
  const topBarCopy = getTopBarCopy(view, user?.displayName, selectedPeriod, isHousehold);

  const openCreatePanel = (kind: "expense" | "income") => {
    if (!canOpenPersonalMoneyAction({ context: activeContext })) {
      return;
    }
    openMplusCreate(kind);
  };

  const createItems = [
    {
      label: "Nuevo gasto",
      description: "Registrar una salida de dinero",
      icon: <ArrowDownLeft className="h-4.5 w-4.5" />,
      iconClassName: "border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.06)] text-[var(--fm-expense)]",
      onClick: () => openCreatePanel("expense"),
    },
    {
      label: "Nuevo ingreso",
      description: "Registrar una entrada de dinero",
      icon: <ArrowUpRight className="h-4.5 w-4.5" />,
      iconClassName: "border-[rgba(74,222,128,0.16)] bg-[rgba(74,222,128,0.06)] text-[var(--fm-income)]",
      onClick: () => openCreatePanel("income"),
    },
  ];

  const householdTopBarActions =
    isHousehold &&
    pathname &&
    ["/household", "/household/movements", "/household/categories", "/household/settings"].includes(pathname) &&
    isHouseholdOperative ? (
      <button
        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[18px] border border-[var(--hh-border)] bg-[var(--hh-surface-elevated)] px-4 text-sm font-semibold text-[var(--hh-text)] transition-colors hover:bg-[color-mix(in_oklch,var(--hh-surface-elevated),white_8%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
        type="button"
        aria-label="Elegir período del hogar"
        onClick={openPeriodPicker}
      >
        <Calendar className="h-4 w-4 text-[var(--hh-primary-action)]" />
        <span>{monthLabel}</span>
        <ChevronDown className="h-4 w-4 text-[var(--hh-text-muted)]" />
      </button>
    ) : null;

  const personalTopBarActions =
    !isHousehold ? (
      <>
        <button
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[18px] border border-[rgba(148,163,184,0.14)] bg-[rgba(23,31,47,0.92)] px-4 text-sm font-semibold text-[var(--fm-warm-paper)] transition-colors hover:bg-[rgba(28,38,57,0.96)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
          type="button"
          aria-label="Elegir período"
          onClick={openPeriodPicker}
        >
          <Calendar className="h-4 w-4 text-[var(--fm-pending)]" />
          <span>{monthLabel}</span>
          <ChevronDown className="h-4 w-4 text-[var(--fm-text-muted)]" />
        </button>

        <FinanceDropdown
          align="right"
          itemLayout="rich"
          items={createItems}
          menuClassName="w-[292px]"
          menuWidth={292}
          trigger={
            <FinanceButton
              aria-label="Registrar movimiento"
              className="min-h-11 cursor-pointer rounded-[18px] bg-[var(--fm-pending)] px-5 font-semibold text-[var(--fm-ink)] shadow-[0_16px_36px_rgb(228_179_99/0.24)] hover:bg-[color-mix(in_oklch,var(--fm-pending),white_8%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-pending)] gap-2"
              size="lg"
              tone="filled"
              type="button"
            >
              <Plus className="h-4 w-4" />
              Nuevo
            </FinanceButton>
          }
        />
      </>
    ) : null;

  const topBarActions = isHousehold ? householdTopBarActions : personalTopBarActions;

  const shellProps = {
    title: topBarCopy.title,
    subtitle: topBarCopy.subtitle,
    actions: topBarActions,
    userName: user?.displayName,
    userEmail: user?.email,
    userPhotoURL: user?.photoUrl,
    movementCount: mplusMovementCount,
  };

  if (status === "unauthenticated") {
    return null;
  }

  let content: React.ReactNode;

  if (sharedRouteFallback.shouldRedirect) {
    content = isHousehold ? <HouseholdLoadingContent /> : <PersonalLoadingContent />;
  } else if (status === "loading") {
    content = loadingGuardTriggered ? (
      <EmptyState
        title="Demora al validar sesión"
        description="No pudimos resolver tu sesión a tiempo. Intenta volver a iniciar sesión."
        actionLabel="Cerrar sesión"
        onAction={() => void handleLogout()}
      />
    ) : isHousehold ? (
      <HouseholdLoadingContent />
    ) : (
      <PersonalLoadingContent />
    );
  } else if (mplusProfile?.status === "resetting" || isResumingReset) {
    content = (
      <EmptyState
        title="Reiniciando cuenta..."
        description={
          resumeError
            ? `Error al reanudar el reinicio: ${resumeError}`
            : "Se está completando el restablecimiento de tu cuenta en Finanzas M+. Al terminar se cerrará la sesión."
        }
        actionLabel={isResumingReset ? undefined : "Continuar reinicio"}
        onAction={isResumingReset ? undefined : () => void handleResumeReset()}
        secondaryActionLabel="Cerrar sesión"
        onSecondaryAction={() => void handleLogout()}
      >
        {isResumingReset && (
          <div className="flex items-center gap-2 text-sm text-[var(--fm-pending)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Procesando reinicio...</span>
          </div>
        )}
      </EmptyState>
    );
  } else if (isHousehold) {
    content = children;
  } else if (mplusStatus === "loading" || mplusStatus === "idle") {
    content = <PersonalLoadingContent />;
  } else if (mplusStatus === "error") {
    content = (
      <EmptyState
        title="Error al cargar datos"
        description={mplusError ?? "No pudimos obtener tus datos personales."}
        actionLabel="Reintentar"
        onAction={() => void mplusRefresh()}
        secondaryActionLabel="Cerrar sesión"
        onSecondaryAction={() => void handleLogout()}
      />
    );
  } else {
    content = children;
  }

  return (
    <>
      <AppShell {...shellProps} context={activeContext}>
        {contextNotice ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-[24px] border border-[rgba(228,179,99,0.24)] bg-[rgba(228,179,99,0.1)] px-4 py-3 text-sm text-[var(--fm-pending)]"
          >
            <span>{contextNotice}</span>
            <button
              type="button"
              aria-label="Cerrar aviso"
              className="cursor-pointer rounded-full p-1 text-[var(--fm-pending)] transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-pending)]"
              onClick={() => setContextNotice(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {content}
      </AppShell>

      {/* Composer del contrato v1 */}
      {personalDialogsMounted && <MovementComposerDialog />}

      {personalDialogsMounted && (
        <PeriodPickerDialog
          open={isPeriodPickerOpen}
          onClose={closePeriodPicker}
          selectedPeriod={selectedPeriod}
          onSelectPeriod={setSelectedPeriod}
        />
      )}

      {isHousehold && (
        <HouseholdPeriodPickerDialog
          open={isPeriodPickerOpen}
          onClose={closePeriodPicker}
          selectedPeriod={selectedPeriod}
          onSelectPeriod={setSelectedPeriod}
        />
      )}
    </>
  );
}
