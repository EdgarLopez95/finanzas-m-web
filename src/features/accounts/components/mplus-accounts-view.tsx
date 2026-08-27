"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AccountIcon } from "@/components/finance/account-icon";
import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceChip } from "@/components/finance/finance-chip";
import { FinanceDropdown } from "@/components/finance/finance-dropdown";
import { AddAccountCard } from "@/features/accounts/components/add-account-card";
import { MplusAccountDialog } from "@/features/accounts/components/mplus-account-dialog";
import {
  archiveMplusAccount,
  unarchiveMplusAccount,
} from "@/features/accounts/services/mplus-account-service";
import type { MplusPersonalAccount } from "@/lib/mplus/models";
import { useAuthStore } from "@/stores/auth-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

/**
 * Cuentas Personales del contrato v1 (matriz W2).
 *
 * Una cuenta pasa a ser una ETIQUETA informativa. Se conservan la card, el
 * icono de banco, la rejilla y el slot punteado "Agregar otra cuenta"; se
 * retiran los bloques de saldo, disponible, bolsillos, ajuste de saldo y la
 * eliminacion en cascada. Lo que queda como accion es editar y archivar.
 */

export function MplusAccountsView() {
  const accounts = useMplusPersonalStore((state) => state.accounts);
  const status = useMplusPersonalStore((state) => state.status);
  const error = useMplusPersonalStore((state) => state.error);
  const refresh = useMplusPersonalStore((state) => state.refresh);
  const applyCommittedAccount = useMplusPersonalStore((state) => state.applyCommittedAccount);
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const ownerId = user?.uid ?? "";

  const [dialogAccount, setDialogAccount] = useState<MplusPersonalAccount | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.state === "active"),
    [accounts],
  );
  const archivedAccounts = useMemo(
    () => accounts.filter((account) => account.state === "archived"),
    [accounts],
  );

  const runStateChange = async (
    account: MplusPersonalAccount,
    operation: typeof archiveMplusAccount,
  ) => {
    setPendingId(account.id);
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
          ? "Alguien más cambió esta cuenta mientras la editabas. Vuelve a intentarlo."
          : outcome.kind === "unavailable"
            ? "No hay conexión con el servidor. El cambio NO se guardó."
            : outcome.message,
      );
    } catch (thrown) {
      setActionError(
        thrown instanceof Error ? thrown.message : "No se pudo actualizar la cuenta.",
      );
    } finally {
      setPendingId(null);
    }
  };

  if (status === "error") {
    return (
      <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" variant="default">
        <div role="alert" className="space-y-4">
          <EmptyState
            title="No pudimos cargar tus cuentas"
            description={error ?? "Revisa tu conexion e intenta de nuevo."}
          />
          <div className="flex justify-center">
            <FinanceButton type="button" size="sm" onClick={() => void refresh()}>
              Reintentar
            </FinanceButton>
          </div>
        </div>
      </FinanceCard>
    );
  }

  return (
    <>
      {/*
        Mismo hero abierto de la Web base. Ya no muestra un total porque en M+
        una cuenta no guarda dinero: explica para que sirve.
      */}
      <section className="rounded-[var(--fm-radius-hero)] bg-[rgba(255,255,255,0.022)] px-6 py-7 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--fm-text-soft)]">
              Tus cuentas
            </p>
            <p className="text-[13px] leading-relaxed text-[var(--fm-text-muted)]">
              Son etiquetas opcionales para recordar de donde salio o entro el dinero. No guardan saldo ni afectan tus totales del mes.
            </p>
          </div>
          <span className="shrink-0 self-start sm:self-center rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-[var(--fm-text-muted)] select-none">
            Vista personal activa
          </span>
        </div>
      </section>

      {actionError ? (
        <p
          role="alert"
          className="rounded-xl border border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.08)] px-3.5 py-2.5 text-sm text-[var(--fm-expense)]"
        >
          {actionError}
        </p>
      ) : null}

      <section className="grid items-start gap-5 xl:grid-cols-2">
        {activeAccounts.map((account) => (
          <article
            key={account.id}
            className="rounded-[var(--fm-radius-card-medium)] border border-white/8 bg-[rgba(18,25,39,0.96)] px-5 py-5 transition-colors hover:border-white/12 animate-in fade-in duration-200"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              {/* La identidad de la cuenta abre su detalle; el menú de acciones
                  queda fuera del área navegable para no competir con él. */}
              <button
                type="button"
                onClick={() => router.push(`/accounts/${account.id}`)}
                className="flex min-w-0 flex-1 items-start gap-3.5 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
              >
                <AccountIcon
                  iconType={account.iconType}
                  iconKey={account.iconKey}
                  color={account.color}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-[var(--font-display)] text-base font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]">
                    {account.name}
                  </h3>
                  <p className="mt-1 text-[12px] text-[var(--fm-text-muted)]">
                    {account.referenceCount === 0
                      ? "Sin movimientos asociados"
                      : account.referenceCount === 1
                        ? "1 movimiento la usa"
                        : `${account.referenceCount} movimientos la usan`}
                  </p>
                </div>
              </button>

              <FinanceDropdown
                align="right"
                items={[
                  {
                    label: "Editar",
                    onClick: () => {
                      setDialogAccount(account);
                      setDialogOpen(true);
                    },
                  },
                  {
                    label: "Archivar",
                    onClick: () => void runStateChange(account, archiveMplusAccount),
                  },
                ]}
              />
            </div>
          </article>
        ))}

        <AddAccountCard
          onClick={() => {
            setDialogAccount(null);
            setDialogOpen(true);
          }}
        />
      </section>

      {activeAccounts.length === 0 ? (
        <EmptyState
          title="Sin cuentas"
          description="Puedes registrar movimientos sin cuenta: solo agregala si te sirve para recordar de donde salio el dinero."
        />
      ) : null}

      {archivedAccounts.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--fm-text-soft)]">
              Cuentas archivadas
            </p>
            <FinanceChip
              className="normal-case tracking-normal px-2 py-0.5 text-[10px]"
              variant="neutral"
            >
              {archivedAccounts.length}
            </FinanceChip>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {archivedAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[rgba(18,25,39,0.7)] px-4 py-3 text-left opacity-70 transition-opacity hover:opacity-100"
              >
                <button
                  type="button"
                  onClick={() => router.push(`/accounts/${account.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
                >
                  <AccountIcon
                    iconType={account.iconType}
                    iconKey={account.iconKey}
                    color={account.color}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--fm-text-soft)]">
                      {account.name}
                    </p>
                    <p className="text-[11px] text-[var(--fm-text-muted)]">
                      Archivada · no aparece al registrar movimientos
                    </p>
                  </div>
                </button>
                <FinanceButton
                  type="button"
                  size="sm"
                  tone="text"
                  variant="ghost"
                  disabled={pendingId === account.id}
                  onClick={() => void runStateChange(account, unarchiveMplusAccount)}
                  className="h-8 text-[var(--fm-text-soft)] hover:text-[var(--fm-warm-paper)]"
                >
                  Reactivar
                </FinanceButton>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <MplusAccountDialog
        open={dialogOpen}
        ownerId={ownerId}
        account={dialogAccount}
        onClose={() => {
          setDialogOpen(false);
          setDialogAccount(null);
        }}
      />
    </>
  );
}
