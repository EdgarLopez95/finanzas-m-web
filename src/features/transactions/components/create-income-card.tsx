"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { useCreatePersonalIncome } from "@/features/transactions/hooks/use-create-personal-income";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";

const todayIso = () => new Date().toISOString().slice(0, 10);

type CreateIncomeCardProps = {
  ownerId: string;
  accounts: Account[];
  categories: Category[];
  onCreated: () => Promise<void>;
};

export function CreateIncomeCard({ ownerId, accounts, categories, onCreated }: CreateIncomeCardProps) {
  const incomeCategories = useMemo(
    () => categories.filter((category) => category.type === "income"),
    [categories]
  );

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(incomeCategories[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState("");

  const { isSubmitting, error, successMessage, submitIncome, resetFeedback } = useCreatePersonalIncome();

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

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return;
    }

    const ok = await submitIncome({
      ownerId,
      amount: parsedAmount,
      accountId,
      categoryId,
      date: parsedDate,
      description,
    });

    if (!ok) {
      return;
    }

    setAmount("");
    setDescription("");
    await onCreated();
  };

  if (!accounts.length) {
    return <EmptyState title="Sin cuentas" description="Necesitas al menos una cuenta para registrar ingresos." />;
  }

  if (!incomeCategories.length) {
    return <EmptyState title="Sin categorias de ingreso" description="Necesitas categorias personales de tipo ingreso para registrar ingresos." />;
  }

  return (
    <FinanceCard title="Nuevo ingreso" subtitle="Registro manual personal" variant="interactive">
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <FinanceTextField
          label="Monto"
          placeholder="Ej. 350000"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          required
        />

        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-medium text-[var(--fm-warm-paper)]" htmlFor="incomeAccountId">
            Cuenta destino
          </label>
          <select
            id="incomeAccountId"
            className="h-11 rounded-[var(--fm-radius-input)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[14px] text-[var(--fm-warm-paper)]"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            required
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-medium text-[var(--fm-warm-paper)]" htmlFor="incomeCategoryId">
            Categoria de ingreso
          </label>
          <select
            id="incomeCategoryId"
            className="h-11 rounded-[var(--fm-radius-input)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[14px] text-[var(--fm-warm-paper)]"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
          >
            {incomeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <FinanceTextField label="Fecha" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        <FinanceTextField
          label="Descripcion (opcional)"
          placeholder="Ej. Pago cliente"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        {error ? <p className="text-sm text-[var(--fm-expense)]">{error}</p> : null}
        {successMessage ? <p className="text-sm text-[var(--fm-income)]">{successMessage}</p> : null}

        <FinanceButton disabled={isSubmitting} tone="filled" type="submit">
          {isSubmitting ? "Guardando..." : "Guardar ingreso"}
        </FinanceButton>
      </form>
    </FinanceCard>
  );
}