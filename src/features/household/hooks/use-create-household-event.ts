import { useRef, useState } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";
import { createHouseholdEvent, type CreateHouseholdEventInput } from "@/features/household/services/create-household-event";

export const useCreateHouseholdEvent = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const refresh = useHouseholdDataStore((state) => state.refresh);

  const submit = async (input: CreateHouseholdEventInput): Promise<boolean> => {
    if (isSubmittingRef.current) {
      return false;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      await createHouseholdEvent(input);
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el evento del Hogar.");
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
