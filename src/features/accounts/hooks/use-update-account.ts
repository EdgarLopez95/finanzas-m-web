import { useCallback, useState } from "react";

import { updatePersonalAccount, type UpdateAccountInput } from "@/features/accounts/services/update-personal-account";

type UpdateAccountState = {
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
};

const initialState: UpdateAccountState = {
  isSubmitting: false,
  error: null,
  successMessage: null,
};

export const useUpdateAccount = () => {
  const [state, setState] = useState<UpdateAccountState>(initialState);

  const submitAccount = useCallback(async (payload: UpdateAccountInput): Promise<boolean> => {
    setState({ isSubmitting: true, error: null, successMessage: null });
    try {
      await updatePersonalAccount(payload);
      setState({ isSubmitting: false, error: null, successMessage: "Cuenta actualizada correctamente." });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar la cuenta.";
      setState({ isSubmitting: false, error: message, successMessage: null });
      return false;
    }
  }, []);

  const resetFeedback = useCallback(() => {
    setState((prev) => {
      if (prev.error === null && prev.successMessage === null) return prev;
      return { ...prev, error: null, successMessage: null };
    });
  }, []);

  return { ...state, submitAccount, resetFeedback };
};
