import { useState } from "react";

import { useHouseholdDataStore } from "@/stores/household-data-store";
import { createHouseholdCategory, type CreateHouseholdCategoryInput } from "@/features/household/services/create-household-category";
import { updateHouseholdCategory, type UpdateHouseholdCategoryInput } from "@/features/household/services/update-household-category";
import { archiveHouseholdCategory } from "@/features/household/services/archive-household-category";
import { unarchiveHouseholdCategory } from "@/features/household/services/unarchive-household-category";

export const useHouseholdCategories = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useHouseholdDataStore((state) => state.refresh);

  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    try {
      await fn();
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la operación.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    error,
    resetError: () => setError(null),
    create: (input: CreateHouseholdCategoryInput) => run(() => createHouseholdCategory(input)),
    update: (input: UpdateHouseholdCategoryInput) => run(() => updateHouseholdCategory(input)),
    archive: (categoryId: string) => run(() => archiveHouseholdCategory(categoryId)),
    unarchive: (categoryId: string) => run(() => unarchiveHouseholdCategory(categoryId)),
  };
};
