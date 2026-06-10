"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Calendar } from "lucide-react";
import { IconSelect } from "@/components/finance/icon-select";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { useCreatePersonalIncome } from "@/features/transactions/hooks/use-create-personal-income";
import {
  TransactionFormSurface,
  type TransactionFormRenderMode,
} from "@/features/transactions/components/transaction-form-surface";
import { getTodayDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import { getAccountVisual } from "@/lib/design/personal-visuals";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";

type CreateIncomeCardProps = {
  ownerId: string;
  accounts: Account[];
  categories: Category[];
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

export function CreateIncomeCard({
  ownerId,
  accounts,
  categories,
  onCreated,
  renderMode = "card",
  defaultAccountId,
  onCancel,
}: CreateIncomeCardProps) {
  const incomeCategories = useMemo(
    () => categories.filter((category) => category.type === "income"),
    [categories],
  );

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId || accounts[0]?.id || "");
  const [categoryId, setCategoryId] = useState(incomeCategories[0]?.id ?? "");
  const [date, setDate] = useState(getTodayDateInputValue);
  const [description, setDescription] = useState("");
  const [countsAsRealIncome, setCountsAsRealIncome] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const { isSubmitting, error: serviceError, successMessage, submitIncome, resetFeedback } =
    useCreatePersonalIncome();

  const activeError = localError || serviceError;



  // Strict validation logic for disabling the submit button
  const isFormValid = useMemo(() => {
    const parsedAmount = Number(amount.replace(/\./g, ""));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return false;
    if (!description.trim()) return false;
    if (!accountId) return false;
    if (!categoryId) return false;
    if (!date) return false;
    return true;
  }, [amount, description, accountId, categoryId, date]);

  const handleSubmit = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }
    if (!isFormValid || isSubmitting) {
      return;
    }

    resetFeedback();
    setLocalError(null);

    const parsedAmount = Number(amount.replace(/\./g, ""));
    const parsedDate = parseDateInputAsLocalDate(date);
    if (!parsedDate) {
      setLocalError("La fecha ingresada no es válida.");
      return;
    }

    const ok = await submitIncome({
      ownerId,
      amount: parsedAmount,
      accountId,
      categoryId,
      countsAsRealIncome,
      date: parsedDate,
      description: description.trim(),
    });

    if (!ok) {
      return;
    }

    setAmount("");
    setDescription("");
    setCountsAsRealIncome(true);
    await onCreated();
  };

  if (!accounts.length) {
    return (
      <EmptyState
        description="Necesitas al menos una cuenta para registrar ingresos."
        title="Sin cuentas"
      />
    );
  }

  if (!incomeCategories.length) {
    return (
      <EmptyState
        description="Necesitas categorías personales de tipo ingreso para registrar ingresos."
        title="Sin categorías de ingreso"
      />
    );
  }

  return (
    <TransactionFormSurface
      renderMode={renderMode}
      subtitle="Registro manual personal"
      title="Nuevo ingreso"
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
            "rounded-2xl border bg-[rgba(74,222,128,0.035)] p-4 transition-all duration-200",
            activeError ? "border-[var(--fm-income)]/20" : "border-[rgba(74,222,128,0.08)]",
            "focus-within:border-[var(--fm-income)]/25 focus-within:bg-[rgba(74,222,128,0.05)]"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(74,222,128,0.12)] text-[var(--fm-income)]">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fm-text-muted)]">
                Monto del ingreso
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
                setLocalError(null);
              }}
              className="w-full bg-transparent border-none outline-none focus:ring-0 p-0 text-3xl font-bold tracking-tight text-[var(--fm-warm-paper)] placeholder:text-white/[0.08]"
              aria-label="Monto del ingreso"
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
                  htmlFor="incomeDescription"
                  className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                >
                  Concepto
                </label>
                <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                  Obligatorio
                </span>
              </div>
              <input
                id="incomeDescription"
                type="text"
                placeholder="Título o concepto"
                required
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setLocalError(null);
                }}
                className="h-11 w-full rounded-xl border border-white/8 bg-white/[0.02] px-3.5 text-sm text-[var(--fm-warm-paper)] focus:border-[var(--fm-pending)]/50 focus:ring-0 outline-none transition-all placeholder:text-white/[0.12]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center">
                <label
                  htmlFor="incomeDate"
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
                  id="incomeDate"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setLocalError(null);
                  }}
                  className="h-11 w-full rounded-xl border border-white/8 bg-white/[0.02] pl-3.5 pr-8 text-sm text-[var(--fm-warm-paper)] focus:border-[var(--fm-pending)]/50 focus:ring-0 outline-none transition-all cursor-pointer"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fm-text-muted)] pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Categoría + Cuenta Destino */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center">
                <label
                  htmlFor="incomeCategoryId"
                  className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                >
                  Categoría
                </label>
                <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                  Obligatorio
                </span>
              </div>
              <IconSelect
                id="incomeCategoryId"
                required
                value={categoryId}
                onChange={(val) => {
                  setCategoryId(val);
                  setLocalError(null);
                }}
                options={incomeCategories.map((cat) => {
                  const Icon = resolveCategoryIcon(cat.iconKey ?? "", "income");
                  return {
                    id: cat.id,
                    label: cat.name,
                    color: cat.color,
                    icon: <Icon className="h-3.5 w-3.5" />,
                  };
                })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center">
                <label
                  htmlFor="incomeAccountId"
                  className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                >
                  Cuenta destino
                </label>
                <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                  Obligatorio
                </span>
              </div>
              <IconSelect
                id="incomeAccountId"
                required
                value={accountId}
                onChange={(val) => {
                  setAccountId(val);
                  setLocalError(null);
                }}
                options={accounts.map((acc) => ({
                  id: acc.id,
                  label: acc.name,
                  color: getAccountVisual(acc).accent,
                }))}
              />
            </div>
          </div>

          {/* Tipo de Ingreso */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]">
              Tipo de ingreso
            </span>
            <div className="grid grid-cols-2 bg-white/[0.02] border border-white/8 p-0.5 rounded-xl h-11">
              <button
                type="button"
                onClick={() => {
                  setCountsAsRealIncome(true);
                  setLocalError(null);
                }}
                className={cn(
                  "rounded-[10px] text-xs font-semibold transition-all cursor-pointer select-none",
                  countsAsRealIncome
                    ? "bg-[var(--fm-income)] text-slate-950 font-bold shadow-sm"
                    : "text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]"
                )}
              >
                Mío
              </button>
              <button
                type="button"
                onClick={() => {
                  setCountsAsRealIncome(false);
                  setLocalError(null);
                }}
                className={cn(
                  "rounded-[10px] text-xs font-semibold transition-all cursor-pointer select-none",
                  !countsAsRealIncome
                    ? "bg-[var(--fm-income)] text-slate-950 font-bold shadow-sm"
                    : "text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]"
                )}
              >
                En tránsito (no propio)
              </button>
            </div>
          </div>
        </div>

        {/* ── 3. Feedback y Footer ── */}
        <div className="space-y-4 pt-2">
          {activeError ? (
            <p className="text-sm text-[var(--fm-expense)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.16)] px-3.5 py-2.5 rounded-xl">
              {activeError}
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
                    ? "bg-[var(--fm-income)] hover:bg-[color-mix(in_oklch,var(--fm-income),white_8%)] text-slate-950 font-bold shadow-[0_12px_28px_rgba(74,222,128,0.15)]"
                    : "bg-white/[0.03] border border-white/5 text-white/25 cursor-not-allowed"
                )}
              >
                {isSubmitting ? "Guardando..." : "Guardar ingreso"}
              </FinanceButton>
            </div>
          </div>
        </div>
      </form>
    </TransactionFormSurface>
  );
}
