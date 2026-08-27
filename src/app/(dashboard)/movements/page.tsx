"use client";

import { Suspense } from "react";
import { MplusMovementsView } from "@/features/movements/components/movements-view";

export default function MovementsPage() {
  return (
    <Suspense fallback={null}>
      <MplusMovementsView />
    </Suspense>
  );
}
