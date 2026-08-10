import { useState } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";
import { createHousehold, type CreateHouseholdInput } from "@/features/household/services/create-household";

export const useCreateHousehold = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (input: CreateHouseholdInput): Promise<string | null> => {
    if (isSubmitting) {
      return null;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const householdId = await createHousehold(input);
      const store = useHouseholdDataStore.getState();
      await store.load(input.uid, { force: true });
      return householdId;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el Hogar.");
      return null;
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
