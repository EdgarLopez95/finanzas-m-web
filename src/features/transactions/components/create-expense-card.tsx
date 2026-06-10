"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, Calendar } from "lucide-react";
import { IconSelect } from "@/components/finance/icon-select";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { useCreatePersonalExpense } from "@/features/transactions/hooks/use-create-personal-expense";
import { readAvailableThirdPartyFunds } from "@/features/transactions/services/read-available-third-party-funds";
import {
  TransactionFormSurface,
  type TransactionFormRenderMode,
} from "@/features/transactions/components/transaction-form-surface";
import { formatCurrencyCop } from "@/lib/format/currency";
import { getTodayDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import { getAccountVisual } from "@/lib/design/personal-visuals";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";

type CreateExpenseCardProps = {
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

export function CreateExpenseCard({
  ownerId,
  accounts,
  categories,
  onCreated,
  renderMode = "card",
  defaultAccountId,
  onCancel,
}: CreateExpenseCardProps) {
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories],
  );

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId || accounts[0]?.id || "");
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? "");
  const [date, setDate] = useState(getTodayDateInputValue);
  const [description, setDescription] = useState("");
  const [availableNoPropio, setAvailableNoPropio] = useState(0);
  const [consumesThirdPartyFunds, setConsumesThirdPartyFunds] = useState(false);
  const [thirdPartyConsumeAmount, setThirdPartyConsumeAmount] = useState("");
  const [isHouseholdShared, setIsHouseholdShared] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { isSubmitting, error: serviceError, successMessage, submitExpense, resetFeedback } =
    useCreatePersonalExpense();

  const activeError = localError || serviceError;



  useEffect(() => {
    let active = true;

    const loadFunds = async () => {
      try {
        const { totalAvailable } = await readAvailableThirdPartyFunds(ownerId);
        if (active) {
          setAvailableNoPropio(totalAvailable);
        }
      } catch (error) {
        console.error("Error loading available third party funds:", error);
      }
    };

    void loadFunds();

    return () => {
      active = false;
    };
  }, [ownerId]);

  // Strict validation logic for disabling the submit button
  const isFormValid = useMemo(() => {
    const parsedAmount = Number(amount.replace(/\./g, ""));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return false;
    if (!description.trim()) return false;
    if (!accountId) return false;
    if (!categoryId) return false;
    if (!date) return false;

    if (consumesThirdPartyFunds) {
      const parsedConsumeAmount = Number(thirdPartyConsumeAmount.replace(/\./g, ""));
      if (!Number.isFinite(parsedConsumeAmount) || parsedConsumeAmount <= 0) return false;
      if (parsedConsumeAmount > parsedAmount) return false;
      if (parsedConsumeAmount > availableNoPropio) return false;
    }

    return true;
  }, [amount, description, accountId, categoryId, date, consumesThirdPartyFunds, thirdPartyConsumeAmount, availableNoPropio]);

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

    let parsedConsumeAmount = 0;
    if (consumesThirdPartyFunds) {
      parsedConsumeAmount = Number(thirdPartyConsumeAmount.replace(/\./g, ""));
    }

    const ok = await submitExpense({
      ownerId,
      amount: parsedAmount,
      accountId,
      categoryId,
      date: parsedDate,
      description: description.trim(),
      consumesThirdPartyFunds,
      thirdPartyConsumeAmount: consumesThirdPartyFunds ? parsedConsumeAmount : undefined,
    });

    if (!ok) {
      return;
    }

    setAmount("");
    setDescription("");
    setConsumesThirdPartyFunds(false);
    setThirdPartyConsumeAmount("");
    setIsHouseholdShared(false);
    await onCreated();
  };

  if (!accounts.length) {
    return (
      <EmptyState
        description="Necesitas al menos una cuenta para registrar gastos."
        title="Sin cuentas"
      />
    );
  }

  if (!expenseCategories.length) {
    return (
      <EmptyState
        description="Necesitas categorías personales de tipo gasto para registrar gastos."
        title="Sin categorías de gasto"
      />
    );
  }


  return (
    <TransactionFormSurface
      renderMode={renderMode}
      subtitle="Registro manual personal"
      title="Nuevo gasto"
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
            "rounded-2xl border bg-[rgba(239,68,68,0.035)] p-4 transition-all duration-200",
            activeError ? "border-[var(--fm-expense)]/20" : "border-[rgba(239,68,68,0.08)]",
            "focus-within:border-[var(--fm-expense)]/25 focus-within:bg-[rgba(239,68,68,0.05)]"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(239,68,68,0.12)] text-[var(--fm-expense)]">
                <ArrowDownLeft className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fm-text-muted)]">
                Monto del gasto
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
              aria-label="Monto del gasto"
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
                  htmlFor="expenseDescription"
                  className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                >
                  Concepto
                </label>
                <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                  Obligatorio
                </span>
              </div>
              <input
                id="expenseDescription"
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
                  htmlFor="expenseDate"
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
                  id="expenseDate"
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

          {/* Categoría + Cuenta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center">
                <label
                  htmlFor="expenseCategoryId"
                  className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                >
                  Categoría
                </label>
                <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                  Obligatorio
                </span>
              </div>
              <IconSelect
                id="expenseCategoryId"
                required
                value={categoryId}
                onChange={(val) => {
                  setCategoryId(val);
                  setLocalError(null);
                }}
                options={expenseCategories.map((cat) => {
                  const Icon = resolveCategoryIcon(cat.iconKey ?? "", "expense");
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
                  htmlFor="expenseAccountId"
                  className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                >
                  Cuenta
                </label>
                <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                  Obligatorio
                </span>
              </div>
              <IconSelect
                id="expenseAccountId"
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

          {/* Tipo de Gasto + Compartir con Hogar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]">
                Tipo de gasto
              </span>
              <div className="grid grid-cols-2 bg-white/[0.02] border border-white/8 p-0.5 rounded-xl h-11">
                <button
                  type="button"
                  onClick={() => {
                    setConsumesThirdPartyFunds(false);
                    setLocalError(null);
                  }}
                  className={cn(
                    "rounded-[10px] text-xs font-semibold transition-all cursor-pointer select-none",
                    !consumesThirdPartyFunds
                      ? "bg-[var(--fm-expense)] text-slate-950 font-bold shadow-sm"
                      : "text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]"
                  )}
                >
                  Mío
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConsumesThirdPartyFunds(true);
                    setLocalError(null);
                  }}
                  className={cn(
                    "rounded-[10px] text-xs font-semibold transition-all cursor-pointer select-none",
                    consumesThirdPartyFunds
                      ? "bg-[var(--fm-expense)] text-slate-950 font-bold shadow-sm"
                      : "text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]"
                  )}
                >
                  Otro
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]">
                Compartir con Hogar
              </span>
              <div className="flex items-center justify-between bg-white/[0.02] border border-white/8 px-3.5 rounded-xl h-11 transition-all">
                <span className="text-xs text-[var(--fm-text-soft)] font-medium">
                  {isHouseholdShared ? "Compartido con hogar" : "Solo cuenta para ti"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsHouseholdShared(!isHouseholdShared)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-white/20 select-none",
                    isHouseholdShared ? "bg-[var(--fm-expense)]" : "bg-white/10"
                  )}
                  role="switch"
                  aria-checked={isHouseholdShared}
                  aria-label="Compartir con Hogar"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      isHouseholdShared ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Si es Gasto Otro (Usa dinero no propio) */}
          {consumesThirdPartyFunds ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3.5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[var(--fm-text-soft)]">Dinero no propio disponible:</span>
                <span className="font-bold text-[var(--fm-pending)] bg-[rgba(228,179,99,0.1)] px-2 py-0.5 rounded-md border border-[var(--fm-pending)]/20">
                  {formatCurrencyCop(availableNoPropio)}
                </span>
              </div>
              
              {availableNoPropio > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center">
                    <label
                      htmlFor="expenseThirdPartyConsumeAmount"
                      className="text-[10px] font-bold uppercase tracking-wider text-[var(--fm-text-muted)]"
                    >
                      Monto a consumir
                    </label>
                    <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                      Obligatorio
                    </span>
                  </div>
                  <input
                    id="expenseThirdPartyConsumeAmount"
                    type="text"
                    inputMode="decimal"
                    placeholder={`Disponible: ${formatCurrencyCop(availableNoPropio)}`}
                    required
                    value={thirdPartyConsumeAmount}
                    onChange={(e) => {
                      setThirdPartyConsumeAmount(formatAmountInput(e.target.value));
                      setLocalError(null);
                    }}
                    className="h-10 w-full rounded-xl border border-white/8 bg-white/[0.02] px-3.5 text-sm text-[var(--fm-warm-paper)] focus:border-[var(--fm-pending)]/50 focus:ring-0 outline-none transition-all"
                  />
                </div>
              ) : (
                <p className="text-xs text-[var(--fm-expense)]">
                  No tienes saldo de terceros disponible para consumir en este momento.
                </p>
              )}
            </div>
          ) : null}
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
                tone="destructive"
                type="submit"
                className={cn(
                  "rounded-xl px-5 select-none cursor-pointer",
                  isFormValid && !isSubmitting
                    ? "bg-[var(--fm-expense)] hover:bg-[color-mix(in_oklch,var(--fm-expense),white_8%)] text-slate-950 font-bold shadow-[0_12px_28px_rgba(239,68,68,0.15)]"
                    : "bg-white/[0.03] border border-white/5 text-white/25 cursor-not-allowed"
                )}
              >
                {isSubmitting ? "Guardando..." : "Guardar gasto"}
              </FinanceButton>
            </div>
          </div>
        </div>
      </form>
    </TransactionFormSurface>
  );
}
