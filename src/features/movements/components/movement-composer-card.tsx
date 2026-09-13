"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Calendar, HelpCircle } from "lucide-react";

import { AccountIcon } from "@/components/finance/account-icon";
import { IconSelect } from "@/components/finance/icon-select";
import { HouseholdCategorySelect } from "@/features/household/components/ui/household-category-select";
import {
  AmountField,
  ComposerFeedback,
  ComposerField,
  ComposerFooter,
  ToggleRow,
  composerControlClass,
  composerControlErrorClass,
  formatAmountInput,
  parseAmountInput,
  toneStyle,
} from "@/features/movements/components/composer/composer-primitives";
import { RemoveFromHouseholdConfirmDialog } from "@/features/movements/components/composer/remove-from-household-confirm-dialog";
import { ShareWithHouseholdConfirmDialog } from "@/features/movements/components/composer/share-with-household-confirm-dialog";
import { HouseholdExpenseDistributionDialog } from "@/features/household/components/household-expense-distribution-dialog";
import { resolveHouseholdCategoryIdForShare } from "@/features/movements/lib/resolve-household-category-for-share";
import { verifyHouseholdSharePreflight } from "@/features/movements/services/verify-household-share-preflight";
import type { MovementDraft } from "@/features/movements/services/movement-mutations";

