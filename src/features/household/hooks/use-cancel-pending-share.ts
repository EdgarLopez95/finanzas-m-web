import { useRef, useState } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";
import {
  cancelPendingShare,
  type CancelPendingShareInput,
} from "@/features/household/services/cancel-pending-share";

export const useCancelPendingShare = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const refreshHousehold = useHouseholdDataStore((state) => state.refresh);

  const submit = async (input: CancelPendingShareInput): Promise<boolean> => {
    if (isSubmittingRef.current) {
      return false;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      await cancelPendingShare(input);
      await refreshHousehold();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar la cuota pendiente.");
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
