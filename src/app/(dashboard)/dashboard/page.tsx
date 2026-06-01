"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Amount } from "@/components/finance/amount";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceShimmer } from "@/components/finance/finance-shimmer";
import { TransactionTimelineItem } from "@/components/finance/transaction-timeline-item";
import { signOutUser } from "@/features/auth/auth-service";
import { useAuthBootstrap } from "@/features/auth/use-auth-bootstrap";
import { AppShell } from "@/components/layout/app-shell";

export default function DashboardPage() {
  const router = useRouter();
  const { status, user } = useAuthBootstrap();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  const handleLogout = async () => {
    await signOutUser();
    router.replace("/login");
  };

  if (status === "loading") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 p-6">
        <FinanceShimmer className="h-24 w-full" />
        <FinanceShimmer className="h-56 w-full" />
      </main>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <AppShell title="Dashboard">
      <section className="grid gap-4 lg:grid-cols-2">
        <FinanceCard
          title="Balance total"
          subtitle="Placeholder visual WEB-U"
          variant="hero"
          headerRight={
            <FinanceButton onClick={handleLogout} size="sm" tone="text" variant="ghost">
              Cerrar sesion
            </FinanceButton>
          }
        >
          <Amount value={5234000} size="hero" />
        </FinanceCard>
        <FinanceCard title="Usuario autenticado" subtitle="Sesion activa de Firebase Auth" variant="default">
          <p className="text-sm text-[var(--fm-warm-paper)]">{user?.displayName}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <p className="text-xs text-muted-foreground">UID: {user?.uid}</p>
        </FinanceCard>
      </section>
      <FinanceCard title="Movimientos recientes" subtitle="Sin datos reales" variant="elevated">
        <div className="space-y-3">
          <TransactionTimelineItem title="Nomina" subtitle="Cuenta principal" amount={2200000} type="income" dateLabel="Hoy" />
          <TransactionTimelineItem title="Arriendo" subtitle="Cuenta hogar" amount={1200000} type="expense" dateLabel="Ayer" />
        </div>
      </FinanceCard>
    </AppShell>
  );
}