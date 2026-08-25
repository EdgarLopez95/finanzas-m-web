"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Calendar, ChevronDown, Eye, EyeOff, Plus, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDropdown } from "@/components/finance/finance-dropdown";
import { FinanceShimmer } from "@/components/finance/finance-shimmer";
import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdShimmer } from "@/features/household/components/ui/household-shimmer";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthRedirectPath } from "@/features/auth/auth-routing";
import { useAuthBootstrap } from "@/features/auth/use-auth-bootstrap";
import { MovementComposerDialog } from "@/features/movements/components/movement-composer-dialog";
import { useMplusHouseholdLoader } from "@/features/household/hooks/use-mplus-household";
import { useMplusPersonalLoader } from "@/features/movements/hooks/use-mplus-personal";
import { useExpiredTrashPurge } from "@/features/movements/hooks/use-expired-trash-purge";
import { useMplusComposerStore } from "@/stores/mplus-composer-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";
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
  useExpiredTrashPurge(authenticated);

  const mplusStatus = useMplusPersonalStore((state) => state.status);
  const mplusError = useMplusPersonalStore((state) => state.error);
  const mplusRefresh = useMplusPersonalStore((state) => state.refresh);
  const mplusMovementCount = useMplusPersonalStore((state) => state.movements.length);

  const balancesHidden = useUiPreferencesStore((state) => state.balancesHidden);
  const toggleBalancesHidden = useUiPreferencesStore((state) => state.toggleBalancesHidden);
  const hydratePreferences = useUiPreferencesStore((state) => state.hydrate);

  const openMplusCreate = useMplusComposerStore((state) => state.openCreate);
  const openCreateExpense = () => openMplusCreate("expense");

  const [loadingGuardTriggered, setLoadingGuardTriggered] = useState(false);
  useEffect(() => {
    hydratePreferences();
  }, [hydratePreferences]);

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
      <>
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
        <HouseholdButton
          className="min-h-11 gap-2 px-5 bg-[var(--hh-sage-accent)] text-[var(--hh-text)] hover:bg-[color-mix(in_oklch,var(--hh-sage-accent),white_8%)]"
          onClick={openCreateExpense}
          tone="filled"
          type="button"
        >
          <Plus className="h-4 w-4" />
          Nuevo gasto
        </HouseholdButton>
      </>
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

        <FinanceButton
          aria-label={balancesHidden ? "Mostrar saldos" : "Ocultar saldos"}
          className="min-h-11 min-w-11 cursor-pointer rounded-[18px] border-[rgba(148,163,184,0.14)] bg-[rgba(23,31,47,0.92)] text-[var(--fm-text-soft)] hover:bg-[rgba(28,38,57,0.96)]"
          onClick={toggleBalancesHidden}
          size="icon"
          tone="text"
          type="button"
          variant="ghost"
        >
          {balancesHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </FinanceButton>

        <FinanceDropdown
          items={createItems}
          trigger={
            <FinanceButton
              aria-label="Registrar movimiento"
              className="min-h-11 gap-2 px-5"
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
        description="No pudimos resolver tu sesión a tiempo. Intenta volver a iniciar sesión."
        title="Demora al validar sesión"
      />
    ) : isHousehold ? (
      <HouseholdLoadingContent />
    ) : (
      <PersonalLoadingContent />
    );
  } else if (isHousehold) {
    content = children;
  } else if (mplusStatus === "loading" || mplusStatus === "idle") {
    content = <PersonalLoadingContent />;
  } else if (mplusStatus === "error") {
    content = (
      <EmptyState
        actionLabel="Reintentar"
        description={mplusError ?? "No pudimos obtener tus datos personales."}
        onAction={() => void mplusRefresh()}
        title="Error al cargar datos"
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
