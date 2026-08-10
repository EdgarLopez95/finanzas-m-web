import { useRef, useState } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";
import { joinHouseholdByInviteCode, type JoinHouseholdInput } from "@/features/household/services/join-household-by-invite-code";

export const useJoinHousehold = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const submit = async (input: JoinHouseholdInput): Promise<string | null> => {
    if (isSubmittingRef.current) {
      return null;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const householdId = await joinHouseholdByInviteCode(input);
      const store = useHouseholdDataStore.getState();
      await store.load(input.uid, { force: true });
      return householdId;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo unir al Hogar.");
      return null;
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
