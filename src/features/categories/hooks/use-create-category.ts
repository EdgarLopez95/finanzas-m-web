import { useState } from "react";

import { createCategory, type CreateCategoryParams } from "@/features/categories/services/create-category";

type CreateCategoryState = {
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
};

const initialState: CreateCategoryState = {
  isSubmitting: false,
  error: null,
  successMessage: null,
};

export const useCreateCategory = () => {
  const [state, setState] = useState<CreateCategoryState>(initialState);

  const submitCategory = async (payload: CreateCategoryParams): Promise<boolean> => {
    setState({ isSubmitting: true, error: null, successMessage: null });

    try {
      await createCategory(payload);
      setState({
        isSubmitting: false,
        error: null,
        successMessage: `Categoría "${payload.name}" creada correctamente.`,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear la categoría.";
      setState({ isSubmitting: false, error: message, successMessage: null });
      return false;
    }
  };

  const resetFeedback = () => {
    setState((prev) => ({ ...prev, error: null, successMessage: null }));
  };

  return {
    ...state,
    submitCategory,
    resetFeedback,
  };
};
