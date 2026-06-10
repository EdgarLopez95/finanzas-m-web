"use client";

import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { CreateExpenseCard } from "./create-expense-card";
import { CreateIncomeCard } from "./create-income-card";
import { CreateTransferCard } from "./create-transfer-card";
import { useTransactionPanelStore } from "@/stores/transaction-panel-store";
import { usePersonalDashboardData } from "@/features/dashboard/hooks/use-personal-dashboard-data";
import { useAuthBootstrap } from "@/features/auth/use-auth-bootstrap";
import { cn } from "@/lib/utils";

export function CreateMovementDialog() {
  const { user } = useAuthBootstrap();
  const personalData = usePersonalDashboardData();
  
  const panelKind = useTransactionPanelStore((state) => state.kind);
  const defaultAccountId = useTransactionPanelStore((state) => state.defaultAccountId);
  const openCreate = useTransactionPanelStore((state) => state.openCreate);
  const closePanel = useTransactionPanelStore((state) => state.close);

  const isOpen = panelKind === "expense" || panelKind === "income" || panelKind === "transfer";

  if (!isOpen) {
    return null;
  }

  const handleCreated = async () => {
    await personalData.refresh();
    closePanel();
  };

  // Segmented control in the header
  const titleSelector = (
    <div className="flex items-center gap-1 rounded-xl bg-white/[0.02] border border-white/5 p-1 w-fit">
      <button
        onClick={() => openCreate("expense", defaultAccountId)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none",
          panelKind === "expense"
            ? "bg-[var(--fm-expense)] text-slate-950 font-bold shadow-sm"
            : "text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] hover:bg-white/[0.03]"
        )}
        type="button"
      >
        <ArrowDownLeft className="h-3.5 w-3.5" />
        <span>Gasto</span>
      </button>

      <button
        onClick={() => openCreate("income", defaultAccountId)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none",
          panelKind === "income"
            ? "bg-[var(--fm-income)] text-slate-950 font-bold shadow-sm"
            : "text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] hover:bg-white/[0.03]"
        )}
        type="button"
      >
        <ArrowUpRight className="h-3.5 w-3.5" />
        <span>Ingreso</span>
      </button>

      <button
        onClick={() => openCreate("transfer", defaultAccountId)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none",
          panelKind === "transfer"
            ? "bg-[var(--fm-transfer)] text-slate-950 font-bold shadow-sm"
            : "text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] hover:bg-white/[0.03]"
        )}
        type="button"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
        <span>Transferencia</span>
      </button>
    </div>
  );

  return (
    <FinanceDialog
      open={isOpen}
      onClose={closePanel}
      title={titleSelector}
    >
      <div className="max-h-[80vh] overflow-y-auto pr-1">
        {panelKind === "expense" && (
          <CreateExpenseCard
            accounts={personalData.data.accounts}
            categories={personalData.data.categories}
            defaultAccountId={defaultAccountId || undefined}
            onCreated={handleCreated}
            ownerId={user?.uid ?? ""}
            renderMode="dialog"
            onCancel={closePanel}
          />
        )}

        {panelKind === "income" && (
          <CreateIncomeCard
            accounts={personalData.data.accounts}
            categories={personalData.data.categories}
            defaultAccountId={defaultAccountId || undefined}
            onCreated={handleCreated}
            ownerId={user?.uid ?? ""}
            renderMode="dialog"
            onCancel={closePanel}
          />
        )}

        {panelKind === "transfer" && (
          <CreateTransferCard
            accounts={personalData.data.accounts}
            pockets={personalData.data.pockets}
            defaultAccountId={defaultAccountId || undefined}
            onCreated={handleCreated}
            ownerId={user?.uid ?? ""}
            renderMode="dialog"
            onCancel={closePanel}
          />
        )}
      </div>
    </FinanceDialog>
  );
}
