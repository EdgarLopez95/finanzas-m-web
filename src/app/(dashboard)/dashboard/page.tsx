"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { Amount } from "@/components/finance/amount";
import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceChip } from "@/components/finance/finance-chip";
import { FinanceShimmer } from "@/components/finance/finance-shimmer";
import { TransactionTimelineItem } from "@/components/finance/transaction-timeline-item";
import { AppShell } from "@/components/layout/app-shell";
import { signOutUser } from "@/features/auth/auth-service";
import { useAuthBootstrap } from "@/features/auth/use-auth-bootstrap";
import { usePersonalDashboardData } from "@/features/dashboard/hooks/use-personal-dashboard-data";
import { buildTransactionFallbackTitle } from "@/features/transactions/services/read-personal-transactions";
import { formatDateEs } from "@/lib/format/date";

export default function DashboardPage() {
  const router = useRouter();
  const { status, user } = useAuthBootstrap();
  const personalData = usePersonalDashboardData(user?.uid ?? null, status === "authenticated");

  const categoriesById = useMemo(() => {
    return new Map(personalData.data.categories.map((category) => [category.id, category]));
  }, [personalData.data.categories]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  const handleLogout = async () => {
    await signOutUser();
    router.replace("/login");
  };

  if (status === "loading" || personalData.status === "loading") {
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

  if (personalData.status === "error") {
    return (
      <AppShell title="Dashboard">
        <EmptyState title="Error al cargar datos" description={personalData.error ?? "Intenta recargar esta vista."} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard">
      <section className="grid gap-4 lg:grid-cols-2">
        <FinanceCard
          title="Balance total"
          subtitle="Base: suma de currentBalance por cuenta personal"
          variant="hero"
          headerRight={
            <FinanceButton onClick={handleLogout} size="sm" tone="text" variant="ghost">
              Cerrar sesion
            </FinanceButton>
          }
        >
          <Amount value={personalData.totalBalance} size="hero" showSign={false} />
        </FinanceCard>
        <FinanceCard title="Usuario autenticado" subtitle="Sesion activa de Firebase Auth" variant="default">
          <p className="text-sm text-[var(--fm-warm-paper)]">{user?.displayName}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <p className="text-xs text-muted-foreground">UID: {user?.uid}</p>
        </FinanceCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <FinanceCard title="Cuentas personales" subtitle={`Total: ${personalData.data.accounts.length}`} variant="elevated">
          {!personalData.data.accounts.length ? (
            <EmptyState title="Sin cuentas" description="Aun no tienes cuentas personales registradas." />
          ) : (
            <div className="space-y-3">
              {personalData.data.accounts.map((account) => {
                const pocketsForAccount = personalData.data.pockets.filter((pocket) => pocket.accountId === account.id);

                return (
                  <article key={account.id} className="rounded-[var(--fm-radius-card-medium)] border border-[var(--fm-border-dark)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[var(--fm-warm-paper)]">{account.name}</p>
                      <Amount value={account.balance} size="sm" showSign={false} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {account.currency} · {account.institutionName || "Sin entidad"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Bolsillos: {pocketsForAccount.length}</p>
                  </article>
                );
              })}
            </div>
          )}
        </FinanceCard>

        <FinanceCard title="Categorias personales" subtitle={`Total: ${personalData.data.categories.length}`} variant="default">
          {!personalData.data.categories.length ? (
            <EmptyState title="Sin categorias" description="Aun no hay categorias personales disponibles." />
          ) : (
            <div className="flex flex-wrap gap-2">
              {personalData.data.categories.slice(0, 12).map((category) => (
                <FinanceChip key={category.id} variant={category.type === "income" ? "income" : category.type === "expense" ? "expense" : "neutral"}>
                  {category.name}
                </FinanceChip>
              ))}
            </div>
          )}
        </FinanceCard>
      </section>

      <FinanceCard title="Movimientos recientes" subtitle="Lectura personal read-only" variant="elevated">
        {!personalData.data.transactions.length ? (
          <EmptyState title="Sin movimientos" description="Aun no tienes transacciones personales recientes." />
        ) : (
          <div className="space-y-3">
            {personalData.data.transactions.map((transaction) => {
              const categoryName = categoriesById.get(transaction.categoryId)?.name;
              const safeCategoryName = categoryName || "Sin categoria";

              return (
                <TransactionTimelineItem
                  key={transaction.id}
                  title={buildTransactionFallbackTitle(transaction.title, transaction.type, categoryName)}
                  subtitle={transaction.notes || safeCategoryName}
                  amount={transaction.amount}
                  type={transaction.type}
                  dateLabel={transaction.createdAt ? formatDateEs(transaction.createdAt) : "Sin fecha"}
                  metadata={safeCategoryName}
                />
              );
            })}
          </div>
        )}
      </FinanceCard>
    </AppShell>
  );
}