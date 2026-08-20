"use client";

import { useState } from "react";

import { DiscardConfirmDialog } from "@/components/finance/discard-confirm-dialog";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { Amount } from "@/components/finance/amount";
import {
  OPERATION_CONTEXT_LINE,
  OperationSelector,
  type OperationKind,
} from "@/features/movements/components/composer/operation-selector";
import { ComposerFeedback } from "@/features/movements/components/composer/composer-primitives";
import { MovementComposerCard } from "@/features/movements/components/movement-composer-card";
import { useMovementMutations } from "@/features/movements/hooks/use-movement-mutations";
import {
  useMplusCatalogs,
  useMplusHouseholdSharing,
} from "@/features/movements/hooks/use-mplus-personal";
import type { MovementDraft } from "@/features/movements/services/movement-mutations";
import type { MovementType } from "@/lib/mplus/enums";
import { useAuthStore } from "@/stores/auth-store";
import { useMplusComposerStore } from "@/stores/mplus-composer-store";

/**
 * Contenedor del composer de movimientos M+.
 *
 * Conserva la carcasa exacta del composer anterior: `FinanceDialog
 * size="composer"`, `OperationSelector` como titulo y `DiscardConfirmDialog`
 * antes de perder lo escrito. Los unicos cambios son los que la matriz W2
 * autoriza: dos operaciones en vez de tres y el envio a Papelera en lugar de
 * la eliminacion directa.
 */

/** Solo Ingreso y Gasto: la transferencia se retiro del producto (matriz W2). */
const MPLUS_OPERATIONS: readonly OperationKind[] = ["expense", "income"];

export function MovementComposerDialog() {
  const mode = useMplusComposerStore((state) => state.mode);
  const openCreate = useMplusComposerStore((state) => state.openCreate);
  const close = useMplusComposerStore((state) => state.close);

  const user = useAuthStore((state) => state.user);
  const { allCategories, allAccounts } = useMplusCatalogs();
  const { canShare, householdId } = useMplusHouseholdSharing();
  const mutations = useMovementMutations();

  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  if (mode.kind === "closed") {
    return null;
  }

  const closeAll = () => {
    setIsDirty(false);
    setShowDiscardConfirm(false);
    mutations.clearFeedback();
    close();
  };

  // Igual que antes: solo la creacion pide confirmacion antes de perder lo
  // escrito, y solo si de verdad hay algo escrito.
  const handleRequestClose = () => {
    if (mode.kind === "create" && isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    closeAll();
  };

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
                masked={false}
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

  const activeType: MovementType = mode.kind === "edit" ? mode.movement.type : mode.type;
  const isEditMode = mode.kind === "edit";

  const handleSubmit = async (draft: MovementDraft): Promise<boolean> => {
    if (!user?.uid) return false;

    const committed = isEditMode
      ? await mutations.update(mode.movement, draft)
      : await mutations.create(user.uid, draft);

    if (committed) {
      closeAll();
    }
    return committed;
  };

  const feedbackError =
    mutations.feedback.kind === "error" || mutations.feedback.kind === "conflict"
      ? mutations.feedback.message
      : null;

  return (
    <>
      <FinanceDialog
        open
        onClose={handleRequestClose}
        size="composer"
        subtitle={isEditMode ? "Editar el movimiento registrado" : OPERATION_CONTEXT_LINE[activeType]}
        title={
          <OperationSelector
            value={activeType}
            operations={MPLUS_OPERATIONS}
            locked={isEditMode}
            onChange={(next) => {
              if (isEditMode || next === "transfer") return;
              openCreate(next, mode.kind === "create" ? mode.defaultAccountId : null);
            }}
          />
        }
      >
        {/*
          La estructura exterior del dialogo no cambia al alternar operacion:
          solo el contenido se reemplaza con una transicion corta (`key`).
        */}
        <div key={activeType} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
          <MovementComposerCard
            type={activeType}
            movement={isEditMode ? mode.movement : null}
            categories={allCategories}
            accounts={allAccounts}
            defaultAccountId={mode.kind === "create" ? mode.defaultAccountId : null}
            householdId={householdId}
            canShareWithHousehold={canShare}
            isSubmitting={mutations.isSubmitting}
            feedbackError={feedbackError}
            onSubmit={handleSubmit}
            onCancel={handleRequestClose}
            onDirtyChange={setIsDirty}
          />
        </div>
      </FinanceDialog>

      <DiscardConfirmDialog
        open={showDiscardConfirm}
        onKeepEditing={() => setShowDiscardConfirm(false)}
        onDiscard={closeAll}
      />
    </>
  );
}
