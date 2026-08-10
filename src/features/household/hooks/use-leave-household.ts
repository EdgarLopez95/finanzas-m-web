import { useState } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";
import { leaveHousehold } from "@/features/household/services/leave-household";

export const useLeaveHousehold = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (householdId: string, uid: string): Promise<boolean> => {
    if (isSubmitting) {
      return false;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await leaveHousehold(householdId, uid);
      const store = useHouseholdDataStore.getState();
      store.applyHouseholdSnapshot({ activeHouseholdId: null }, uid);
      await store.load(uid, { force: true });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abandonar el Hogar.");
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
