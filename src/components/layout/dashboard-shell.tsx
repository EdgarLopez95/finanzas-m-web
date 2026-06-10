"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Calendar, Check, ChevronDown, Eye, EyeOff, PencilLine, Plus, Repeat } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { EmptyState } from "@/components/finance/empty-state";
import { cn } from "@/lib/utils";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDropdown } from "@/components/finance/finance-dropdown";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { FinanceShimmer } from "@/components/finance/finance-shimmer";
import { FinanceSidePanel } from "@/components/finance/finance-side-panel";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthRedirectPath } from "@/features/auth/auth-routing";
import { useAuthBootstrap } from "@/features/auth/use-auth-bootstrap";
import {
  usePersonalDashboardData,
  usePersonalDataLoader,
} from "@/features/dashboard/hooks/use-personal-dashboard-data";
import { useHouseholdLoader } from "@/features/household/hooks/use-household-data";
import { CreateMovementDialog } from "@/features/transactions/components/create-movement-dialog";
import { DeleteTransactionConfirmCard } from "@/features/transactions/components/delete-transaction-confirm-card";
import { EditTransactionCard } from "@/features/transactions/components/edit-transaction-card";
import { useTransactionPanelStore, type TransactionPanelKind } from "@/stores/transaction-panel-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";
import type { Transaction } from "@/types/transaction";

type ViewKey = "home" | "movements" | "accounts" | "categories" | "settings" | "household";

const VIEW_BY_PATH: Record<string, ViewKey> = {
  "/dashboard": "home",
  "/movements": "movements",
  "/accounts": "accounts",
  "/categories": "categories",
  "/settings": "settings",
  "/household": "household",
};

const monthFormatter = new Intl.DateTimeFormat("es-CO", { month: "long" });

