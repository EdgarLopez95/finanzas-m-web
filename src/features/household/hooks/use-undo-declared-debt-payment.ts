import { useRef, useState } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";
import { usePersonalDataStore } from "@/stores/personal-data-store";
import {
  undoDeclaredDebtPayment,
  type UndoDeclaredDebtPaymentInput,
} from "@/features/household/services/undo-declared-debt-payment";

export const useUndoDeclaredDebtPayment = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const refreshHousehold = useHouseholdDataStore((state) => state.refresh);
  const refreshPersonal = usePersonalDataStore((state) => state.refresh);

  const submit = async (input: UndoDeclaredDebtPaymentInput): Promise<boolean> => {
    if (isSubmittingRef.current) {
      return false;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      await undoDeclaredDebtPayment(input);
      await Promise.all([refreshHousehold(), refreshPersonal()]);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo deshacer la declaración del pago.");
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
