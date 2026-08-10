"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AccountDetailView } from "@/features/accounts/components/account-detail-view";
import { NewPocketDialog } from "@/features/dashboard/components/personal-views";
import { usePersonalDashboardData } from "@/features/dashboard/hooks/use-personal-dashboard-data";
import { useAuthStore } from "@/stores/auth-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

/**
 * Detalle de cuenta como pantalla propia. Antes era un modal montado desde la
 * lista; ahora tiene URL, y por tanto es enlazable, recargable y navegable con
 * el botón atrás del navegador.
 *
 * Acepta cuentas cerradas: el detalle sigue siendo consultable (es donde vive
 * "Reabrir cuenta"), igual que cuando el modal las abría.
 */
export default function AccountDetailPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = use(params);
  const router = useRouter();
  const personalData = usePersonalDashboardData();
  const masked = useUiPreferencesStore((state) => state.balancesHidden);
  const ownerId = useAuthStore((state) => state.user?.uid ?? "");
  const [newPocketOpen, setNewPocketOpen] = useState(false);

  const data = personalData.data;

  const account = useMemo(
    () =>
      data.accounts.find((item) => item.id === accountId) ??
      data.archivedAccounts.find((item) => item.id === accountId) ??
      null,
    [data.accounts, data.archivedAccounts, accountId],
  );

  const pockets = useMemo(
    () => data.pockets.filter((pocket) => pocket.accountId === accountId),
    [data.pockets, accountId],
  );

  // Incluye cerradas para que un movimiento que referencia una cuenta cerrada
  // resuelva su nombre real en vez de caer al fallback "Cuenta eliminada".
  const allAccountsForLookup = useMemo(
    () => [...data.accounts, ...data.archivedAccounts],
    [data.accounts, data.archivedAccounts],
  );

  // "Todavía no cargó" y "no existe" son estados DISTINTOS: con la lista aún
  // vacía, afirmar "no encontramos esta cuenta" es una mentira momentánea.
  // `accountsResolved` es la única condición bajo la cual la ausencia en
  // `accounts`/`archivedAccounts` significa realmente que la cuenta no existe.
  // (`DashboardShell` ya cubre loading/idle/error/partial con sus propias
  // superficies antes de renderizar esta página; esta guarda es explícita para
  // que el contrato no dependa de ese orden.)
  const accountsResolved = personalData.status === "success";

  if (!account && !accountsResolved) {
    return (
      <div className="rounded-[28px] border border-white/8 bg-[rgba(18,25,39,0.96)] px-6 py-10 text-center">
        <p className="text-sm text-[var(--fm-text-muted)]" role="status">
          Cargando cuenta…
        </p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="rounded-[28px] border border-white/8 bg-[rgba(18,25,39,0.96)] px-6 py-10 text-center">
        <p className="text-sm text-[var(--fm-text-muted)]">
          No encontramos esta cuenta. Puede que la hayas eliminado.
        </p>
        <Link
          href="/accounts"
          className="mt-4 inline-flex rounded-xl px-3 py-2 text-sm font-semibold text-[var(--fm-pending)] transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
        >
          Volver a Cuentas
        </Link>
      </div>
    );
  }

  return (
    <>
      <AccountDetailView
        account={account}
        pockets={pockets}
        transactions={data.allTransactions}
        categories={data.categories}
        accounts={allAccountsForLookup}
        masked={masked}
        ownerId={ownerId}
        onAddPocketClick={() => setNewPocketOpen(true)}
        onDeleted={async () => {
          // Eliminada la cuenta, esta URL deja de existir: no dejar huérfano.
          router.replace("/accounts");
          if (personalData.refresh) {
            await personalData.refresh();
          }
        }}
        refresh={personalData.refresh}
      />

      {newPocketOpen && (
        <NewPocketDialog
          open={newPocketOpen}
          account={account}
          ownerId={ownerId}
          onClose={() => setNewPocketOpen(false)}
          onCreated={async () => {
            if (personalData.refresh) {
              await personalData.refresh();
            }
          }}
        />
      )}
    </>
  );
}
