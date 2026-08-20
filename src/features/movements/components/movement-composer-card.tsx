"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Calendar } from "lucide-react";

import { AccountIcon } from "@/components/finance/account-icon";
import { IconSelect } from "@/components/finance/icon-select";
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
import type { MovementDraft } from "@/features/movements/services/movement-mutations";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { formatDateInputValue, getTodayDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import { AMOUNT_MAX, TITLE_MAX_LENGTH, NOTE_MAX_LENGTH } from "@/lib/mplus/catalogs";
import type { MovementType } from "@/lib/mplus/enums";
import type { MplusMovement, MplusPersonalAccount, MplusPersonalCategory } from "@/lib/mplus/models";
import { cn } from "@/lib/utils";

/**
 * Composer de movimientos del contrato v1.
 *
 * Usa EXACTAMENTE el mismo kit visual que el composer anterior
 * (`AmountField`, `ComposerField`, `IconSelect`, `ToggleRow`,
 * `ComposerFooter`), con el mismo orden de bloques: monto → concepto y fecha →
 * categoria y cuenta → opciones. Lo unico que cambia es lo que el producto
 * admite (matriz W2):
 *
 * - solo Ingreso y Gasto (la transferencia se retiro);
 * - categoria OBLIGATORIA, cuenta OPCIONAL (en M+ es una etiqueta, no un saldo);
 * - toggle "Contar en Hogar" reutilizando `ToggleRow`;
 * - sin dinero no propio, sin bolsillo, sin cuenta destino.
 *
 * No confirma nada por su cuenta: `onSubmit` devuelve `true` solo cuando el
 * servidor acepto el commit (contrato §22).
 */

/** Campo del formulario que puede mostrar error. */
type ComposerFieldKey = "amount" | "title" | "date" | "category";

/** Opcion del selector de cuenta que representa "ninguna". */
const NO_ACCOUNT_OPTION_ID = "__sin_cuenta__";

export type MovementComposerCardProps = {
  type: MovementType;
  /** Movimiento existente en modo edicion; null al crear. */
  movement: MplusMovement | null;
  categories: readonly MplusPersonalCategory[];
  accounts: readonly MplusPersonalAccount[];
  defaultAccountId?: string | null;
  /** Hogar activo del perfil; null si no se puede compartir. */
  householdId: string | null;
  canShareWithHousehold: boolean;
  isSubmitting: boolean;
  feedbackError: string | null;
  onSubmit: (draft: MovementDraft) => Promise<boolean>;
  onCancel: () => void;
  /** Marca el formulario como sucio para la confirmacion de descarte. */
  onDirtyChange?: (dirty: boolean) => void;
};

export function MovementComposerCard({
  type,
  movement,
  categories,
  accounts,
  defaultAccountId,
  householdId,
  canShareWithHousehold,
  isSubmitting,
  feedbackError,
  onSubmit,
  onCancel,
  onDirtyChange,
}: MovementComposerCardProps) {
  const isEditMode = movement !== null;
  const isExpense = type === "expense";

  const [amount, setAmount] = useState(() =>
    movement ? formatAmountInput(String(movement.amount)) : "",
  );
  const [title, setTitle] = useState(() => movement?.title ?? "");
  const [note, setNote] = useState(() => movement?.note ?? "");
  const [date, setDate] = useState(() =>
    movement
      ? formatDateInputValue(new Date(movement.occurredAtMillis))
      : getTodayDateInputValue(),
  );
  const [categoryId, setCategoryId] = useState(() => movement?.categoryId ?? "");
  const [accountId, setAccountId] = useState(
    () => movement?.accountId ?? defaultAccountId ?? null,
  );
  const [shareWithHousehold, setShareWithHousehold] = useState(
    () => movement?.householdId !== null && movement?.householdId !== undefined,
  );

  const [touched, setTouched] = useState<Partial<Record<ComposerFieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const markTouched = (field: ComposerFieldKey) =>
    setTouched((current) => ({ ...current, [field]: true }));

  const markDirty = () => onDirtyChange?.(true);

  // Solo las categorias activas del tipo en curso. Una categoria archivada
  // sigue viviendo en el historial pero no se asigna a movimientos nuevos
  // (contrato §8.2); en edicion se conserva la actual aunque este archivada
  // para no forzar un cambio que el usuario no pidio.
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

    // Contrato §9.1: la categoria es obligatoria SIEMPRE; la cuenta no.
    if (!categoryId) {
      next.category = "Elige una categoria.";
    }

    return next;
  }, [categoryId, date, isExpense, parsedAmount, title]);

  const isFormValid = Object.keys(errors).length === 0;
  const visibleError = (field: ComposerFieldKey) =>
    submitAttempted || touched[field] ? (errors[field] ?? null) : null;

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (!isFormValid) {
      return;
    }

    const occurredAt = parseDateInputAsLocalDate(date);
    if (!occurredAt) {
      return;
    }

    const draft: MovementDraft = {
      type,
      title: title.trim(),
      amount: parsedAmount,
      categoryId,
      accountId,
      note: note.trim(),
      occurredAtMillis: occurredAt.getTime(),
      // Compartir exige Hogar activo; si la sesion cambio debajo, el toggle
      // deja de aplicar en vez de mandar un payload que Rules rechazaria.
      householdId: shareWithHousehold && canShareWithHousehold ? householdId : null,
    };

    const committed = await onSubmit(draft);
    if (committed) {
      onDirtyChange?.(false);
    }
  };

  const fieldPrefix = isExpense ? "expense" : "income";

  return (
    <form
      style={toneStyle(type)}
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ComposerField
              label="Categoria"
              htmlFor={`${fieldPrefix}CategoryId`}
              required
              error={visibleError("category")}
            >
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
            </ComposerField>

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
          </div>

          <ComposerField label="Nota" htmlFor={`${fieldPrefix}Note`}>
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

          {canShareWithHousehold ? (
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
          submitLabel={isEditMode ? "Guardar cambios" : isExpense ? "Registrar gasto" : "Registrar ingreso"}
          submittingLabel="Guardando..."
          isSubmitting={isSubmitting}
          disabled={submitAttempted && !isFormValid}
          onCancel={onCancel}
        />
      </form>
  );
}
