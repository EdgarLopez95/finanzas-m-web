"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Calendar } from "lucide-react";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { useCreatePersonalTransfer } from "@/features/transactions/hooks/use-create-personal-transfer";
import {
  TransactionFormSurface,
  type TransactionFormRenderMode,
} from "@/features/transactions/components/transaction-form-surface";
import { getTodayDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import { formatCurrencyCop } from "@/lib/format/currency";
import { getAccountVisual } from "@/lib/design/personal-visuals";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/account";
import type { Pocket } from "@/types/pocket";

type CreateTransferCardProps = {
  ownerId: string;
  accounts: Account[];
  pockets?: Pocket[];
  onCreated: () => Promise<void>;
  renderMode?: TransactionFormRenderMode;
  defaultAccountId?: string;
  onCancel?: () => void;
};

const formatAmountInput = (rawValue: string): string => {
  const clean = rawValue.replace(/\D/g, "");
  if (!clean) return "";
  const formattedEn = Number(clean).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
  return formattedEn.replace(/,/g, ".");
};

export function CreateTransferCard({
  ownerId,
  accounts,
  pockets = [],
  onCreated,
  renderMode = "card",
  defaultAccountId,
  onCancel,
}: CreateTransferCardProps) {
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId || accounts[0]?.id || "");
  const [targetAccountId, setTargetAccountId] = useState(
    accounts.find((a) => a.id !== (defaultAccountId || accounts[0]?.id))?.id || accounts[1]?.id || accounts[0]?.id || ""
  );
  const [date, setDate] = useState(getTodayDateInputValue);
  const [description, setDescription] = useState("");
  const [selectedPocketId, setSelectedPocketId] = useState("");

  const { isSubmitting, error, successMessage, submitTransfer, resetFeedback } =
    useCreatePersonalTransfer();

  const selectedSourceAccount = useMemo(() => {
    return accounts.find((a) => a.id === accountId);
  }, [accounts, accountId]);

  const selectedTargetAccount = useMemo(() => {
    return accounts.find((a) => a.id === targetAccountId);
  }, [accounts, targetAccountId]);

  // Obtener bolsillos de la cuenta destino
  const targetAccountPockets = useMemo(() => {
    if (!targetAccountId) return [];
    return pockets.filter((p) => p.accountId === targetAccountId);
  }, [pockets, targetAccountId]);

  // Swap function to interchange accounts
  const handleSwapAccounts = () => {
    const temp = accountId;
    setAccountId(targetAccountId);
    setTargetAccountId(temp);
    resetFeedback();
  };

  // Strict validation logic for disabling the submit button
  const isFormValid = useMemo(() => {
    const parsedAmount = Number(amount.replace(/\./g, ""));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return false;
    if (!description.trim()) return false;
    if (!accountId) return false;
    if (!targetAccountId) return false;
    if (accountId === targetAccountId) return false;
    if (!date) return false;
    return true;
  }, [amount, description, accountId, targetAccountId, date]);

  const handleSubmit = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }
    if (!isFormValid || isSubmitting) {
      return;
    }

    resetFeedback();

    const parsedAmount = Number(amount.replace(/\./g, ""));
    const parsedDate = parseDateInputAsLocalDate(date);
    if (!parsedDate) {
      return;
    }

    const ok = await submitTransfer({
      ownerId,
      amount: parsedAmount,
      accountId,
      targetAccountId,
      date: parsedDate,
      description: description.trim(),
    });

    if (!ok) {
      return;
    }

    setAmount("");
    setDescription("");
    setSelectedPocketId("");
    await onCreated();
  };

  if (accounts.length < 2) {
    return (
      <EmptyState
        description="Necesitas al menos dos cuentas para transferir."
        title="Cuentas insuficientes"
      />
    );
  }

  return (
    <TransactionFormSurface
      renderMode={renderMode}
      subtitle="Movimiento interno entre cuentas personales"
      title="Nueva transferencia"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        {/* ── 1. Bloque de Monto Protagonista ── */}
        <div
          className={cn(
            "rounded-2xl border bg-[rgba(59,130,246,0.035)] p-4 transition-all duration-200",
            error ? "border-[var(--fm-transfer)]/20" : "border-[rgba(59,130,246,0.08)]",
            "focus-within:border-[var(--fm-transfer)]/25 focus-within:bg-[rgba(59,130,246,0.05)]"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(59,130,246,0.12)] text-[var(--fm-transfer)]">
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fm-text-muted)]">
                Monto a transferir
              </span>
            </div>
          </div>

          <div className="mt-2.5 flex items-baseline gap-1">
            <span className="text-3xl font-light text-[var(--fm-text-muted)] select-none">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              required
              value={amount}
              onChange={(e) => {
                setAmount(formatAmountInput(e.target.value));
                resetFeedback();
              }}
              className="w-full bg-transparent border-none outline-none focus:ring-0 p-0 text-3xl font-bold tracking-tight text-[var(--fm-warm-paper)] placeholder:text-white/[0.08]"
              aria-label="Monto a transferir"
            />
          </div>
        </div>

        {/* ── 2. Campos de Detalles ── */}
        <div className="space-y-4">
          {/* Concepto + Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-[2.2fr_1fr] gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center">
                <label
                  htmlFor="transferDescription"
                  className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                >
                  Concepto
                </label>
                <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                  Obligatorio
                </span>
              </div>
              <input
                id="transferDescription"
                type="text"
                placeholder="Título o concepto"
                required
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  resetFeedback();
                }}
                className="h-11 w-full rounded-xl border border-white/8 bg-white/[0.02] px-3.5 text-sm text-[var(--fm-warm-paper)] focus:border-[var(--fm-pending)]/50 focus:ring-0 outline-none transition-all placeholder:text-white/[0.12]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center">
                <label
                  htmlFor="transferDate"
                  className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                >
                  Fecha
                </label>
                <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                  Obligatorio
                </span>
              </div>
              <div className="relative">
                <input
                  id="transferDate"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    resetFeedback();
                  }}
                  className="h-11 w-full rounded-xl border border-white/8 bg-white/[0.02] pl-3.5 pr-8 text-sm text-[var(--fm-warm-paper)] focus:border-[var(--fm-pending)]/50 focus:ring-0 outline-none transition-all cursor-pointer"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fm-text-muted)] pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Sale de + Llega a */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center">
                <label
                  htmlFor="transferAccountId"
                  className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                >
                  Sale de
                </label>
                <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                  Obligatorio
                </span>
              </div>
              <div className="relative">
                {selectedSourceAccount && (
                  <span
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border border-white/10"
                    style={{ backgroundColor: getAccountVisual(selectedSourceAccount).accent }}
                  />
                )}
                <select
                  id="transferAccountId"
                  required
                  value={accountId}
                  onChange={(e) => {
                    setAccountId(e.target.value);
                    resetFeedback();
                  }}
                  className={cn(
                    "h-11 w-full rounded-xl border border-white/8 bg-white/[0.02] py-2 text-sm text-[var(--fm-warm-paper)] focus:border-[var(--fm-pending)]/50 focus:ring-0 outline-none transition-all cursor-pointer appearance-none pr-8",
                    selectedSourceAccount ? "pl-9" : "px-3.5"
                  )}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id} className="bg-[rgba(21,29,43,0.98)] text-[var(--fm-warm-paper)]">
                      {account.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none border-l-4 border-r-4 border-t-4 border-transparent border-t-[var(--fm-text-muted)] h-0 w-0" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center">
                <label
                  htmlFor="transferTargetAccountId"
                  className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                >
                  Llega a
                </label>
                <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                  Obligatorio
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  {selectedTargetAccount && (
                    <span
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border border-white/10"
                      style={{ backgroundColor: getAccountVisual(selectedTargetAccount).accent }}
                    />
                  )}
                  <select
                    id="transferTargetAccountId"
                    required
                    value={targetAccountId}
                    onChange={(e) => {
                      setTargetAccountId(e.target.value);
                      resetFeedback();
                    }}
                    className={cn(
                      "h-11 w-full rounded-xl border border-white/8 bg-white/[0.02] py-2 text-sm text-[var(--fm-warm-paper)] focus:border-[var(--fm-pending)]/50 focus:ring-0 outline-none transition-all cursor-pointer appearance-none pr-8",
                      selectedTargetAccount ? "pl-9" : "px-3.5"
                    )}
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id} className="bg-[rgba(21,29,43,0.98)] text-[var(--fm-warm-paper)]">
                        {account.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none border-l-4 border-r-4 border-t-4 border-transparent border-t-[var(--fm-text-muted)] h-0 w-0" />
                </div>

                <button
                  type="button"
                  onClick={handleSwapAccounts}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.02] text-[var(--fm-text-soft)] hover:bg-white/10 hover:text-[var(--fm-warm-paper)] transition-all cursor-pointer select-none"
                  title="Intercambiar origen y destino"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Bolsillo Destino (Opcional) */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]">
              Bolsillo destino <span className="text-[10px] text-[var(--fm-text-muted)] lowercase tracking-normal font-normal">opcional</span>
            </span>
            <div className="relative">
              <select
                id="transferPocketId"
                disabled={targetAccountPockets.length === 0}
                value={selectedPocketId}
                onChange={(e) => setSelectedPocketId(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2 text-sm text-[var(--fm-warm-paper)] focus:border-[var(--fm-pending)]/50 focus:ring-0 outline-none transition-all cursor-pointer appearance-none pr-8 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {targetAccountPockets.length === 0 ? (
                  <option value="">Primero elige la cuenta destino</option>
                ) : (
                  <>
                    <option value="">Ninguno (saldo disponible)</option>
                    {targetAccountPockets.map((pocket) => (
                      <option key={pocket.id} value={pocket.id} className="bg-[rgba(21,29,43,0.98)] text-[var(--fm-warm-paper)]">
                        {pocket.name} ({formatCurrencyCop(pocket.balance)})
                      </option>
                    ))}
                  </>
                )}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none border-l-4 border-r-4 border-t-4 border-transparent border-t-[var(--fm-text-muted)] h-0 w-0" />
            </div>
          </div>

          {accountId === targetAccountId ? (
            <p className="text-xs text-[var(--fm-expense)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.16)] px-3.5 py-2 rounded-xl">
              La cuenta origen y destino deben ser diferentes.
            </p>
          ) : null}
        </div>

        {/* ── 3. Feedback y Footer ── */}
        <div className="space-y-4 pt-2">
          {error ? (
            <p className="text-sm text-[var(--fm-expense)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.16)] px-3.5 py-2.5 rounded-xl">
              {error}
            </p>
          ) : null}
          {successMessage ? (
            <p className="text-sm text-[var(--fm-income)] bg-[rgba(74,222,128,0.08)] border border-[rgba(74,222,128,0.16)] px-3.5 py-2.5 rounded-xl">
              {successMessage}
            </p>
          ) : null}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-white/8 pt-4">
            <span className="text-[11px] text-[var(--fm-text-muted)] font-medium">
              {!isFormValid && "Completa el monto y los campos obligatorios."}
            </span>
            
            <div className="flex items-center justify-end gap-2.5">
              {onCancel && (
                <FinanceButton
                  type="button"
                  tone="outlined"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="rounded-xl px-4 select-none cursor-pointer"
                >
                  Cancelar
                </FinanceButton>
              )}
              <FinanceButton
                disabled={!isFormValid || isSubmitting}
                tone="filled"
                type="submit"
                className={cn(
                  "rounded-xl px-5 select-none cursor-pointer",
                  isFormValid && !isSubmitting
                    ? "bg-[var(--fm-transfer)] hover:bg-[color-mix(in_oklch,var(--fm-transfer),white_8%)] text-slate-950 font-bold shadow-[0_12px_28px_rgba(59,130,246,0.15)]"
                    : "bg-white/[0.03] border border-white/5 text-white/25 cursor-not-allowed"
                )}
              >
                {isSubmitting ? "Guardando..." : "Transferir"}
              </FinanceButton>
            </div>
          </div>
        </div>
      </form>
    </TransactionFormSurface>
  );
}
