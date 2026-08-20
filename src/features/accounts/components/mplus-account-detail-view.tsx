"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { AccountIcon } from "@/components/finance/account-icon";
import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceChip } from "@/components/finance/finance-chip";
import { PersonalTransactionRow } from "@/components/finance/personal-transaction-row";
import { MplusAccountDialog } from "@/features/accounts/components/mplus-account-dialog";
import {
  archiveMplusAccount,
  unarchiveMplusAccount,
} from "@/features/accounts/services/mplus-account-service";
import {
  buildMplusMovementRows,
  groupRowsByDay,
} from "@/features/movements/lib/personal-month-view-model";
import { formatPeriodLabel } from "@/lib/format/date";
import type { MplusPersonalAccount } from "@/lib/mplus/models";
import { useAppContextStore } from "@/stores/app-context-store";
import { useAuthStore } from "@/stores/auth-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

/**
 * Detalle de una cuenta en el contrato v1 (matriz W2).
 *
 * Conserva el breadcrumb, el header de cuenta y la lista de movimientos. Se
 * retiran el balance, el disponible, los bolsillos, el reajuste de saldo y la
 * eliminacion en cascada: en M+ una cuenta no guarda dinero. Las acciones que
 * quedan son editar y archivar/reactivar.
 */

export function MplusAccountDetailView({
  account,
  masked,
}: {
  account: MplusPersonalAccount;
  masked: boolean;
}) {
  const movements = useMplusPersonalStore((state) => state.movements);
  const categories = useMplusPersonalStore((state) => state.categories);
  const accounts = useMplusPersonalStore((state) => state.accounts);
  const refresh = useMplusPersonalStore((state) => state.refresh);
  const applyCommittedAccount = useMplusPersonalStore((state) => state.applyCommittedAccount);
  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);
  const ownerId = useAuthStore((state) => state.user?.uid ?? "");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const isArchived = account.state === "archived";

  const groupedRows = useMemo(() => {
    const accountMovements = movements.filter(
      (movement) => movement.accountId === account.id,
    );
    return groupRowsByDay(buildMplusMovementRows(accountMovements, categories, accounts));
  }, [account.id, accounts, categories, movements]);

  const runStateChange = async (operation: typeof archiveMplusAccount) => {
    setIsPending(true);
    setActionError(null);
    try {
      const outcome = await operation(account);
      if (outcome.kind === "success") {
        if (outcome.replayed) {
          await refresh();
        } else {
          applyCommittedAccount(outcome.value);
        }
        return;
      }
      setActionError(
        outcome.kind === "conflict"
          ? "Alguien mas cambio esta cuenta. Recargamos el estado del servidor."
          : outcome.kind === "unavailable"
            ? "No hay conexion con el servidor. El cambio NO se guardo."
            : outcome.message,
      );
      if (outcome.kind === "conflict") await refresh();
    } catch (thrown) {
      setActionError(
        thrown instanceof Error ? thrown.message : "No se pudo actualizar la cuenta.",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      {/* Breadcrumb: Cuentas › {nombre}. El segmento actual es texto, no link. */}
      <nav aria-label="Ruta de navegación" className="mb-4 flex items-center gap-1.5 text-sm">
        <Link
          href="/accounts"
          className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[var(--fm-text-muted)] transition-colors hover:text-[var(--fm-warm-paper)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Cuentas
        </Link>
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-[var(--fm-text-soft)]" />
        <span aria-current="page" className="truncate px-1.5 py-1 font-medium text-[var(--fm-warm-paper)]">
          {account.name}
        </span>
      </nav>

      <section className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <AccountIcon
            iconType={account.iconType}
            iconKey={account.iconKey}
            color={account.color}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-[var(--font-display)] text-xl font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]">
                {account.name}
              </h1>
              {isArchived ? (
                <FinanceChip
                  className="normal-case tracking-normal px-2 py-0.5 text-[10px]"
                  variant="neutral"
                >
                  Archivada
                </FinanceChip>
              ) : null}
            </div>
            <p className="mt-1 text-[12px] text-[var(--fm-text-muted)]">
              {account.referenceCount === 0
                ? "Sin movimientos asociados"
                : account.referenceCount === 1
                  ? "1 movimiento la usa"
                  : `${account.referenceCount} movimientos la usan`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FinanceButton
            type="button"
            size="sm"
            tone="outlined"
            variant="outline"
            disabled={isPending}
            onClick={() => setDialogOpen(true)}
          >
            Editar
          </FinanceButton>
          <FinanceButton
            type="button"
            size="sm"
            tone="text"
            variant="ghost"
            disabled={isPending}
            onClick={() =>
              void runStateChange(isArchived ? unarchiveMplusAccount : archiveMplusAccount)
            }
          >
            {isArchived ? "Reactivar" : "Archivar"}
          </FinanceButton>
        </div>
      </section>

      {actionError ? (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.08)] px-3.5 py-2.5 text-sm text-[var(--fm-expense)]"
        >
          {actionError}
        </p>
      ) : null}

      <FinanceCard
        className="border-white/8 bg-[rgba(18,25,39,0.96)]"
        variant="default"
        subtitle={`Movimientos de ${formatPeriodLabel(selectedPeriod)} que usan esta cuenta`}
        title="Movimientos"
      >
        {!groupedRows.length ? (
          <EmptyState
            title="Sin movimientos"
            description="Ningun movimiento de este mes usa esta cuenta."
          />
        ) : (
          <div className="space-y-6">
            {groupedRows.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="px-1 text-[11px] uppercase tracking-[0.22em] text-[var(--fm-text-muted)]">
                  {group.label}
                </p>
                <div className="divide-y divide-white/8">
                  {group.rows.map((row) => (
                    <div key={row.id} className="py-2.5 first:pt-0 last:pb-0">
                      <PersonalTransactionRow masked={masked} row={row} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </FinanceCard>

      <MplusAccountDialog
        open={dialogOpen}
        ownerId={ownerId}
        account={account}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
