"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Calendar, Wallet } from "lucide-react";

import { IconSelect } from "@/components/finance/icon-select";
import { AccountIcon } from "@/components/finance/account-icon";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { useUpdatePersonalTransaction } from "@/features/transactions/hooks/use-update-personal-transaction";
import { readAvailableThirdPartyFunds } from "@/features/transactions/services/read-available-third-party-funds";
import {
  getPersonalMovementEditBlockReason,
  isPersonalMovementEditable,
} from "@/features/transactions/lib/personal-movement-mutability";
import {
  TransactionFormSurface,
  type TransactionFormRenderMode,
} from "@/features/transactions/components/transaction-form-surface";
import { formatCurrencyCop } from "@/lib/format/currency";
import { formatDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";
import type { Pocket } from "@/types/pocket";
import type { Transaction } from "@/types/transaction";

type EditTransactionCardProps = {
  ownerId: string;
  movement: Transaction;
  accounts: Account[];
  pockets: Pocket[];
  categories: Category[];
  onUpdated: () => Promise<void>;
  onCancel: () => void;
  renderMode?: TransactionFormRenderMode;
};

const formatAmountInput = (rawValue: string): string => {
  const clean = rawValue.replace(/\D/g, "");
  if (!clean) return "";
  const formattedEn = Number(clean).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
  return formattedEn.replace(/,/g, ".");
};

export function EditTransactionCard({
  ownerId,
  movement,
  accounts,
  pockets = [],
  categories,
  onUpdated,
  onCancel,
  renderMode = "card",
}: EditTransactionCardProps) {
  const isEditableType =
    movement.type === "expense" || movement.type === "income" || movement.type === "transfer";

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense" && !category.archived),
    [categories],
  );
  const incomeCategories = useMemo(
    () => categories.filter((category) => category.type === "income" && !category.archived),
    [categories],
  );

  const [amount, setAmount] = useState(() => formatAmountInput(String(movement.amount || "")));
  const [accountId, setAccountId] = useState(movement.accountId || accounts[0]?.id || "");
  const [pocketId, setPocketId] = useState(movement.pocketId ?? "");
  const [categoryId, setCategoryId] = useState(
    movement.type === "expense"
      ? movement.categoryId || expenseCategories[0]?.id || ""
      : movement.type === "income"
        ? movement.categoryId || incomeCategories[0]?.id || ""
        : "",
  );
  const [sourceContainerId, setSourceContainerId] = useState(() => {
    if (movement.type !== "transfer") return "";
    return movement.pocketId ? `pocket-${movement.pocketId}` : `available-${movement.accountId}`;
  });
  const [targetContainerId, setTargetContainerId] = useState(() => {
    if (movement.type !== "transfer") return "";
    const accId = movement.targetAccountId;
    if (!accId) return "";
    return movement.targetPocketId ? `pocket-${movement.targetPocketId}` : `available-${accId}`;
  });
  const [date, setDate] = useState(() =>
    formatDateInputValue(movement.date ?? movement.createdAt, new Date()),
  );
  const [description, setDescription] = useState(movement.title || movement.notes || "");
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
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? null,
    [accountId, accounts],
  );


  const sourceOptions = useMemo(() => {
    if (!accountId) {
      return [];
    }
    const accountPockets = pockets.filter((pocket) => pocket.accountId === accountId);
    return [
      {
        id: "",
        label: `Disponible de ${selectedAccount?.name ?? "la cuenta"}`,
        color: selectedAccount ? (selectedAccount.color || "#60a5fa") : undefined,
      },
      ...accountPockets.map((pocket) => ({
        id: pocket.id,
        label: `${pocket.name} (${formatCurrencyCop(pocket.balance)})`,
        color: selectedAccount ? (selectedAccount.color || "#60a5fa") : undefined,
        icon: <Wallet className="h-4 w-4" />,
      })),
    ];
  }, [accountId, pockets, selectedAccount]);

  const containers = useMemo(() => {
    if (movement.type !== "transfer") return [];
    const list: { id: string; accountId: string; pocketId: string | null; label: string; account: Account; icon?: React.ReactNode }[] = [];
    accounts.forEach((account) => {
      list.push({ id: `available-${account.id}`, accountId: account.id, pocketId: null, label: `Disponible de ${account.name}`, account });
      pockets.filter((p) => p.accountId === account.id).forEach((pocket) => {
        list.push({ id: `pocket-${pocket.id}`, accountId: account.id, pocketId: pocket.id, label: `${pocket.name} · ${account.name}`, account, icon: <Wallet className="h-4 w-4" /> });
      });
    });
    return list;
  }, [accounts, movement.type, pockets]);

  const handleSwapContainers = () => {
    const temp = sourceContainerId;
    setSourceContainerId(targetContainerId);
    setTargetContainerId(temp);
    resetFeedback();
  };

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
          setThirdPartyConsumeAmount(formatAmountInput(String(totalConsumed)));
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

  const isFormValid = useMemo(() => {
    const parsedAmount = Number(amount.replace(/\./g, ""));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return false;
    if (!description.trim()) return false;
    if (!accountId) return false;
    if (!date) return false;

    if (movement.type === "transfer") {
      const src = containers.find((c) => c.id === sourceContainerId);
      const tgt = containers.find((c) => c.id === targetContainerId);
      if (!src || !tgt || sourceContainerId === targetContainerId) return false;
    } else {
      if (!categoryId) return false;
    }

    if (movement.type === "expense" && consumesThirdPartyFunds) {
      const parsedConsumeAmount = Number(thirdPartyConsumeAmount.replace(/\./g, ""));
      if (!Number.isFinite(parsedConsumeAmount) || parsedConsumeAmount <= 0) return false;
      if (parsedConsumeAmount > parsedAmount) return false;
      if (parsedConsumeAmount > availableNoPropio) return false;
    }

    return true;
  }, [amount, description, accountId, categoryId, sourceContainerId, targetContainerId, containers, date, consumesThirdPartyFunds, thirdPartyConsumeAmount, availableNoPropio, movement.type]);

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

    if (movement.type === "transfer") {
      const src = containers.find((c) => c.id === sourceContainerId);
      const tgt = containers.find((c) => c.id === targetContainerId);
      if (!src || !tgt) {
        setLocalError("Contenedor de transferencia no válido.");
        return;
      }
      const ok = await submitUpdate({
        ownerId,
        transactionId: movement.id,
        type: "transfer",
        amount: parsedAmount,
        accountId: src.accountId,
        pocketId: src.pocketId,
        targetAccountId: tgt.accountId,
        targetPocketId: tgt.pocketId,
        date: parsedDate,
        description: description.trim(),
      });

      if (ok) {
        await onUpdated();
      }
      return;
    }

    let parsedConsumeAmount = 0;
    if (movement.type === "expense" && consumesThirdPartyFunds) {
      parsedConsumeAmount = Number(thirdPartyConsumeAmount.replace(/\./g, ""));
    }

    const typeForUpdate = movement.type === "expense" ? "expense" : "income";
    const ok = await submitUpdate({
      ownerId,
      transactionId: movement.id,
      type: typeForUpdate,
      amount: parsedAmount,
      accountId,
      categoryId,
      ...(movement.type === "income" ? { countsAsRealIncome, pocketId: pocketId || undefined } : {}),
      ...(movement.type === "expense"
        ? {
            consumesThirdPartyFunds,
            pocketId: pocketId || undefined,
            thirdPartyConsumeAmount: consumesThirdPartyFunds ? parsedConsumeAmount : undefined,
          }
        : {}),
      date: parsedDate,
      description: description.trim(),
    });

    if (ok) {
      await onUpdated();
    }
  };

  if (!accounts.length) {
    return (
      <EmptyState
        description="Necesitas cuentas personales para editar movimientos."
        title="Sin cuentas"
      />
    );
  }

  // G3 (defensa en profundidad) — cubre tipo no editable, técnicos y los que
  // tocan el ledger no propio, por si el panel se abre por otra vía.
  if (!isEditableType || !isPersonalMovementEditable(movement)) {
    return (
      <EmptyState
        description={
          getPersonalMovementEditBlockReason(movement) || "Este movimiento no se puede editar."
        }
        title="Movimiento no editable"
      />
    );
  }

  if (movement.type === "expense" && !expenseCategories.length) {
    return (
      <EmptyState
        description="No hay categorías personales para editar este gasto."
        title="Sin categorías de gasto"
      />
    );
  }

  if (movement.type === "income" && !incomeCategories.length) {
    return (
      <EmptyState
        description="No hay categorías personales para editar este ingreso."
        title="Sin categorías de ingreso"
      />
    );
  }

  return (
    <TransactionFormSurface
      renderMode={renderMode}
      subtitle="Actualiza datos del movimiento personal"
      title={
        movement.type === "expense"
          ? "Editar gasto"
          : movement.type === "income"
            ? "Editar ingreso"
            : "Editar transferencia"
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <div
          className={cn(
            "rounded-2xl border p-4 transition-all duration-200",
            movement.type === "expense"
              ? cn(
                  "bg-[rgba(239,68,68,0.035)]",
                  activeError ? "border-[var(--fm-expense)]/20" : "border-[rgba(239,68,68,0.08)]",
                  "focus-within:border-[var(--fm-expense)]/25 focus-within:bg-[rgba(239,68,68,0.05)]"
                )
              : movement.type === "income"
                ? cn(
                    "bg-[rgba(74,222,128,0.035)]",
                    activeError ? "border-[var(--fm-income)]/20" : "border-[rgba(74,222,128,0.08)]",
                    "focus-within:border-[var(--fm-income)]/25 focus-within:bg-[rgba(74,222,128,0.05)]"
                  )
                : cn(
                    "bg-[rgba(59,130,246,0.035)]",
                    activeError ? "border-[var(--fm-transfer)]/20" : "border-[rgba(59,130,246,0.08)]",
                    "focus-within:border-[var(--fm-transfer)]/25 focus-within:bg-[rgba(59,130,246,0.05)]"
                  )
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full",
                  movement.type === "expense"
                    ? "bg-[rgba(239,68,68,0.12)] text-[var(--fm-expense)]"
                    : movement.type === "income"
                      ? "bg-[rgba(74,222,128,0.12)] text-[var(--fm-income)]"
                      : "bg-[rgba(59,130,246,0.12)] text-[var(--fm-transfer)]"
                )}
              >
                {movement.type === "expense" && <ArrowDownLeft className="h-3.5 w-3.5" />}
                {movement.type === "income" && <ArrowUpRight className="h-3.5 w-3.5" />}
                {movement.type === "transfer" && <ArrowLeftRight className="h-3.5 w-3.5" />}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fm-text-muted)]">
                {movement.type === "expense"
                  ? "Monto del gasto"
                  : movement.type === "income"
                    ? "Monto del ingreso"
                    : "Monto a transferir"}
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
                resetFeedback();
              }}
              className="w-full bg-transparent border-none outline-none focus:ring-0 p-0 text-3xl font-bold tracking-tight text-[var(--fm-warm-paper)] placeholder:text-white/[0.08]"
              aria-label="Monto del movimiento"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[2.2fr_1fr] gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center">
                <label
                  htmlFor="editDescription"
                  className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                >
                  Concepto
                </label>
                <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                  OBLIGATORIO
                </span>
              </div>
              <input
                id="editDescription"
                type="text"
                placeholder="Título o concepto"
                required
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setLocalError(null);
                  resetFeedback();
                }}
                className="h-11 w-full rounded-xl border border-white/8 bg-white/[0.02] px-3.5 text-sm text-[var(--fm-warm-paper)] focus:border-[var(--fm-pending)]/50 focus:ring-0 outline-none transition-all placeholder:text-white/[0.12]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center">
                <label
                  htmlFor="editDate"
                  className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                >
                  Fecha
                </label>
                <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                  OBLIGATORIO
                </span>
              </div>
              <div className="relative">
                <input
                  id="editDate"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setLocalError(null);
                    resetFeedback();
                  }}
                  className="h-11 w-full rounded-xl border border-white/8 bg-white/[0.02] pl-3.5 pr-8 text-sm text-[var(--fm-warm-paper)] focus:border-[var(--fm-pending)]/50 focus:ring-0 outline-none transition-all cursor-pointer"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fm-text-muted)] pointer-events-none" />
              </div>
            </div>
          </div>

          {(movement.type === "expense" || movement.type === "income") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center">
                  <label
                    htmlFor="editCategoryId"
                    className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                  >
                    Categoría
                  </label>
                  <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                    OBLIGATORIO
                  </span>
                </div>
                <IconSelect
                  id="editCategoryId"
                  required
                  value={categoryId}
                  onChange={(val) => {
                    setCategoryId(val);
                    setLocalError(null);
                    resetFeedback();
                  }}
                  options={(movement.type === "expense" ? expenseCategories : incomeCategories).map((cat) => {
                    const Icon = resolveCategoryIcon(cat.iconKey ?? "", cat.type);
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
                    htmlFor="editAccountId"
                    className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                  >
                    Cuenta
                  </label>
                  <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                    OBLIGATORIO
                  </span>
                </div>
                <IconSelect
                  id="editAccountId"
                  required
                  value={accountId}
                  onChange={(val) => {
                    setAccountId(val);
                    setPocketId("");
                    setLocalError(null);
                    resetFeedback();
                  }}
                  options={accounts.map((acc) => ({
                    id: acc.id,
                    label: acc.name,
                    color: acc.color || "#60a5fa",
                    icon: (
                      <AccountIcon
                        iconType={(acc.iconType as "generic" | "bank_logo") || "generic"}
                        iconKey={acc.iconKey || "bank"}
                        color={acc.color || "#60a5fa"}
                        size="xs"
                      />
                    ),
                  }))}
                />
              </div>
            </div>
          )}

          {movement.type === "transfer" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center">
                  <label
                    htmlFor="editSourceContainerId"
                    className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                  >
                    Sale de
                  </label>
                  <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                    REQUERIDO
                  </span>
                </div>
                <IconSelect
                  id="editSourceContainerId"
                  required
                  value={sourceContainerId}
                  onChange={(val) => {
                    setSourceContainerId(val);
                    setLocalError(null);
                    resetFeedback();
                  }}
                  options={containers.map((c) => ({
                    id: c.id,
                    label: c.label,
                    color: c.account.color || "#60a5fa",
                    icon: (
                      <AccountIcon
                        iconType={(c.account.iconType as "generic" | "bank_logo") || "generic"}
                        iconKey={c.account.iconKey || "bank"}
                        color={c.account.color || "#60a5fa"}
                        size="xs"
                      />
                    ),
                  }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center">
                  <label
                    htmlFor="editTargetContainerId"
                    className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                  >
                    Llega a
                  </label>
                  <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                    REQUERIDO
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <IconSelect
                      id="editTargetContainerId"
                      required
                      value={targetContainerId}
                      onChange={(val) => {
                        setTargetContainerId(val);
                        setLocalError(null);
                        resetFeedback();
                      }}
                      options={containers.map((c) => ({
                        id: c.id,
                        label: c.label,
                        color: c.account.color || "#60a5fa",
                        icon: (
                          <AccountIcon
                            iconType={(c.account.iconType as "generic" | "bank_logo") || "generic"}
                            iconKey={c.account.iconKey || "bank"}
                            color={c.account.color || "#60a5fa"}
                            size="xs"
                          />
                        ),
                      }))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSwapContainers}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.02] text-[var(--fm-text-soft)] hover:bg-white/10 hover:text-[var(--fm-warm-paper)] transition-all cursor-pointer select-none"
                    title="Intercambiar origen y destino"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bolsillo: "Sale de" para Gasto, "Entra a" para Ingreso */}
          {(movement.type === "expense" || movement.type === "income") && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center">
                <label
                  htmlFor="editExpenseSourceId"
                  className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
                >
                  {movement.type === "income" ? "Entra a" : "Sale de"}
                </label>
              </div>
              <IconSelect
                id="editExpenseSourceId"
                value={pocketId}
                onChange={(val) => {
                  setPocketId(val);
                  setLocalError(null);
                  resetFeedback();
                }}
                options={sourceOptions}
                placeholder={movement.type === "income" ? "Selecciona el destino" : "Selecciona el origen"}
              />
            </div>
          )}

          {/* Validaciones de Transferencia */}
          {movement.type === "transfer" && sourceContainerId && sourceContainerId === targetContainerId ? (
            <p className="text-xs text-[var(--fm-expense)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.16)] px-3.5 py-2 rounded-xl">
              El origen y destino de la transferencia no pueden ser idénticos.
            </p>
          ) : null}

          {/* Tipo de Gasto (sólo para Gasto) */}
          {movement.type === "expense" && (
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
            </div>
          )}

          {/* Ingreso Real / no real checkbox */}
          {movement.type === "income" && (
            <label
              className="cursor-pointer rounded-xl border border-white/8 bg-white/[0.02] p-3.5 block transition-all"
              htmlFor="editCountsAsRealIncome"
            >
              <div className="flex items-start gap-3">
                <input
                  checked={countsAsRealIncome}
                  className="mt-1 h-4 w-4 accent-[var(--fm-income)]"
                  id="editCountsAsRealIncome"
                  onChange={(event) => {
                    setCountsAsRealIncome(event.target.checked);
                    resetFeedback();
                  }}
                  type="checkbox"
                />
                <div className="space-y-1">
                  <p className="text-[14px] font-medium text-[var(--fm-warm-paper)]">
                    Cuenta como ingreso real
                  </p>
                  <p className="text-xs text-[var(--fm-text-muted)]">
                    Actívalo para sueldo, ventas o dinero propio. Desactívalo para reembolsos o
                    dinero de otra persona.
                  </p>
                </div>
              </div>
            </label>
          )}

          {/* Dinero de terceros (para Gasto) */}
          {movement.type === "expense" && consumesThirdPartyFunds && (
            <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3.5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[var(--fm-text-soft)]">
                  Dinero no propio disponible:
                </span>
                <span className="font-bold text-[var(--fm-pending)] bg-[rgba(228,179,99,0.1)] px-2 py-0.5 rounded-md border border-[var(--fm-pending)]/20">
                  {formatCurrencyCop(availableNoPropio)}
                </span>
              </div>

              {availableNoPropio > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center">
                    <label
                      htmlFor="editThirdPartyConsumeAmount"
                      className="text-[10px] font-bold uppercase tracking-wider text-[var(--fm-text-muted)]"
                    >
                      Monto a consumir
                    </label>
                    <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-[rgba(228,179,99,0.12)] text-[var(--fm-pending)] border border-[var(--fm-pending)]/20 uppercase tracking-widest">
                      OBLIGATORIO
                    </span>
                  </div>
                  <input
                    id="editThirdPartyConsumeAmount"
                    type="text"
                    inputMode="decimal"
                    placeholder={`Disponible: ${formatCurrencyCop(availableNoPropio)}`}
                    required
                    value={thirdPartyConsumeAmount}
                    onChange={(e) => {
                      setThirdPartyConsumeAmount(formatAmountInput(e.target.value));
                      setLocalError(null);
                      resetFeedback();
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
          )}
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
              <FinanceButton
                disabled={!isFormValid || isSubmitting}
                tone="destructive"
                type="submit"
                className={cn(
                  "rounded-xl px-5 select-none cursor-pointer",
                  isFormValid && !isSubmitting
                    ? movement.type === "expense"
                      ? "bg-[var(--fm-expense)] hover:bg-[color-mix(in_oklch,var(--fm-expense),white_8%)] text-slate-950 font-bold shadow-[0_12px_28px_rgba(239,68,68,0.15)]"
                      : movement.type === "income"
                        ? "bg-[var(--fm-income)] hover:bg-[color-mix(in_oklch,var(--fm-income),white_8%)] text-slate-950 font-bold shadow-[0_12px_28px_rgba(74,222,128,0.15)]"
                        : "bg-[var(--fm-transfer)] hover:bg-[color-mix(in_oklch,var(--fm-transfer),white_8%)] text-slate-950 font-bold shadow-[0_12px_28px_rgba(59,130,246,0.15)]"
                    : "bg-white/[0.03] border border-white/5 text-white/25 cursor-not-allowed"
                )}
              >
                {isSubmitting ? "Guardando..." : "Guardar cambios"}
              </FinanceButton>
            </div>
          </div>
        </div>
      </form>
    </TransactionFormSurface>
  );
}