import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { formatDateInputValue, getTodayDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import { AMOUNT_MAX, TITLE_MAX_LENGTH, NOTE_MAX_LENGTH } from "@/lib/mplus/catalogs";
import type { HouseholdExpenseDistributionMode, MovementType } from "@/lib/mplus/enums";
import type {
  MplusCategoryMapping,
  MplusHouseholdExpense,
  MplusHouseholdExpenseCategory,
  MplusMovement,
  MplusPersonalAccount,
  MplusPersonalCategory,
} from "@/lib/mplus/models";
import { cn } from "@/lib/utils";

/** Campo del formulario que puede mostrar error. */
type ComposerFieldKey = "amount" | "title" | "date" | "category";

/** Opcion del selector de cuenta que representa "ninguna". */
const NO_ACCOUNT_OPTION_ID = "__sin_cuenta__";

export type MovementComposerCardProps = {
  type: MovementType;
  /** Movimiento existente en modo edicion; null al crear. */
  movement?: MplusMovement | null;
  /** Gasto de Hogar existente en modo edición; null al crear. */
  householdExpense?: MplusHouseholdExpense | null;
  /** Objetivo del registro: Personal o Hogar */
  target?: "personal" | "household";
  memberAName?: string;
  memberBName?: string;
  memberAId?: string;
  memberBId?: string;
  categories: readonly MplusPersonalCategory[];
  accounts: readonly MplusPersonalAccount[];
  defaultAccountId?: string | null;
  /** Hogar activo del perfil; null si no se puede compartir. */
  householdId: string | null;
  canShareWithHousehold: boolean;
  householdCategories?: readonly MplusHouseholdExpenseCategory[];
  learnedMappings?: readonly MplusCategoryMapping[];
  currentUid?: string | null;
  isSubmitting: boolean;
  feedbackError: string | null;
  onSubmit: (draft: MovementDraft) => Promise<boolean>;
  onSubmitHouseholdExpense?: (draft: {
    title: string;
    amount: number;
    note: string;
    occurredAtMillis: number;
    householdCategoryId: string | null;
    distributionMode: HouseholdExpenseDistributionMode;
    memberAAmount: number;
    memberBAmount: number;
  }) => Promise<boolean>;
  onCancel: () => void;
  /** Marca el formulario como sucio para la confirmacion de descarte. */
  onDirtyChange?: (dirty: boolean) => void;
};

export function MovementComposerCard({
  type,
  movement = null,
  householdExpense = null,
  target = "personal",
  memberAName,
  memberBName,
  memberAId,
  memberBId,
  categories,
  accounts,
  defaultAccountId,
  householdId,
  canShareWithHousehold,
  householdCategories = [],
  learnedMappings = [],
  currentUid = null,
  isSubmitting,
  feedbackError,
  onSubmit,
  onSubmitHouseholdExpense,
  onCancel,
  onDirtyChange,
}: MovementComposerCardProps) {
  const isHouseholdMode = target === "household" || Boolean(householdExpense);
  const isEditMode = movement !== null || Boolean(householdExpense);
  const isExpense = isHouseholdMode ? true : type === "expense";

  const [amount, setAmount] = useState(() => {
    if (householdExpense) return formatAmountInput(String(householdExpense.amount));
    if (movement) return formatAmountInput(String(movement.amount));
    return "";
  });
  const [title, setTitle] = useState(() => householdExpense?.title ?? movement?.title ?? "");
  const [note, setNote] = useState(() => householdExpense?.note ?? movement?.note ?? "");
  const [date, setDate] = useState(() => {
    if (householdExpense?.occurredAtMillis) {
      return formatDateInputValue(new Date(householdExpense.occurredAtMillis));
    }
    if (movement) {
      return formatDateInputValue(new Date(movement.occurredAtMillis));
    }
    return getTodayDateInputValue();
  });
  const [categoryId, setCategoryId] = useState(() => {
    if (isHouseholdMode) {
      return householdExpense?.householdCategoryId ?? "";
    }
    return movement?.categoryId ?? "";
  });
  const [accountId, setAccountId] = useState(
    () => movement?.accountId ?? defaultAccountId ?? null,
  );
  const [shareWithHousehold, setShareWithHousehold] = useState(
    () => (movement ? movement.householdId !== null : canShareWithHousehold),
  );

  const [showShareConfirm, setShowShareConfirm] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isCheckingPreflight, setIsCheckingPreflight] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showHouseholdDistributionDialog, setShowHouseholdDistributionDialog] = useState(false);

  const [touched, setTouched] = useState<Partial<Record<ComposerFieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const markTouched = (field: ComposerFieldKey) =>
    setTouched((current) => ({ ...current, [field]: true }));

  const markDirty = () => onDirtyChange?.(true);

  // Opciones de categoría en Personal
  const categoryOptions = useMemo(() => {
    const active = categories.filter(
      (category) => category.type === type && category.state === "active",
    );
    const current =
      movement && !active.some((category) => category.id === movement.categoryId)
        ? categories.find((category) => category.id === movement.categoryId)
        : undefined;
    return current ? [current, ...active] : active;
  }, [categories, movement, type]);

  // Opciones de categoría en Hogar (incluye "Por clasificar")
  const householdCategoryOptions = useMemo(() => {
    const unclassifiedOption = {
      id: "",
      label: "Por clasificar",
      color: "#94A3B8",
      icon: <HelpCircle className="h-3.5 w-3.5" />,
    };
    const active = (householdCategories ?? []).filter((c) => c.state === "active");
    const current =
      householdExpense?.householdCategoryId &&
      !active.some((c) => c.id === householdExpense.householdCategoryId)
        ? (householdCategories ?? []).find((c) => c.id === householdExpense.householdCategoryId)
        : undefined;
    const list = current ? [current, ...active] : active;
    return [
      unclassifiedOption,
      ...list.map((c) => {
        const Icon = resolveCategoryIcon(c.iconKey, "expense");
        return {
          id: c.id,
          label: c.name,
          color: c.color,
          icon: <Icon className="h-3.5 w-3.5" />,
        };
      }),
    ];
  }, [householdCategories, householdExpense]);

  const accountOptions = useMemo(
    () => accounts.filter((account) => account.state === "active"),
    [accounts],
  );

  const parsedAmount = parseAmountInput(amount);

  const errors = useMemo(() => {
    const next: Partial<Record<ComposerFieldKey, string>> = {};

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      next.amount = "Ingresa un monto mayor a $ 0.";
    } else if (!Number.isInteger(parsedAmount)) {
      next.amount = "El monto debe ser un valor entero en pesos.";
    } else if (parsedAmount > AMOUNT_MAX) {
      next.amount = "El monto supera el maximo permitido.";
    }

    if (!title.trim()) {
      next.title = `Escribe un concepto para identificar ${isExpense ? "el gasto" : "el ingreso"}.`;
    } else if (title.trim().length > TITLE_MAX_LENGTH) {
      next.title = `Maximo ${TITLE_MAX_LENGTH} caracteres.`;
    }

    if (!date) {
      next.date = "Elige la fecha.";
    } else {
      const parsed = parseDateInputAsLocalDate(date);
      if (!parsed) {
        next.date = "La fecha no es valida.";
      }
    }

    // En Personal la categoría es obligatoria.
    // En Hogar la categoría es nullable (equivale a 'Por clasificar').
    if (!isHouseholdMode && !categoryId) {
      next.category = "Elige una categoria.";
    }

    return next;
  }, [categoryId, date, isExpense, isHouseholdMode, parsedAmount, title]);

  const isFormValid = Object.keys(errors).length === 0;
  const visibleError = (field: ComposerFieldKey) =>
    submitAttempted || touched[field] ? (errors[field] ?? null) : null;

  const buildBaseDraft = (): MovementDraft | null => {
    const occurredAt = parseDateInputAsLocalDate(date);
    if (!occurredAt) return null;
    return {
      type,
      title: title.trim(),
      amount: parsedAmount,
      categoryId,
      accountId,
      note: note.trim(),
      occurredAtMillis: occurredAt.getTime(),
      householdId: null,
    };
  };

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (!isFormValid) {
      return;
    }

    if (isHouseholdMode) {
      setShowHouseholdDistributionDialog(true);
      return;
    }

    const baseDraft = buildBaseDraft();
    if (!baseDraft) {
      return;
    }

    // Caso 1: Estaba compartido y el usuario desactivó el toggle -> Diálogo "Retirar de Hogar"
    if (isEditMode && movement?.householdId !== null && !shareWithHousehold) {
      setShowRemoveConfirm(true);
      return;
    }

    // Caso 2: El usuario desea compartir con Hogar -> Diálogo "Contar en Hogar"
    if (shareWithHousehold && canShareWithHousehold) {
      setShareError(null);
      setShowShareConfirm(true);
      return;
    }

    // Caso 3: Guardar solo en Personal sin diálogo adicional
    const committed = await onSubmit({
      ...baseDraft,
      householdId: null,
      householdCategoryId: null,
    });
    if (committed) {
      onDirtyChange?.(false);
    }
  };

  const handleConfirmShare = async () => {
    const baseDraft = buildBaseDraft();
    if (!baseDraft) return;

    if (!currentUid || !householdId) {
      setShareError("No hay una cuenta de usuario o un hogar activo asignado para compartir.");
      return;
    }

    const resolvedHouseholdCategoryId = resolveHouseholdCategoryIdForShare({
      householdId: householdId ?? "",
      type,
      ownerId: currentUid ?? "",
      personalCategoryId: categoryId,
      mappings: learnedMappings,
      householdCategories,
    });

    setIsCheckingPreflight(true);
    setShareError(null);

    try {
      const preflight = await verifyHouseholdSharePreflight({
        uid: currentUid,
        householdId,
        householdCategoryId: resolvedHouseholdCategoryId,
      });

      if (!preflight.ok) {
        setShareError(preflight.reason);
        setIsCheckingPreflight(false);
        return; // Cero escrituras hacia Firestore
      }
    } catch {
      setShareError(
        "No fue posible comprobar los permisos del Hogar en el servidor. Puedes guardarlo solo en Personal.",
      );
      setIsCheckingPreflight(false);
      return;
    }

    setIsCheckingPreflight(false);

    const draft: MovementDraft = {
      ...baseDraft,
      householdId,
      householdCategoryId: resolvedHouseholdCategoryId,
      learnMapping: false,
    };

    const committed = await onSubmit(draft);
    if (committed) {
      setShowShareConfirm(false);
      setShareError(null);
      onDirtyChange?.(false);
    }
  };

  const handleSavePersonalOnly = async () => {
    const baseDraft = buildBaseDraft();
    if (!baseDraft) return;

    setShareError(null);

    const draft: MovementDraft = {
      ...baseDraft,
      householdId: null,
      householdCategoryId: null,
    };

    const committed = await onSubmit(draft);
    if (committed) {
      setShowShareConfirm(false);
      setShareError(null);
      onDirtyChange?.(false);
    }
  };

  const handleConfirmRemove = async () => {
    const baseDraft = buildBaseDraft();
    if (!baseDraft) return;

    const draft: MovementDraft = {
      ...baseDraft,
      householdId: null,
      householdCategoryId: null,
    };

    const committed = await onSubmit(draft);
    if (committed) {
      setShowRemoveConfirm(false);
      onDirtyChange?.(false);
    }
  };

  const fieldPrefix = isExpense ? "expense" : "income";

  return (
    <>
      <form
        style={toneStyle(isHouseholdMode ? "expense" : type)}
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        {/* ── 1. Monto ── */}
        <AmountField
          id={`${fieldPrefix}Amount`}
          label={`Monto ${isExpense ? "del gasto" : "del ingreso"} (obligatorio)`}
          ariaLabel={`Monto ${isExpense ? "del gasto" : "del ingreso"}`}
          value={amount}
          autoFocus
          onChange={(next) => {
            setAmount(next);
            markDirty();
          }}
          onBlur={() => markTouched("amount")}
          icon={
            isExpense ? (
              <ArrowDownLeft className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpRight className="h-3.5 w-3.5" />
            )
          }
          error={visibleError("amount")}
        />

        {/* ── 2. Detalles del movimiento ── */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
            <ComposerField
              label="Concepto"
              htmlFor={`${fieldPrefix}Title`}
              required
              error={visibleError("title")}
            >
              <input
                id={`${fieldPrefix}Title`}
                type="text"
                placeholder="Titulo o concepto"
                maxLength={TITLE_MAX_LENGTH}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  markDirty();
                }}
                onBlur={() => markTouched("title")}
                aria-invalid={visibleError("title") ? true : undefined}
                className={cn(
                  composerControlClass,
                  visibleError("title") && composerControlErrorClass,
                )}
              />
            </ComposerField>

            <ComposerField
              label="Fecha"
              htmlFor={`${fieldPrefix}Date`}
              required
              error={visibleError("date")}
            >
              <div className="relative">
                <input
                  id={`${fieldPrefix}Date`}
                  type="date"
                  value={date}
                  // Contrato §4.6: hoy o pasado, nunca futuro.
                  max={getTodayDateInputValue()}
                  onChange={(event) => {
                    setDate(event.target.value);
                    markDirty();
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

          <div className={isHouseholdMode ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 gap-4 sm:grid-cols-2"}>
            <ComposerField
              label={isHouseholdMode ? "Categoría de Hogar" : "Categoria"}
              htmlFor={`${fieldPrefix}CategoryId`}
              required={!isHouseholdMode}
              hint={isHouseholdMode ? "Opcional: puedes clasificar ahora o dejarlo Por clasificar." : undefined}
              error={visibleError("category")}
            >
              {isHouseholdMode ? (
                <HouseholdCategorySelect
                  id={`${fieldPrefix}CategoryId`}
                  required={false}
                  placeholder="Por clasificar"
                  searchPlaceholder="Buscar categoría…"
                  value={categoryId}
                  onChange={(value) => {
                    setCategoryId(value);
                    markTouched("category");
                    markDirty();
                  }}
                  options={householdCategoryOptions}
                  className="h-11 rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface)] px-3.5 text-sm"
                />
              ) : (
                <IconSelect
                  id={`${fieldPrefix}CategoryId`}
                  required
                  searchPlaceholder="Buscar categoria..."
                  value={categoryId}
                  onChange={(value) => {
                    setCategoryId(value);
                    markTouched("category");
                    markDirty();
                  }}
                  options={categoryOptions.map((category) => {
                    const Icon = resolveCategoryIcon(category.iconKey, type);
                    return {
                      id: category.id,
                      label: category.name,
                      color: category.color,
                      icon: <Icon className="h-3.5 w-3.5" />,
                    };
                  })}
                />
              )}
            </ComposerField>

            {!isHouseholdMode && (
              <ComposerField
                label="Cuenta"
                htmlFor={`${fieldPrefix}AccountId`}
                hint="Opcional: sirve para recordar de donde salio o entro el dinero."
              >
                <IconSelect
                  id={`${fieldPrefix}AccountId`}
                  placeholder="Sin cuenta"
                  value={accountId ?? NO_ACCOUNT_OPTION_ID}
                  onChange={(value) => {
                    setAccountId(value === NO_ACCOUNT_OPTION_ID ? null : value);
                    markDirty();
                  }}
                  options={[
                    { id: NO_ACCOUNT_OPTION_ID, label: "Sin cuenta" },
                    ...accountOptions.map((account) => ({
                      id: account.id,
                      label: account.name,
                      color: account.color,
                      icon: (
                        <AccountIcon
                          iconType={account.iconType}
                          iconKey={account.iconKey}
                          color={account.color}
                          size="xs"
                        />
                      ),
                    })),
                  ]}
                />
              </ComposerField>
            )}
          </div>

          <ComposerField label="Nota" htmlFor={`${fieldPrefix}Note`} hint={isHouseholdMode ? "Visible para ambos integrantes." : undefined}>
            <input
              id={`${fieldPrefix}Note`}
              type="text"
              placeholder="Opcional"
              maxLength={NOTE_MAX_LENGTH}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                markDirty();
              }}
              className={composerControlClass}
            />
          </ComposerField>

          {!isHouseholdMode && canShareWithHousehold ? (
            <ToggleRow
              id={`${fieldPrefix}ShareWithHousehold`}
              title="Contar en Hogar"
              description={
                isExpense
                  ? "El gasto sigue siendo tuyo; ademas suma en el tablero compartido."
                  : "El ingreso sigue siendo tuyo; ademas suma en el tablero compartido."
              }
              checked={shareWithHousehold}
              onChange={(next) => {
                setShareWithHousehold(next);
                markDirty();
              }}
            />
          ) : null}
        </div>

        <ComposerFeedback error={feedbackError} />

        <ComposerFooter
          context={isHouseholdMode ? "household" : "personal"}
          submitLabel={
            isHouseholdMode
              ? isEditMode ? "Guardar cambios" : "Continuar a distribución"
              : isEditMode
              ? "Guardar cambios"
              : isExpense
              ? "Registrar gasto"
              : "Registrar ingreso"
          }
          submittingLabel="Guardando..."
          isSubmitting={isSubmitting}
          disabled={submitAttempted && !isFormValid}
          onCancel={onCancel}
        />
      </form>

      {/* Diálogo de confirmación "Contar en Hogar" en Personal */}
      <ShareWithHouseholdConfirmDialog
        open={showShareConfirm}
        movementType={type}
        onConfirmShare={handleConfirmShare}
        onSavePersonalOnly={handleSavePersonalOnly}
        onCancel={() => {
          setShowShareConfirm(false);
          setShareError(null);
        }}
        isSubmitting={isSubmitting || isCheckingPreflight}
        errorMessage={shareError || feedbackError}
      />

      {/* Diálogo de confirmación "Retirar de Hogar" en Personal */}
      <RemoveFromHouseholdConfirmDialog
        open={showRemoveConfirm}
        onConfirmRemove={handleConfirmRemove}
        onCancel={() => setShowRemoveConfirm(false)}
        isSubmitting={isSubmitting}
      />

      {/* Diálogo de distribución compacta en Hogar */}
      {isHouseholdMode && (
        <HouseholdExpenseDistributionDialog
          open={showHouseholdDistributionDialog}
          totalAmount={parsedAmount}
          memberAName={memberAName ?? "Integrante A"}
          memberBName={memberBName ?? "Integrante B"}
          memberAId={memberAId ?? ""}
          memberBId={memberBId ?? ""}
          currentUid={currentUid}
          initialDistributionMode={householdExpense?.distributionMode ?? "equal"}
          initialMemberAAmount={householdExpense?.memberAAmount}
          initialMemberBAmount={householdExpense?.memberBAmount}
          isSubmitting={isSubmitting}
          onCancel={() => setShowHouseholdDistributionDialog(false)}
          onConfirm={async (dist) => {
            const occurredAtDate = parseDateInputAsLocalDate(date) ?? new Date();
            const committed = await onSubmitHouseholdExpense?.({
              title: title.trim(),
              amount: parsedAmount,
              note: note.trim(),
              occurredAtMillis: occurredAtDate.getTime(),
              householdCategoryId: categoryId ? categoryId : null,
              distributionMode: dist.distributionMode,
              memberAAmount: dist.memberAAmount,
              memberBAmount: dist.memberBAmount,
            });
            if (committed) {
              setShowHouseholdDistributionDialog(false);
              onDirtyChange?.(false);
            }
          }}
        />
      )}
    </>
  );
}
