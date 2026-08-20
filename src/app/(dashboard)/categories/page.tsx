"use client";

import { MplusCategoriesView } from "@/features/categories/components/mplus-categories-view";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

export default function CategoriesPage() {
  const masked = useUiPreferencesStore((state) => state.balancesHidden);

  return <MplusCategoriesView masked={masked} />;
}
