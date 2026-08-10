"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Plus,
  SplitSquareHorizontal,
  CreditCard,
  Gift,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { HouseholdTextField } from "@/features/household/components/ui/household-text-field";
import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdDialog } from "@/features/household/components/ui/household-dialog";
import { HouseholdDiscardConfirmDialog } from "@/features/household/components/ui/household-discard-confirm-dialog";
import { HouseholdCategorySelect } from "@/features/household/components/ui/household-category-select";
import { HouseholdDateField } from "@/features/household/components/ui/household-date-field";
import { useCreateHouseholdEvent } from "@/features/household/hooks/use-create-household-event";
import {
  getActiveHouseholdCategories,
  isValidCreateCategoryId,
  resolveInitialCreateCategoryId,
} from "@/features/household/lib/household-category-selection";
import { getTodayDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import { formatCurrencyCop } from "@/lib/format/currency";
import { useFocusTrap } from "@/features/household/hooks/use-focus-trap";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import type { HouseholdCategory, HouseholdMemberProfile } from "@/types/household";

type Props = {
  open: boolean;
  onClose: () => void;
  householdId: string;
  currentUid: string;
  memberIds: string[];
  memberProfiles: Record<string, HouseholdMemberProfile>;
  categories: HouseholdCategory[];
};

type SettlementMode = "invitation" | "advancedByPayer" | "eachPaysOwn";

const formatAmountInput = (raw: string): string => {
  const clean = raw.replace(/\D/g, "");
  if (!clean) return "";
  return Number(clean).toLocaleString("en-US", { maximumFractionDigits: 0 }).replace(/,/g, ".");
};

const parseAmountInput = (raw: string): number => {
  const clean = raw.replace(/\D/g, "");
  return clean ? parseInt(clean, 10) : 0;
};

const SETTLEMENT_OPTIONS: {
  id: SettlementMode;
  label: string;
  shortDescription: string;
  helper: string;
  Icon: LucideIcon;
}[] = [
  {
    id: "advancedByPayer",
    label: "Adelanto",
    shortDescription: "Me deben una parte",
    helper: "El pagador cubre el total; el resto le devuelve su parte.",
    Icon: CreditCard,
  },
  {
    id: "invitation",
    label: "Invitación",
    shortDescription: "No me deben nada",
    helper: "Quien pagó no espera que le devuelvan nada.",
    Icon: Gift,
  },
  {
    id: "eachPaysOwn",
    label: "Cada uno lo suyo",
    shortDescription: "Cada uno pagó su parte",
    helper: "Cada persona ya cubrió lo que le correspondía.",
    Icon: WalletCards,
  },
];

/** Título pequeño y discreto: orienta sin encerrar la zona en una card. */
function StageHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hh-text-muted)]">
      {children}
    </p>
  );
}

/** Línea compacta de balance: "Asignado $X de $Y" · estado. Nunca una caja tipo input. */
function ShareBalanceLine({
  sum,
  total,
  valid,
}: {
  sum: number;
  total: number;
  valid: boolean;
}) {
  const diff = total - sum;
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-[var(--hh-text-secondary)]">
        Asignado {formatCurrencyCop(sum)} de {formatCurrencyCop(total)}
      </span>
      <span
        className={cn(
          "font-semibold",
          valid ? "text-[var(--hh-primary-action)]" : "text-[var(--hh-destructive-content)]",
        )}
      >
        {valid ? "Completo" : diff > 0 ? `Faltan ${formatCurrencyCop(diff)}` : `Sobran ${formatCurrencyCop(Math.abs(diff))}`}
      </span>
    </div>
  );
}

