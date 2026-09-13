"use client";

import { useState } from "react";

import { DiscardConfirmDialog } from "@/components/finance/discard-confirm-dialog";
import { HouseholdDiscardConfirmDialog } from "@/features/household/components/ui/household-discard-confirm-dialog";
import { shouldConfirmExit } from "@/features/movements/lib/personal-movement-exit-policy";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { Amount } from "@/components/finance/amount";
import {
  OPERATION_CONTEXT_LINE,
  OperationSelector,
  type OperationKind,
} from "@/features/movements/components/composer/operation-selector";
import { ComposerFeedback } from "@/features/movements/components/composer/composer-primitives";
import { MovementConflictDialog } from "@/features/movements/components/movement-conflict-dialog";
import { MovementComposerCard } from "@/features/movements/components/movement-composer-card";
import { HouseholdDialog } from "@/features/household/components/ui/household-dialog";
import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdAmount } from "@/features/household/components/ui/household-amount";
import {
  createHouseholdExpense,
  trashHouseholdExpense,
  updateHouseholdExpense,
} from "@/features/household/services/household-expense-mutations";
import { useMovementMutations } from "@/features/movements/hooks/use-movement-mutations";
import {
  useMplusCatalogs,
  useMplusHouseholdSharing,
} from "@/features/movements/hooks/use-mplus-personal";
import type { MovementDraft } from "@/features/movements/services/movement-mutations";
import type { HouseholdExpenseDistributionMode, MovementType } from "@/lib/mplus/enums";
import { useAuthStore } from "@/stores/auth-store";
import { useMplusComposerStore } from "@/stores/mplus-composer-store";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";

/** Solo Ingreso y Gasto: la transferencia se retiro del producto (matriz W2). */
const MPLUS_OPERATIONS: readonly OperationKind[] = ["expense", "income"];

