import { useRef, useState } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";
import { generateHouseholdInviteCode, type GenerateInviteCodeInput } from "@/features/household/services/generate-household-invite-code";

export const useGenerateInviteCode = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const refreshHousehold = useHouseholdDataStore((state) => state.refresh);

  const submit = async (input: GenerateInviteCodeInput): Promise<string | null> => {
    if (isSubmittingRef.current) {
      return null;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const code = await generateHouseholdInviteCode(input);
      await refreshHousehold();
      return code;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el código de invitación.");
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
