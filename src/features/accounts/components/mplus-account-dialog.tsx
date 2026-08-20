"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Coins, Landmark, MoreHorizontal, PiggyBank, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AccountIcon } from "@/components/finance/account-icon";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { IconSelect } from "@/components/finance/icon-select";
import {
  createMplusAccount,
  updateMplusAccount,
} from "@/features/accounts/services/mplus-account-service";
import {
  ACCOUNT_TYPE_OPTIONS,
  BANK_OPTIONS,
  ICON_DEFAULTS_BY_TYPE,
  SAVINGS_OPTIONS,
  TYPE_COLORS,
  WALLET_OPTIONS,
  resolveIconTypeForSelection,
  suggestAccountName,
} from "@/lib/accounts/account-visual-catalog";
import { NAME_MAX_LENGTH } from "@/lib/mplus/catalogs";
import type { AccountType } from "@/lib/mplus/enums";
import type { MplusPersonalAccount } from "@/lib/mplus/models";
import { cn } from "@/lib/utils";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

/**
 * Alta y edicion de cuentas del contrato v1.
 *
 * Conserva la estructura del dialogo anterior (tipo → marca → nombre →
 * acciones) con los mismos componentes. Lo que desaparece es lo que el
 * producto ya no tiene: el saldo inicial y el interruptor "Sumar al total".
 * En M+ una cuenta no guarda dinero; solo dice de donde salio o entro.
 */

const TYPE_ICON_MAP: Record<string, LucideIcon> = {
  Landmark,
  Wallet,
  Coins,
  PiggyBank,
  MoreHorizontal,
};

type MplusAccountDialogProps = {
  open: boolean;
  ownerId: string;
  /** Cuenta a editar; null para crear una nueva. */
  account: MplusPersonalAccount | null;
  onClose: () => void;
};

