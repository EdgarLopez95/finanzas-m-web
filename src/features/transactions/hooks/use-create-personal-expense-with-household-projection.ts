import { useRef, useState } from "react";

import {
  createPersonalExpenseWithHouseholdProjection,
  type CreatePersonalExpenseWithHouseholdProjectionInput,
} from "../services/create-personal-expense-with-household-projection";
import { useHouseholdDataStore } from "@/stores/household-data-store";

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

export const useCreatePersonalExpenseWithHouseholdProjection = () => {
  const [state, setState] = useState<CreateExpenseState>(initialState);
  const isSubmittingRef = useRef(false);
  const refreshHousehold = useHouseholdDataStore((state) => state.refresh);

  const submitExpense = async (payload: CreatePersonalExpenseWithHouseholdProjectionInput): Promise<boolean> => {
    if (isSubmittingRef.current) {
      return false;
    }
    isSubmittingRef.current = true;
    setState({ isSubmitting: true, error: null, successMessage: null });

    try {
      await createPersonalExpenseWithHouseholdProjection(payload);
      // Actualizar los datos del Hogar (eventos, deudas, shares) en el store
      await refreshHousehold();
      setState({
        isSubmitting: false,
        error: null,
        successMessage: "Gasto compartido creado y proyectado correctamente.",
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el gasto compartido.";
      setState({ isSubmitting: false, error: message, successMessage: null });
      return false;
    } finally {
      isSubmittingRef.current = false;
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
