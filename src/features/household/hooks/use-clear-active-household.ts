import { useState } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";
import { clearActiveHousehold } from "@/features/household/services/clear-active-household";

export const useClearActiveHousehold = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshHousehold = useHouseholdDataStore((state) => state.refresh);

  const submit = async (uid: string): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);

    try {
      await clearActiveHousehold(uid);
      await refreshHousehold();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo limpiar el Hogar activo.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    error,
    submit,
    resetError: () => setError(null),
  };
};
