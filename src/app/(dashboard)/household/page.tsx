"use client";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceShimmer } from "@/components/finance/finance-shimmer";
import { HouseholdOverview } from "@/features/household/components/household-overview";
import { useHouseholdData } from "@/features/household/hooks/use-household-data";

export default function HouseholdPage() {
  const household = useHouseholdData();

  if (household.status === "loading" || household.status === "idle") {
    return (
      <div className="space-y-4">
        <FinanceShimmer className="h-40 w-full rounded-[32px]" />
        <FinanceShimmer className="h-64 w-full rounded-[32px]" />
      </div>
    );
  }

  if (household.status === "error") {
    return (
      <EmptyState
        description={household.error ?? "Intenta recargar esta vista."}
        title="Error al cargar Hogar"
      />
    );
  }

  if (household.status === "empty") {
    return (
      <EmptyState
        description="Cuando tengas un hogar activo, aqui veras su resumen compartido en modo solo lectura."
        title="No tienes un hogar activo todavia"
      />
    );
  }

  if (!household.data.household) {
    return (
      <EmptyState
        description="Tu usuario no tiene un hogar activo disponible en este momento."
        title="No se encontro el hogar"
      />
    );
  }

  return (
    <HouseholdOverview
      categories={household.data.categories}
      debts={household.data.debts}
      incomeEntries={household.data.incomeEntries}
      memberCount={household.summary.memberCount}
      monthlyBalance={household.summary.monthlyBalance}
      monthlyExpenseTotal={household.summary.monthlyExpenseTotal}
      monthlyIncomeTotal={household.summary.monthlyIncomeTotal}
      name={household.data.household.name}
      recentEvents={household.summary.recentEvents}
    />
  );
}
