"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeftRight, Pencil, Trash2, Wallet } from "lucide-react";

import { Amount } from "@/components/finance/amount";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { useTransactionPanelStore } from "@/stores/transaction-panel-store";
import { useDeletePersonalEntities } from "@/features/accounts/hooks/use-delete-personal-entities";
import { calculateAccountPhysicalBalances } from "@/lib/finance/account-balance-model";
import { resolveAccountComposition, buildPocketCompositionRows } from "@/lib/finance/account-ownership-composition";
import { evaluateThirdPartyLegacy } from "@/lib/finance/third-party-legacy-evaluation";
import { resolveAccountActionAvailability } from "@/features/accounts/lib/account-action-availability";
import {
  resolveOwnershipViewState,
  isOwnershipReady,
  runIfAllowed,
  type OwnershipSnapshot,
} from "@/features/accounts/lib/account-ownership-view-state";
import { readThirdPartyLocationSnapshot } from "@/features/transactions/services/read-third-party-location-snapshot";
import { formatCurrencyCop } from "@/lib/format/currency";
import type { Account } from "@/types/account";
import type { Pocket } from "@/types/pocket";

type PocketDetailDialogProps = {
  open: boolean;
  account: Account | null;
  pocket: Pocket | null;
  /** Bolsillos de ESA cuenta — necesarios para derivar Disponible y composición. */
  pockets: Pocket[];
  masked?: boolean;
  ownerId: string;
  onClose: () => void;
  /** Delega la edición al `EditPocketDialog` que ya monta la vista de Cuentas. */
  onEdit: (pocket: Pocket) => void;
  /** Se llama tras eliminar, para refrescar los datos de la vista. */
  onDeleted: () => Promise<void> | void;
};

/**
 * Detalle de un bolsillo desde la página Cuentas.
 *
 * Paridad semántica con el sheet de Android (saldo, cuenta padre, mover dinero,
 * editar, eliminar) pero con el patrón web ya usado en el producto: un modal
 * centrado (`FinanceDialog`), no un bottom sheet.
 *
 * Las acciones que mueven o atribuyen dinero comparten exactamente el mismo
 * gate que el detalle de cuenta (`resolveAccountActionAvailability` sobre un
 * snapshot de propiedad de ESTA cuenta). Fail-closed: sin snapshot válido no se
 * habilita mover ni eliminar. Los servicios siguen siendo la barrera real.
 */
