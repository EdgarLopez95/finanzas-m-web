"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2, AlertTriangle, Wallet } from "lucide-react";

// PUENTE PERSONAL: acreditar el reembolso acredita dinero en mi cuenta personal.
import { FinanceButton } from "@/components/finance/finance-button";
import { useConfirmDebtReception } from "@/features/household/hooks/use-confirm-debt-reception";
import { useFocusTrap } from "@/features/household/hooks/use-focus-trap";
import { usePersonalDataStore, canSubmitPersonalData } from "@/stores/personal-data-store";

import { formatCurrencyCop } from "@/lib/format/currency";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Se invoca al descartar con "Ahora no" (X, backdrop o botón secundario): marca el debtId como descartado para no reabrirlo en bucle en el mismo estado. */
  onDismiss: () => void;
  debtId: string;
  debtAmount: number;
  debtorName: string;
  currentUid: string;
  /** Motivo por el que no se pudo resolver la cuenta origen para acreditar. */
  reason: string;
  onSuccess?: () => void;
};

/**
 * Sheet de acreditación manual de un reembolso. Se abre automáticamente al
 * recibir `needs_manual_account` (household-debt-auto-settle). Paridad Android:
 * el origen se resuelve primero desde `event.sourceTransactionId` y, si falta,
 * desde `completedByTransactionId` de la share completada del pagador. Este
 * sheet cubre de forma segura los casos donde ninguna fuente permite acreditar
 * en una cuenta propia viva. Paridad Android: el sheet Home tras
 * `NeedsManualAccount`, con el
 * mismo copy ("No pudimos acreditar automático") y las mismas dos acciones
 * ("Acreditar reembolso" / "Ahora no"). `confirmReception` no acepta fecha ni
 * descripción libres (`HouseholdDebtRepository.kt:361-395`), así que este
 * diálogo tampoco las pide.
 */
