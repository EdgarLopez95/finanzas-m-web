import { useState } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";
import { renameHousehold } from "@/features/household/services/rename-household";

export const useRenameHousehold = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshHousehold = useHouseholdDataStore((state) => state.refresh);

  const submit = async (householdId: string, uid: string, name: string): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);

    try {
      await renameHousehold(householdId, uid, name);
      await refreshHousehold();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo renombrar el Hogar.");
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
