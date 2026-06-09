"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, Eye, EyeOff, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { FinanceShimmer } from "@/components/finance/finance-shimmer";
import { FinanceSidePanel } from "@/components/finance/finance-side-panel";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthBootstrap } from "@/features/auth/use-auth-bootstrap";
import {
  usePersonalDashboardData,
  usePersonalDataLoader,
} from "@/features/dashboard/hooks/use-personal-dashboard-data";
import { useHouseholdLoader } from "@/features/household/hooks/use-household-data";
import { CreateExpenseCard } from "@/features/transactions/components/create-expense-card";
import { CreateIncomeCard } from "@/features/transactions/components/create-income-card";
import { CreateTransferCard } from "@/features/transactions/components/create-transfer-card";
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
      return { title: "Gastos por categoria", subtitle: "En que se te esta yendo la plata este mes" };
    case "household":
      return { title: "Hogar", subtitle: "Resumen compartido en modo lectura para tu contexto familiar" };
    default:
      return { title: "Ajustes", subtitle: "Perfil, preferencias y personalizacion" };
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

  const panelKind = useTransactionPanelStore((state) => state.kind);
  const panelTransaction = useTransactionPanelStore((state) => state.transaction);
  const openCreate = useTransactionPanelStore((state) => state.openCreate);
  const closePanel = useTransactionPanelStore((state) => state.close);

  const [loadingGuardTriggered, setLoadingGuardTriggered] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const quickCreateRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    hydratePreferences();
  }, [hydratePreferences]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickCreateRef.current && !quickCreateRef.current.contains(event.target as Node)) {
        setQuickCreateOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthLabel = capitalize(monthFormatter.format(new Date()));
  const topBarCopy = getTopBarCopy(view, user?.displayName);

  const openCreatePanel = (kind: "expense" | "income" | "transfer") => {
    openCreate(kind);
    setQuickCreateOpen(false);
  };

  const topBarActions = isHousehold ? (
    <FinanceButton onClick={() => router.push("/dashboard")} tone="text" type="button" variant="ghost">
      Volver a Inicio
    </FinanceButton>
  ) : (
    <>
      <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/8 bg-[rgba(18,25,39,0.92)] px-4 text-sm font-medium text-[var(--fm-warm-paper)]">
        <Calendar className="h-4 w-4 text-[var(--fm-pending)]" />
        <span>{monthLabel}</span>
      </div>

      <FinanceButton
        aria-label={balancesHidden ? "Mostrar saldos" : "Ocultar saldos"}
        className="min-w-11 border-white/8 bg-[rgba(18,25,39,0.92)]"
        onClick={toggleBalancesHidden}
        size="icon"
        tone="text"
        type="button"
        variant="ghost"
      >
        {balancesHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </FinanceButton>

      <div ref={quickCreateRef} className="relative">
        <FinanceButton
          className="min-h-11 px-5 shadow-[0_16px_36px_rgb(228_179_99/0.22)]"
          onClick={() => setQuickCreateOpen((current) => !current)}
          size="lg"
          tone="filled"
          type="button"
        >
          <Plus className="h-4 w-4" />
          Nuevo
        </FinanceButton>

        {quickCreateOpen ? (
          <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-64 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,27,40,0.98),rgba(12,18,29,0.98))] p-2 shadow-[0_28px_70px_rgb(2_6_23/0.42)]">
            <button
              className="flex w-full flex-col gap-1 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/5"
              onClick={() => openCreatePanel("expense")}
              type="button"
            >
              <span className="text-sm font-semibold text-[var(--fm-warm-paper)]">Nuevo gasto</span>
              <span className="text-xs text-[var(--fm-text-muted)]">Registrar una salida de dinero</span>
            </button>
            <button
              className="flex w-full flex-col gap-1 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/5"
              onClick={() => openCreatePanel("income")}
              type="button"
            >
              <span className="text-sm font-semibold text-[var(--fm-warm-paper)]">Nuevo ingreso</span>
              <span className="text-xs text-[var(--fm-text-muted)]">Registrar una entrada personal</span>
            </button>
            <button
              className="flex w-full flex-col gap-1 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/5"
              onClick={() => openCreatePanel("transfer")}
              type="button"
            >
              <span className="text-sm font-semibold text-[var(--fm-warm-paper)]">Nueva transferencia</span>
              <span className="text-xs text-[var(--fm-text-muted)]">Mover dinero entre cuentas</span>
            </button>
          </div>
        ) : null}
      </div>
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
        description="No pudimos resolver tu sesion a tiempo. Intenta volver a iniciar sesion."
        title="Demora al validar sesion"
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
        open={
          panelKind === "expense" ||
          panelKind === "income" ||
          panelKind === "transfer" ||
          panelKind === "edit"
        }
        subtitle={
          panelKind === "edit"
            ? "Actualiza los datos del movimiento personal sin salir de la vista actual."
            : "Usa esta capa lateral para registrar movimientos personales con menos friccion."
        }
        title={getPanelTitle(panelKind, panelTransaction)}
      >
        {panelKind === "expense" ? (
          <CreateExpenseCard
            accounts={personalData.data.accounts}
            categories={personalData.data.categories}
            onCreated={async () => {
              await personalData.refresh();
              closePanel();
            }}
            ownerId={user?.uid ?? ""}
            renderMode="panel"
          />
        ) : null}

        {panelKind === "income" ? (
          <CreateIncomeCard
            accounts={personalData.data.accounts}
            categories={personalData.data.categories}
            onCreated={async () => {
              await personalData.refresh();
              closePanel();
            }}
            ownerId={user?.uid ?? ""}
            renderMode="panel"
          />
        ) : null}

        {panelKind === "transfer" ? (
          <CreateTransferCard
            accounts={personalData.data.accounts}
            onCreated={async () => {
              await personalData.refresh();
              closePanel();
            }}
            ownerId={user?.uid ?? ""}
            renderMode="panel"
          />
        ) : null}

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

      <FinanceDialog
        onClose={closePanel}
        open={panelKind === "delete" && Boolean(panelTransaction)}
        subtitle="Confirma esta accion antes de continuar."
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