const capitalize = (value: string): string => {
  if (!value.length) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const getTopBarCopy = (view: ViewKey, userName?: string | null) => {
  const firstName = userName?.split(" ").find(Boolean) ?? "usuario";
  const monthLabel = capitalize(monthFormatter.format(new Date()));
  const yearLabel = String(new Date().getFullYear());

  switch (view) {
    case "home":
      return { title: "Inicio", subtitle: `Hola, ${firstName} - resumen de ${monthLabel} ${yearLabel}` };
    case "movements":
      return { title: "Movimientos", subtitle: "Historial completo de gastos, ingresos y transferencias" };
    case "accounts":
      return { title: "Cuentas", subtitle: "Tus cuentas personales y sus bolsillos" };
    case "categories":
      return { title: "Gastos por categoría", subtitle: "En qué se te está yendo la plata este mes" };
    case "household":
      return { title: "Hogar", subtitle: "Resumen compartido en modo lectura para tu contexto familiar" };
    default:
      return { title: "Ajustes", subtitle: "Perfil, preferencias y personalización" };
  }
};

const getPanelTitle = (kind: TransactionPanelKind, transaction: Transaction | null) => {
  if (kind === "expense") {
    return "Nuevo gasto";
  }
  if (kind === "income") {
    return "Nuevo ingreso";
  }
  if (kind === "transfer") {
    return "Nueva transferencia";
  }
  if (kind === "edit" && transaction) {
    if (transaction.type === "expense") {
      return "Editar gasto";
    }
    if (transaction.type === "income") {
      return "Editar ingreso";
    }
    return "Editar transferencia";
  }
  return "Editar movimiento";
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

const LoadingContent = () => (
  <>
    <FinanceShimmer className="h-40 w-full rounded-[32px]" />
    <FinanceShimmer className="h-72 w-full rounded-[32px]" />
  </>
);

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
  const isHousehold = view === "household";

  const { status, user } = useAuthBootstrap();
  const authenticated = status === "authenticated";

  // Drivers ÚNICOS de carga. enabled = authenticated es estable entre
  // navegaciones, así que no hay reset-thrash: los datos se cargan una vez y
  // persisten mientras la sesión siga activa.
  usePersonalDataLoader(user?.uid ?? null, authenticated);
  useHouseholdLoader(user?.uid ?? null, authenticated);

  const personalData = usePersonalDashboardData();

  const balancesHidden = useUiPreferencesStore((state) => state.balancesHidden);
  const toggleBalancesHidden = useUiPreferencesStore((state) => state.toggleBalancesHidden);
  const hydratePreferences = useUiPreferencesStore((state) => state.hydrate);
  const isEditingBoard = useUiPreferencesStore((state) => state.isEditingBoard);
  const setEditingBoard = useUiPreferencesStore((state) => state.setEditingBoard);

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

  const monthLabel = capitalize(monthFormatter.format(new Date()));
  const topBarCopy = getTopBarCopy(view, user?.displayName);

  const openCreatePanel = (kind: "expense" | "income" | "transfer") => {
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
      description: "Registrar una entrada",
      icon: <ArrowUpRight className="h-4.5 w-4.5" />,
      iconClassName: "border-[rgba(74,222,128,0.16)] bg-[rgba(74,222,128,0.06)] text-[var(--fm-income)]",
      onClick: () => openCreatePanel("income"),
    },
    {
      label: "Nueva transferencia",
      description: "Mover entre cuentas o bolsillos",
      icon: <Repeat className="h-4.5 w-4.5" />,
      iconClassName: "border-[rgba(59,130,246,0.16)] bg-[rgba(59,130,246,0.06)] text-[var(--fm-transfer)]",
      onClick: () => openCreatePanel("transfer"),
    },
  ];

  const handleEditDashboard = () => {
    setEditingBoard(!isEditingBoard);
  };

  const topBarActions = isHousehold ? (
    <FinanceButton onClick={() => router.push("/dashboard")} tone="text" type="button" variant="ghost">
      Volver a Inicio
    </FinanceButton>
  ) : (
    <>
      <button
        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[18px] border border-[rgba(148,163,184,0.14)] bg-[rgba(23,31,47,0.92)] px-4 text-sm font-semibold text-[var(--fm-warm-paper)] transition-colors hover:bg-[rgba(28,38,57,0.96)]"
        type="button"
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
            isEditingBoard && "border-[rgba(228,179,99,0.3)] bg-[rgba(228,179,99,0.1)] text-[var(--fm-pending)] hover:bg-[rgba(228,179,99,0.15)] hover:text-[var(--fm-pending)]"
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
  );

  const shellProps = {
    title: topBarCopy.title,
    subtitle: topBarCopy.subtitle,
    actions: topBarActions,
    userName: user?.displayName,
    userEmail: user?.email,
    movementCount: personalData.data.transactions.length,
  };

  if (status === "unauthenticated") {
    return null;
  }

  let content: React.ReactNode;

  if (status === "loading") {
    content = loadingGuardTriggered ? (
      <EmptyState
        description="No pudimos resolver tu sesión a tiempo. Intenta volver a iniciar sesión."
        title="Demora al validar sesión"
      />
    ) : (
      <LoadingContent />
    );
  } else if (isHousehold) {
    // La página de Hogar gestiona sus propios estados (cargando/vacío/error).
    content = children;
  } else if (personalData.status === "loading" || personalData.status === "idle") {
    content = <LoadingContent />;
  } else if (personalData.status === "error") {
    content = (
      <EmptyState
        description={personalData.error ?? "Intenta recargar esta vista."}
        title="Error al cargar datos"
      />
    );
  } else {
    content = (
      <>
        {personalData.error ? (
          <div className="rounded-[24px] border border-[rgba(228,179,99,0.25)] bg-[rgba(228,179,99,0.1)] px-4 py-3 text-sm text-[var(--fm-pending)]">
            Se cargaron datos parciales. Revisa reglas o permisos de Firestore.
          </div>
        ) : null}

        {personalData.hasThirdPartyInconsistency ? (
          <div className="rounded-[24px] border border-[rgba(239,68,68,0.24)] bg-[rgba(239,68,68,0.1)] px-4 py-3 text-sm text-[var(--fm-expense)]">
            Hay una inconsistencia por revisar en dinero no propio.
          </div>
        ) : null}

        {children}
      </>
    );
  }

  return (
    <>
      <AppShell {...shellProps}>{content}</AppShell>

      <FinanceSidePanel
        onClose={closePanel}
        open={panelKind === "edit"}
        subtitle="Actualiza los datos del movimiento personal sin salir de la vista actual."
        title={getPanelTitle(panelKind, panelTransaction)}
      >
        {panelKind === "edit" && panelTransaction ? (
          <EditTransactionCard
            accounts={personalData.data.accounts}
            categories={personalData.data.categories}
            movement={panelTransaction}
            onCancel={closePanel}
            onUpdated={async () => {
              await personalData.refresh();
              closePanel();
            }}
            ownerId={user?.uid ?? ""}
            renderMode="panel"
          />
        ) : null}
      </FinanceSidePanel>

      <CreateMovementDialog />

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
    </>
  );
}
