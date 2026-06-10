import { useCallback, useState } from "react";

import { createPersonalAccount, type CreateAccountInput } from "@/features/accounts/services/create-personal-account";

type CreateAccountState = {
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
};

const initialState: CreateAccountState = {
  isSubmitting: false,
  error: null,
  successMessage: null,
};

export const useCreateAccount = () => {
  const [state, setState] = useState<CreateAccountState>(initialState);

  const submitAccount = useCallback(async (payload: CreateAccountInput): Promise<boolean> => {
    setState({ isSubmitting: true, error: null, successMessage: null });

    try {
      await createPersonalAccount(payload);
      setState({ isSubmitting: false, error: null, successMessage: "Cuenta creada correctamente." });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear la cuenta.";
      setState({ isSubmitting: false, error: message, successMessage: null });
      return false;
    }
  }, []);

  const resetFeedback = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, successMessage: null }));
  }, []);

  return {
    ...state,
    submitAccount,
    resetFeedback,
  };
};
