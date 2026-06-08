"use client";

import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { useCreatePersonalExpense } from "@/features/transactions/hooks/use-create-personal-expense";
import { readAvailableThirdPartyFunds } from "@/features/transactions/services/read-available-third-party-funds";
import { formatCurrencyCop } from "@/lib/format/currency";
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

  // UI state for third party fund consumption
  const [availableNoPropio, setAvailableNoPropio] = useState(0);
  const [consumesThirdPartyFunds, setConsumesThirdPartyFunds] = useState(false);
  const [thirdPartyConsumeAmount, setThirdPartyConsumeAmount] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const { isSubmitting, error: serviceError, successMessage, submitExpense, resetFeedback } = useCreatePersonalExpense();

  const activeError = localError || serviceError;

  useEffect(() => {
    let active = true;
    const loadFunds = async () => {
      try {
        const { totalAvailable } = await readAvailableThirdPartyFunds(ownerId);
        if (active) {
          setAvailableNoPropio(totalAvailable);
        }
      } catch (err) {
        console.error("Error loading available third party funds:", err);
      }
    };
    void loadFunds();
    return () => {
      active = false;
    };
  }, [ownerId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    setLocalError(null);

    const parsedAmount = Number(amount.replace(/,/g, "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setLocalError("El monto total del gasto debe ser un numero mayor a cero.");
      return;
    }

    if (!accountId || !categoryId || !date) {
      setLocalError("Faltan campos obligatorios.");
      return;
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      setLocalError("La fecha ingresada no es valida.");
      return;
    }

    let parsedConsumeAmount = 0;
    if (consumesThirdPartyFunds) {
      parsedConsumeAmount = Number(thirdPartyConsumeAmount.replace(/,/g, "."));
      if (!Number.isFinite(parsedConsumeAmount) || parsedConsumeAmount <= 0) {
        setLocalError("El monto consumido debe ser mayor a cero.");
        return;
      }
      if (parsedConsumeAmount > parsedAmount) {
        setLocalError("El monto consumido no puede superar el monto total del gasto.");
        return;
      }
      if (parsedConsumeAmount > availableNoPropio) {
        setLocalError(`El monto consumido (${formatCurrencyCop(parsedConsumeAmount)}) supera el saldo no propio disponible (${formatCurrencyCop(availableNoPropio)}).`);
        return;
      }
    }

    const ok = await submitExpense({
      ownerId,
      amount: parsedAmount,
      accountId,
      categoryId,
      date: parsedDate,
      description,
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

        <label
          className="rounded-[var(--fm-radius-card-medium)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] p-3 cursor-pointer"
          htmlFor="createConsumesThirdPartyFunds"
        >
          <div className="flex items-start gap-3">
            <input
              id="createConsumesThirdPartyFunds"
              className="mt-1 h-4 w-4 accent-[var(--fm-expense)]"
              type="checkbox"
              checked={consumesThirdPartyFunds}
              onChange={(event) => {
                setConsumesThirdPartyFunds(event.target.checked);
                setLocalError(null);
              }}
              disabled={availableNoPropio === 0}
            />
            <div className="space-y-1">
              <p className="text-[14px] font-medium text-[var(--fm-warm-paper)]">
                Usa dinero no propio {availableNoPropio === 0 ? "(Sin saldo disponible)" : `(Disponible: ${formatCurrencyCop(availableNoPropio)})`}
              </p>
              <p className="text-xs text-muted-foreground">
                Úsalo cuando este gasto paga dinero que no era tuyo (p. ej. reembolsos o fondos de terceros).
              </p>
            </div>
          </div>
        </label>

        {consumesThirdPartyFunds && availableNoPropio > 0 ? (
          <FinanceTextField
            label="Monto consumido"
            placeholder={`Disponible: ${formatCurrencyCop(availableNoPropio)}`}
            value={thirdPartyConsumeAmount}
            onChange={(event) => {
              setThirdPartyConsumeAmount(event.target.value);
              setLocalError(null);
            }}
            inputMode="decimal"
            required
          />
        ) : null}

        {activeError ? <p className="text-sm text-[var(--fm-expense)]">{activeError}</p> : null}
        {successMessage ? <p className="text-sm text-[var(--fm-income)]">{successMessage}</p> : null}

        <FinanceButton disabled={isSubmitting} tone="filled" type="submit">
          {isSubmitting ? "Guardando..." : "Guardar gasto"}
        </FinanceButton>
      </form>
    </FinanceCard>
  );
}