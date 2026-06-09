"use client";

import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { useCreatePersonalExpense } from "@/features/transactions/hooks/use-create-personal-expense";
import { readAvailableThirdPartyFunds } from "@/features/transactions/services/read-available-third-party-funds";
import {
  TransactionFormSurface,
  type TransactionFormRenderMode,
} from "@/features/transactions/components/transaction-form-surface";
import { formatCurrencyCop } from "@/lib/format/currency";
import { getTodayDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";

type CreateExpenseCardProps = {
  ownerId: string;
  accounts: Account[];
  categories: Category[];
  onCreated: () => Promise<void>;
  renderMode?: TransactionFormRenderMode;
};

export function CreateExpenseCard({
  ownerId,
  accounts,
  categories,
  onCreated,
  renderMode = "card",
}: CreateExpenseCardProps) {
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories],
  );

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? "");
  const [date, setDate] = useState(getTodayDateInputValue);
  const [description, setDescription] = useState("");
  const [availableNoPropio, setAvailableNoPropio] = useState(0);
  const [consumesThirdPartyFunds, setConsumesThirdPartyFunds] = useState(false);
  const [thirdPartyConsumeAmount, setThirdPartyConsumeAmount] = useState("");
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

    const parsedDate = parseDateInputAsLocalDate(date);
    if (!parsedDate) {
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
        setLocalError(
          `El monto consumido (${formatCurrencyCop(parsedConsumeAmount)}) supera el saldo no propio disponible (${formatCurrencyCop(availableNoPropio)}).`,
        );
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
        description="Necesitas categorias personales de tipo gasto para registrar gastos."
        title="Sin categorias de gasto"
      />
    );
  }

  return (
    <TransactionFormSurface
      renderMode={renderMode}
      subtitle="Registro manual personal"
      title="Nuevo gasto"
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <FinanceTextField
          inputMode="decimal"
          label="Monto"
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Ej. 25000"
          required
          value={amount}
        />

        <div className="flex flex-col gap-2">
          <label
            className="text-[14px] font-medium text-[var(--fm-warm-paper)]"
            htmlFor="accountId"
          >
            Cuenta origen
          </label>
          <select
            id="accountId"
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
            htmlFor="categoryId"
          >
            Categoria de gasto
          </label>
          <select
            id="categoryId"
            className="h-11 rounded-[var(--fm-radius-input)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[14px] text-[var(--fm-warm-paper)]"
            onChange={(event) => setCategoryId(event.target.value)}
            required
            value={categoryId}
          >
            {expenseCategories.map((category) => (
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
          placeholder="Ej. Mercado semana"
          value={description}
        />

        <label
          className="cursor-pointer rounded-[var(--fm-radius-card-medium)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] p-3"
          htmlFor="createConsumesThirdPartyFunds"
        >
          <div className="flex items-start gap-3">
            <input
              checked={consumesThirdPartyFunds}
              className="mt-1 h-4 w-4 accent-[var(--fm-expense)]"
              disabled={availableNoPropio === 0}
              id="createConsumesThirdPartyFunds"
              onChange={(event) => {
                setConsumesThirdPartyFunds(event.target.checked);
                setLocalError(null);
              }}
              type="checkbox"
            />
            <div className="space-y-1">
              <p className="text-[14px] font-medium text-[var(--fm-warm-paper)]">
                Usa dinero no propio{" "}
                {availableNoPropio === 0
                  ? "(Sin saldo disponible)"
                  : `(Disponible: ${formatCurrencyCop(availableNoPropio)})`}
              </p>
              <p className="text-xs text-muted-foreground">
                Usalo cuando este gasto paga dinero que no era tuyo (p. ej. reembolsos o fondos
                de terceros).
              </p>
            </div>
          </div>
        </label>

        {consumesThirdPartyFunds && availableNoPropio > 0 ? (
          <FinanceTextField
            inputMode="decimal"
            label="Monto consumido"
            onChange={(event) => {
              setThirdPartyConsumeAmount(event.target.value);
              setLocalError(null);
            }}
            placeholder={`Disponible: ${formatCurrencyCop(availableNoPropio)}`}
            required
            value={thirdPartyConsumeAmount}
          />
        ) : null}

        {activeError ? <p className="text-sm text-[var(--fm-expense)]">{activeError}</p> : null}
        {successMessage ? <p className="text-sm text-[var(--fm-income)]">{successMessage}</p> : null}

        <FinanceButton disabled={isSubmitting} tone="filled" type="submit">
          {isSubmitting ? "Guardando..." : "Guardar gasto"}
        </FinanceButton>
      </form>
    </TransactionFormSurface>
  );
}
