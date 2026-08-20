"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Calendar, Check, ChevronDown, Eye, EyeOff, PencilLine, Plus, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { EmptyState } from "@/components/finance/empty-state";
import { cn } from "@/lib/utils";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDropdown } from "@/components/finance/finance-dropdown";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { FinanceShimmer } from "@/components/finance/finance-shimmer";
import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdShimmer } from "@/features/household/components/ui/household-shimmer";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthRedirectPath } from "@/features/auth/auth-routing";
import { useAuthBootstrap } from "@/features/auth/use-auth-bootstrap";
import { usePersonalDashboardData } from "@/features/dashboard/hooks/use-personal-dashboard-data";
import { useHouseholdLoader, useHouseholdData } from "@/features/household/hooks/use-household-data";
import { useAutoSettleDebts } from "@/features/household/hooks/use-auto-settle-debts";
import { HouseholdDebtReceptionFallback } from "@/features/household/components/household-debt-reception-fallback";
import { shouldMountHouseholdDebtReceptionFallback } from "@/features/household/lib/auto-settle-debt";
import { CreateHouseholdExpenseDialog } from "@/features/household/components/create-household-expense-dialog";
import { CreateMovementDialog } from "@/features/transactions/components/create-movement-dialog";
import { MovementComposerDialog } from "@/features/movements/components/movement-composer-dialog";
import { useMplusHouseholdLoader } from "@/features/household/hooks/use-mplus-household";
import { useMplusPersonalLoader } from "@/features/movements/hooks/use-mplus-personal";
import { useExpiredTrashPurge } from "@/features/movements/hooks/use-expired-trash-purge";
import { useMplusComposerStore } from "@/stores/mplus-composer-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";
import { DeleteTransactionConfirmCard } from "@/features/transactions/components/delete-transaction-confirm-card";
import { useTransactionPanelStore } from "@/stores/transaction-panel-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";
import { useAppContextStore } from "@/stores/app-context-store";
import { useHouseholdDataStore } from "@/stores/household-data-store";
import { PeriodPickerDialog } from "@/components/finance/period-picker-dialog";
import { HouseholdPeriodPickerDialog } from "@/features/household/components/ui/household-period-picker-dialog";
import { useHouseholdUiStore } from "@/stores/household-ui-store";
import { resolveHouseholdViewMode } from "@/features/household/lib/household-view-model";
import {
  HOUSEHOLD_LOST_NOTICE,
  canOpenHouseholdAction,
  canOpenPersonalMoneyAction,
  resolveHouseholdLoss,
  resolveHouseholdLossRecovery,
  resolveContextRedirection,
  shouldMountPersonalMoneyDialogs,
  type HouseholdSessionSnapshot,
} from "@/lib/navigation/app-context";
import { formatPeriodLabel, type SelectedPeriod } from "@/lib/format/date";
import type { Transaction } from "@/types/transaction";

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
        return { title: "Movimientos", subtitle: "Historial completo de gastos e ingresos del libro compartido" };
      case "categories":
        return { title: "Categorías del hogar", subtitle: "En qué se va la plata compartida este mes" };
      case "settings":
        return { title: "Ajustes", subtitle: "Perfil, hogar y preferencias del contexto" };
      default:
        return { title: "Hogar", subtitle: "" };
    }
  }

  switch (view) {
    case "home":
      return { title: "Inicio", subtitle: `Hola, ${firstName} - resumen de ${monthLabel} ${yearLabel}` };
    case "movements":
      return { title: "Movimientos", subtitle: "Historial completo de gastos, ingresos y transferencias" };
    case "accounts":
      return { title: "Cuentas", subtitle: "Tus cuentas personales y sus bolsillos" };
    case "categories":
      return { title: "Gastos por categoría", subtitle: "En qué se te está yendo la plata este mes" };
    default:
      return { title: "Ajustes", subtitle: "Perfil, preferencias y personalización" };
  }
};


const getDeleteDialogTitle = (transaction: Transaction | null) => {
  if (!transaction) {
    return "Eliminar movimiento";
  }
  if (transaction.type === "expense") {
    return "Eliminar gasto";
  }
  if (transaction.type === "income") {
    return "Eliminar ingreso";
  }
  if (transaction.type === "transfer") {
    return "Eliminar transferencia";
  }
  return "Eliminar movimiento";
};

// #region PERSONAL
/** Esqueleto de carga de las superficies Personal: kit Finance. */
const PersonalLoadingContent = () => (
  <>
    <FinanceShimmer className="h-40 w-full rounded-[32px]" />
    <FinanceShimmer className="h-72 w-full rounded-[32px]" />
  </>
);
// #endregion PERSONAL

