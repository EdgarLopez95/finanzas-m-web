import { useState } from "react";

import { deleteAccountPocket } from "@/features/pockets/services/delete-account-pocket";
import { deleteClosedPersonalAccount } from "@/features/accounts/services/delete-closed-personal-account";

type DeleteEntityState = {
  isSubmitting: boolean;
  error: string | null;
};

const initialState: DeleteEntityState = {
  isSubmitting: false,
  error: null,
};

export const useDeletePersonalEntities = () => {
  const [state, setState] = useState<DeleteEntityState>(initialState);

  const run = async (task: () => Promise<void>) => {
    setState({ isSubmitting: true, error: null });

    try {
      await task();
      setState(initialState);
      return true;
    } catch (error) {
      console.error("[delete-personal-entities] Error al eliminar entidad cascade:", error);
      const message = error instanceof Error ? error.message : "No se pudo completar la eliminacion.";
      setState({ isSubmitting: false, error: message });
      return false;
    }
  };

  return {
    ...state,
    resetError: () => setState((prev) => ({ ...prev, error: null })),
    submitDeletePocket: (ownerId: string, pocketId: string, accountId: string) =>
      run(() => deleteAccountPocket({ ownerId, pocketId, accountId })),
    // Paso 2 (cierre de ciclo de vida de cuentas): la eliminación de cuenta
    // pasa por `deleteClosedPersonalAccount`, que NUNCA borra bolsillos ni
    // movimientos reales en cascada (solo la propia técnica de saldo
    // inicial) y bloquea cuentas activas con movimientos reales o con
    // bolsillos. El viejo `deleteAccountCascade` (cascada completa) queda sin
    // usar desde la UI — se conserva en `delete-personal-entity-cascade.ts`
    // solo porque sigue siendo ejercitado por pruebas existentes ajenas a
    // este paso; no debe volver a cablearse a ninguna acción de usuario.
    submitDeleteAccount: (ownerId: string, accountId: string) =>
      run(() => deleteClosedPersonalAccount({ ownerId, accountId })),
  };
};
