"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Calendar, Wallet } from "lucide-react";
import { IconSelect } from "@/components/finance/icon-select";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";

import { EmptyState } from "@/components/finance/empty-state";
import { useCreatePersonalIncome } from "@/features/transactions/hooks/use-create-personal-income";
import {
  AmountField,
  ComposerFeedback,
  ComposerField,
  ComposerFooter,
  SegmentedChoice,
  StatusNote,
  composerControlClass,
  composerControlErrorClass,
  parseAmountInput,
  toneStyle,
} from "@/features/transactions/components/composer/composer-primitives";
import {
  TransactionFormSurface,
  type TransactionFormRenderMode,
} from "@/features/transactions/components/transaction-form-surface";
import { getTodayDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import { formatCurrencyCop } from "@/lib/format/currency";
import { AccountIcon } from "@/components/finance/account-icon";
import { cn } from "@/lib/utils";

import type { Account } from "@/types/account";
import type { Category } from "@/types/category";
import type { Pocket } from "@/types/pocket";

type CreateIncomeCardProps = {
  ownerId: string;
  accounts: Account[];
  pockets?: Pocket[];
  categories: Category[];
  onCreated: () => Promise<void>;
  renderMode?: TransactionFormRenderMode;
  defaultAccountId?: string;
  onCancel?: () => void;
};

type IncomeField = "amount" | "description" | "date" | "category" | "account";

export function CreateIncomeCard({
  ownerId,
  accounts,
  pockets = [],
  categories,
  onCreated,
  renderMode = "card",
  defaultAccountId,
  onCancel,
}: CreateIncomeCardProps) {
  const incomeCategories = useMemo(
    () => categories.filter((category) => category.type === "income" && !category.archived),
    [categories],
  );

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId || accounts[0]?.id || "");
  const [pocketId, setPocketId] = useState("");
  const [categoryId, setCategoryId] = useState(incomeCategories[0]?.id ?? "");
  const [date, setDate] = useState(getTodayDateInputValue);
  const [description, setDescription] = useState("");
  const [countsAsRealIncome, setCountsAsRealIncome] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Partial<Record<IncomeField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const markTouched = (field: IncomeField) =>
    setTouched((current) => ({ ...current, [field]: true }));

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? null,
    [accountId, accounts],
  );
  const destinationOptions = useMemo(() => {
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

  const { isSubmitting, error: serviceError, successMessage, submitIncome, resetFeedback } =
    useCreatePersonalIncome();

  const activeError = localError || serviceError;

  const parsedAmount = parseAmountInput(amount);

  const errors = useMemo(() => {
    const next: Partial<Record<IncomeField, string>> = {};

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      next.amount = "Ingresa un monto mayor a $ 0.";
    }
    if (!description.trim()) {
      next.description = "Escribe un concepto para identificar el ingreso.";
    }
    if (!date) {
      next.date = "Elige la fecha del ingreso.";
    }
    if (!categoryId) {
      next.category = "Elige una categoría.";
    }
    if (!accountId) {
      next.account = "Elige la cuenta que recibe el dinero.";
    }

    return next;
  }, [parsedAmount, description, date, categoryId, accountId]);

  const isFormValid = Object.keys(errors).length === 0;

  const visibleError = (field: IncomeField) =>
    submitAttempted || touched[field] ? errors[field] ?? null : null;

  const handleSubmit = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }
    setSubmitAttempted(true);

    if (!isFormValid || isSubmitting) {
      return;
    }

    resetFeedback();
    setLocalError(null);

    const parsedDate = parseDateInputAsLocalDate(date);
    if (!parsedDate) {
      setLocalError("La fecha ingresada no es válida.");
      return;
    }

    const ok = await submitIncome({
      ownerId,
      amount: parsedAmount,
      accountId,
      pocketId: pocketId || undefined,
      categoryId,
      countsAsRealIncome,
      date: parsedDate,
      description: description.trim(),
    });

    if (!ok) {
      return;
    }

    setAmount("");
    setDescription("");
    setPocketId("");
    setCountsAsRealIncome(true);
    setTouched({});
    setSubmitAttempted(false);
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
        description="Necesitas categorías personales de tipo ingreso para registrar ingresos."
        title="Sin categorías de ingreso"
      />
    );
  }

  const footerMessage = submitAttempted && !isFormValid ? "Revisa los campos marcados." : null;

  return (
    <TransactionFormSurface
      renderMode={renderMode}
      subtitle="Registrar una entrada de dinero"
      title="Nuevo ingreso"
    >
      <form
        style={toneStyle("income")}
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        {/* ── 1. Monto ── */}
        <AmountField
          id="incomeAmount"
          label="Monto del ingreso (obligatorio)"
          ariaLabel="Monto del ingreso"
          value={amount}
          autoFocus
          onChange={(next) => {
            setAmount(next);
            setLocalError(null);
          }}
          onBlur={() => markTouched("amount")}
          icon={<ArrowUpRight className="h-3.5 w-3.5" />}
          error={visibleError("amount")}
        />

        {/* ── 2. Detalles del movimiento ── */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
            <ComposerField
              label="Concepto"
              htmlFor="incomeDescription"
              required
              error={visibleError("description")}
            >
              <input
                id="incomeDescription"
                type="text"
                placeholder="Título o concepto"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setLocalError(null);
                }}
                onBlur={() => markTouched("description")}
                aria-invalid={visibleError("description") ? true : undefined}
                className={cn(
                  composerControlClass,
                  visibleError("description") && composerControlErrorClass,
                )}
              />
            </ComposerField>

            <ComposerField label="Fecha" htmlFor="incomeDate" required error={visibleError("date")}>
              <div className="relative">
                <input
                  id="incomeDate"
                  type="date"
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setLocalError(null);
                  }}
                  onBlur={() => markTouched("date")}
                  aria-invalid={visibleError("date") ? true : undefined}
                  className={cn(
                    composerControlClass,
                    "cursor-pointer pr-9 [&::-webkit-calendar-picker-indicator]:opacity-0",
                    visibleError("date") && composerControlErrorClass,
                  )}
                />
                <Calendar
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fm-text-muted)]"
                />
              </div>
            </ComposerField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ComposerField
              label="Categoría"
              htmlFor="incomeCategoryId"
              required
              error={visibleError("category")}
            >
              <IconSelect
                id="incomeCategoryId"
                required
                searchPlaceholder="Buscar categoría..."
                value={categoryId}
                onChange={(val) => {
                  setCategoryId(val);
                  markTouched("category");
                  setLocalError(null);
                }}
                options={incomeCategories.map((cat) => {
                  const Icon = resolveCategoryIcon(cat.iconKey ?? "", "income");
                  return {
                    id: cat.id,
                    label: cat.name,
                    color: cat.color,
                    icon: <Icon className="h-3.5 w-3.5" />,
                  };
                })}
              />
            </ComposerField>

            <ComposerField
              label="Cuenta destino"
              htmlFor="incomeAccountId"
              required
              error={visibleError("account")}
            >
              <IconSelect
                id="incomeAccountId"
                required
                value={accountId}
                onChange={(val) => {
                  setAccountId(val);
                  // El bolsillo pertenece a la cuenta: al cambiarla se vuelve al
                  // Disponible para no dejar un destino incompatible.
                  setPocketId("");
                  markTouched("account");
                  setLocalError(null);
                }}
                options={accounts.map((acc) => {
                  const accentColor = acc.color || "#60a5fa";
                  return {
                    id: acc.id,
                    label: acc.name,
                    color: accentColor,
                    icon: (
                      <AccountIcon
                        iconType={(acc.iconType as "generic" | "bank_logo") || "generic"}
                        iconKey={acc.iconKey || "bank"}
                        color={accentColor}
                        size="xs"
                      />
                    ),
                  };
                })}
              />
            </ComposerField>
          </div>

          <ComposerField
            label="Entra a"
            htmlFor="incomeDestinationId"
            hint="Dentro de la cuenta destino, elige el disponible o un bolsillo."
          >
            <IconSelect
              id="incomeDestinationId"
              value={pocketId}
              onChange={(val) => {
                setPocketId(val);
                setLocalError(null);
              }}
              options={destinationOptions}
              placeholder="Selecciona el destino"
            />
          </ComposerField>

          {/* ── 3. Tipo de ingreso (+ explicación condicional) ── */}
          <ComposerField label="Tipo de ingreso">
            <SegmentedChoice
              ariaLabel="Tipo de ingreso"
              value={countsAsRealIncome ? "own" : "transit"}
              onChange={(next) => {
                setCountsAsRealIncome(next === "own");
                setLocalError(null);
              }}
              options={[
                { value: "own", label: "Mío" },
                { value: "transit", label: "En tránsito (no propio)" },
              ]}
            />
          </ComposerField>

          {!countsAsRealIncome ? (
            <StatusNote>
              Este dinero entra a tu cuenta, pero no aumenta tu dinero propio.
            </StatusNote>
          ) : null}
        </div>

        {/* ── 4. Feedback y footer ── */}
        <div className="space-y-4">
          <ComposerFeedback error={activeError} successMessage={successMessage} />

          <ComposerFooter
            message={footerMessage}
            messageTone={footerMessage ? "danger" : "muted"}
            submitLabel="Guardar ingreso"
            submittingLabel="Guardando…"
            isSubmitting={isSubmitting}
            disabled={!isFormValid}
            onCancel={onCancel}
          />
        </div>
      </form>
    </TransactionFormSurface>
  );
}
