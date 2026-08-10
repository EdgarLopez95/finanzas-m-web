import { useCallback, useState } from "react";

import { updateAccountPocket, type UpdatePocketInput } from "@/features/pockets/services/update-account-pocket";

type UpdatePocketState = {
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
};

const initialState: UpdatePocketState = {
  isSubmitting: false,
  error: null,
  successMessage: null,
};

export const useUpdatePocket = () => {
  const [state, setState] = useState<UpdatePocketState>(initialState);

  const submitPocket = useCallback(async (payload: UpdatePocketInput): Promise<boolean> => {
    setState({ isSubmitting: true, error: null, successMessage: null });

    try {
      await updateAccountPocket(payload);
      setState({ isSubmitting: false, error: null, successMessage: "Bolsillo actualizado correctamente." });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el bolsillo.";
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

  return {
    ...state,
    submitPocket,
    resetFeedback,
  };
};
