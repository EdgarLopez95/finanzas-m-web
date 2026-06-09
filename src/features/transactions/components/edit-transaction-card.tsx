"use client";

import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { useUpdatePersonalTransaction } from "@/features/transactions/hooks/use-update-personal-transaction";
import { readAvailableThirdPartyFunds } from "@/features/transactions/services/read-available-third-party-funds";
import {
  TransactionFormSurface,
  type TransactionFormRenderMode,
} from "@/features/transactions/components/transaction-form-surface";
import { formatCurrencyCop } from "@/lib/format/currency";
import { formatDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";
import type { Transaction } from "@/types/transaction";

type EditTransactionCardProps = {
  ownerId: string;
  movement: Transaction;
  accounts: Account[];
  categories: Category[];
  onUpdated: () => Promise<void>;
  onCancel: () => void;
  renderMode?: TransactionFormRenderMode;
};

export function EditTransactionCard({
  ownerId,
  movement,
  accounts,
  categories,
  onUpdated,
  onCancel,
  renderMode = "card",
}: EditTransactionCardProps) {
  const isEditableType =
    movement.type === "expense" || movement.type === "income" || movement.type === "transfer";

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories],
  );
  const incomeCategories = useMemo(
    () => categories.filter((category) => category.type === "income"),
    [categories],
  );

  const [amount, setAmount] = useState(String(movement.amount || ""));
  const [accountId, setAccountId] = useState(movement.accountId || accounts[0]?.id || "");
  const [categoryId, setCategoryId] = useState(
    movement.type === "expense"
      ? movement.categoryId || expenseCategories[0]?.id || ""
      : movement.type === "income"
        ? movement.categoryId || incomeCategories[0]?.id || ""
        : "",
  );
  const [targetAccountId, setTargetAccountId] = useState(
    movement.type === "transfer"
      ? movement.targetAccountId ||
          accounts.find((account) => account.id !== movement.accountId)?.id ||
          ""
      : "",
  );
  const [date, setDate] = useState(() =>
    formatDateInputValue(movement.date ?? movement.createdAt, new Date()),
  );
  const [description, setDescription] = useState(movement.notes || "");
  const [countsAsRealIncome, setCountsAsRealIncome] = useState(
    movement.type === "income" ? movement.countsAsRealIncome ?? true : true,
  );
  const [availableNoPropio, setAvailableNoPropio] = useState(0);
  const [consumesThirdPartyFunds, setConsumesThirdPartyFunds] = useState(false);
  const [thirdPartyConsumeAmount, setThirdPartyConsumeAmount] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const { isSubmitting, error: serviceError, successMessage, submitUpdate, resetFeedback } =
    useUpdatePersonalTransaction();

  const activeError = localError || serviceError;

  useEffect(() => {
    if (movement.type !== "expense") {
      return;
    }

    let active = true;

    const loadFundsAndConsumptions = async () => {
      try {
        const { totalAvailable, allConsumptions } = await readAvailableThirdPartyFunds(
          ownerId,
          movement.id,
        );
        if (!active) {
          return;
        }

        setAvailableNoPropio(totalAvailable);

        const currentConsumptions = allConsumptions.filter(
          (consumption) => consumption.consumerExpenseTransactionId === movement.id,
        );
        const wasConsuming = currentConsumptions.length > 0;
        setConsumesThirdPartyFunds(wasConsuming);

        if (wasConsuming) {
          const totalConsumed = currentConsumptions.reduce(
            (sum, consumption) => sum + consumption.amount,
            0,
          );
          setThirdPartyConsumeAmount(String(totalConsumed));
        }
      } catch (error) {
        console.error("Error loading available third party funds and consumptions:", error);
      }
    };

    void loadFundsAndConsumptions();

    return () => {
      active = false;
    };
  }, [movement.id, movement.type, ownerId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    setLocalError(null);

    if (!isEditableType) {
      return;
    }

    const parsedAmount = Number(amount.replace(/,/g, "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setLocalError("El monto debe ser un numero mayor a cero.");
      return;
    }

    const parsedDate = parseDateInputAsLocalDate(date);
    if (!parsedDate) {
      setLocalError("La fecha ingresada no es valida.");
      return;
    }

    if (movement.type === "transfer") {
      if (!accountId || !targetAccountId || accountId === targetAccountId) {
        setLocalError("Las cuentas de origen y destino deben ser validas y diferentes.");
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
      setLocalError("Faltan campos obligatorios.");
      return;
    }

    let parsedConsumeAmount = 0;
    if (movement.type === "expense" && consumesThirdPartyFunds) {
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

    const typeForUpdate = movement.type === "expense" ? "expense" : "income";
    const ok = await submitUpdate({
      ownerId,
      transactionId: movement.id,
      type: typeForUpdate,
      amount: parsedAmount,
      accountId,
      categoryId,
      ...(movement.type === "income" ? { countsAsRealIncome } : {}),
      ...(movement.type === "expense"
        ? {
            consumesThirdPartyFunds,
            thirdPartyConsumeAmount: consumesThirdPartyFunds ? parsedConsumeAmount : undefined,
          }
        : {}),
      date: parsedDate,
      description,
    });

    if (!ok) {
      return;
    }

    await onUpdated();
  };

  if (!accounts.length) {
    return (
      <EmptyState
        description="Necesitas cuentas personales para editar movimientos."
        title="Sin cuentas"
      />
    );
  }

  if (!isEditableType) {
    return (
      <EmptyState
        description="Este tipo de movimiento no se puede editar en WEB-V4A."
        title="Movimiento no editable"
      />
    );
  }

  if (movement.type === "expense" && !expenseCategories.length) {
    return (
      <EmptyState
        description="No hay categorias personales para editar este gasto."
        title="Sin categorias de gasto"
      />
    );
  }

  if (movement.type === "income" && !incomeCategories.length) {
    return (
      <EmptyState
        description="No hay categorias personales para editar este ingreso."
        title="Sin categorias de ingreso"
      />
    );
  }

  const title =
    movement.type === "expense"
      ? "Editar gasto"
      : movement.type === "income"
        ? "Editar ingreso"
        : "Editar transferencia";

  return (
    <TransactionFormSurface
      renderMode={renderMode}
      subtitle="Actualiza datos del movimiento personal"
      title={title}
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
            htmlFor="editAccountId"
          >
            {movement.type === "income" ? "Cuenta destino" : "Cuenta origen"}
          </label>
          <select
            id="editAccountId"
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

        {movement.type === "expense" || movement.type === "income" ? (
          <div className="flex flex-col gap-2">
            <label
              className="text-[14px] font-medium text-[var(--fm-warm-paper)]"
              htmlFor="editCategoryId"
            >
              {movement.type === "expense" ? "Categoria de gasto" : "Categoria de ingreso"}
            </label>
            <select
              id="editCategoryId"
              className="h-11 rounded-[var(--fm-radius-input)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[14px] text-[var(--fm-warm-paper)]"
              onChange={(event) => setCategoryId(event.target.value)}
              required
              value={categoryId}
            >
              {(movement.type === "expense" ? expenseCategories : incomeCategories).map(
                (category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ),
              )}
            </select>
          </div>
        ) : null}

        {movement.type === "transfer" ? (
          <div className="flex flex-col gap-2">
            <label
              className="text-[14px] font-medium text-[var(--fm-warm-paper)]"
              htmlFor="editTargetAccountId"
            >
              Cuenta destino
            </label>
            <select
              id="editTargetAccountId"
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
        ) : null}

        {movement.type === "transfer" && accountId === targetAccountId ? (
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
          placeholder="Ej. Ajuste de movimiento"
          value={description}
        />

        {movement.type === "income" ? (
          <label
            className="rounded-[var(--fm-radius-card-medium)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] p-3"
            htmlFor="editCountsAsRealIncome"
          >
            <div className="flex items-start gap-3">
              <input
                checked={countsAsRealIncome}
                className="mt-1 h-4 w-4 accent-[var(--fm-income)]"
                id="editCountsAsRealIncome"
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
        ) : null}

        {movement.type === "expense" ? (
          <label
            className="cursor-pointer rounded-[var(--fm-radius-card-medium)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] p-3"
            htmlFor="editConsumesThirdPartyFunds"
          >
            <div className="flex items-start gap-3">
              <input
                checked={consumesThirdPartyFunds}
                className="mt-1 h-4 w-4 accent-[var(--fm-expense)]"
                disabled={availableNoPropio === 0 && !consumesThirdPartyFunds}
                id="editConsumesThirdPartyFunds"
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
        ) : null}

        {movement.type === "expense" && consumesThirdPartyFunds && availableNoPropio > 0 ? (
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

        <div className="flex flex-wrap gap-2">
          <FinanceButton
            disabled={isSubmitting || (movement.type === "transfer" && accountId === targetAccountId)}
            tone="filled"
            type="submit"
          >
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </FinanceButton>
          <FinanceButton
            disabled={isSubmitting}
            onClick={onCancel}
            tone="outlined"
            type="button"
            variant="outline"
          >
            Cancelar
          </FinanceButton>
        </div>
      </form>
    </TransactionFormSurface>
  );
}
