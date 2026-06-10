import { useState } from "react";
import { createAccountPocket, type CreatePocketInput } from "@/features/pockets/services/create-account-pocket";

type CreatePocketState = {
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
};

const initialState: CreatePocketState = {
  isSubmitting: false,
  error: null,
  successMessage: null,
};

export const useCreatePocket = () => {
  const [state, setState] = useState<CreatePocketState>(initialState);

  const submitPocket = async (payload: CreatePocketInput): Promise<boolean> => {
    setState({ isSubmitting: true, error: null, successMessage: null });

    try {
      await createAccountPocket(payload);
      setState({ isSubmitting: false, error: null, successMessage: "Bolsillo creado correctamente." });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el bolsillo.";
      setState({ isSubmitting: false, error: message, successMessage: null });
      return false;
    }
  };

  const resetFeedback = () => {
    setState((prev) => ({ ...prev, error: null, successMessage: null }));
  };

  return {
    ...state,
    submitPocket,
    resetFeedback,
  };
};
