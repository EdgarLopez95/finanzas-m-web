import { useState } from "react";

import { deletePersonalTransaction } from "@/features/transactions/services/delete-personal-transaction";

type DeleteState = {
  isSubmitting: boolean;
  error: string | null;
};

const initialState: DeleteState = {
  isSubmitting: false,
  error: null,
};

export const useDeletePersonalTransaction = () => {
  const [state, setState] = useState<DeleteState>(initialState);

  const submitDelete = async (ownerId: string, transactionId: string): Promise<boolean> => {
    setState({ isSubmitting: true, error: null });

    try {
      await deletePersonalTransaction({ ownerId, transactionId });
      setState({ isSubmitting: false, error: null });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo eliminar el movimiento.";
      setState({ isSubmitting: false, error: message });
      return false;
    }
  };

  const resetError = () => {
    setState((prev) => ({ ...prev, error: null }));
  };

  return {
    ...state,
    submitDelete,
    resetError,
  };
};
