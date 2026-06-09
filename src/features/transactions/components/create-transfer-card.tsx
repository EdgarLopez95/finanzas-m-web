"use client";

import { useState } from "react";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { useCreatePersonalTransfer } from "@/features/transactions/hooks/use-create-personal-transfer";
import {
  TransactionFormSurface,
  type TransactionFormRenderMode,
} from "@/features/transactions/components/transaction-form-surface";
import { getTodayDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import type { Account } from "@/types/account";

type CreateTransferCardProps = {
  ownerId: string;
  accounts: Account[];
  onCreated: () => Promise<void>;
  renderMode?: TransactionFormRenderMode;
};

export function CreateTransferCard({
  ownerId,
  accounts,
  onCreated,
  renderMode = "card",
}: CreateTransferCardProps) {
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [targetAccountId, setTargetAccountId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");
  const [date, setDate] = useState(getTodayDateInputValue);
  const [description, setDescription] = useState("");

  const { isSubmitting, error, successMessage, submitTransfer, resetFeedback } =
    useCreatePersonalTransfer();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    const parsedAmount = Number(amount.replace(/,/g, "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    if (!accountId || !targetAccountId || !date || accountId === targetAccountId) {
      return;
    }

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
      description,
    });

    if (!ok) {
      return;
    }

    setAmount("");
    setDescription("");
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
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <FinanceTextField
          inputMode="decimal"
          label="Monto"
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Ej. 100000"
          required
          value={amount}
        />

        <div className="flex flex-col gap-2">
          <label
            className="text-[14px] font-medium text-[var(--fm-warm-paper)]"
            htmlFor="transferAccountId"
          >
            Cuenta origen
          </label>
          <select
            id="transferAccountId"
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
            htmlFor="transferTargetAccountId"
          >
            Cuenta destino
          </label>
          <select
            id="transferTargetAccountId"
            className="h-11 rounded-[var(--fm-radius-input)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[14px] text-[var(--fm-warm-paper)]"
            onChange={(event) => setTargetAccountId(event.target.value)}
            required
            value={targetAccountId}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        {accountId === targetAccountId ? (
          <p className="text-sm text-[var(--fm-expense)]">
            La cuenta origen y destino deben ser diferentes.
          </p>
        ) : null}

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
          placeholder="Ej. Mover fondo de ahorro"
          value={description}
        />

        {error ? <p className="text-sm text-[var(--fm-expense)]">{error}</p> : null}
        {successMessage ? <p className="text-sm text-[var(--fm-income)]">{successMessage}</p> : null}

        <FinanceButton
          disabled={isSubmitting || accountId === targetAccountId}
          tone="filled"
          type="submit"
        >
          {isSubmitting ? "Guardando..." : "Guardar transferencia"}
        </FinanceButton>
      </form>
    </TransactionFormSurface>
  );
}
