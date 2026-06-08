"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceShimmer } from "@/components/finance/finance-shimmer";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthBootstrap } from "@/features/auth/use-auth-bootstrap";
import { HouseholdOverview } from "@/features/household/components/household-overview";
import { useHouseholdData } from "@/features/household/hooks/use-household-data";

export default function HouseholdPage() {
  const router = useRouter();
  const { status, user } = useAuthBootstrap();
  const householdData = useHouseholdData(user?.uid ?? null, status === "authenticated");
  const [loadingGuardTriggered, setLoadingGuardTriggered] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== "loading") {
      setLoadingGuardTriggered(false);
      return;
    }

    const timeout = setTimeout(() => {
      setLoadingGuardTriggered(true);
    }, 10000);

    return () => clearTimeout(timeout);
  }, [status]);

  if (status === "loading" || householdData.status === "loading") {
    if (loadingGuardTriggered) {
      return (
        <AppShell title="Hogar">
          <EmptyState
            title="Demora al validar sesion"
            description="No pudimos resolver tu sesion a tiempo. Intenta volver a iniciar sesion."
          />
        </AppShell>
      );
    }

    return (
      <AppShell title="Hogar">
        <div className="space-y-4">
          <FinanceShimmer className="h-40 w-full" />
          <FinanceShimmer className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  if (householdData.status === "error") {
    return (
      <AppShell title="Hogar">
        <EmptyState
          title="Error al cargar Hogar"
          description={householdData.error ?? "Intenta recargar esta vista."}
        />
      </AppShell>
    );
  }

  if (householdData.status === "empty") {
    return (
      <AppShell title="Hogar">
        <EmptyState
          title="No tienes un hogar activo todavia"
          description="Cuando tengas un hogar activo, aqui veras su resumen compartido en modo solo lectura."
        />
      </AppShell>
    );
  }

  if (!householdData.data.household) {
    return (
      <AppShell title="Hogar">
        <EmptyState
          title="No se encontro el hogar"
          description="Tu usuario no tiene un hogar activo disponible en este momento."
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Hogar">
      <div className="space-y-4">
        <div className="flex justify-end">
          <FinanceButton tone="text" variant="ghost" onClick={() => router.push("/dashboard")}>
            Volver al dashboard
          </FinanceButton>
        </div>
        <HouseholdOverview
          name={householdData.data.household.name}
          memberCount={householdData.summary.memberCount}
          monthlyExpenseTotal={householdData.summary.monthlyExpenseTotal}
          monthlyIncomeTotal={householdData.summary.monthlyIncomeTotal}
          monthlyBalance={householdData.summary.monthlyBalance}
          categories={householdData.data.categories}
          debts={householdData.data.debts}
          recentEvents={householdData.summary.recentEvents}
          incomeEntries={householdData.data.incomeEntries}
        />
      </div>
    </AppShell>
  );
}