export function CreateHouseholdExpenseDialog({
  open,
  onClose,
  householdId,
  currentUid,
  memberIds,
  memberProfiles,
  categories,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { isSubmitting, error, submit, resetError } = useCreateHouseholdEvent();

  const selfDisplayName = useAuthStore((state) => state.user?.displayName);
  const selfPhotoUrl = useAuthStore((state) => state.user?.photoUrl);

  // Identidad visual: nombre/foto reales siempre van al avatar (iniciales
  // correctas); "Yo" es solo la etiqueta visible, nunca lo que identifica.
  const resolveRealName = (userId: string): string =>
    userId === currentUid ? selfDisplayName || "Tú" : memberProfiles[userId]?.displayName || "Otro miembro";
  const resolvePhotoUrl = (userId: string): string | null =>
    (userId === currentUid ? selfPhotoUrl : memberProfiles[userId]?.photoUrl) ?? null;
  const resolveCardLabel = (userId: string): string => (userId === currentUid ? "Yo" : resolveRealName(userId));

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [amountRaw, setAmountRaw] = useState("");
  const [date, setDate] = useState(getTodayDateInputValue);
  const [categoryId, setCategoryId] = useState("");
  // shares: memberUserId -> amountRaw string
  const [sharesRaw, setSharesRaw] = useState<Record<string, string>>({});
  const [paidByUserId, setPaidByUserId] = useState(currentUid);
  const [settlementMode, setSettlementMode] = useState<SettlementMode>("advancedByPayer");
  /** Paso 1 = datos + quién/cómo. Paso 2 = reparto (solo Adelanto / Cada uno). */
  const [step, setStep] = useState<1 | 2>(1);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Ensure currentUid is always first in the list
  const orderedMembers = useMemo(() => {
    const others = memberIds.filter((id) => id !== currentUid);
    return currentUid ? [currentUid, ...others] : memberIds;
  }, [memberIds, currentUid]);

  const totalAmount = parseAmountInput(amountRaw);

  const sharesSum = orderedMembers.reduce((s, id) => s + parseAmountInput(sharesRaw[id] ?? ""), 0);
  const sharesValid = orderedMembers.length > 0 && Math.abs(sharesSum - totalAmount) <= 1;

  const buildEqualShares = (total: number): Record<string, string> => {
    if (orderedMembers.length === 0 || total <= 0) return {};
    const base = Math.floor(total / orderedMembers.length);
    const remainder = total - base * orderedMembers.length;
    const next: Record<string, string> = {};
    orderedMembers.forEach((id, idx) => {
      const amount = idx === 0 ? base + remainder : base;
      next[id] = formatAmountInput(String(amount));
    });
    return next;
  };

  const splitEqually = () => {
    setSharesRaw(buildEqualShares(totalAmount));
  };

  const handleShareChange = (editedMemberId: string, rawVal: string) => {
    const formatted = formatAmountInput(rawVal);
    const newShareNum = parseAmountInput(rawVal);

    if (orderedMembers.length === 2 && totalAmount > 0) {
      const otherMemberId = orderedMembers.find((id) => id !== editedMemberId);
      if (otherMemberId) {
        const remaining = Math.max(0, totalAmount - newShareNum);
        setSharesRaw({
          [editedMemberId]: formatted,
          [otherMemberId]: formatAmountInput(String(remaining)),
        });
        return;
      }
    }

    setSharesRaw((prev) => ({
      ...prev,
      [editedMemberId]: formatted,
    }));
  };

  const handleAmountChange = (rawVal: string) => {
    const formatted = formatAmountInput(rawVal);
    setAmountRaw(formatted);
    const newTotal = parseAmountInput(rawVal);

    if (orderedMembers.length === 2 && newTotal > 0) {
      const base = Math.floor(newTotal / 2);
      const remainder = newTotal - base * 2;
      setSharesRaw({
        [orderedMembers[0]]: formatAmountInput(String(base + remainder)),
        [orderedMembers[1]]: formatAmountInput(String(base)),
      });
    }
  };
  const splitLabel = orderedMembers.length === 2 ? "Dividir 50 / 50" : "Dividir en partes iguales";

  // Validation
  const [submitted, setSubmitted] = useState(false);
  // El CTA se deshabilita mientras el gasto no pueda persistirse, así que el
  // envío no puede ser la única puerta al error inline: cada campo lo revela al
  // perder el foco.
  const [touched, setTouched] = useState<{ title?: boolean; amount?: boolean }>({});
  const showFieldError = (field: "title" | "amount") => submitted || Boolean(touched[field]);
  const titleError =
    showFieldError("title") && !title.trim() ? "El título es obligatorio." : undefined;
  const amountError =
    showFieldError("amount") && totalAmount <= 0 ? "El monto debe ser mayor a cero." : undefined;

  const requiresShares = settlementMode !== "invitation";
  const basicsReady = Boolean(title.trim()) && totalAmount > 0;
  const canContinue = basicsReady;
  const canSubmit =
    basicsReady && (!requiresShares || sharesValid);

  /** Qué falta para la acción primaria del paso actual. */
  const missingParts =
    step === 1
      ? ([!title.trim() ? "el título" : null, totalAmount <= 0 ? "el monto" : null].filter(Boolean) as string[])
      : ([
          !title.trim() ? "el título" : null,
          totalAmount <= 0 ? "el monto" : null,
          requiresShares && totalAmount > 0 && !sharesValid ? "cuadrar el reparto" : null,
        ].filter(Boolean) as string[]);

  const activeCategories = useMemo(() => getActiveHouseholdCategories(categories), [categories]);

  const payerIsCurrentUser = paidByUserId === currentUid;
  const payerCardLabel = resolveCardLabel(paidByUserId);

  /** Deudas resultantes de Adelanto: cada no-pagador con parte > 0 le debe al pagador. */
  const advancedDebts = useMemo(() => {
    if (settlementMode !== "advancedByPayer" || !sharesValid) return [];
    return orderedMembers
      .filter((id) => id !== paidByUserId)
      .map((id) => ({ debtorId: id, amount: parseAmountInput(sharesRaw[id] ?? "") }))
      .filter((entry) => entry.amount > 0);
  }, [settlementMode, sharesValid, orderedMembers, paidByUserId, sharesRaw]);

  const debtPhrase = (debtorId: string, amount: number): string => {
    const formatted = formatCurrencyCop(amount);
    if (debtorId === currentUid) {
      return `Le debes ${formatted} a ${resolveRealName(paidByUserId)}.`;
    }
    if (payerIsCurrentUser) {
      return `${resolveRealName(debtorId)} te debe ${formatted}.`;
    }
    return `${resolveRealName(debtorId)} le debe ${formatted} a ${resolveRealName(paidByUserId)}.`;
  };

  // Shield against real-time archiving of currently selected category
  useEffect(() => {
    if (open && categoryId && !isValidCreateCategoryId(categoryId, categories)) {
      setCategoryId(resolveInitialCreateCategoryId(categories));
    }
  }, [open, categoryId, categories]);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setShowDescription(false);
      setAmountRaw("");
      setDate(getTodayDateInputValue());
      setCategoryId(resolveInitialCreateCategoryId(categories));
      setSharesRaw({});
      setPaidByUserId(currentUid);
      setSettlementMode("advancedByPayer");
      setStep(1);
      setSubmitted(false);
      setTouched({});
      setShowDiscardConfirm(false);
      resetError();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Único camino que NO pide confirmación: el botón "Atrás" explícito del paso 2. */
  const handleGoBackToStep1 = () => {
    setStep(1);
    setSubmitted(false);
  };

  /** X, Escape, backdrop o "Cancelar": en cualquiera de los dos pasos, piden confirmación. */
  const handleRequestDiscardConfirm = () => {
    setShowDiscardConfirm(true);
  };

  // Escape / Tab: HouseholdDialog ya hace scroll-lock + Escape; el trap solo
  // cicla Tab. No re-enfocar el panel aquí (robaba el foco del monto/título).
  useFocusTrap(dialogRef, open, handleRequestDiscardConfirm);

  if (!open) return null;

  const persistExpense = async () => {
    if (!isValidCreateCategoryId(categoryId, categories)) {
      setCategoryId(resolveInitialCreateCategoryId(categories));
      return;
    }

    if (!title.trim() || totalAmount <= 0 || (settlementMode !== "invitation" && !sharesValid)) return;

    const eventDate = parseDateInputAsLocalDate(date) ?? new Date();
    const memberShares = settlementMode === "invitation"
      ? orderedMembers.map((id) => ({
          memberUserId: id,
          responsibilityAmount: id === paidByUserId ? totalAmount : 0,
        }))
      : orderedMembers.map((id) => ({
          memberUserId: id,
          responsibilityAmount: parseAmountInput(sharesRaw[id] ?? "0"),
        }));

    const ok = await submit({
      householdId,
      createdByUserId: currentUid,
      paidByUserId,
      settlementMode,
      title: title.trim(),
      description: description.trim(),
      totalAmount,
      householdCategoryId: categoryId || "",
      eventDate,
      memberShares,
      householdMemberIds: orderedMembers,
      availableCategories: categories,
    });

    if (ok) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (step === 1) {
      if (!basicsReady) return;
      if (!requiresShares) {
        await persistExpense();
        return;
      }
      setSharesRaw(buildEqualShares(totalAmount));
      setStep(2);
      setSubmitted(false);
      return;
    }

    await persistExpense();
  };

  const primaryCtaLabel = (() => {
    if (isSubmitting) return "Guardando…";
    if (step === 1 && requiresShares) return "Continuar";
    return "Guardar gasto";
  })();

  const primaryDisabled = isSubmitting || (step === 1 ? !canContinue : !canSubmit);

  return (
    <>
    <HouseholdDialog
      open={open}
      onClose={handleRequestDiscardConfirm}
      size="default"
      title={step === 1 ? "Nuevo gasto Hogar" : "Reparto del gasto"}
      subtitle={
        step === 2
          ? `${title.trim() || "Gasto"} · ${formatCurrencyCop(totalAmount)}`
          : undefined
      }
      panelRef={dialogRef}
    >
      {/* Scrollable form body: fallback para viewports bajos, no el flujo normal */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto max-h-[85vh] -mx-5 px-5">

          <div className="space-y-5 py-1">

            {step === 1 ? (
              <>
            {/* ── Datos del gasto ── */}
            <section className="space-y-3">
              <StageHeading>Datos del gasto</StageHeading>

              {/* Monto protagonista, compacto */}
              <div
                className={cn(
                  "rounded-[16px] border p-3 transition-colors duration-200",
                  "bg-[var(--hh-surface)]",
                  "focus-within:border-[var(--hh-primary-action)]",
                  amountError ? "border-[var(--hh-destructive-border)]" : "border-[var(--hh-border)]",
                )}
              >
                <label
                  htmlFor="create-household-expense-amount"
                  className="text-[10px] font-semibold uppercase tracking-wider text-[var(--hh-text-muted)]"
                >
                  Monto total (obligatorio)
                </label>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span aria-hidden="true" className="select-none text-[18px] font-light text-[var(--hh-text-muted)]">
                    $
                  </span>
                  <input
                    id="create-household-expense-amount"
                    className="w-full min-w-0 border-none bg-transparent p-0 text-[30px] leading-none font-bold tracking-tight text-[var(--hh-text)] outline-none placeholder:text-[var(--hh-text-muted)]"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    autoFocus
                    data-hh-dialog-initial-focus="true"
                    value={amountRaw}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, amount: true }))}
                    aria-invalid={amountError ? true : undefined}
                    aria-describedby={amountError ? "create-household-expense-amount-error" : undefined}
                  />
                </div>
                {amountError && (
                  <p
                    id="create-household-expense-amount-error"
                    role="alert"
                    className="mt-1 text-[11px] text-[var(--hh-destructive-content)]"
                  >
                    {amountError}
                  </p>
                )}
              </div>

              <HouseholdTextField
                label="Título (obligatorio)"
                placeholder="Ej: Mercado semanal, Recibo de luz…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
                errorText={titleError}
                className="text-[16px] sm:text-[14px]"
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {activeCategories.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="create-household-expense-category" className="text-[14px] font-medium text-[var(--hh-text)]">
                      Categoría del Hogar
                    </label>
                    <HouseholdCategorySelect
                      id="create-household-expense-category"
                      value={categoryId}
                      onChange={setCategoryId}
                      placeholder="Sin categoría"
                      className="h-11 text-[16px] sm:text-[14px]"
                      options={[
                        { id: "", label: "Sin categoría" },
                        ...activeCategories.map((cat) => {
                          const Icon = resolveCategoryIcon(cat.iconKey, "expense");
                          return {
                            id: cat.id,
                            label: cat.name,
                            color: cat.color,
                            icon: <Icon className="h-3.5 w-3.5" />,
                          };
                        }),
                      ]}
                    />
                  </div>
                ) : null}
                <HouseholdDateField
                  id="create-household-expense-date"
                  label="Fecha"
                  value={date}
                  onChange={setDate}
                />
              </div>

              {/* Descripción bajo demanda */}
              {showDescription || description ? (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                  <HouseholdTextField
                    label="Descripción (opcional)"
                    placeholder="Notas adicionales del gasto"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="text-[16px] sm:text-[14px]"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDescription(true)}
                  className="flex min-h-6 items-center gap-1.5 text-[12px] font-medium text-[var(--hh-primary-action)] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar descripción
                </button>
              )}
            </section>

            {/* ── Cómo se pagó: quién + modo ── */}
            <section className="flex flex-col gap-5">
              <div className="space-y-2">
                <p className="text-[14px] font-medium text-[var(--hh-text)]">¿Quién pagó?</p>
                <div
                  id="create-household-expense-paid-by"
                  role="radiogroup"
                  aria-label="¿Quién pagó?"
                  className="flex flex-wrap gap-2"
                >
                  {orderedMembers.map((id) => {
                    const isActive = id === paidByUserId;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => setPaidByUserId(id)}
                        className={cn(
                          "flex min-w-[132px] flex-1 items-center gap-2.5 rounded-[14px] border px-3 py-2.5",
                          "cursor-pointer select-none outline-none transition-colors duration-150",
                          "focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]",
                          isActive
                            ? "border-[var(--hh-primary-action)] bg-[color-mix(in_srgb,var(--hh-primary-action)_12%,var(--hh-surface))]"
                            : "border-[var(--hh-border)] bg-[var(--hh-surface)] hover:bg-[var(--hh-surface-hover)]",
                        )}
                      >
                        <ProfileAvatar
                          name={resolveRealName(id)}
                          photoURL={resolvePhotoUrl(id)}
                          size="sm"
                          decorative
                          className="rounded-[8px] bg-[var(--hh-surface-elevated)] text-[var(--hh-text-secondary)]"
                        />
                        <span
                          className={cn(
                            "min-w-0 truncate text-[13px] font-semibold",
                            isActive ? "text-[var(--hh-primary-action)]" : "text-[var(--hh-text)]",
                          )}
                        >
                          {resolveCardLabel(id)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[14px] font-medium text-[var(--hh-text)]">¿Cómo se pagó?</p>
                <div
                  id="create-household-expense-settlement-mode"
                  role="radiogroup"
                  aria-label="¿Cómo se pagó?"
                  className="grid grid-cols-3 gap-2"
                >
                  {SETTLEMENT_OPTIONS.map((option) => {
                    const isActive = option.id === settlementMode;
                    const Icon = option.Icon;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => setSettlementMode(option.id)}
                        className={cn(
                          "flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-[14px] border px-2 py-2.5 text-center",
                          "cursor-pointer select-none outline-none transition-colors duration-150",
                          "focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]",
                          isActive
                            ? "border-[var(--hh-primary-action)] bg-[color-mix(in_srgb,var(--hh-primary-action)_12%,var(--hh-surface))]"
                            : "border-[var(--hh-border)] bg-[var(--hh-surface)] hover:bg-[var(--hh-surface-hover)]",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5 shrink-0",
                            isActive ? "text-[var(--hh-primary-action)]" : "text-[var(--hh-text-muted)]",
                          )}
                          strokeWidth={1.75}
                        />
                        <span
                          className={cn(
                            "text-[12px] font-semibold leading-tight",
                            isActive ? "text-[var(--hh-primary-action)]" : "text-[var(--hh-text)]",
                          )}
                        >
                          {option.label}
                        </span>
                        <span className="text-[10px] leading-snug text-[var(--hh-text-secondary)]">
                          {option.shortDescription}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p key={settlementMode} className="text-[11px] leading-snug text-[var(--hh-text-muted)] animate-in fade-in duration-150">
                  {SETTLEMENT_OPTIONS.find((o) => o.id === settlementMode)?.helper}
                </p>
              </div>
            </section>

            {settlementMode === "invitation" && (
              <section className="flex flex-col items-center gap-2 py-1 text-center animate-in fade-in duration-150">
                <ProfileAvatar
                  name={resolveRealName(paidByUserId)}
                  photoURL={resolvePhotoUrl(paidByUserId)}
                  size="md"
                  decorative
                  className="rounded-[12px] bg-[var(--hh-surface-elevated)] text-[var(--hh-text-secondary)]"
                />
                <p className="text-[15px] font-semibold text-[var(--hh-text)]">
                  {payerIsCurrentUser ? "Yo invité" : `${payerCardLabel} invitó`}
                </p>
                <p className="text-[12px] text-[var(--hh-text-secondary)]">
                  {orderedMembers.length === 2 ? "No queda ninguna deuda." : "No se genera deuda para los demás miembros."}
                </p>
              </section>
            )}
              </>
            ) : (
            /* ── Paso 2: solo reparto ── */
            <section key={settlementMode} className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14px] font-medium text-[var(--hh-text)]">
                  {settlementMode === "advancedByPayer" ? "¿Cómo se reparte el gasto?" : "¿Cuánto pagó cada uno?"}
                </p>
                {settlementMode === "advancedByPayer" && orderedMembers.length > 1 && (
                  <button
                    type="button"
                    onClick={splitEqually}
                    disabled={totalAmount <= 0}
                    className="flex min-h-6 items-center gap-1.5 text-xs font-medium text-[var(--hh-primary-action)] disabled:opacity-40 hover:opacity-80 transition-opacity"
                  >
                    <SplitSquareHorizontal className="h-3.5 w-3.5" />
                    {splitLabel}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                {orderedMembers.map((memberId) => {
                  const isPayer = memberId === paidByUserId;
                  const cardName = resolveCardLabel(memberId);
                  const roleLabel =
                    settlementMode === "advancedByPayer"
                      ? isPayer
                        ? "Mi parte"
                        : "Su parte"
                      : undefined;
                  const mainLabel =
                    settlementMode === "eachPaysOwn"
                      ? memberId === currentUid
                        ? "Yo pagué"
                        : `${cardName} pagó`
                      : cardName;
                  return (
                    <div
                      key={memberId}
                      className="min-w-0 rounded-[16px] border border-[var(--hh-border)] bg-[var(--hh-surface)] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <ProfileAvatar
                          name={resolveRealName(memberId)}
                          photoURL={resolvePhotoUrl(memberId)}
                          size="sm"
                          decorative
                          className="rounded-[8px] bg-[var(--hh-surface-elevated)] text-[var(--hh-text-secondary)]"
                        />
                        <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--hh-text)]">
                          {mainLabel}
                        </span>
                      </div>
                      {roleLabel && (
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--hh-text-muted)]">
                          {roleLabel}
                        </p>
                      )}
                      <div className={cn("flex items-baseline gap-1", roleLabel ? "mt-0.5" : "mt-2")}>
                        <span aria-hidden="true" className="select-none text-[14px] font-light text-[var(--hh-text-muted)]">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={sharesRaw[memberId] ?? ""}
                          onChange={(e) => handleShareChange(memberId, e.target.value)}
                          aria-label={`Responsabilidad de ${resolveRealName(memberId)}`}
                          className="w-full min-w-0 border-none bg-transparent p-0 text-[22px] leading-none font-bold text-[var(--hh-text)] outline-none placeholder:text-[var(--hh-text-muted)]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <ShareBalanceLine sum={sharesSum} total={totalAmount} valid={sharesValid} />

              {settlementMode === "advancedByPayer" && sharesValid && (
                <div className="space-y-2 pt-1">
                  {advancedDebts.length > 0 ? (
                    advancedDebts.map((entry) => (
                      <div key={entry.debtorId} className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <ProfileAvatar
                            name={resolveRealName(entry.debtorId)}
                            photoURL={resolvePhotoUrl(entry.debtorId)}
                            size="sm"
                            decorative
                            className="rounded-[8px] bg-[var(--hh-surface-elevated)] text-[var(--hh-text-secondary)]"
                          />
                          <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--hh-text-muted)]" />
                          <span className="text-[18px] font-bold text-[var(--hh-text)]">
                            {formatCurrencyCop(entry.amount)}
                          </span>
                          <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--hh-text-muted)]" />
                          <ProfileAvatar
                            name={resolveRealName(paidByUserId)}
                            photoURL={resolvePhotoUrl(paidByUserId)}
                            size="sm"
                            decorative
                            className="rounded-[8px] bg-[var(--hh-surface-elevated)] text-[var(--hh-text-secondary)]"
                          />
                        </div>
                        <p className="text-[12.5px] text-[var(--hh-text-secondary)]">
                          {debtPhrase(entry.debtorId, entry.amount)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12.5px] text-[var(--hh-text-secondary)]">No queda deuda.</p>
                  )}
                </div>
              )}

              {settlementMode === "eachPaysOwn" && sharesValid && (
                <p className="text-[12.5px] text-[var(--hh-text-secondary)]">
                  Cada uno registra su parte · No queda deuda
                </p>
              )}
            </section>
            )}

            {/* Error global */}
            {error && (
              <div className="rounded-[12px] border border-[var(--hh-destructive-border)] bg-[var(--hh-surface)] px-3 py-2.5 text-sm text-[var(--hh-destructive-content)]">
                {error}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="mt-5 flex flex-col gap-3 border-t border-[var(--hh-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p
              aria-live="polite"
              className={cn(
                "min-h-4 text-[12px] font-medium",
                missingParts.length > 0
                  ? "text-[var(--hh-destructive-content)]"
                  : "text-[var(--hh-text-muted)]",
              )}
            >
              {missingParts.length > 0
                ? `Falta ${missingParts.join(", ")}.`
                : step === 1 && requiresShares
                  ? "Siguiente: definir el reparto"
                  : ""}
            </p>
            <div className="flex items-center justify-end gap-3">
              <HouseholdButton
                type="button"
                tone="text"
                variant="ghost"
                onClick={step === 2 ? handleGoBackToStep1 : handleRequestDiscardConfirm}
                disabled={isSubmitting}
              >
                {step === 2 ? "Atrás" : "Cancelar"}
              </HouseholdButton>
              <HouseholdButton
                type="submit"
                tone="filled"
                disabled={primaryDisabled}
                aria-busy={isSubmitting}
              >
                {primaryCtaLabel}
              </HouseholdButton>
            </div>
          </div>
        </form>
    </HouseholdDialog>
    <HouseholdDiscardConfirmDialog
      open={showDiscardConfirm}
      onKeepEditing={() => setShowDiscardConfirm(false)}
      onDiscard={() => {
        setShowDiscardConfirm(false);
        onClose();
      }}
    />
    </>
  );
}
