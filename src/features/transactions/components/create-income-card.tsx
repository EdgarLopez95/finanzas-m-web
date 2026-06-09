"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { useCreatePersonalIncome } from "@/features/transactions/hooks/use-create-personal-income";
import {
  TransactionFormSurface,
  type TransactionFormRenderMode,
} from "@/features/transactions/components/transaction-form-surface";
import { getTodayDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";

type CreateIncomeCardProps = {
  ownerId: string;
  accounts: Account[];
  categories: Category[];
  onCreated: () => Promise<void>;
  renderMode?: TransactionFormRenderMode;
};

export function CreateIncomeCard({
  ownerId,
  accounts,
  categories,
  onCreated,
  renderMode = "card",
}: CreateIncomeCardProps) {
  const incomeCategories = useMemo(
    () => categories.filter((category) => category.type === "income"),
    [categories],
  );

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(incomeCategories[0]?.id ?? "");
  const [date, setDate] = useState(getTodayDateInputValue);
  const [description, setDescription] = useState("");
  const [countsAsRealIncome, setCountsAsRealIncome] = useState(true);

  const { isSubmitting, error, successMessage, submitIncome, resetFeedback } =
    useCreatePersonalIncome();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    const parsedAmount = Number(amount.replace(/,/g, "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    if (!accountId || !categoryId || !date) {
      return;
    }

    const parsedDate = parseDateInputAsLocalDate(date);
    if (!parsedDate) {
      return;
    }

    const ok = await submitIncome({
      ownerId,
      amount: parsedAmount,
      accountId,
      categoryId,
      countsAsRealIncome,
      date: parsedDate,
      description,
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
        description="Necesitas categorias personales de tipo ingreso para registrar ingresos."
        title="Sin categorias de ingreso"
      />
    );
  }

  return (
    <TransactionFormSurface
      renderMode={renderMode}
      subtitle="Registro manual personal"
      title="Nuevo ingreso"
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <FinanceTextField
          inputMode="decimal"
          label="Monto"
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Ej. 350000"
          required
          value={amount}
        />

        <div className="flex flex-col gap-2">
          <label
            className="text-[14px] font-medium text-[var(--fm-warm-paper)]"
            htmlFor="incomeAccountId"
          >
            Cuenta destino
          </label>
          <select
            id="incomeAccountId"
            className="h-11 rounded-[var(--fm-radius-input)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[14px] text-[var(--fm-warm-paper)]"
            onChange={(event) => setAccountId(event.target.value)}
            required
            value={accountId}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="text-[14px] font-medium text-[var(--fm-warm-paper)]"
            htmlFor="incomeCategoryId"
          >
            Categoria de ingreso
          </label>
          <select
            id="incomeCategoryId"
            className="h-11 rounded-[var(--fm-radius-input)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[14px] text-[var(--fm-warm-paper)]"
            onChange={(event) => setCategoryId(event.target.value)}
            required
            value={categoryId}
          >
            {incomeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <FinanceTextField
          label="Fecha"
          onChange={(event) => setDate(event.target.value)}
          required
          type="date"
          value={date}
        />
        <FinanceTextField
          label="Descripcion (opcional)"
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ej. Pago cliente"
          value={description}
        />

        <label
          className="rounded-[var(--fm-radius-card-medium)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] p-3"
          htmlFor="incomeCountsAsRealIncome"
        >
          <div className="flex items-start gap-3">
            <input
              checked={countsAsRealIncome}
              className="mt-1 h-4 w-4 accent-[var(--fm-income)]"
              id="incomeCountsAsRealIncome"
              onChange={(event) => setCountsAsRealIncome(event.target.checked)}
              type="checkbox"
            />
            <div className="space-y-1">
              <p className="text-[14px] font-medium text-[var(--fm-warm-paper)]">
                Cuenta como ingreso real
              </p>
              <p className="text-xs text-muted-foreground">
                Activalo para sueldo, ventas o dinero propio. Desactivalo para reembolsos o
                dinero de otra persona.
              </p>
            </div>
          </div>
        </label>

        {error ? <p className="text-sm text-[var(--fm-expense)]">{error}</p> : null}
        {successMessage ? <p className="text-sm text-[var(--fm-income)]">{successMessage}</p> : null}

        <FinanceButton disabled={isSubmitting} tone="filled" type="submit">
          {isSubmitting ? "Guardando..." : "Guardar ingreso"}
        </FinanceButton>
      </form>
    </TransactionFormSurface>
  );
}