// #region HOGAR
/** Esqueleto de carga del libro compartido: kit Hogar. */
const HouseholdLoadingContent = () => (
  <>
    <HouseholdShimmer className="h-40 w-full rounded-[32px]" />
    <HouseholdShimmer className="h-72 w-full rounded-[32px]" />
  </>
);
// #endregion HOGAR

/**
 * Carcasa persistente del dashboard. Se monta una sola vez desde el layout del
 * grupo (dashboard) y NO se desmonta al navegar entre secciones: solo cambia el
 * contenido (`children`). Aquí viven la sidebar, el topbar, los paneles y la
 * carga de datos; por eso navegar entre vistas ya cargadas es instantáneo.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const view = VIEW_BY_PATH[pathname] ?? "home";

  // Paso 6: el contexto activo es un estado explícito, no una derivación
  // visual. `isHousehold` (chrome/acciones) lo lee del store; `view` sigue
  // atado a la ruta solo para el copy del topbar y el contenido renderizado.
  const storeContext = useAppContextStore((state) => state.activeContext);
  const setActiveContext = useAppContextStore((state) => state.setActiveContext);

  // La fuente de verdad absoluta del contexto activo es storeContext.
  // Una URL no puede imponer un cambio de contexto sincrónicamente durante el
  // render — `resolveContextForPath` no se usa aquí para calcular
  // `activeContext`; solo lo consume, como insumo puro, el bootstrap inicial
  // de sesión (`resolveInitialContextBootstrap`, vía `settleInitialContext`).
  const activeContext = storeContext;
  const isHousehold = activeContext === "household";
  const personalDialogsMounted = shouldMountPersonalMoneyDialogs(activeContext);

  // Corrección P1 Paso 10 — bootstrap seguro de la intención inicial de la
  // URL. Se necesita el estado REAL de la suscripción de Hogar (no solo
  // `activeHouseholdId === null`, que también es cierto mientras aún carga)
  // antes de decidir si aceptar Hogar o redirigir a Personal.
  const settleInitialContext = useAppContextStore((state) => state.settleInitialContext);
  const initialContextBootstrapResolved = useAppContextStore((state) => state.initialContextBootstrapResolved);
  const householdDataStoreData = useHouseholdDataStore((state) => state.data);
  const householdStatus = useHouseholdDataStore((state) => state.status);
  const activeHouseholdId = householdDataStoreData.activeHouseholdId;
  const householdData = useHouseholdData();

  useEffect(() => {
    settleInitialContext(pathname, { activeHouseholdId, status: householdStatus });
  }, [pathname, activeHouseholdId, householdStatus, settleInitialContext]);

  // Fallback temporal: una superficie compartida sin equivalente Hogar todavía
  // implementado (pasos de shell posteriores) hace `replace` a /household
  // conservando el contexto Hogar, sin renderizar nada Personal entretanto.
  const sharedRouteFallback = resolveContextRedirection({ pathname, context: activeContext });

  const { status, user } = useAuthBootstrap();
  const authenticated = status === "authenticated";

  // Drivers ÚNICOS de carga. enabled = authenticated es estable entre
  // navegaciones, así que no hay reset-thrash: los datos se cargan una vez y
  // persisten mientras la sesión siga activa.
  // W2: el cargador Personal legacy ya no se monta. Leía `transactions`,
  // `pockets` y `third_party_fund_*`, colecciones que el contrato v1 no declara
  // y que las Rules canónicas niegan por defecto: contra el proyecto real
  // fallaba siempre y bloqueaba TODA la superficie Personal. El código legacy
  // sigue en el repo (regla 6 de docs/12); solo deja de ejecutarse.
  useMplusPersonalLoader(user?.uid ?? null, authenticated);
  useMplusHouseholdLoader(authenticated);
  // Contrato §9.5: al abrir con conexion, lo vencido en Papelera se elimina de
  // verdad y ajusta el contador de la cuenta.
  useExpiredTrashPurge(authenticated);
  useHouseholdLoader(user?.uid ?? null, authenticated);
  // Observador de auto-settle de deudas: vive en el shell, presente en Personal
  // y Hogar por igual (paridad Android: HouseholdDebtAutoSettleObserver.kt).
  useAutoSettleDebts(user?.uid ?? null, authenticated);

  const personalData = usePersonalDashboardData();
  // Fuente de verdad del estado Personal para el shell (contrato v1).
  const mplusStatus = useMplusPersonalStore((state) => state.status);
  const mplusError = useMplusPersonalStore((state) => state.error);
  const mplusRefresh = useMplusPersonalStore((state) => state.refresh);
  const mplusMovementCount = useMplusPersonalStore((state) => state.movements.length);

  const isCreateExpenseOpen = useHouseholdUiStore((state) => state.isCreateExpenseOpen);
  const closeCreateExpense = useHouseholdUiStore((state) => state.closeCreateExpense);

  const balancesHidden = useUiPreferencesStore((state) => state.balancesHidden);
  const toggleBalancesHidden = useUiPreferencesStore((state) => state.toggleBalancesHidden);
  const hydratePreferences = useUiPreferencesStore((state) => state.hydrate);
  const isEditingBoard = useUiPreferencesStore((state) => state.isEditingBoard);
  const setEditingBoard = useUiPreferencesStore((state) => state.setEditingBoard);

  // Acción primaria del libro compartido (composer M+).
  const openMplusCreate = useMplusComposerStore((state) => state.openCreate);
  const openCreateExpense = () => openMplusCreate("expense");

  const panelKind = useTransactionPanelStore((state) => state.kind);
  const panelTransaction = useTransactionPanelStore((state) => state.transaction);
  const openCreate = useTransactionPanelStore((state) => state.openCreate);
  const closePanel = useTransactionPanelStore((state) => state.close);

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

  // Turn off board editing mode when navigating away from Home
  useEffect(() => {
    if (view !== "home") {
      setEditingBoard(false);
    }
  }, [view, setEditingBoard]);

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
  const householdLossNotifiedFor = useAppContextStore((state) => state.householdLossNotifiedFor);
  const markHouseholdLossNotified = useAppContextStore((state) => state.markHouseholdLossNotified);

  // Corrección P1 Paso 10: no aplicar la redirección de ruta compartida
  // mientras el bootstrap inicial de contexto sigue pendiente — de lo
  // contrario, con el store todavía en "personal" por defecto mientras la
  // suscripción de Hogar carga, esto expulsaría a /dashboard a un usuario con
  // Hogar activo antes de que `settleInitialContext` pudiera confirmarlo.
  const sharedFallbackHref = sharedRouteFallback.replaceHref;
  useEffect(() => {
    if (!initialContextBootstrapResolved) {
      return;
    }
    if (sharedFallbackHref) {
      router.replace(sharedFallbackHref);
    }
  }, [sharedFallbackHref, router, initialContextBootstrapResolved]);

  // Paso 6 · Pérdida remota del Hogar (salir, disolver, remoción remota):
  // volver obligatoriamente a Personal, avisar UNA sola vez y hacer `replace`
  // seguro si se estaba dentro de una ruta Hogar. Los estados transitorios
  // (`loading`/`error`) nunca cuentan como pérdida, así que un fallo de red no
  // expulsa al usuario (coherente con `handleListenerError`).
  const previousHouseholdSnapshotRef = useRef<HouseholdSessionSnapshot | null>(null);

  const householdViewMode = resolveHouseholdViewMode({
    status: householdStatus,
    household: householdDataStoreData.household,
  });


  const isHouseholdOperative = canOpenHouseholdAction({
    context: activeContext,
    hasActiveHousehold: activeHouseholdId !== null,
    householdViewMode,
  });

  useEffect(() => {
    const next: HouseholdSessionSnapshot = { activeHouseholdId, status: householdStatus };
    const previous = previousHouseholdSnapshotRef.current;
    previousHouseholdSnapshotRef.current = next;

    const loss = resolveHouseholdLoss({ previous, next, notifiedForHouseholdId: householdLossNotifiedFor });
    if (!loss.lost) {
      return;
    }

    const recovery = resolveHouseholdLossRecovery({ lost: loss.lost, pathname });

    if (recovery.shouldReturnToPersonal) {
      setActiveContext("personal");
    }

    if (loss.shouldNotify) {
      setContextNotice(HOUSEHOLD_LOST_NOTICE);
      markHouseholdLossNotified(loss.lostHouseholdId);
    }

    if (recovery.replaceHref) {
      router.replace(recovery.replaceHref);
    }
  }, [
    activeHouseholdId,
    householdStatus,
    householdLossNotifiedFor,
    markHouseholdLossNotified,
    pathname,
    router,
    setActiveContext,
    setContextNotice,
  ]);

  const monthLabel = formatPeriodLabel(selectedPeriod);
  const topBarCopy = getTopBarCopy(view, user?.displayName, selectedPeriod, isHousehold);

  const openCreatePanel = (kind: "expense" | "income" | "transfer") => {
    // Guarda de contexto: ninguna acción de dinero propio puede abrirse
    // mientras el contexto activo sea Hogar.
    if (!canOpenPersonalMoneyAction({ context: activeContext })) {
      return;
    }
    // W2: Ingreso y Gasto abren el composer del contrato v1. La transferencia
    // se retiró del producto y ya no se ofrece (matriz W2).
    if (kind === "expense" || kind === "income") {
      openMplusCreate(kind);
      return;
    }
    openCreate(kind);
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

  const handleEditDashboard = () => {
    setEditingBoard(!isEditingBoard);
  };

  const householdTopBarActions =
    // #region HOGAR
    // Acción primaria del libro compartido. Es global en las tres rutas de Hogar:
    // Inicio, Movimientos y Ajustes (paridad con FinanzasMainTabsShell.kt).
    // Solo se muestra si el hogar está operativo (dos o más miembros).
    isHousehold &&
    pathname &&
    ["/household", "/household/movements", "/household/settings"].includes(pathname) &&
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
          // Paso 9 / QA-001: paridad con household().householdAddFabContainerColor
          // (Sage) / householdAddFabContentColor (WarmPaper ~ --hh-text).
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
  // #endregion HOGAR

  const personalTopBarActions =
    // #region PERSONAL
    // Controles de dinero propio: período, visibilidad de saldos, edición de
    // tablero y creación de movimientos. Kit y tokens Finance.
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

        {view === "home" && (
          <FinanceButton
            className={cn(
              "min-h-11 cursor-pointer rounded-[18px] border border-[rgba(148,163,184,0.14)] bg-[rgba(23,31,47,0.92)] px-4 text-[var(--fm-text-soft)] hover:bg-[rgba(28,38,57,0.96)] hover:text-[var(--fm-warm-paper)] transition-all",
              isEditingBoard &&
                "border-[rgba(228,179,99,0.3)] bg-[rgba(228,179,99,0.1)] text-[var(--fm-pending)] hover:bg-[rgba(228,179,99,0.15)] hover:text-[var(--fm-pending)]"
            )}
            onClick={handleEditDashboard}
            tone="text"
            type="button"
            variant="ghost"
          >
            {isEditingBoard ? (
              <>
                <Check className="h-4 w-4 text-[var(--fm-pending)]" />
                <span>Listo</span>
              </>
            ) : (
              <>
                <PencilLine className="h-4 w-4" />
                <span>Editar tablero</span>
              </>
            )}
          </FinanceButton>
        )}

        <FinanceDropdown
          align="right"
          itemLayout="rich"
          items={createItems}
          menuClassName="w-[292px]"
          menuWidth={292}
          trigger={
            <FinanceButton
              className="min-h-11 cursor-pointer rounded-[18px] bg-[var(--fm-pending)] px-5 text-[var(--fm-ink)] shadow-[0_16px_36px_rgb(228_179_99/0.24)] hover:bg-[color-mix(in_oklch,var(--fm-pending),white_8%)]"
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
  // #endregion PERSONAL

  const topBarActions = (
    <>
      {householdTopBarActions}
      {personalTopBarActions}
    </>
  );

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
    // Mientras dura el `replace` tras cruzar Personal↔Hogar, no se pinta la
    // página saliente. El placeholder DEBE coincidir con el contexto destino
    // (ya aplicado en el store): si al salir de Hogar se dejaba
    // HouseholdLoadingContent, el chrome Personal mostraba dos bloques verdes.
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
    // La página de Hogar gestiona sus propios estados (cargando/vacío/error).
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
    content = (
      <>
        {children}
      </>
    );
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

      {shouldMountHouseholdDebtReceptionFallback(view) && <HouseholdDebtReceptionFallback />}

      {/*
        Paso 6: los diálogos de movimientos personales se MONTAN solo en
        Personal. Ocultarlos no bastaría: montados conservan estado y podrían
        reabrirse dentro del contexto Hogar.
      */}
      {personalDialogsMounted && <CreateMovementDialog />}

      {/* Composer del contrato v1: mismo dialogo, solo Ingreso/Gasto (matriz W2). */}
      {personalDialogsMounted && <MovementComposerDialog />}

      {/* Diálogo global de gasto de Hogar, montado solo si el Hogar es operativo y el contexto es Hogar */}
      {isHouseholdOperative && (
        <CreateHouseholdExpenseDialog
          open={isCreateExpenseOpen}
          onClose={closeCreateExpense}
          householdId={householdData.data.activeHouseholdId ?? ""}
          currentUid={user?.uid ?? ""}
          memberIds={householdData.data.household?.memberIds ?? []}
          memberProfiles={householdData.summary.memberProfiles}
          categories={householdData.data.categories.filter((c) => !c.archived)}
        />
      )}

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

      {personalDialogsMounted && (
        <FinanceDialog
          onClose={closePanel}
          open={panelKind === "delete" && Boolean(panelTransaction)}
          subtitle="Confirma esta acción antes de continuar."
          title={getDeleteDialogTitle(panelTransaction)}
        >
          {panelKind === "delete" && panelTransaction ? (
            <DeleteTransactionConfirmCard
              movement={panelTransaction}
              onCancel={closePanel}
              onDeleted={async () => {
                await personalData.refresh();
                closePanel();
              }}
              ownerId={user?.uid ?? ""}
              renderMode="dialog"
            />
          ) : null}
        </FinanceDialog>
      )}
    </>
  );
}
