import { useState } from "react";

import { closePersonalAccount } from "@/features/accounts/services/close-personal-account";
import { reopenPersonalAccount } from "@/features/accounts/services/reopen-personal-account";

type AccountLifecycleState = {
  isSubmitting: boolean;
  error: string | null;
};

const initialState: AccountLifecycleState = {
  isSubmitting: false,
  error: null,
};

/**
 * Cerrar/reabrir una cuenta personal (Paso 2). Separado de
 * `useDeletePersonalEntities` (que cubre eliminar cuenta/bolsillo) porque son
 * acciones distintas en la UX (2.4/2.5) aunque comparten la misma forma de
 * estado de envío/error.
 */
export const useAccountLifecycle = () => {
  const [state, setState] = useState<AccountLifecycleState>(initialState);

  const run = async (task: () => Promise<void>) => {
    setState({ isSubmitting: true, error: null });
    try {
      await task();
      setState(initialState);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo completar la acción.";
      setState({ isSubmitting: false, error: message });
      return false;
    }
  };

  return {
    ...state,
    resetError: () => setState((prev) => ({ ...prev, error: null })),
    submitCloseAccount: (ownerId: string, accountId: string) =>
      run(() => closePersonalAccount({ ownerId, accountId })),
    submitReopenAccount: (ownerId: string, accountId: string) =>
      run(() => reopenPersonalAccount({ ownerId, accountId })),
  };
};
