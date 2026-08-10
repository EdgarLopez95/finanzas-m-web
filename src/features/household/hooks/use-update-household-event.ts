import { useRef, useState } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";
import { updateHouseholdEvent, type UpdateHouseholdEventInput } from "@/features/household/services/update-household-event";

export const useUpdateHouseholdEvent = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const refresh = useHouseholdDataStore((state) => state.refresh);

  const submit = async (input: UpdateHouseholdEventInput): Promise<boolean> => {
    if (isSubmittingRef.current) {
      return false;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      await updateHouseholdEvent(input);
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el gasto del Hogar.");
      return false;
    } finally {
      isSubmittingRef.current = false;
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
