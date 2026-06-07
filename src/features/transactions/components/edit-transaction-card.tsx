"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { useUpdatePersonalTransaction } from "@/features/transactions/hooks/use-update-personal-transaction";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";
import type { Transaction } from "@/types/transaction";

const toIsoDate = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

type EditTransactionCardProps = {
  ownerId: string;
  movement: Transaction;
  accounts: Account[];
  categories: Category[];
  onUpdated: () => Promise<void>;
  onCancel: () => void;
};

export function EditTransactionCard({
  ownerId,
  movement,
  accounts,
  categories,
  onUpdated,
  onCancel,
}: EditTransactionCardProps) {
  const isEditableType = movement.type === "expense" || movement.type === "income" || movement.type === "transfer";

  const expenseCategories = useMemo(() => categories.filter((category) => category.type === "expense"), [categories]);
  const incomeCategories = useMemo(() => categories.filter((category) => category.type === "income"), [categories]);

  const [amount, setAmount] = useState(String(movement.amount || ""));
  const [accountId, setAccountId] = useState(movement.accountId || accounts[0]?.id || "");
  const [categoryId, setCategoryId] = useState(
    movement.type === "expense"
      ? movement.categoryId || expenseCategories[0]?.id || ""
      : movement.type === "income"
        ? movement.categoryId || incomeCategories[0]?.id || ""
        : ""
  );
  const [targetAccountId, setTargetAccountId] = useState(
    movement.type === "transfer"
      ? movement.targetAccountId || accounts.find((account) => account.id !== movement.accountId)?.id || ""
      : ""
  );
  const [date, setDate] = useState(toIsoDate(movement.createdAt));
  const [description, setDescription] = useState(movement.notes || "");

  const { isSubmitting, error, successMessage, submitUpdate, resetFeedback } = useUpdatePersonalTransaction();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    if (!isEditableType) {
      return;
    }

    const parsedAmount = Number(amount.replace(/,/g, "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return;
    }

    if (movement.type === "transfer") {
      if (!accountId || !targetAccountId || accountId === targetAccountId) {
        return;
      }

      const ok = await submitUpdate({
        ownerId,
        transactionId: movement.id,
        type: "transfer",
        amount: parsedAmount,
        accountId,
        targetAccountId,
        date: parsedDate,
        description,
      });

      if (!ok) {
        return;
      }

      await onUpdated();
      return;
    }

    if (!accountId || !categoryId) {
      return;
    }

    const typeForUpdate = movement.type === "expense" ? "expense" : "income";
    const ok = await submitUpdate({
      ownerId,
      transactionId: movement.id,
      type: typeForUpdate,
      amount: parsedAmount,
      accountId,
      categoryId,
      date: parsedDate,
      description,
    });

    if (!ok) {
      return;
    }

    await onUpdated();
  };

  if (!accounts.length) {
    return <EmptyState title="Sin cuentas" description="Necesitas cuentas personales para editar movimientos." />;
  }

  if (!isEditableType) {
    return <EmptyState title="Movimiento no editable" description="Este tipo de movimiento no se puede editar en WEB-V4A." />;
  }

  if (movement.type === "expense" && !expenseCategories.length) {
    return <EmptyState title="Sin categorias de gasto" description="No hay categorias personales para editar este gasto." />;
  }

  if (movement.type === "income" && !incomeCategories.length) {
    return <EmptyState title="Sin categorias de ingreso" description="No hay categorias personales para editar este ingreso." />;
  }

  const title =
    movement.type === "expense"
      ? "Editar gasto"
      : movement.type === "income"
        ? "Editar ingreso"
        : "Editar transferencia";

  return (
    <FinanceCard title={title} subtitle="Actualiza datos del movimiento personal" variant="interactive">
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
          <label className="text-[14px] font-medium text-[var(--fm-warm-paper)]" htmlFor="editAccountId">
            {movement.type === "income" ? "Cuenta destino" : "Cuenta origen"}
          </label>
          <select
            id="editAccountId"
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

        {movement.type === "expense" || movement.type === "income" ? (
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-medium text-[var(--fm-warm-paper)]" htmlFor="editCategoryId">
              {movement.type === "expense" ? "Categoria de gasto" : "Categoria de ingreso"}
            </label>
            <select
              id="editCategoryId"
              className="h-11 rounded-[var(--fm-radius-input)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[14px] text-[var(--fm-warm-paper)]"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              required
            >
              {(movement.type === "expense" ? expenseCategories : incomeCategories).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {movement.type === "transfer" ? (
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-medium text-[var(--fm-warm-paper)]" htmlFor="editTargetAccountId">
              Cuenta destino
            </label>
            <select
              id="editTargetAccountId"
              className="h-11 rounded-[var(--fm-radius-input)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[14px] text-[var(--fm-warm-paper)]"
              value={targetAccountId}
              onChange={(event) => setTargetAccountId(event.target.value)}
              required
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {movement.type === "transfer" && accountId === targetAccountId ? (
          <p className="text-sm text-[var(--fm-expense)]">La cuenta origen y destino deben ser diferentes.</p>
        ) : null}

        <FinanceTextField label="Fecha" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        <FinanceTextField
          label="Descripcion (opcional)"
          placeholder="Ej. Ajuste de movimiento"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        {error ? <p className="text-sm text-[var(--fm-expense)]">{error}</p> : null}
        {successMessage ? <p className="text-sm text-[var(--fm-income)]">{successMessage}</p> : null}

        <div className="flex flex-wrap gap-2">
          <FinanceButton disabled={isSubmitting || (movement.type === "transfer" && accountId === targetAccountId)} tone="filled" type="submit">
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </FinanceButton>
          <FinanceButton disabled={isSubmitting} onClick={onCancel} tone="outlined" type="button" variant="outline">
            Cancelar
          </FinanceButton>
        </div>
      </form>
    </FinanceCard>
  );
}
