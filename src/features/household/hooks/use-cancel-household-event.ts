import { useRef, useState } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";
import { cancelHouseholdEvent, type CancelHouseholdEventInput } from "@/features/household/services/cancel-household-event";

export const useCancelHouseholdEvent = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const refresh = useHouseholdDataStore((state) => state.refresh);

  const cancel = async (input: CancelHouseholdEventInput): Promise<boolean> => {
    if (isSubmittingRef.current) {
      return false;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      await cancelHouseholdEvent(input);
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar el gasto del Hogar.");
      return false;
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    error,
    cancel,
    resetError: () => setError(null),
  };
};
