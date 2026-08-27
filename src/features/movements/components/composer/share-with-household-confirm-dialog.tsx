"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Calendar, HelpCircle, Sparkles } from "lucide-react";

import { AccountIcon } from "@/components/finance/account-icon";
import { Amount } from "@/components/finance/amount";
import { FinanceButton } from "@/components/finance/finance-button";
import { IconSelect } from "@/components/finance/icon-select";
import { useFocusTrap } from "@/features/household/hooks/use-focus-trap";
import type { MovementDraft } from "@/features/movements/services/movement-mutations";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { formatDateEs } from "@/lib/format/date";
import type {
  MplusHouseholdExpenseCategory,
  MplusPersonalAccount,
  MplusPersonalCategory,
} from "@/lib/mplus/models";

const UNCLASSIFIED_OPTION_ID = "__unclassified__";

export type ShareWithHouseholdConfirmDialogProps = {
  open: boolean;
  draft: MovementDraft;
  personalCategory?: MplusPersonalCategory;
  personalAccount?: MplusPersonalAccount | null;
  householdCategories: readonly MplusHouseholdExpenseCategory[];
  learnedHouseholdCategoryId: string | null;
  onConfirmShare: (params: {
    householdCategoryId: string | null;
    learnMapping: boolean;
  }) => void;
  onSavePersonalOnly: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
};

