"use client";

/**
 * G1 — Panel "Distribución de dinero" (mapa de ownership). Se abre desde la
 * línea "No propio pendiente" del hero. Lee el snapshot canónico de ubicación
 * (`readThirdPartyLocationSnapshot`) de forma perezosa al abrir — nunca en
 * render ni como suscripción permanente — y deriva las filas con el módulo
 * puro `buildOwnershipDistribution` (mismo `resolveAccountComposition` del
 * detalle de cuenta, sin proyección paralela).
 */

import { useEffect, useState } from "react";

import { Amount } from "@/components/finance/amount";
import { FinanceChip } from "@/components/finance/finance-chip";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { readThirdPartyLocationSnapshot } from "@/features/transactions/services/read-third-party-location-snapshot";
import {
  buildOwnershipDistribution,
  resolveOwnershipPanelEmptyState,
  type OwnershipDistributionMode,
} from "@/features/dashboard/lib/ownership-distribution-view-model";
import { evaluateThirdPartyLegacy, LEGACY_REVIEW_MESSAGE } from "@/lib/finance/third-party-legacy-evaluation";
import { usePersonalDataStore } from "@/stores/personal-data-store";
import type {
  ThirdPartyLocationConsumption,
  ThirdPartyLocationEntry,
  ThirdPartyLocationMove,
} from "@/lib/finance/third-party-location";
import { cn } from "@/lib/utils";

type Snapshot = {
  entries: ThirdPartyLocationEntry[];
  moves: ThirdPartyLocationMove[];
  consumptions: ThirdPartyLocationConsumption[];
};

export type OwnershipDistributionPanelProps = {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  masked: boolean;
  defaultMode: OwnershipDistributionMode;
};

const MODE_LABEL: Record<OwnershipDistributionMode, string> = {
  not_mine: "Dinero no propio",
  mine: "Mi dinero",
};

const MODE_EMPTY_COPY: Record<OwnershipDistributionMode, string> = {
  not_mine: "No hay dinero no propio ubicado.",
  mine: "No hay saldo propio en ubicaciones.",
};

