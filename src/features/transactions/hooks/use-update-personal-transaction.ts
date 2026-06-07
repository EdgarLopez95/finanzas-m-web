import { useState } from "react";

import { updatePersonalTransaction } from "@/features/transactions/services/update-personal-transaction";
import type { UpdatePersonalTransactionInput } from "@/types/transaction";

type UpdateTransactionState = {
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
};

const initialState: UpdateTransactionState = {
  isSubmitting: false,
  error: null,
  successMessage: null,
};

export const useUpdatePersonalTransaction = () => {
  const [state, setState] = useState<UpdateTransactionState>(initialState);

  const submitUpdate = async (payload: UpdatePersonalTransactionInput): Promise<boolean> => {
    setState({ isSubmitting: true, error: null, successMessage: null });

    try {
      await updatePersonalTransaction(payload);
      setState({ isSubmitting: false, error: null, successMessage: "Movimiento actualizado correctamente." });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el movimiento.";
      setState({ isSubmitting: false, error: message, successMessage: null });
      return false;
    }
  };

  const resetFeedback = () => {
    setState((prev) => ({ ...prev, error: null, successMessage: null }));
  };

  return {
    ...state,
    submitUpdate,
    resetFeedback,
  };
};
