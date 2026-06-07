import { useState } from "react";

import { createPersonalIncome } from "@/features/transactions/services/create-personal-income";
import type { CreateIncomeInput } from "@/types/transaction";

type CreateIncomeState = {
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
};

const initialState: CreateIncomeState = {
  isSubmitting: false,
  error: null,
  successMessage: null,
};

export const useCreatePersonalIncome = () => {
  const [state, setState] = useState<CreateIncomeState>(initialState);

  const submitIncome = async (payload: CreateIncomeInput): Promise<boolean> => {
    setState({ isSubmitting: true, error: null, successMessage: null });

    try {
      await createPersonalIncome(payload);
      setState({ isSubmitting: false, error: null, successMessage: "Ingreso creado correctamente." });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el ingreso.";
      setState({ isSubmitting: false, error: message, successMessage: null });
      return false;
    }
  };

  const resetFeedback = () => {
    setState((prev) => ({ ...prev, error: null, successMessage: null }));
  };

  return {
    ...state,
    submitIncome,
    resetFeedback,
  };
};