import { useState } from "react";

import {
  deleteAccountCascade,
  deletePocketCascade,
} from "@/features/accounts/services/delete-personal-entity-cascade";

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
      const message = error instanceof Error ? error.message : "No se pudo completar la eliminacion.";
      setState({ isSubmitting: false, error: message });
      return false;
    }
  };

  return {
    ...state,
    resetError: () => setState((prev) => ({ ...prev, error: null })),
    submitDeletePocket: (ownerId: string, pocketId: string) =>
      run(() => deletePocketCascade({ ownerId, pocketId })),
    submitDeleteAccount: (ownerId: string, accountId: string) =>
      run(() => deleteAccountCascade({ ownerId, accountId })),
  };
};