export function ConfirmReceptionDialog({
  open,
  onClose,
  onDismiss,
  debtId,
  debtAmount,
  debtorName,
  currentUid,
  reason,
  onSuccess,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { isSubmitting, error: submitError, submit, resetError } = useConfirmDebtReception();

  const accounts = usePersonalDataStore((state) => state.data.accounts);
  const personalStatus = usePersonalDataStore((state) => state.status);
  const loadPersonalData = usePersonalDataStore((state) => state.load);

  const [accountId, setAccountId] = useState("");

  useEffect(() => {
    if (open && currentUid) {
      void loadPersonalData(currentUid);
    }
  }, [open, currentUid, loadPersonalData]);

  const activeAccounts = useMemo(() => {
    return accounts.filter((a) => !a.archived);
  }, [accounts]);

  useEffect(() => {
    if (open) {
      setAccountId(activeAccounts[0]?.id ?? "");
      resetError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeAccounts, debtorName]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleDismiss = () => {
    onDismiss();
    onClose();
  };

  useFocusTrap(dialogRef, open, handleDismiss);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmitPersonalData(personalStatus)) return;
    if (!accountId) return;

    const ok = await submit({
      debtId,
      ownerId: currentUid,
      accountId,
    });

    if (ok) {
      if (onSuccess) onSuccess();
      onClose();
    }
  };

  return (
    <div
      data-fm-context="personal"
      className="fixed inset-0 z-[98] flex items-end sm:items-center justify-center bg-black/80 px-4 pb-4 sm:py-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="No pudimos acreditar automático"
        tabIndex={-1}
        className="w-full max-w-md rounded-[24px] border border-white/[0.08] bg-[var(--fm-surface-dark)] shadow-xl flex flex-col max-h-[90vh] overflow-hidden outline-none animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
          <div>
            <h2 className="font-[var(--font-display)] text-lg font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
              No pudimos acreditar automático
            </h2>
            <p className="text-xs text-[var(--fm-text-muted)] mt-0.5 max-w-[280px] truncate">
              Deudor: {debtorName}
            </p>
          </div>
          <FinanceButton
            type="button"
            size="icon"
            tone="text"
            variant="ghost"
            aria-label="Ahora no"
            onClick={handleDismiss}
            className="h-8 w-8 shrink-0 rounded-full"
          >
            <X className="h-4 w-4" />
          </FinanceButton>
        </div>

        {personalStatus === "loading" && accounts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--fm-pending)]" />
            <p className="text-sm text-[var(--fm-text-muted)]">Cargando tus finanzas personales...</p>
          </div>
        ) : activeAccounts.length === 0 ? (
          <div className="flex-1 p-6 text-center space-y-4">
            <p className="text-sm text-[var(--fm-text-muted)]">
              No tienes cuentas personales activas registradas. Primero debes crear una cuenta en la sección &quot;Personal&quot; para poder recibir pagos.
            </p>
            <FinanceButton onClick={handleDismiss} className="w-full">
              Entendido
            </FinanceButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-4">
              {/* Por qué se pide intervención manual */}
              <div className="flex gap-2.5 rounded-[16px] bg-[var(--fm-border-dark)] border border-[var(--fm-border-dark)] p-3.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--fm-warm-paper)]" />
                <p className="text-xs text-[var(--fm-text-muted)] leading-relaxed">
                  {reason} Elige la cuenta donde quieres recibir este reembolso para acreditarlo.
                </p>
              </div>

              {/* Resumen de Monto a Recibir */}
              <div className="rounded-[16px] bg-[var(--fm-income)] border border-[var(--fm-income)] p-4 text-center">
                <span className="text-xs text-[var(--fm-text-muted)] uppercase tracking-wider font-semibold">
                  Monto Recibido
                </span>
                <p className="text-2xl font-bold tracking-tight text-[var(--fm-income)] mt-1">
                  {formatCurrencyCop(debtAmount)}
                </p>
              </div>

              {/* Cuenta Destino */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm-reception-account" className="text-[13px] font-medium text-[var(--fm-warm-paper)] flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-[var(--fm-text-muted)]" />
                  Cuenta de destino *
                </label>
                <select
                  id="confirm-reception-account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  required
                  className="h-11 rounded-[16px] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[16px] sm:text-[14px] text-[var(--fm-warm-paper)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)] appearance-none cursor-pointer"
                >
                  {activeAccounts.map((acc) => {
                    // Paso 1 (cierre): `acc.balance` YA es el Disponible crudo — no restar bolsillos.
                    return (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatCurrencyCop(acc.balance)})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Advertencia de Impacto */}
              <div className="rounded-[12px] bg-white/[0.02] border border-white/[0.06] p-3 text-xs text-[var(--fm-text-muted)] leading-relaxed">
                Se sumará a tu cuenta personal y la deuda quedará pagada.
              </div>

              {personalStatus !== "success" && (
                <div className="rounded-[12px] bg-[var(--fm-expense)] border border-[var(--fm-expense)] p-3 text-xs text-[var(--fm-expense)] font-medium leading-relaxed">
                  No puedes acreditar este reembolso porque tus datos personales no están completamente verificados (estado: {personalStatus}). Reintenta antes de continuar.
                </div>
              )}

              {submitError && (
                <div className="rounded-[12px] bg-[var(--fm-expense)] border border-[var(--fm-expense)] p-3 text-xs text-[var(--fm-expense)] font-medium">
                  {submitError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06] bg-white/[0.01] shrink-0">
              <FinanceButton
                type="button"
                tone="text"
                variant="ghost"
                onClick={handleDismiss}
                disabled={isSubmitting}
              >
                Ahora no
              </FinanceButton>
              <FinanceButton
                type="submit"
                tone="filled"
                disabled={isSubmitting || !canSubmitPersonalData(personalStatus) || !accountId}
                className="bg-[var(--fm-income)] text-[var(--fm-ink)] hover:bg-[color-mix(in_oklch,var(--fm-income),white_8%)]"
              >
                {isSubmitting ? "Acreditando..." : "Acreditar reembolso"}
              </FinanceButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
