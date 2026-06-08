"use client";

import { useEffect, useMemo, useState } from "react";
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
import { CreateExpenseCard } from "@/features/transactions/components/create-expense-card";
import { CreateIncomeCard } from "@/features/transactions/components/create-income-card";
import { DeleteTransactionConfirmCard } from "@/features/transactions/components/delete-transaction-confirm-card";
import { EditTransactionCard } from "@/features/transactions/components/edit-transaction-card";
import { CreateTransferCard } from "@/features/transactions/components/create-transfer-card";
import { buildTransactionFallbackTitle } from "@/features/transactions/services/read-personal-transactions";
import { formatDateEs } from "@/lib/format/date";
import { useAuthStore } from "@/stores/auth-store";
import type { Transaction } from "@/types/transaction";

type CreateMode = "expense" | "income" | "transfer" | null;

export default function DashboardPage() {
  const router = useRouter();
  const { status, user } = useAuthBootstrap();
  const clearSession = useAuthStore((state) => state.clearSession);
  const personalData = usePersonalDashboardData(user?.uid ?? null, status === "authenticated");
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [editingMovement, setEditingMovement] = useState<Transaction | null>(null);
  const [deletingMovement, setDeletingMovement] = useState<Transaction | null>(null);
  const [loadingGuardTriggered, setLoadingGuardTriggered] = useState(false);

  const categoriesById = useMemo(() => {
    return new Map(personalData.data.categories.map((category) => [category.id, category]));
  }, [personalData.data.categories]);

  const accountsById = useMemo(() => {
    return new Map(personalData.data.accounts.map((account) => [account.id, account]));
  }, [personalData.data.accounts]);

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

  const handleLogout = async () => {
    await signOutUser();
    clearSession();
    router.replace("/login");
  };

  if (status === "loading" || personalData.status === "loading") {
    if (loadingGuardTriggered) {
      return (
        <AppShell title="Dashboard">
          <div className="space-y-3">
            <EmptyState
              title="Demora al validar sesion"
              description="No pudimos resolver tu sesion a tiempo. Intenta volver a iniciar sesion."
            />
            <div className="flex justify-center">
              <FinanceButton
                onClick={() => {
                  router.replace("/login");
                }}
                size="sm"
                tone="filled"
              >
                Ir a login
              </FinanceButton>
            </div>
          </div>
        </AppShell>
      );
    }

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
          title="Saldo en cuentas"
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
          <div className="flex flex-wrap gap-2 pb-3">
            <FinanceButton onClick={() => {
              setEditingMovement(null);
              setDeletingMovement(null);
              setCreateMode((prev) => (prev === "expense" ? null : "expense"));
            }} size="sm" tone="filled">
              {createMode === "expense" ? "Cerrar gasto" : "Nuevo gasto"}
            </FinanceButton>
            <FinanceButton onClick={() => {
              setEditingMovement(null);
              setDeletingMovement(null);
              setCreateMode((prev) => (prev === "income" ? null : "income"));
            }} size="sm" tone="outlined" variant="outline">
              {createMode === "income" ? "Cerrar ingreso" : "Nuevo ingreso"}
            </FinanceButton>
            <FinanceButton onClick={() => {
              setEditingMovement(null);
              setDeletingMovement(null);
              setCreateMode((prev) => (prev === "transfer" ? null : "transfer"));
            }} size="sm" tone="text" variant="ghost">
              {createMode === "transfer" ? "Cerrar transferencia" : "Nueva transferencia"}
            </FinanceButton>
          </div>
          <p className="text-sm text-[var(--fm-warm-paper)]">{user?.displayName}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <p className="text-xs text-muted-foreground">UID: {user?.uid}</p>
        </FinanceCard>
      </section>

      {createMode === "expense" ? (
        <CreateExpenseCard
          ownerId={user?.uid ?? ""}
          accounts={personalData.data.accounts}
          categories={personalData.data.categories}
          onCreated={async () => {
            await personalData.refresh();
            setCreateMode(null);
          }}
        />
      ) : null}

      {createMode === "income" ? (
        <CreateIncomeCard
          ownerId={user?.uid ?? ""}
          accounts={personalData.data.accounts}
          categories={personalData.data.categories}
          onCreated={async () => {
            await personalData.refresh();
            setCreateMode(null);
          }}
        />
      ) : null}

      {createMode === "transfer" ? (
        <CreateTransferCard
          ownerId={user?.uid ?? ""}
          accounts={personalData.data.accounts}
          onCreated={async () => {
            await personalData.refresh();
            setCreateMode(null);
          }}
        />
      ) : null}

      {editingMovement ? (
        <EditTransactionCard
          ownerId={user?.uid ?? ""}
          movement={editingMovement}
          accounts={personalData.data.accounts}
          categories={personalData.data.categories}
          onCancel={() => setEditingMovement(null)}
          onUpdated={async () => {
            await personalData.refresh();
            setEditingMovement(null);
          }}
        />
      ) : null}

      {deletingMovement ? (
        <DeleteTransactionConfirmCard
          ownerId={user?.uid ?? ""}
          movement={deletingMovement}
          onCancel={() => setDeletingMovement(null)}
          onDeleted={async () => {
            await personalData.refresh();
            setDeletingMovement(null);
          }}
        />
      ) : null}

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
              const transferTargetName = transaction.targetAccountId
                ? accountsById.get(transaction.targetAccountId)?.name ?? "Cuenta destino"
                : null;
              const safeCategoryName = transaction.type === "transfer"
                ? `Destino: ${transferTargetName ?? "Cuenta destino"}`
                : categoryName || "Sin categoria";

              return (
                <div key={transaction.id} className="space-y-2">
                  <TransactionTimelineItem
                    title={buildTransactionFallbackTitle(transaction.title, transaction.type, categoryName)}
                    subtitle={transaction.notes || safeCategoryName}
                    amount={transaction.amount}
                    type={transaction.type}
                    dateLabel={transaction.createdAt ? formatDateEs(transaction.createdAt) : "Sin fecha"}
                    metadata={safeCategoryName}
                  />
                  <div className="flex justify-end gap-2">
                    <FinanceButton
                      size="sm"
                      tone="text"
                      variant="ghost"
                      onClick={() => {
                        setCreateMode(null);
                        setDeletingMovement(null);
                        setEditingMovement(transaction);
                      }}
                    >
                      Editar
                    </FinanceButton>
                    <FinanceButton
                      size="sm"
                      tone="destructive"
                      variant="ghost"
                      onClick={() => {
                        setCreateMode(null);
                        setEditingMovement(null);
                        setDeletingMovement(transaction);
                      }}
                    >
                      Eliminar
                    </FinanceButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </FinanceCard>
    </AppShell>
  );
}