export function MovementComposerDialog() {
  const mode = useMplusComposerStore((state) => state.mode);
  const openCreate = useMplusComposerStore((state) => state.openCreate);
  const close = useMplusComposerStore((state) => state.close);

  const user = useAuthStore((state) => state.user);
  const { allCategories, allAccounts } = useMplusCatalogs();
  const { canShare, householdId } = useMplusHouseholdSharing(user?.uid ?? null);
  const household = useMplusHouseholdStore((state) => state.household);

  const householdMembers = useMplusHouseholdStore((state) => state.members);
  const householdCategories = useMplusHouseholdStore((state) => state.categories);
  const householdMappings = useMplusHouseholdStore((state) => state.mappings);
  const mutations = useMovementMutations();

  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [pendingTypeSwitch, setPendingTypeSwitch] = useState<MovementType | null>(null);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [isHouseholdSubmitting, setIsHouseholdSubmitting] = useState(false);

  if (mode.kind === "closed") {
    return null;
  }

  const isHouseholdMode =
    (mode.kind === "create" && mode.target === "household") ||
    mode.kind === "edit_household_expense";

  const closeAll = () => {
    setIsDirty(false);
    setShowDiscardConfirm(false);
    setPendingTypeSwitch(null);
    setHouseholdError(null);
    setIsHouseholdSubmitting(false);
    mutations.clearFeedback();
    close();
  };

  const handleRequestClose = () => {
    if (showDiscardConfirm) {
      return;
    }
    if (mutations.isSubmitting || isHouseholdSubmitting) {
      return;
    }
    if (
      shouldConfirmExit({
        mode,
        isSubmitting: mutations.isSubmitting || isHouseholdSubmitting,
        isConfirmOpen: showDiscardConfirm,
      })
    ) {
      setShowDiscardConfirm(true);
      return;
    }
    closeAll();
  };

  const handleDiscardConfirm = () => {
    if (pendingTypeSwitch) {
      const nextType = pendingTypeSwitch;
      setPendingTypeSwitch(null);
      setShowDiscardConfirm(false);
      setIsDirty(false);
      openCreate(nextType, mode.kind === "create" ? mode.defaultAccountId : null);
      return;
    }
    closeAll();
  };

  const handleKeepEditing = () => {
    setPendingTypeSwitch(null);
    setShowDiscardConfirm(false);
  };

  // ── Modo Papelera Personal ──
  if (mode.kind === "trash") {
    const movement = mode.movement;
    return (
      <FinanceDialog
        open
        onClose={closeAll}
        subtitle="Confirma esta accion antes de continuar."
        title="Enviar a la Papelera"
      >
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
            <p className="text-[13px] font-semibold text-[var(--fm-warm-paper)]">
              {movement.title}
            </p>
            <div className="mt-1 flex items-center justify-between gap-4">
              <p className="text-[11px] leading-snug text-[var(--fm-text-muted)]">
                Queda 30 dias en la Papelera y puedes restaurarlo en ese plazo.
              </p>
              <Amount
                showSign
                size="sm"
                value={movement.amount}
                variant={movement.type === "income" ? "income" : "expense"}
              />
            </div>
          </div>

          <ComposerFeedback
            error={
              mutations.feedback.kind === "error" || mutations.feedback.kind === "conflict"
                ? mutations.feedback.message
                : null
            }
          />

          <div className="flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-end">
            <FinanceButton
              type="button"
              tone="outlined"
              variant="outline"
              onClick={closeAll}
              disabled={mutations.isSubmitting}
              className="cursor-pointer select-none rounded-xl px-4"
            >
              Cancelar
            </FinanceButton>
            <FinanceButton
              type="button"
              tone="filled"
              disabled={mutations.isSubmitting}
              aria-busy={mutations.isSubmitting}
              onClick={async () => {
                const done = await mutations.trash(movement);
                if (done) closeAll();
              }}
              className="cursor-pointer select-none rounded-xl px-5"
            >
              {mutations.isSubmitting ? "Enviando..." : "Enviar a la Papelera"}
            </FinanceButton>
          </div>
        </div>
      </FinanceDialog>
    );
  }

  // ── Modo Papelera Hogar (Fuente como unidad) ──
  if (mode.kind === "trash_household_expense") {
    const expense = mode.expense;
    return (
      <HouseholdDialog
        open
        onClose={closeAll}
        subtitle="Confirma esta acción antes de continuar."
        title="Enviar a la Papelera"
      >
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] px-4 py-3">
            <p className="text-[13px] font-semibold text-[var(--hh-text)]">
              {expense.title}
            </p>
            <div className="mt-1 flex items-center justify-between gap-4">
              <p className="text-[11px] leading-snug text-[var(--hh-text-muted)]">
                Queda 30 días en la Papelera y puedes restaurarlo en ese plazo.
              </p>
              <HouseholdAmount
                showSign
                size="sm"
                value={expense.amount}
                variant="expense"
              />
            </div>
          </div>

          <ComposerFeedback error={householdError} />

          <div className="flex flex-col gap-3 border-t border-[var(--hh-border)] pt-4 sm:flex-row sm:items-center sm:justify-end">
            <HouseholdButton
              type="button"
              tone="outlined"
              onClick={closeAll}
              disabled={isHouseholdSubmitting}
              className="cursor-pointer select-none rounded-xl px-4"
            >
              Cancelar
            </HouseholdButton>
            <HouseholdButton
              type="button"
              tone="filled"
              disabled={isHouseholdSubmitting}
              aria-busy={isHouseholdSubmitting}
              onClick={async () => {
                setIsHouseholdSubmitting(true);
                setHouseholdError(null);
                if (!household) return;
                const outcome = await trashHouseholdExpense(
                  expense,
                  household,
                  { userId: user?.uid, members: householdMembers },
                );
                setIsHouseholdSubmitting(false);
                if (outcome.kind === "success") {
                  closeAll();
                } else if (outcome.kind === "rejected") {
                  setHouseholdError(outcome.message);
                } else if (outcome.kind === "conflict") {
                  setHouseholdError("Conflicto por edición remota. Recarga la página.");
                } else {
                  setHouseholdError("No fue posible enviar a la papelera.");
                }
              }}
              className="cursor-pointer select-none rounded-xl px-5"
            >
              {isHouseholdSubmitting ? "Enviando..." : "Enviar a la Papelera"}
            </HouseholdButton>
          </div>
        </div>
      </HouseholdDialog>
    );
  }

  const activeType: MovementType =
    mode.kind === "edit"
      ? mode.movement.type
      : mode.kind === "create"
      ? mode.type
      : "expense";

  const isEditMode = mode.kind === "edit" || mode.kind === "edit_household_expense";

  const memberAId = household?.memberAId ?? "";
  const memberBId = household?.memberBId ?? "";
  const memberAName =
    householdMembers.find((m) => m.userId === memberAId)?.displayName ?? "Integrante A";
  const memberBName =
    householdMembers.find((m) => m.userId === memberBId)?.displayName ?? "Integrante B";

  const handleSubmitPersonal = async (draft: MovementDraft): Promise<boolean> => {
    if (!user?.uid) return false;

    const committed =
      mode.kind === "edit"
        ? await mutations.update(mode.movement, draft)
        : await mutations.create(user.uid, draft);

    if (committed) {
      closeAll();
    }
    return committed;
  };

  const handleSubmitHouseholdExpense = async (draft: {
    title: string;
    amount: number;
    note: string;
    occurredAtMillis: number;
    householdCategoryId: string | null;
    distributionMode: HouseholdExpenseDistributionMode;
    memberAAmount: number;
    memberBAmount: number;
  }): Promise<boolean> => {
    if (!user?.uid || !household) return false;

    setIsHouseholdSubmitting(true);
    setHouseholdError(null);

    const expenseDraft = {
      title: draft.title,
      amount: draft.amount,
      note: draft.note,
      occurredAtMillis: draft.occurredAtMillis,
      householdCategoryId: draft.householdCategoryId,
      distributionMode: draft.distributionMode,
      customDistribution:
        draft.distributionMode === "custom"
          ? {
              memberAAmount: draft.memberAAmount,
              memberBAmount: draft.memberBAmount,
            }
          : undefined,
    };

    const outcome =
      mode.kind === "edit_household_expense"
        ? await updateHouseholdExpense(
            mode.expense,
            household,
            expenseDraft,
            { userId: user.uid, members: householdMembers },
          )
        : await createHouseholdExpense(
            household,
            expenseDraft,
            { userId: user.uid, members: householdMembers },
          );

    setIsHouseholdSubmitting(false);

    if (outcome.kind === "success") {
      closeAll();
      return true;
    } else if (outcome.kind === "rejected") {
      setHouseholdError(outcome.message);
      return false;
    } else if (outcome.kind === "conflict") {
      setHouseholdError("El gasto fue modificado por otra sesión. Por favor recarga.");
      return false;
    } else {
      setHouseholdError("Servicio no disponible temporalmente.");
      return false;
    }
  };

  const feedbackError =
    householdError ||
    (mutations.feedback.kind === "error" || mutations.feedback.kind === "conflict"
      ? mutations.feedback.message
      : null);

  // ── Contenedor Modal: Adapta tokens a Hogar (HouseholdDialog) o Personal (FinanceDialog) ──
  const DialogWrapper = isHouseholdMode ? HouseholdDialog : FinanceDialog;
  const dialogTitle = isHouseholdMode ? (
    isEditMode ? "Editar gasto en Hogar" : "Nuevo gasto en Hogar"
  ) : (
    <OperationSelector
      value={activeType}
      operations={MPLUS_OPERATIONS}
      locked={isEditMode}
      onChange={(next) => {
        if (isEditMode || next === "transfer" || next === activeType) return;
        if (mutations.isSubmitting) return;

        if (isDirty) {
          setPendingTypeSwitch(next);
          setShowDiscardConfirm(true);
          return;
        }

        openCreate(next, mode.kind === "create" ? mode.defaultAccountId : null);
      }}
    />
  );

  const dialogSubtitle = isHouseholdMode
    ? isEditMode
      ? "Modificar gasto del Hogar"
      : "Registrar una salida de dinero en las cuentas del Hogar"
    : isEditMode
    ? "Editar el movimiento registrado"
    : OPERATION_CONTEXT_LINE[activeType];

  return (
    <>
      <DialogWrapper
        open
        onClose={handleRequestClose}
        size="composer"
        subtitle={dialogSubtitle}
        title={dialogTitle}
      >
        <div key={activeType} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
          <MovementComposerCard
            type={activeType}
            target={isHouseholdMode ? "household" : "personal"}
            movement={mode.kind === "edit" ? mode.movement : null}
            householdExpense={mode.kind === "edit_household_expense" ? mode.expense : null}
            memberAName={memberAName}
            memberBName={memberBName}
            memberAId={memberAId}
            memberBId={memberBId}
            categories={allCategories}
            accounts={allAccounts}
            defaultAccountId={mode.kind === "create" ? mode.defaultAccountId : null}
            householdId={householdId}
            canShareWithHousehold={canShare}
            householdCategories={householdCategories}
            learnedMappings={householdMappings}
            currentUid={user?.uid ?? null}
            isSubmitting={mutations.isSubmitting || isHouseholdSubmitting}
            feedbackError={feedbackError}
            onSubmit={handleSubmitPersonal}
            onSubmitHouseholdExpense={handleSubmitHouseholdExpense}
            onCancel={handleRequestClose}
            onDirtyChange={setIsDirty}
          />
        </div>
      </DialogWrapper>

      {isHouseholdMode ? (
        <HouseholdDiscardConfirmDialog
          open={showDiscardConfirm}
          title={pendingTypeSwitch ? "¿Descartar y cambiar tipo?" : undefined}
          description={
            pendingTypeSwitch
              ? "Se perderá lo que escribiste al cambiar entre ingreso y gasto."
              : undefined
          }
          cancelButtonText={pendingTypeSwitch ? "Cancelar" : undefined}
          exitButtonText={pendingTypeSwitch ? "Cambiar" : undefined}
          onKeepEditing={handleKeepEditing}
          onDiscard={handleDiscardConfirm}
        />
      ) : (
        <DiscardConfirmDialog
          open={showDiscardConfirm}
          title={pendingTypeSwitch ? "¿Descartar y cambiar tipo?" : undefined}
          description={
            pendingTypeSwitch
              ? "Se perderá lo que escribiste al cambiar entre ingreso y gasto."
              : undefined
          }
          cancelButtonText={pendingTypeSwitch ? "Cancelar" : undefined}
          exitButtonText={pendingTypeSwitch ? "Cambiar" : undefined}
          onKeepEditing={handleKeepEditing}
          onDiscard={handleDiscardConfirm}
        />
      )}

      <MovementConflictDialog
        open={Boolean(mutations.conflictState)}
        conflict={mutations.conflictState}
        categories={allCategories}
        accounts={allAccounts}
        householdCategories={householdCategories}
        isSubmitting={mutations.isSubmitting}
        onKeepServer={async () => {
          await mutations.resolveConflictKeepServer();
          closeAll();
        }}
        onKeepLocal={async () => {
          const ok = await mutations.resolveConflictKeepLocal();
          if (ok) closeAll();
        }}
        onClose={() => {
          mutations.clearConflict();
          closeAll();
        }}
      />
    </>
  );
}
