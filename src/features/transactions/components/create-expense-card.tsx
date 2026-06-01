"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { useCreatePersonalExpense } from "@/features/transactions/hooks/use-create-personal-expense";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";

const todayIso = () => new Date().toISOString().slice(0, 10);

type CreateExpenseCardProps = {
  ownerId: string;
  accounts: Account[];
  categories: Category[];
  onCreated: () => Promise<void>;
};

export function CreateExpenseCard({ ownerId, accounts, categories, onCreated }: CreateExpenseCardProps) {
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories]
  );

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState("");

  const { isSubmitting, error, successMessage, submitExpense, resetFeedback } = useCreatePersonalExpense();

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

    const ok = await submitExpense({
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
    return <EmptyState title="Sin cuentas" description="Necesitas al menos una cuenta para registrar gastos." />;
  }

  if (!expenseCategories.length) {
    return <EmptyState title="Sin categorias de gasto" description="Necesitas categorias personales de tipo gasto para registrar gastos." />;
  }

  return (
    <FinanceCard title="Nuevo gasto" subtitle="Registro manual personal" variant="interactive">
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <FinanceTextField
          label="Monto"
          placeholder="Ej. 25000"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          required
        />

        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-medium text-[var(--fm-warm-paper)]" htmlFor="accountId">
            Cuenta origen
          </label>
          <select
            id="accountId"
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
          <label className="text-[14px] font-medium text-[var(--fm-warm-paper)]" htmlFor="categoryId">
            Categoria de gasto
          </label>
          <select
            id="categoryId"
            className="h-11 rounded-[var(--fm-radius-input)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[14px] text-[var(--fm-warm-paper)]"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
          >
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <FinanceTextField label="Fecha" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        <FinanceTextField
          label="Descripcion (opcional)"
          placeholder="Ej. Mercado semana"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        {error ? <p className="text-sm text-[var(--fm-expense)]">{error}</p> : null}
        {successMessage ? <p className="text-sm text-[var(--fm-income)]">{successMessage}</p> : null}

        <FinanceButton disabled={isSubmitting} tone="filled" type="submit">
          {isSubmitting ? "Guardando..." : "Guardar gasto"}
        </FinanceButton>
      </form>
    </FinanceCard>
  );
}