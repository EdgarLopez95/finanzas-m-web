import { useState } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";
import { dissolveHousehold } from "@/features/household/services/dissolve-household";

export const useDissolveHousehold = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (householdId: string, uid: string): Promise<boolean> => {
    if (isSubmitting) {
      return false;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await dissolveHousehold(householdId, uid);
      const store = useHouseholdDataStore.getState();
      store.applyHouseholdSnapshot({ activeHouseholdId: null }, uid);
      await store.load(uid, { force: true });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo disolver el Hogar.");
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
