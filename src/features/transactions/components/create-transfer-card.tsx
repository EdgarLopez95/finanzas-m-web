"use client";

import { useState } from "react";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { useCreatePersonalTransfer } from "@/features/transactions/hooks/use-create-personal-transfer";
import type { Account } from "@/types/account";

const todayIso = () => new Date().toISOString().slice(0, 10);

type CreateTransferCardProps = {
  ownerId: string;
  accounts: Account[];
  onCreated: () => Promise<void>;
};

export function CreateTransferCard({ ownerId, accounts, onCreated }: CreateTransferCardProps) {
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [targetAccountId, setTargetAccountId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState("");

  const { isSubmitting, error, successMessage, submitTransfer, resetFeedback } = useCreatePersonalTransfer();

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

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
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
    return <EmptyState title="Cuentas insuficientes" description="Necesitas al menos dos cuentas para transferir." />;
  }

  return (
    <FinanceCard title="Nueva transferencia" subtitle="Movimiento interno entre cuentas personales" variant="interactive">
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <FinanceTextField
          label="Monto"
          placeholder="Ej. 100000"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          required
        />

        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-medium text-[var(--fm-warm-paper)]" htmlFor="transferAccountId">
            Cuenta origen
          </label>
          <select
            id="transferAccountId"
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
          <label className="text-[14px] font-medium text-[var(--fm-warm-paper)]" htmlFor="transferTargetAccountId">
            Cuenta destino
          </label>
          <select
            id="transferTargetAccountId"
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

        {accountId === targetAccountId ? (
          <p className="text-sm text-[var(--fm-expense)]">La cuenta origen y destino deben ser diferentes.</p>
        ) : null}

        <FinanceTextField label="Fecha" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        <FinanceTextField
          label="Descripcion (opcional)"
          placeholder="Ej. Mover fondo de ahorro"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        {error ? <p className="text-sm text-[var(--fm-expense)]">{error}</p> : null}
        {successMessage ? <p className="text-sm text-[var(--fm-income)]">{successMessage}</p> : null}

        <FinanceButton disabled={isSubmitting || accountId === targetAccountId} tone="filled" type="submit">
          {isSubmitting ? "Guardando..." : "Guardar transferencia"}
        </FinanceButton>
      </form>
    </FinanceCard>
  );
}