export function PocketDetailDialog({
  open,
  account,
  pocket,
  pockets,
  masked = false,
  ownerId,
  onClose,
  onEdit,
  onDeleted,
}: PocketDetailDialogProps) {
  const blockReasonId = useId();
  const openCreate = useTransactionPanelStore((state) => state.openCreate);
  const { isSubmitting, error, resetError, submitDeletePocket } = useDeletePersonalEntities();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Mismo patrón que `AccountDetailDialog`: la lectura ocurre al abrir, nunca en
  // render ni desde una suscripción, y se descarta si cambia la cuenta.
  const [ownershipSnapshot, setOwnershipSnapshot] = useState<OwnershipSnapshot | null>(null);
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);

  const accountId = account?.id ?? null;

  useEffect(() => {
    if (!open || !accountId || !ownerId) return;
    let cancelled = false;

    setOwnershipSnapshot(null);
    setOwnershipError(null);
    setOwnershipLoading(true);

    readThirdPartyLocationSnapshot(ownerId)
      .then((snapshot) => {
        if (cancelled) return;
        setOwnershipSnapshot({ accountId, ...snapshot });
      })
      .catch(() => {
        if (cancelled) return;
        setOwnershipSnapshot(null);
        setOwnershipError("No se pudo calcular tu dinero propio. Intenta nuevamente.");
      })
      .finally(() => {
        if (!cancelled) setOwnershipLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, accountId, ownerId]);

  // Al cerrar se limpia el estado local de confirmación/errores.
  // `resetError` se lee desde un ref: el hook la recrea en cada render, y como
  // dependencia del efecto provocaba un bucle de actualizaciones.
  const resetErrorRef = useRef(resetError);
  resetErrorRef.current = resetError;

  useEffect(() => {
    if (!open) {
      setConfirmDelete(false);
      resetErrorRef.current();
    }
  }, [open]);

  if (!open || !account || !pocket) return null;

  const { availableBalance, pocketsBalance } = calculateAccountPhysicalBalances(account.balance, pockets);

  const ownershipView = resolveOwnershipViewState({
    accountId: account.id,
    loading: ownershipLoading,
    error: ownershipError,
    snapshot: ownershipSnapshot,
  });
  const readySnapshot = isOwnershipReady(ownershipView) ? ownershipView.snapshot : null;

  const composition = resolveAccountComposition({
    accountId: account.id,
    availableBalance,
    pockets: pockets.map((item) => ({ id: item.id, balance: item.balance })),
    entries: readySnapshot?.entries ?? [],
    moves: readySnapshot?.moves ?? [],
    consumptions: readySnapshot?.consumptions ?? [],
  });
  const actions = resolveAccountActionAvailability({
    archived: account.archived === true,
    composition,
    legacy: evaluateThirdPartyLegacy({ entries: readySnapshot?.entries ?? [] }),
    pocketCount: pockets.length,
    ownershipStatus: ownershipView.status,
  });

  // G1: la línea de composición solo aporta cuando hay dinero no propio o una
  // inconsistencia. En el caso limpio, el saldo ya visible lo dice todo.
  const compositionRow = buildPocketCompositionRows(
    composition,
    pockets.map((item) => ({ id: item.id, name: item.name })),
  ).find((row) => row.pocketId === pocket.id);
  const showComposition =
    readySnapshot !== null && compositionRow !== undefined && (compositionRow.thirdParty !== 0 || compositionRow.isInconsistent);

  const isArchived = account.archived === true;
  const blockReason = actions.moveThirdParty.reason;

  const handleDelete = async () => {
    resetError();
    const deleted = await submitDeletePocket(ownerId, pocket.id, account.id);
    if (!deleted) return;
    setConfirmDelete(false);
    onClose();
    await onDeleted();
  };

  if (confirmDelete) {
    return (
      <FinanceDialog
        open
        title="Eliminar bolsillo"
        subtitle="Se eliminará este bolsillo y los movimientos asociados a él. Esta acción no se puede deshacer."
        onClose={() => {
          if (!isSubmitting) {
            setConfirmDelete(false);
            resetError();
          }
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--fm-warm-paper)]">
            {`Vas a eliminar "${pocket.name}" y liberar su saldo a la cuenta disponible.`}
          </p>
          {error ? <p className="text-sm text-[var(--fm-expense)]">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <FinanceButton
              type="button"
              tone="outlined"
              variant="outline"
              onClick={() => {
                setConfirmDelete(false);
                resetError();
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </FinanceButton>
            <FinanceButton type="button" tone="destructive" onClick={() => void handleDelete()} disabled={isSubmitting}>
              {isSubmitting ? "Eliminando..." : "Eliminar bolsillo"}
            </FinanceButton>
          </div>
        </div>
      </FinanceDialog>
    );
  }

  return (
    <FinanceDialog
      open
      /* Título como nodo para llevar el icono de bolsillo junto al nombre;
         replica los estilos del <h2> que FinanceDialog aplica a un title string. */
      title={
        <h2 className="flex items-center gap-2.5 font-[var(--font-display)] text-[24px] font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
          <Wallet aria-hidden="true" className="h-6 w-6 shrink-0 text-[var(--fm-text-soft)]" />
          <span className="truncate">{pocket.name}</span>
        </h2>
      }
      subtitle={`Cuenta: ${account.name}`}
      onClose={onClose}
    >
      <div className="space-y-5">
        {/* Saldo del bolsillo — el número que abre el modal. */}
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--fm-text-soft)]">
            <Wallet aria-hidden="true" className="h-4 w-4" />
            Saldo del bolsillo
          </p>
          <Amount
            className="mt-1.5 block text-[32px] font-bold leading-none tracking-[-0.02em] text-[var(--fm-warm-paper)]"
            masked={masked}
            showSign={false}
            size="sm"
            value={pocket.balance}
          />
          {showComposition && compositionRow ? (
            <p className="mt-2 text-[11px] text-[var(--fm-text-muted)]">
              Mi dinero{" "}
              <span className={compositionRow.own < 0 ? "font-semibold text-[var(--fm-expense)]" : "text-[var(--fm-text-soft)]"}>
                {formatCurrencyCop(compositionRow.own)}
              </span>
              {" · "}No propio <span className="text-[var(--fm-transfer)]">{formatCurrencyCop(compositionRow.thirdParty)}</span>
              {compositionRow.isInconsistent ? " · Requiere revisión" : null}
            </p>
          ) : null}
        </div>

        {/* Contexto de la cuenta padre — solo lectura. */}
        <div className="grid grid-cols-2 gap-2 border-t border-white/6 pt-4">
          <div className="rounded-[14px] bg-white/[0.03] px-3.5 py-3">
            <p className="text-[11px] text-[var(--fm-text-muted)]">Disponible en cuenta</p>
            <Amount
              className="mt-1 block text-base font-semibold text-[var(--fm-warm-paper)]"
              masked={masked}
              showSign={false}
              size="sm"
              value={availableBalance}
            />
          </div>
          <div className="rounded-[14px] bg-white/[0.03] px-3.5 py-3">
            <p className="text-[11px] text-[var(--fm-text-muted)]">Total en bolsillos</p>
            <Amount
              className="mt-1 block text-base font-semibold text-[var(--fm-warm-paper)]"
              masked={masked}
              showSign={false}
              size="sm"
              value={pocketsBalance}
            />
          </div>
        </div>

        {/* Acciones — ocultas por completo en una cuenta cerrada. */}
        {isArchived ? (
          <p className="border-t border-white/6 pt-4 text-xs text-[var(--fm-text-muted)]">
            Esta cuenta está cerrada. Reábrela para volver a mover o editar sus bolsillos.
          </p>
        ) : (
          <div className="space-y-3 border-t border-white/6 pt-4">
            <FinanceButton
              type="button"
              variant="default"
              tone="filled"
              className="w-full"
              disabled={!actions.moveThirdParty.enabled}
              title={actions.moveThirdParty.reason ?? undefined}
              aria-describedby={actions.moveThirdParty.reason ? blockReasonId : undefined}
              onClick={() =>
                runIfAllowed(actions.moveThirdParty, () => {
                  openCreate("transfer", account.id, pocket.id);
                  onClose();
                })
              }
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Mover dinero
            </FinanceButton>

            <div className="flex flex-wrap gap-2">
              <FinanceButton type="button" variant="ghost" tone="text" size="sm" onClick={() => onEdit(pocket)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Editar
              </FinanceButton>
              <FinanceButton
                type="button"
                variant="ghost"
                tone="text"
                size="sm"
                className="text-[var(--fm-expense)]"
                disabled={!actions.deletePocket.enabled}
                title={actions.deletePocket.reason ?? undefined}
                aria-describedby={actions.deletePocket.reason ? blockReasonId : undefined}
                onClick={() => runIfAllowed(actions.deletePocket, () => setConfirmDelete(true))}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Eliminar
              </FinanceButton>
            </div>

            {/*
              Motivo único: hoy `moveThirdParty` y `deletePocket` comparten el
              mismo `moneyAction` en `resolveAccountActionAvailability`, así que
              ambos controles apuntan a este párrafo. Si algún día divergen,
              habrá que partirlo en dos.
            */}
            {blockReason ? (
              <p id={blockReasonId} className="text-[11px] text-[var(--fm-text-muted)]" role="status">
                {blockReason}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </FinanceDialog>
  );
}
