"use client";

import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { useDeletePersonalTransaction } from "@/features/transactions/hooks/use-delete-personal-transaction";
import type { Transaction } from "@/types/transaction";

type DeleteTransactionConfirmCardProps = {
  ownerId: string;
  movement: Transaction;
  onCancel: () => void;
  onDeleted: () => Promise<void>;
};

export function DeleteTransactionConfirmCard({
  ownerId,
  movement,
  onCancel,
  onDeleted,
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
    <FinanceCard title={title} subtitle="Confirma esta accion antes de continuar" variant="interactive">
      <div className="space-y-3">
        <p className="text-sm text-[var(--fm-warm-paper)]">
          Esta accion revertira el saldo asociado.
        </p>
        <p className="text-xs text-muted-foreground">
          No podras deshacer esta eliminacion desde la web en esta version.
        </p>

        {error ? <p className="text-sm text-[var(--fm-expense)]">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <FinanceButton
            type="button"
            tone="destructive"
            disabled={isSubmitting}
            onClick={handleDelete}
          >
            {isSubmitting ? "Eliminando..." : "Confirmar eliminacion"}
          </FinanceButton>
          <FinanceButton
            type="button"
            tone="outlined"
            variant="outline"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancelar
          </FinanceButton>
        </div>
      </div>
    </FinanceCard>
  );
}
