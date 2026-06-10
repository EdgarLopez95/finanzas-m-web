"use client";

import { FinanceButton } from "@/components/finance/finance-button";
import { useDeletePersonalTransaction } from "@/features/transactions/hooks/use-delete-personal-transaction";
import {
  TransactionFormSurface,
  type TransactionFormRenderMode,
} from "@/features/transactions/components/transaction-form-surface";
import type { Transaction } from "@/types/transaction";

type DeleteTransactionConfirmCardProps = {
  ownerId: string;
  movement: Transaction;
  onCancel: () => void;
  onDeleted: () => Promise<void>;
  renderMode?: TransactionFormRenderMode;
};

export function DeleteTransactionConfirmCard({
  ownerId,
  movement,
  onCancel,
  onDeleted,
  renderMode = "card",
}: DeleteTransactionConfirmCardProps) {
  const { isSubmitting, error, submitDelete, resetError } = useDeletePersonalTransaction();

  const title =
    movement.type === "expense"
      ? "Eliminar gasto"
      : movement.type === "income"
        ? "Eliminar ingreso"
        : movement.type === "transfer"
          ? "Eliminar transferencia"
          : "Eliminar movimiento";

  const handleDelete = async () => {
    resetError();
    const ok = await submitDelete(ownerId, movement.id);
    if (!ok) {
      return;
    }

    await onDeleted();
  };

  return (
    <TransactionFormSurface
      renderMode={renderMode}
      subtitle="Confirma esta acción antes de continuar"
      title={title}
    >
      <div className="space-y-3">
        <p className="text-sm text-[var(--fm-warm-paper)]">
          Esta acción revertirá el saldo asociado.
        </p>
        <p className="text-xs text-muted-foreground">
          No podrás deshacer esta eliminación desde la web en esta versión.
        </p>

        {error ? <p className="text-sm text-[var(--fm-expense)]">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <FinanceButton
            disabled={isSubmitting}
            onClick={handleDelete}
            tone="destructive"
            type="button"
          >
            {isSubmitting ? "Eliminando..." : "Confirmar eliminación"}
          </FinanceButton>
          <FinanceButton
            disabled={isSubmitting}
            onClick={onCancel}
            tone="outlined"
            type="button"
            variant="outline"
          >
            Cancelar
          </FinanceButton>
        </div>
      </div>
    </TransactionFormSurface>
  );
}
