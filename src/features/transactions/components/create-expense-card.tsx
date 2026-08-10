"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, Calendar } from "lucide-react";
import { IconSelect } from "@/components/finance/icon-select";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";

import { EmptyState } from "@/components/finance/empty-state";
import { AccountIcon } from "@/components/finance/account-icon";
import { HouseholdShareConfirmDialog } from "@/components/finance/household-share-confirm-dialog";
import { useCreatePersonalExpense } from "@/features/transactions/hooks/use-create-personal-expense";
import { useCreatePersonalExpenseWithHouseholdProjection } from "@/features/transactions/hooks/use-create-personal-expense-with-household-projection";
import { readAvailableThirdPartyFunds } from "@/features/transactions/services/read-available-third-party-funds";
import { useHouseholdDataStore } from "@/stores/household-data-store";
import { isHouseholdSessionUsable } from "@/lib/navigation/app-context";
import { getActiveHouseholdCategories } from "@/features/household/lib/household-category-selection";
import {
  AmountField,
  ComposerFeedback,
  ComposerField,
  ComposerFooter,
  SegmentedChoice,
  StatusNote,
  ToggleRow,
  composerControlClass,
  composerControlErrorClass,
  formatAmountInput,
  parseAmountInput,
  toneStyle,
} from "@/features/transactions/components/composer/composer-primitives";
import {
  TransactionFormSurface,
  type TransactionFormRenderMode,
} from "@/features/transactions/components/transaction-form-surface";
import { formatCurrencyCop } from "@/lib/format/currency";
import { getTodayDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import { getAccountVisual } from "@/lib/design/personal-visuals";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";

type CreateExpenseCardProps = {
  ownerId: string;
  accounts: Account[];
  categories: Category[];
  onCreated: () => Promise<void>;
  renderMode?: TransactionFormRenderMode;
  defaultAccountId?: string;
  onCancel?: () => void;
};

type ExpenseField = "amount" | "description" | "date" | "category" | "account" | "thirdParty";

export function CreateExpenseCard({
  ownerId,
  accounts,
  categories,
  onCreated,
  renderMode = "card",
  defaultAccountId,
  onCancel,
}: CreateExpenseCardProps) {
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories],
  );

  // ── Registro paralelo en Hogar: datos del hogar activo ──
  // Se calcula antes de los estados de UI porque `isHouseholdShared` arranca
  // preseleccionado con este valor (Objetivo 1).
  const householdActiveId = useHouseholdDataStore((state) => state.data.activeHouseholdId);
  const householdStatus = useHouseholdDataStore((state) => state.status);
  const household = useHouseholdDataStore((state) => state.data.household);
  const householdCategories = useHouseholdDataStore((state) => state.data.categories);
  const householdMemberProfiles = useHouseholdDataStore((state) => state.data.memberProfiles);

  const householdUsable = isHouseholdSessionUsable({
    activeHouseholdId: householdActiveId,
    status: householdStatus,
  });
  const activeHouseholdCategories = useMemo(
    () => getActiveHouseholdCategories(householdCategories),
    [householdCategories],
  );
  const otherHouseholdMembers = useMemo(
    () => (household?.memberIds ?? []).filter((id) => id !== ownerId),
    [household, ownerId],
  );
  // El control solo se muestra cuando de verdad se puede usar: hogar activo,
  // al menos una categoría de Hogar y al menos otro miembro a quien deberle.
  const canShareWithHousehold =
    householdUsable && activeHouseholdCategories.length > 0 && otherHouseholdMembers.length > 0;

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId || accounts[0]?.id || "");
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? "");
  const [date, setDate] = useState(getTodayDateInputValue);
  const [description, setDescription] = useState("");
  const [availableNoPropio, setAvailableNoPropio] = useState(0);
  const [consumesThirdPartyFunds, setConsumesThirdPartyFunds] = useState(false);
  const [thirdPartyConsumeAmount, setThirdPartyConsumeAmount] = useState("");
  // Objetivo 1: preseleccionado cuando el Hogar es realmente elegible al abrir.
  const [isHouseholdShared, setIsHouseholdShared] = useState(canShareWithHousehold);
  const [showHouseholdConfirm, setShowHouseholdConfirm] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Partial<Record<ExpenseField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const parsedAmount = parseAmountInput(amount);

  const {
    isSubmitting: isSubmittingExpense,
    error: expenseError,
    successMessage: expenseSuccessMessage,
    submitExpense,
    resetFeedback: resetExpenseFeedback,
  } = useCreatePersonalExpense();

  const {
    isSubmitting: isSubmittingProjection,
    error: projectionError,
    successMessage: projectionSuccessMessage,
    submitExpense: submitExpenseWithHouseholdProjection,
    resetFeedback: resetProjectionFeedback,
  } = useCreatePersonalExpenseWithHouseholdProjection();

  // Solo uno de los dos hooks se invoca por envío (según `isHouseholdShared` en
  // ese momento): el otro queda en su estado inicial, así que combinar con OR
  // / "el primero que no sea null" es seguro.
  const isSubmitting = isSubmittingExpense || isSubmittingProjection;
  const serviceError = projectionError ?? expenseError;
  const successMessage = projectionSuccessMessage ?? expenseSuccessMessage;
  const resetFeedback = () => {
    resetExpenseFeedback();
    resetProjectionFeedback();
  };

  const activeError = localError || serviceError;

  const resolveHouseholdCategoryId = (): string => {
    const selectedPersonalCategory = expenseCategories.find((cat) => cat.id === categoryId);
    const byName = selectedPersonalCategory
      ? activeHouseholdCategories.find(
          (cat) => cat.name.trim().toLowerCase() === selectedPersonalCategory.name.trim().toLowerCase(),
        )
      : undefined;
    return (byName ?? activeHouseholdCategories[0])?.id ?? "";
  };

  const householdMemberShares = useMemo(() => {
    if (!canShareWithHousehold) return [];
    const memberIds = household?.memberIds ?? [];
    const count = memberIds.length;
    if (count === 0 || parsedAmount <= 0) return [];
    const base = Math.floor(parsedAmount / count);
    const remainder = parsedAmount - base * count;
    // El pagador (dueño de esta cuenta) absorbe el residuo del reparto entero.
    return memberIds.map((id) => ({
      memberUserId: id,
      responsibilityAmount: base + (id === ownerId ? remainder : 0),
    }));
  }, [canShareWithHousehold, household, ownerId, parsedAmount]);

  const resolveHouseholdMemberName = (memberId: string): string =>
    householdMemberProfiles[memberId]?.displayName || "Otro miembro";

  const markTouched = (field: ExpenseField) =>
    setTouched((current) => ({ ...current, [field]: true }));

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

  const hasThirdPartyFunds = availableNoPropio > 0;

  const errors = useMemo(() => {
    const next: Partial<Record<ExpenseField, string>> = {};

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      next.amount = "Ingresa un monto mayor a $ 0.";
    }
    if (!description.trim()) {
      next.description = "Escribe un concepto para identificar el gasto.";
    }
    if (!date) {
      next.date = "Elige la fecha del gasto.";
    }
    if (!categoryId) {
      next.category = "Elige una categoría.";
    }
    if (!accountId) {
      next.account = "Elige la cuenta de la que sale el dinero.";
    }

    if (consumesThirdPartyFunds) {
      if (!hasThirdPartyFunds) {
        next.thirdParty = "No hay dinero de terceros disponible para consumir.";
      } else {
        const parsedConsumeAmount = parseAmountInput(thirdPartyConsumeAmount);
        if (!Number.isFinite(parsedConsumeAmount) || parsedConsumeAmount <= 0) {
          next.thirdParty = "Indica cuánto dinero no propio se consume.";
        } else if (parsedAmount > 0 && parsedConsumeAmount > parsedAmount) {
          next.thirdParty = "No puede superar el monto del gasto.";
        } else if (parsedConsumeAmount > availableNoPropio) {
          next.thirdParty = `Supera lo disponible (${formatCurrencyCop(availableNoPropio)}).`;
        }
      }
    }

    return next;
  }, [
    parsedAmount,
    description,
    date,
    categoryId,
    accountId,
    consumesThirdPartyFunds,
    hasThirdPartyFunds,
    thirdPartyConsumeAmount,
    availableNoPropio,
  ]);

  const isFormValid = Object.keys(errors).length === 0;

  /**
   * Imposibilidad financiera: el dinero elegido no alcanza para la operación.
   * A diferencia de un campo por completar, esto deshabilita el CTA de
   * inmediato — nunca se muestra "no se puede" junto a un botón que invita a
   * ejecutarlo. Se recalcula en cada render, así que vuelve a habilitarse solo.
   */
  const parsedConsumeAmount = parseAmountInput(thirdPartyConsumeAmount);
  const isBlocked =
    (consumesThirdPartyFunds &&
      (!hasThirdPartyFunds ||
        (parsedConsumeAmount > 0 &&
          (parsedConsumeAmount > availableNoPropio ||
            (parsedAmount > 0 && parsedConsumeAmount > parsedAmount))))) ||
    // Salvaguarda: el toggle solo se muestra cuando `canShareWithHousehold` es
    // verdadero, pero si la sesión de Hogar cambia debajo (se disuelve, se
    // queda sin categorías) mientras sigue prendido, esto lo atrapa antes del
    // envío en vez de dejar pasar un payload incompleto.
    (isHouseholdShared && !canShareWithHousehold);

  const visibleError = (field: ExpenseField) =>
    submitAttempted || touched[field] ? errors[field] ?? null : null;

  // El toggle solo se ofrece en el formulario cuando de verdad se puede usar;
  // "Otro" (dinero no propio) lo desactiva por completo, así que la
  // confirmación previa de Hogar solo aplica en ese mismo universo.
  const householdShareConfirmEligible = canShareWithHousehold && !consumesThirdPartyFunds;

  /** Ejecuta uno de los dos flujos existentes; nunca duplica su lógica. */
  const runSubmit = async (shareWithHousehold: boolean): Promise<boolean> => {
    resetFeedback();
    setLocalError(null);

    const parsedDate = parseDateInputAsLocalDate(date);
    if (!parsedDate) {
      setLocalError("La fecha ingresada no es válida.");
      return false;
    }

    const parsedConsumeAmount = consumesThirdPartyFunds
      ? parseAmountInput(thirdPartyConsumeAmount)
      : 0;

    // Revalida en el momento de guardar (no solo al abrir la confirmación):
    // si el Hogar dejó de ser elegible mientras estaba abierta, cae al flujo
    // Personal seguro en vez de enviar un payload de Hogar inconsistente.
    const effectiveShareWithHousehold =
      shareWithHousehold && canShareWithHousehold && Boolean(householdActiveId) && !consumesThirdPartyFunds;

    // "También registrar en Hogar" y "Otro" (dinero no propio) son mutuamente
    // excluyentes: el servicio de proyección rechaza los gastos con dinero no
    // propio, así que solo uno de los dos caminos se toma por envío.
    const ok = effectiveShareWithHousehold
      ? await submitExpenseWithHouseholdProjection({
          ownerId,
          amount: parsedAmount,
          accountId,
          categoryId,
          date: parsedDate,
          description: description.trim(),
          householdId: householdActiveId as string,
          householdCategoryId: resolveHouseholdCategoryId(),
          memberShares: householdMemberShares,
        })
      : await submitExpense({
          ownerId,
          amount: parsedAmount,
          accountId,
          categoryId,
          date: parsedDate,
          description: description.trim(),
          consumesThirdPartyFunds,
          thirdPartyConsumeAmount: consumesThirdPartyFunds ? parsedConsumeAmount : undefined,
        });

    if (!ok) {
      return false;
    }

    setAmount("");
    setDescription("");
    setConsumesThirdPartyFunds(false);
    setThirdPartyConsumeAmount("");
    setIsHouseholdShared(canShareWithHousehold);
    setTouched({});
    setSubmitAttempted(false);
    await onCreated();
    return true;
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }
    setSubmitAttempted(true);

    if (!isFormValid || isSubmitting) {
      return;
    }

    // Objetivo 2/6/7: con Hogar realmente elegible, se confirma antes de
    // guardar; sin eso (no elegible, o "Otro" seleccionado) se guarda directo.
    if (householdShareConfirmEligible) {
      setShowHouseholdConfirm(true);
      return;
    }

    await runSubmit(isHouseholdShared);
  };

  const handleReturnToEdit = () => {
    if (isSubmitting) {
      return;
    }
    setShowHouseholdConfirm(false);
  };

  const handleConfirmAndSaveWithHousehold = async () => {
    if (isSubmitting) {
      return;
    }
    await runSubmit(isHouseholdShared);
    setShowHouseholdConfirm(false);
  };

  // Protección: si el Hogar deja de ser elegible mientras la confirmación
  // está abierta (se disuelve, pierde categorías, etc.), se cierra sola en
  // vez de dejar una confirmación de Hogar para una opción que ya no existe.
  useEffect(() => {
    if (showHouseholdConfirm && !canShareWithHousehold) {
      setShowHouseholdConfirm(false);
    }
  }, [showHouseholdConfirm, canShareWithHousehold]);

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
        description="Necesitas categorías personales de tipo gasto para registrar gastos."
        title="Sin categorías de gasto"
      />
    );
  }

  const footerMessage = submitAttempted && !isFormValid ? "Revisa los campos marcados." : null;

  return (
    <>
    <TransactionFormSurface
      renderMode={renderMode}
      subtitle="Registrar una salida de dinero"
      title="Nuevo gasto"
    >
      <form
        style={toneStyle("expense")}
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        {/* ── 1. Monto ── */}
        <AmountField
          id="expenseAmount"
          label="Monto del gasto (obligatorio)"
          ariaLabel="Monto del gasto"
          value={amount}
          autoFocus
          onChange={(next) => {
            setAmount(next);
            setLocalError(null);
          }}
          onBlur={() => markTouched("amount")}
          icon={<ArrowDownLeft className="h-3.5 w-3.5" />}
          error={visibleError("amount")}
        />

        {/* ── 2. Detalles del movimiento ── */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
            <ComposerField
              label="Concepto"
              htmlFor="expenseDescription"
              required
              error={visibleError("description")}
            >
              <input
                id="expenseDescription"
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

            <ComposerField label="Fecha" htmlFor="expenseDate" required error={visibleError("date")}>
              <div className="relative">
                <input
                  id="expenseDate"
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
              htmlFor="expenseCategoryId"
              required
              error={visibleError("category")}
            >
              <IconSelect
                id="expenseCategoryId"
                required
                searchPlaceholder="Buscar categoría..."
                value={categoryId}
                onChange={(val) => {
                  setCategoryId(val);
                  markTouched("category");
                  setLocalError(null);
                }}
                options={expenseCategories.map((cat) => {
                  const Icon = resolveCategoryIcon(cat.iconKey ?? "", "expense");
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
              label="Cuenta"
              htmlFor="expenseAccountId"
              required
              error={visibleError("account")}
            >
              <IconSelect
                id="expenseAccountId"
                required
                value={accountId}
                onChange={(val) => {
                  setAccountId(val);
                  markTouched("account");
                  setLocalError(null);
                }}
                options={accounts.map((acc) => ({
                  id: acc.id,
                  label: acc.name,
                  color: getAccountVisual(acc).accent,
                  icon: (
                    <AccountIcon
                      iconType={(acc.iconType as "generic" | "bank_logo") || "generic"}
                      iconKey={acc.iconKey || "bank"}
                      color={getAccountVisual(acc).accent}
                      size="xs"
                    />
                  ),
                }))}
              />
            </ComposerField>
          </div>

          {/* ── 3. Tipo de gasto (+ contenido condicional) ── */}
          <ComposerField label="Tipo de gasto">
            <SegmentedChoice
              ariaLabel="Tipo de gasto"
              value={consumesThirdPartyFunds ? "other" : "own"}
              onChange={(next) => {
                const nextConsumesThirdParty = next === "other";
                setConsumesThirdPartyFunds(nextConsumesThirdParty);
                // Mutuamente excluyente con "También registrar en Hogar": el
                // servicio de proyección rechaza dinero no propio.
                if (nextConsumesThirdParty && isHouseholdShared) {
                  setIsHouseholdShared(false);
                }
                setLocalError(null);
              }}
              options={[
                { value: "own", label: "Mío" },
                { value: "other", label: "Otro" },
              ]}
            />
          </ComposerField>

          {consumesThirdPartyFunds ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
              {hasThirdPartyFunds ? (
                <>
                  <StatusNote>
                    Este gasto consume dinero de terceros que tienes guardado: no reduce tu dinero
                    propio.
                  </StatusNote>

                  <ComposerField
                    label="Monto a consumir"
                    htmlFor="expenseThirdPartyConsumeAmount"
                    required
                    hint={`Disponible: ${formatCurrencyCop(availableNoPropio)}`}
                    error={visibleError("thirdParty")}
                  >
                    <input
                      id="expenseThirdPartyConsumeAmount"
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={thirdPartyConsumeAmount}
                      onChange={(event) => {
                        setThirdPartyConsumeAmount(formatAmountInput(event.target.value));
                        setLocalError(null);
                      }}
                      onBlur={() => markTouched("thirdParty")}
                      aria-invalid={visibleError("thirdParty") ? true : undefined}
                      className={cn(
                        composerControlClass,
                        visibleError("thirdParty") && composerControlErrorClass,
                      )}
                    />
                  </ComposerField>
                </>
              ) : (
                // Sin saldo de terceros la explicación y la imposibilidad son
                // el mismo estado: no se apilan dos mensajes.
                <StatusNote variant="warning" title="No tienes dinero de terceros disponible">
                  Registra el gasto como “Mío” o recibe primero dinero no propio.
                </StatusNote>
              )}
            </div>
          ) : null}

          {/* ── 4. Registro paralelo en Hogar ── */}
          {/*
            Sin hogar operativo, sin categorías de Hogar o sin otro miembro a
            quien deberle, no hay nada que este control pueda hacer: no se
            muestra un control que no se puede usar.
          */}
          {canShareWithHousehold ? (
            <ToggleRow
              id="expenseHouseholdShared"
              title="También registrar en Hogar"
              description={
                consumesThirdPartyFunds
                  ? "No disponible con dinero no propio (“Otro”)."
                  : isHouseholdShared
                    ? "Se registrará también en Hogar."
                    : "Crea el registro compartido sin volver a mover el saldo de tu cuenta."
              }
              checked={isHouseholdShared}
              onChange={setIsHouseholdShared}
              disabled={consumesThirdPartyFunds}
            >
              {isHouseholdShared && parsedAmount > 0 ? (
                <StatusNote>
                  Quedará pagado por ti.{" "}
                  {otherHouseholdMembers
                    .map((memberId) => {
                      const share = householdMemberShares.find((s) => s.memberUserId === memberId);
                      return `${resolveHouseholdMemberName(memberId)} te deberá ${formatCurrencyCop(share?.responsibilityAmount ?? 0)}`;
                    })
                    .join("; ")}
                  .
                </StatusNote>
              ) : null}
            </ToggleRow>
          ) : null}
        </div>

        {/* ── 5. Feedback y footer ── */}
        <div className="space-y-4">
          <ComposerFeedback error={activeError} successMessage={successMessage} />

          <ComposerFooter
            message={footerMessage}
            messageTone={footerMessage ? "danger" : "muted"}
            submitLabel="Guardar gasto"
            submittingLabel="Guardando…"
            isSubmitting={isSubmitting}
            disabled={isBlocked || !isFormValid}
            onCancel={onCancel}
          />
        </div>
      </form>
    </TransactionFormSurface>
    <HouseholdShareConfirmDialog
      open={showHouseholdConfirm}
      shareWithHousehold={isHouseholdShared}
      onShareWithHouseholdChange={setIsHouseholdShared}
      isSubmitting={isSubmitting}
      onReturnToEdit={handleReturnToEdit}
      onConfirm={() => void handleConfirmAndSaveWithHousehold()}
    />
    </>
  );
}