export function OwnershipDistributionPanel({
  open,
  onClose,
  ownerId,
  masked,
  defaultMode,
}: OwnershipDistributionPanelProps) {
  // G1.1 — físicos vivos del store, no la reconstrucción por período de
  // `HomeView`: el mapa muestra el estado actual, no el de un mes pasado.
  const liveAccounts = usePersonalDataStore((state) => state.data.accounts);
  const livePockets = usePersonalDataStore((state) => state.data.pockets);

  const [mode, setMode] = useState<OwnershipDistributionMode>(defaultMode);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setMode(defaultMode);
    // Solo al abrir: no queremos que un re-render con nuevo defaultMode
    // pise la elección del usuario mientras el panel sigue abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !ownerId) return;
    let cancelled = false;

    setSnapshot(null);
    setError(null);
    setLoading(true);

    readThirdPartyLocationSnapshot(ownerId)
      .then((result) => {
        if (cancelled) return;
        setSnapshot(result);
      })
      .catch(() => {
        if (cancelled) return;
        setSnapshot(null);
        setError("No se pudo calcular la distribución. Intenta nuevamente.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, ownerId]);

  const distribution = snapshot
    ? buildOwnershipDistribution({
        mode,
        accounts: liveAccounts.map((account) => ({ id: account.id, name: account.name, balance: account.balance })),
        pockets: livePockets.map((pocket) => ({
          id: pocket.id,
          accountId: pocket.accountId,
          name: pocket.name,
          balance: pocket.balance,
        })),
        entries: snapshot.entries,
        moves: snapshot.moves,
        consumptions: snapshot.consumptions,
      })
    : null;

  // G1.1 — legado sin ubicación verificable: nunca se imputa a ninguna
  // cuenta/bolsillo, pero tampoco se calla si el hero ya lo sumó al pendiente.
  const legacy = snapshot ? evaluateThirdPartyLegacy({ entries: snapshot.entries }) : null;
  const unlocatedAmount = legacy?.unlocatedAmount ?? 0;
  const emptyState = distribution
    ? resolveOwnershipPanelEmptyState({ groupsLength: distribution.groups.length, unlocatedAmount, mode })
    : null;

  return (
    <FinanceDialog
      onClose={onClose}
      open={open}
      subtitle="Dónde está ubicado tu dinero, por cuenta y bolsillo. Al momento actual."
      title="Distribución de dinero"
    >
      <div className="mb-4 flex gap-2">
        {(["not_mine", "mine"] as const).map((option) => (
          <button
            key={option}
            aria-pressed={mode === option}
            className={cn(
              "flex-1 rounded-full border px-3 py-2 text-[13px] font-semibold transition-colors",
              mode === option
                ? "border-[var(--fm-pending)]/50 bg-[var(--fm-pending)]/15 text-[var(--fm-warm-paper)]"
                : "border-white/10 bg-transparent text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]",
            )}
            onClick={() => setMode(option)}
            type="button"
          >
            {MODE_LABEL[option]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[var(--fm-text-muted)]">Calculando…</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-[var(--fm-expense)]">{error}</p>
      ) : (
        <div className="space-y-4">
          {/* G1.1 — legado sin ubicación verificable: nunca se imputa a una
              cuenta/bolsillo, pero tampoco se calla como si no hubiera nada
              pendiente (el hero ya lo sumó al "No propio pendiente"). */}
          {unlocatedAmount > 0 ? (
            <div className="rounded-xl border border-[var(--fm-pending)]/30 bg-[var(--fm-pending)]/10 px-4 py-3" role="status">
              <p className="text-[13px] leading-relaxed text-[var(--fm-warm-paper)]">{LEGACY_REVIEW_MESSAGE}</p>
              <Amount
                className="mt-1 text-[16px] font-bold text-[var(--fm-pending)]"
                masked={masked}
                showSign={false}
                size="sm"
                value={unlocatedAmount}
              />
            </div>
          ) : null}

          {emptyState === "empty" ? (
            <p className="py-8 text-center text-sm text-[var(--fm-text-muted)]">{MODE_EMPTY_COPY[mode]}</p>
          ) : null}

          {emptyState === "list" && distribution ? (
            <>
              {distribution.groups.map((group) => (
                <div key={group.accountId} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
                    <span className="text-[13px] font-semibold text-[var(--fm-text-soft)] truncate">{group.accountName}</span>
                    <Amount
                      className="text-[13px] font-semibold"
                      masked={masked}
                      showSign={false}
                      size="sm"
                      value={group.groupTotal}
                      variant={mode === "not_mine" ? "transfer" : "default"}
                    />
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {group.rows.map((row) => (
                      <div
                        key={`${row.accountId}::${row.pocketId ?? "available"}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] text-[var(--fm-text-soft)]">
                            {row.kind === "available" ? "Disponible" : row.pocketName}
                          </p>
                          {row.isInconsistent ? (
                            <FinanceChip className="mt-1" variant="expense">
                              Requiere revisión
                            </FinanceChip>
                          ) : null}
                        </div>
                        <Amount
                          className="text-[13px] font-semibold flex-shrink-0"
                          masked={masked}
                          showSign={false}
                          size="sm"
                          value={row.displayAmount}
                          variant={mode === "not_mine" ? "transfer" : "default"}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between border-t border-white/[0.08] pt-3.5">
                <span className="text-[13px] font-semibold text-[var(--fm-text-muted)]">Total</span>
                <Amount
                  className="text-[16px] font-bold"
                  masked={masked}
                  showSign={false}
                  size="sm"
                  value={distribution.grandTotal}
                  variant={mode === "not_mine" ? "transfer" : "default"}
                />
              </div>
            </>
          ) : null}
        </div>
      )}
    </FinanceDialog>
  );
}
