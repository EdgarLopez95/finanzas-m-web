import { useState } from "react";

import { createPersonalTransfer } from "@/features/transactions/services/create-personal-transfer";
import type { CreateTransferInput } from "@/types/transaction";

type CreateTransferState = {
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
};

const initialState: CreateTransferState = {
  isSubmitting: false,
  error: null,
  successMessage: null,
};

export const useCreatePersonalTransfer = () => {
  const [state, setState] = useState<CreateTransferState>(initialState);

  const submitTransfer = async (payload: CreateTransferInput): Promise<boolean> => {
    setState({ isSubmitting: true, error: null, successMessage: null });

    try {
      await createPersonalTransfer(payload);
      setState({ isSubmitting: false, error: null, successMessage: "Transferencia creada correctamente." });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear la transferencia.";
      setState({ isSubmitting: false, error: message, successMessage: null });
      return false;
    }
  };

  const resetFeedback = () => {
    setState((prev) => ({ ...prev, error: null, successMessage: null }));
  };

  return {
    ...state,
    submitTransfer,
    resetFeedback,
  };
};