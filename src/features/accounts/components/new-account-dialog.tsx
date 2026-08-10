"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { AccountIcon } from "@/components/finance/account-icon";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { IconSelect } from "@/components/finance/icon-select";
import { useCreateAccount } from "@/features/accounts/hooks/use-create-account";
import { formatCurrencyCop } from "@/lib/format/currency";
import {
  ACCOUNT_TYPE_OPTIONS,
  BANK_OPTIONS,
  WALLET_OPTIONS,
  SAVINGS_OPTIONS,
  TYPE_COLORS,
  resolveIconTypeForSelection,
  suggestAccountName,
  type AccountType,
  type AccountIconType,
} from "@/lib/accounts/account-visual-catalog";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type NewAccountDialogProps = {
  open: boolean;
  ownerId: string;
  onClose: () => void;
  onCreated: () => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Lucide icons by name (for type option chips)
// ─────────────────────────────────────────────────────────────────────────────

import { Landmark, Wallet, Coins, PiggyBank, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TYPE_ICON_MAP: Record<string, LucideIcon> = {
  Landmark,
  Wallet,
  Coins,
  PiggyBank,
  MoreHorizontal,
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function NewAccountDialog({ open, ownerId, onClose, onCreated }: NewAccountDialogProps) {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [type, setType] = useState<AccountType | null>(null);
  const [iconKey, setIconKey] = useState<string | null>(null);
  const [, setIconType] = useState<AccountIconType>("bank_logo");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [initialBalance, setInitialBalance] = useState("");
  const [includeInTotal, setIncludeInTotal] = useState(true);

  // ── Validation errors ──────────────────────────────────────────────────────
  const [typeError, setTypeError] = useState<string | null>(null);
  const [brandError, setBrandError] = useState<string | null>(null);

  // ── Submission ─────────────────────────────────────────────────────────────
  const { isSubmitting, error, successMessage, submitAccount, resetFeedback } = useCreateAccount();

  // ── Reset on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setType(null);
      setIconKey(null);
      setIconType("bank_logo");
      setName("");
      setNameTouched(false);
      setInitialBalance("");
      setIncludeInTotal(true);
      setTypeError(null);
      setBrandError(null);
      resetFeedback();
    }
  }, [open, resetFeedback]);

  // ── Derived: second selector options ───────────────────────────────────────
  const secondSelectorOptions =
    type === "bank"           ? BANK_OPTIONS :
    type === "digital_wallet" ? WALLET_OPTIONS :
    type === "savings"        ? SAVINGS_OPTIONS :
    null;

  const secondSelectorLabel =
    type === "bank"           ? "Banco" :
    type === "digital_wallet" ? "Billetera" :
    type === "savings"        ? "Tipo de ahorro" :
    null;

  const requiresBrand = type === "bank" || type === "digital_wallet";

  // ── Derived: color ──────────────────────────────────────────────────────────
  const color = type ? TYPE_COLORS[type] ?? "#94a3b8" : "#94a3b8";

  // ── Handle type change ──────────────────────────────────────────────────────
  const handleTypeSelect = (newType: AccountType) => {
    setType(newType);
    setIconKey(null);
    setIconType(resolveIconTypeForSelection(newType, null));
    setTypeError(null);
    setBrandError(null);

    // Auto-prefill name if not manually edited
    if (!nameTouched) {
      const suggested = suggestAccountName(newType, null);
      setName(suggested ?? "");
    }
  };

  // ── Handle brand selection ──────────────────────────────────────────────────
  const handleBrandSelect = (selectedKey: string) => {
    setIconKey(selectedKey);
    setIconType(resolveIconTypeForSelection(type as AccountType, selectedKey));
    setBrandError(null);

    // Auto-prefill name if not manually edited
    if (!nameTouched) {
      const suggested = suggestAccountName(type as AccountType, selectedKey);
      if (suggested !== null) setName(suggested);
    }
  };

  // ── Handle inputs ───────────────────────────────────────────────────────────
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setNameTouched(true);
  };

  const handleInitialBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    setInitialBalance(raw);
  };

  // ── Validate and submit ─────────────────────────────────────────────────────
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!type) {
      setTypeError("Selecciona un tipo de cuenta");
      return;
    }

    // Validate brand required
    if (requiresBrand && !iconKey) {
      setBrandError(
        type === "bank" ? "Selecciona un banco" : "Selecciona una billetera"
      );
      return;
    }

    if (!name.trim()) return;

    // Resolve final iconKey + iconType
    const finalIconKey = iconKey ?? (type === "cash" ? "cash" : type === "savings" ? "savings" : "other");
    const finalIconType = resolveIconTypeForSelection(type, finalIconKey);

    const success = await submitAccount({
      ownerId,
      name: name.trim(),
      type,
      iconType: finalIconType,
      iconKey: finalIconKey,
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
    <>
      <FinanceDialog
        onClose={onClose}
        open={open}
        subtitle="Banco, billetera, efectivo o ahorro"
        title="Nueva cuenta"
      >
      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* ── Error / Success banners ── */}
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

        {/* ── 1. Tipo de cuenta ── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fm-text-muted)]">
            Tipo de cuenta
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ACCOUNT_TYPE_OPTIONS.map((opt, idx) => {
              const Icon = TYPE_ICON_MAP[opt.iconName];
              const isActive = type === opt.value;
              const accentColor = TYPE_COLORS[opt.value];
              const isLast = idx === ACCOUNT_TYPE_OPTIONS.length - 1;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handleTypeSelect(opt.value)}
                  className={cn(
                    "flex flex-row items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-white/20 min-h-[72px]",
                    !isActive && "border-white/8 bg-white/[0.02] hover:border-white/14 hover:bg-white/[0.04]",
                    isLast && "col-span-2"
                  )}
                  style={
                    isActive
                      ? {
                          borderColor: accentColor,
                          backgroundColor: `${accentColor}15`,
                          boxShadow: `0 0 0 1px ${accentColor}40`,
                        }
                      : undefined
                  }
                >
                  <div
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border"
                    style={{
                      backgroundColor: `${accentColor}22`,
                      borderColor: `${accentColor}44`,
                      color: accentColor,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--fm-warm-paper)] truncate">{opt.label}</p>
                    <p className="text-[11px] leading-tight text-[var(--fm-text-muted)] mt-0.5">{opt.description}</p>
                  </div>

                  {isActive ? (
                    <Check className="h-5 w-5 shrink-0" style={{ color: accentColor }} />
                  ) : null}
                </button>
              );
            })}
          </div>
          {typeError ? <p className="text-xs text-[var(--fm-expense)]">{typeError}</p> : null}
        </div>

        {/* ── 2. Selector de marca (condicional) ── */}
        {type && secondSelectorOptions !== null ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fm-text-muted)]">
              {secondSelectorLabel ?? "Seleccionar"}
            </p>
            {brandError ? (
              <p className="text-xs text-[var(--fm-expense)]">{brandError}</p>
            ) : null}
            <IconSelect
              id="brand-selector"
              value={iconKey ?? ""}
              onChange={handleBrandSelect}
              placeholder={`Seleccionar ${secondSelectorLabel?.toLowerCase() || ""}`}
              options={secondSelectorOptions.map((opt) => ({
                id: opt.iconKey,
                label: opt.label,
                color: color,
                icon: (
                  <AccountIcon
                    iconType={resolveIconTypeForSelection(type, opt.iconKey)}
                    iconKey={opt.iconKey}
                    color={color}
                    size="xs"
                  />
                ),
              }))}
            />
          </div>
        ) : null}

        {/* ── 3. Nombre y Saldo ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FinanceTextField
            disabled={isSubmitting}
            label="Nombre de la cuenta"
            onChange={handleNameChange}
            placeholder="Ej. Mi cuenta"
            required
            value={name}
          />
          <FinanceTextField
            disabled={isSubmitting}
            label="Saldo inicial (opcional)"
            onChange={handleInitialBalanceChange}
            placeholder="$ 0"
            type="text"
            inputMode="numeric"
            value={initialBalance ? formatCurrencyCop(Number(initialBalance)) : ""}
          />
        </div>

        {/* ── 4. Incluir en total ── */}
        <button
          aria-pressed={includeInTotal}
          className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/14 hover:bg-white/[0.04]"
          disabled={isSubmitting}
          onClick={() => setIncludeInTotal((current) => !current)}
          type="button"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-medium text-[var(--fm-warm-paper)]">Sumar al total</span>
            <span className="block text-xs text-[var(--fm-text-muted)]">
              Incluir esta cuenta en el saldo general
            </span>
          </span>
          <span
            className={cn(
              "relative inline-flex h-7 w-12 flex-none items-center rounded-full border border-white/8 px-1 transition-colors",
              includeInTotal ? "bg-[var(--fm-pending)]" : "bg-white/[0.05]",
            )}
          >
            <span
              className="h-5 w-5 rounded-full bg-[var(--fm-warm-paper)] transition-transform"
              style={{ transform: includeInTotal ? "translateX(1.2rem)" : "translateX(0)" }}
            />
          </span>
        </button>

        {/* ── Actions ── */}
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
          <FinanceButton
            disabled={isSubmitting || !type || !name.trim() || (requiresBrand && !iconKey)}
            tone="filled"
            type="submit"
            variant="default"
          >
            {isSubmitting ? "Creando..." : "Crear cuenta"}
          </FinanceButton>
        </div>
      </form>
    </FinanceDialog>
    </>
  );
}