export function MplusAccountDialog({
  open,
  ownerId,
  account,
  onClose,
}: MplusAccountDialogProps) {
  const isEditMode = account !== null;
  const applyCommittedAccount = useMplusPersonalStore((state) => state.applyCommittedAccount);

  const [type, setType] = useState<AccountType | null>(() => account?.type ?? null);
  const [iconKey, setIconKey] = useState<string | null>(() => account?.iconKey ?? null);
  const [name, setName] = useState(() => account?.name ?? "");
  const [nameTouched, setNameTouched] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reabrir el dialogo con otra cuenta (o para crear) reinicia el formulario:
  // sin esto, arrastraria el estado del anterior.
  useEffect(() => {
    if (!open) return;
    setType(account?.type ?? null);
    setIconKey(account?.iconKey ?? null);
    setName(account?.name ?? "");
    setNameTouched(account !== null);
    setError(null);
  }, [account, open]);

  const brandOptions = useMemo(() => {
    if (type === "bank") return BANK_OPTIONS;
    if (type === "digital_wallet") return WALLET_OPTIONS;
    if (type === "savings") return SAVINGS_OPTIONS;
    return null;
  }, [type]);

  const brandLabel =
    type === "bank" ? "Banco" : type === "digital_wallet" ? "Billetera" : "Tipo de ahorro";

  const color = type ? TYPE_COLORS[type] : "#60a5fa";
  const requiresBrand = brandOptions !== null;

  const handleTypeSelect = (nextType: AccountType) => {
    setType(nextType);
    const fallback = ICON_DEFAULTS_BY_TYPE[nextType];
    setIconKey(fallback.iconKey);
    setError(null);
    // Igual que antes: el nombre se autocompleta mientras el usuario no lo
    // haya escrito a mano.
    if (!nameTouched) {
      setName(suggestAccountName(nextType, fallback.iconKey) ?? "");
    }
  };

  const handleBrandSelect = (nextIconKey: string) => {
    setIconKey(nextIconKey);
    setError(null);
    if (!nameTouched && type) {
      setName(suggestAccountName(type, nextIconKey) ?? "");
    }
  };

  const canSubmit =
    Boolean(type) && name.trim().length > 0 && (!requiresBrand || Boolean(iconKey));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!type || !iconKey || !canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const visual = {
        type,
        iconType: resolveIconTypeForSelection(type, iconKey),
        iconKey,
        color,
      };

      const outcome = isEditMode
        ? await updateMplusAccount(account, { name, visual })
        : await createMplusAccount(ownerId, name, visual);

      if (outcome.kind === "success") {
        // Nada de exito anticipado: el estado local se toca solo aqui, con el
        // documento que el servidor ya confirmo.
        if (!outcome.replayed) {
          applyCommittedAccount(outcome.value);
        }
        onClose();
        return;
      }

      setError(
        outcome.kind === "conflict"
          ? "Alguien mas cambio esta cuenta mientras la editabas. Vuelve a abrirla para ver la version del servidor."
          : outcome.kind === "unavailable"
            ? "No hay conexion con el servidor. El cambio NO se guardo."
            : outcome.message,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar la cuenta.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FinanceDialog
      onClose={onClose}
      open={open}
      subtitle="Banco, billetera, efectivo o ahorro"
      title={isEditMode ? "Editar cuenta" : "Nueva cuenta"}
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-500/20 bg-[rgba(239,68,68,0.1)] p-3 text-xs text-[var(--fm-expense)]"
          >
            {error}
          </div>
        ) : null}

        {/* ── 1. Tipo de cuenta ── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fm-text-muted)]">
            Tipo de cuenta
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ACCOUNT_TYPE_OPTIONS.map((option, index) => {
              const Icon = TYPE_ICON_MAP[option.iconName];
              const isActive = type === option.value;
              const accentColor = TYPE_COLORS[option.value];
              const isLast = index === ACCOUNT_TYPE_OPTIONS.length - 1;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handleTypeSelect(option.value as AccountType)}
                  className={cn(
                    "flex flex-row items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-white/20 min-h-[72px]",
                    !isActive &&
                      "border-white/8 bg-white/[0.02] hover:border-white/14 hover:bg-white/[0.04]",
                    isLast && "col-span-2",
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
                    <p className="text-sm font-semibold text-[var(--fm-warm-paper)] truncate">
                      {option.label}
                    </p>
                    <p className="text-[11px] leading-tight text-[var(--fm-text-muted)] mt-0.5">
                      {option.description}
                    </p>
                  </div>

                  {isActive ? (
                    <Check className="h-5 w-5 shrink-0" style={{ color: accentColor }} />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 2. Selector de marca (condicional) ── */}
        {type && brandOptions !== null ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fm-text-muted)]">
              {brandLabel}
            </p>
            <IconSelect
              id="mplus-brand-selector"
              value={iconKey ?? ""}
              onChange={handleBrandSelect}
              placeholder={`Seleccionar ${brandLabel.toLowerCase()}`}
              options={brandOptions.map((option) => ({
                id: option.iconKey,
                label: option.label,
                color,
                icon: (
                  <AccountIcon
                    iconType={resolveIconTypeForSelection(type, option.iconKey)}
                    iconKey={option.iconKey}
                    color={color}
                    size="xs"
                  />
                ),
              }))}
            />
          </div>
        ) : null}

        {/* ── 3. Nombre ── */}
        <FinanceTextField
          disabled={isSubmitting}
          label="Nombre de la cuenta"
          maxLength={NAME_MAX_LENGTH}
          onChange={(event) => {
            setName(event.target.value);
            setNameTouched(true);
          }}
          placeholder="Ej. Mi cuenta"
          required
          value={name}
        />

        {/* ── Acciones ── */}
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
            disabled={isSubmitting || !canSubmit}
            tone="filled"
            type="submit"
            variant="default"
          >
            {isSubmitting
              ? isEditMode
                ? "Guardando..."
                : "Creando..."
              : isEditMode
                ? "Guardar cambios"
                : "Crear cuenta"}
          </FinanceButton>
        </div>
      </form>
    </FinanceDialog>
  );
}
