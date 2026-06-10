"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { useCreateAccount } from "@/features/accounts/hooks/use-create-account";
import type { AccountType } from "@/features/accounts/services/create-personal-account";
import { cn } from "@/lib/utils";

type NewAccountDialogProps = {
  open: boolean;
  ownerId: string;
  onClose: () => void;
  onCreated: () => void;
};

const ACCOUNT_TYPES: Array<{ value: AccountType; label: string }> = [
  { value: "bank", label: "Banco" },
  { value: "digital_wallet", label: "Billetera digital" },
  { value: "cash", label: "Efectivo" },
  { value: "savings", label: "Ahorro" },
  { value: "other", label: "Otra" },
];

const COLOR_PRESETS = ["#E4B363", "#4ADE80", "#60A5FA", "#F87171", "#A78BFA", "#2DD4BF"];

const DEFAULT_TYPE: AccountType = "bank";
const DEFAULT_COLOR = COLOR_PRESETS[0];

export function NewAccountDialog({ open, ownerId, onClose, onCreated }: NewAccountDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>(DEFAULT_TYPE);
  const [initialBalance, setInitialBalance] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [includeInTotal, setIncludeInTotal] = useState(true);
  const { isSubmitting, error, successMessage, submitAccount, resetFeedback } = useCreateAccount();

  useEffect(() => {
    if (open) {
      setName("");
      setType(DEFAULT_TYPE);
      setInitialBalance("");
      setColor(DEFAULT_COLOR);
      setIncludeInTotal(true);
      resetFeedback();
    }
  }, [open, resetFeedback]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    const success = await submitAccount({
      ownerId,
      name: name.trim(),
      type,
      initialBalance: Number(initialBalance || 0),
      color,
      includeInTotal,
    });

    if (success) {
      setTimeout(() => {
        onCreated();
        onClose();
      }, 800);
    }
  };

  return (
    <FinanceDialog
      onClose={onClose}
      open={open}
      subtitle="Banco, billetera, efectivo o ahorro"
      title="Nueva cuenta"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <div className="rounded-xl border border-red-500/20 bg-[rgba(239,68,68,0.1)] p-3 text-xs text-[var(--fm-expense)]">
            {error}
          </div>
        ) : null}
        {successMessage ? (
          <div className="rounded-xl border border-green-500/20 bg-[rgba(74,222,128,0.1)] p-3 text-xs text-[var(--fm-income)]">
            {successMessage}
          </div>
        ) : null}

        <FinanceTextField
          disabled={isSubmitting}
          label="Nombre de la cuenta"
          onChange={(event) => setName(event.target.value)}
          placeholder="Ej: Bancolombia, Nequi, Efectivo"
          required
          value={name}
        />

        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--fm-text-soft)]">Tipo de cuenta</p>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_TYPES.map((option) => {
              const active = type === option.value;
              return (
                <FinanceButton
                  aria-pressed={active}
                  className={active ? "bg-[var(--fm-surface-dark-alt)]" : undefined}
                  disabled={isSubmitting}
                  key={option.value}
                  onClick={() => setType(option.value)}
                  size="sm"
                  tone={active ? "filled" : "text"}
                  type="button"
                  variant={active ? "default" : "ghost"}
                >
                  {option.label}
                </FinanceButton>
              );
            })}
          </div>
        </div>

        <FinanceTextField
          disabled={isSubmitting}
          label="Saldo inicial (opcional)"
          onChange={(event) => setInitialBalance(event.target.value)}
          placeholder="0"
          type="number"
          value={initialBalance}
        />

        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--fm-text-soft)]">Color</p>
          <div className="flex flex-wrap gap-2.5">
            {COLOR_PRESETS.map((preset) => {
              const active = color === preset;
              return (
                <button
                  aria-label={`Color ${preset}`}
                  aria-pressed={active}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fm-surface-dark)]",
                    active ? "scale-110 ring-2 ring-white/70 ring-offset-2 ring-offset-[var(--fm-surface-dark)]" : "hover:scale-105",
                  )}
                  disabled={isSubmitting}
                  key={preset}
                  onClick={() => setColor(preset)}
                  style={{ backgroundColor: preset }}
                  type="button"
                >
                  {active ? <Check className="h-4 w-4 text-[#0b111c]" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <button
          aria-pressed={includeInTotal}
          className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/8 bg-[var(--fm-surface-dark-alt)] px-4 py-3 text-left transition-colors hover:border-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
          disabled={isSubmitting}
          onClick={() => setIncludeInTotal((current) => !current)}
          type="button"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-medium text-[var(--fm-warm-paper)]">Sumar al total</span>
            <span className="block text-xs text-[var(--fm-text-muted)]">
              Incluir el saldo de esta cuenta en el total general
            </span>
          </span>
          <span
            className={cn(
              "relative inline-flex h-7 w-12 flex-none items-center rounded-full border border-white/8 px-1 transition-colors",
              includeInTotal ? "bg-[var(--fm-pending)]" : "bg-[rgba(28,37,55,0.94)]",
            )}
          >
            <span
              className="h-5 w-5 rounded-full bg-[var(--fm-warm-paper)] transition-transform"
              style={{ transform: includeInTotal ? "translateX(1.2rem)" : "translateX(0)" }}
            />
          </span>
        </button>

        <div className="flex justify-end gap-3 pt-2">
          <FinanceButton
            disabled={isSubmitting}
            onClick={onClose}
            tone="text"
            type="button"
            variant="ghost"
          >
            Cancelar
          </FinanceButton>
          <FinanceButton disabled={isSubmitting || !name.trim()} tone="filled" type="submit" variant="default">
            {isSubmitting ? "Creando..." : "Crear cuenta"}
          </FinanceButton>
        </div>
      </form>
    </FinanceDialog>
  );
}
