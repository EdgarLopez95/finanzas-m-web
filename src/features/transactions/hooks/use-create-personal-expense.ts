import { useState } from "react";

import { createPersonalExpense } from "@/features/transactions/services/create-personal-expense";
import type { CreateExpenseInput } from "@/types/transaction";

type CreateExpenseState = {
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
};

const initialState: CreateExpenseState = {
  isSubmitting: false,
  error: null,
  successMessage: null,
};

export const useCreatePersonalExpense = () => {
  const [state, setState] = useState<CreateExpenseState>(initialState);

  const submitExpense = async (payload: CreateExpenseInput): Promise<boolean> => {
    setState({ isSubmitting: true, error: null, successMessage: null });

    try {
      await createPersonalExpense(payload);
      setState({ isSubmitting: false, error: null, successMessage: "Gasto creado correctamente." });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el gasto.";
      setState({ isSubmitting: false, error: message, successMessage: null });
      return false;
    }
  };

  const resetFeedback = () => {
    setState((prev) => ({ ...prev, error: null, successMessage: null }));
  };

  return {
    ...state,
    submitExpense,
    resetFeedback,
  };
};