export function ShareWithHouseholdConfirmDialog({
  open,
  draft,
  personalCategory,
  personalAccount,
  householdCategories,
  learnedHouseholdCategoryId,
  onConfirmShare,
  onSavePersonalOnly,
  onCancel,
  isSubmitting,
}: ShareWithHouseholdConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const isExpense = draft.type === "expense";

  // Solo categorías de gasto activas del Hogar
  const activeHouseholdCategories = useMemo(
    () => householdCategories.filter((cat) => cat.state === "active"),
    [householdCategories],
  );

  // Inicializa con la equivalencia aprendida si existe y está activa.
  // Si no existe equivalencia previa, selecciona por defecto "Clasificar después" (§14, paridad Android).
  const initialCategorySelection = useMemo(() => {
    if (!isExpense) return null;
    if (
      learnedHouseholdCategoryId &&
      activeHouseholdCategories.some((cat) => cat.id === learnedHouseholdCategoryId)
    ) {
      return learnedHouseholdCategoryId;
    }
    return UNCLASSIFIED_OPTION_ID;
  }, [activeHouseholdCategories, isExpense, learnedHouseholdCategoryId]);

  const [selectedHouseholdCatId, setSelectedHouseholdCatId] = useState<string>(
    () => initialCategorySelection ?? UNCLASSIFIED_OPTION_ID,
  );

  // Sincroniza al abrir
  useEffect(() => {
    if (open) {
      setSelectedHouseholdCatId(initialCategorySelection ?? UNCLASSIFIED_OPTION_ID);
    }
  }, [initialCategorySelection, open]);

  useFocusTrap(panelRef, open, onCancel);

  useEffect(() => {
    if (open) {
      primaryButtonRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const PersonalCatIcon = personalCategory
    ? resolveCategoryIcon(personalCategory.iconKey, draft.type)
    : HelpCircle;

  const isClassifyLater = selectedHouseholdCatId === UNCLASSIFIED_OPTION_ID;
  const effectiveHouseholdCatId = isClassifyLater ? null : selectedHouseholdCatId;

  // Opciones del selector de categorías de Hogar
  const categorySelectOptions = [
    ...activeHouseholdCategories.map((cat) => {
      const Icon = resolveCategoryIcon(cat.iconKey, "expense");
      return {
        id: cat.id,
        label: cat.name,
        color: cat.color,
        icon: <Icon className="h-3.5 w-3.5" />,
      };
    }),
    {
      id: UNCLASSIFIED_OPTION_ID,
      label: "Clasificar después",
      color: "#94A3B8",
      icon: <HelpCircle className="h-3.5 w-3.5" />,
    },
  ];

  const handleConfirm = () => {
    if (!isExpense) {
      onConfirmShare({ householdCategoryId: null, learnMapping: false });
      return;
    }

    if (isClassifyLater) {
      onConfirmShare({ householdCategoryId: null, learnMapping: false });
    } else {
      onConfirmShare({
        householdCategoryId: effectiveHouseholdCatId,
        learnMapping: true,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-[rgba(4,8,15,0.72)] px-4 py-6 overflow-y-auto"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="w-full max-w-lg rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(21,29,43,0.98),rgba(12,18,29,0.98))] p-5 sm:p-6 shadow-[0_30px_70px_rgb(2_6_23/0.42)] outline-none animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-5"
      >
        {/* Encabezado */}
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--fm-primary-action)]/15 text-[var(--fm-primary-action)]">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2
              id={titleId}
              className="font-[var(--font-display)] text-[18px] sm:text-[20px] font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]"
            >
              Contar en Hogar
            </h2>
          </div>
          <p id={descriptionId} className="mt-2 text-xs sm:text-sm leading-relaxed text-[var(--fm-text-muted)]">
            {isExpense
              ? "El gasto sigue siendo personal y además aparecerá en el tablero compartido del Hogar."
              : "El ingreso sigue siendo personal y además aparecerá en el tablero compartido del Hogar."}
          </p>
        </div>

        {/* Resumen compacto del movimiento */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-[var(--fm-text-muted)] font-medium">
                {isExpense ? "Gasto personal" : "Ingreso personal"}
              </p>
              <p className="text-sm sm:text-base font-semibold text-[var(--fm-warm-paper)] truncate mt-0.5">
                {draft.title || "Sin concepto"}
              </p>
            </div>
            <Amount
              showSign
              size="md"
              value={draft.amount}
              variant={isExpense ? "expense" : "income"}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2.5 border-t border-white/[0.06] text-xs text-[var(--fm-text-muted)]">
            {/* Categoría personal */}
            <div className="flex items-center gap-2 min-w-0">
              {personalCategory ? (
                <>
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white"
                    style={{ backgroundColor: personalCategory.color }}
                  >
                    <PersonalCatIcon className="h-3 w-3" />
                  </span>
                  <span className="truncate font-medium text-[var(--fm-text)]">
                    {personalCategory.name}
                  </span>
                </>
              ) : (
                <span>Sin categoría</span>
              )}
            </div>

            {/* Fecha */}
            <div className="flex items-center gap-1.5 min-w-0">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--fm-text-muted)]" />
              <span className="truncate">
                {formatDateEs(new Date(draft.occurredAtMillis))}
              </span>
            </div>

            {/* Cuenta */}
            <div className="flex items-center gap-1.5 min-w-0">
              {personalAccount ? (
                <>
                  <AccountIcon
                    iconType={personalAccount.iconType}
                    iconKey={personalAccount.iconKey}
                    color={personalAccount.color}
                    size="xs"
                  />
                  <span className="truncate">{personalAccount.name}</span>
                </>
              ) : (
                <span className="text-[var(--fm-text-muted)]">Sin cuenta</span>
              )}
            </div>
          </div>
        </div>

        {/* Sección de Categoría de Hogar (solo gastos) */}
        {isExpense ? (
          <div className="space-y-2">
            <label
              htmlFor="householdCategorySelect"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--fm-warm-paper)]"
            >
              Categoría en Hogar
            </label>

            <IconSelect
              id="householdCategorySelect"
              value={selectedHouseholdCatId}
              onChange={setSelectedHouseholdCatId}
              options={categorySelectOptions}
              searchPlaceholder="Buscar categoría de Hogar..."
            />

            {!isClassifyLater && personalCategory ? (
              <p className="text-[11px] sm:text-xs text-[var(--fm-text-muted)] flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--fm-primary-action)]" />
                La usaremos para próximos gastos tuyos de{" "}
                <span className="font-semibold text-[var(--fm-text)]">
                  {personalCategory.name}
                </span>.
              </p>
            ) : isClassifyLater ? (
              <p className="text-[11px] sm:text-xs text-[var(--fm-text-muted)]">
                Quedará como <em>Por clasificar</em> en el Hogar hasta que le asignes una categoría.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Acciones */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-white/[0.08]">
          <FinanceButton
            type="button"
            tone="text"
            onClick={onCancel}
            disabled={isSubmitting}
            className="cursor-pointer select-none rounded-xl px-3 py-2 text-xs sm:text-sm text-center"
          >
            Cancelar
          </FinanceButton>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <FinanceButton
              type="button"
              tone="outlined"
              variant="outline"
              onClick={onSavePersonalOnly}
              disabled={isSubmitting}
              className="cursor-pointer select-none rounded-xl px-3.5 py-2 text-xs sm:text-sm text-center whitespace-nowrap"
            >
              Guardar solo en Personal
            </FinanceButton>

            <FinanceButton
              ref={primaryButtonRef}
              type="button"
              tone="filled"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              onClick={handleConfirm}
              className="cursor-pointer select-none rounded-xl px-4 py-2 text-xs sm:text-sm text-center font-semibold"
            >
              {isSubmitting ? "Guardando..." : "Confirmar y compartir"}
            </FinanceButton>
          </div>
        </div>
      </div>
    </div>
  );
}
