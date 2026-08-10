"use client";

import { useEffect, useRef } from "react";
import { X, ArrowRight } from "lucide-react";
import { Amount } from "@/components/finance/amount";
import { FinanceButton } from "@/components/finance/finance-button";
import { EmptyState } from "@/components/finance/empty-state";
import { getCategoryVisual } from "@/lib/design/personal-visuals";
import { buildTransactionFallbackTitle } from "@/features/transactions/services/read-personal-transactions";
import type { Account } from "@/types/account";
import type { Transaction } from "@/types/transaction";
import { isIncomingDebtReimbursement, type ExpenseCategoryBreakdownItem } from "@/features/dashboard/lib/personal-view-model";

type CategoryDetailDialogProps = {
  open: boolean;
  category: ExpenseCategoryBreakdownItem | null;
  transactions: Transaction[];
  accounts: Account[];
  masked: boolean;
  onClose: () => void;
  onSelectTransaction: (transaction: Transaction) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
};

export function CategoryDetailDialog({
  open,
  category,
  transactions,
  accounts,
  masked,
  onClose,
  onSelectTransaction,
  triggerRef,
}: CategoryDetailDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Manejar Escape y bloquear scroll del body
  useEffect(() => {
    if (!open) return;
    
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    
    // Autofocus primer elemento enfocable o el contenedor
    dialogRef.current?.focus();

    const currentTrigger = triggerRef?.current;

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      
      // Devolver foco al trigger al cerrar (WPP-110 a WPP-112)
      if (currentTrigger) {
        currentTrigger.focus();
      }
    };
  }, [open, onClose, triggerRef]);

  if (!open || !category) return null;

  const visual = getCategoryVisual(category.name, 0, category.color, category.iconKey);
  const Icon = visual.icon;

  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-[rgba(4,8,15,0.78)] px-4 py-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-full max-w-lg rounded-[24px] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(18,26,40,0.99),rgba(10,16,27,0.99))] shadow-[0_40px_100px_rgba(2,6,23,0.7)] flex flex-col max-h-[85vh] overflow-hidden outline-none animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="grid h-8 w-8 place-items-center rounded-lg border text-xs"
              style={{
                backgroundColor: visual.accentSoft,
                borderColor: `${visual.accent}33`,
                color: visual.accent,
              }}
            >
              <Icon className="h-4.5 w-4.5" />
            </div>
            <h2 className="font-[var(--font-display)] text-lg font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
              Gastos en {category.name}
            </h2>
          </div>
          <FinanceButton
            type="button"
            size="icon"
            tone="text"
            variant="ghost"
            aria-label="Cerrar"
            onClick={onClose}
            className="h-8 w-8 rounded-full"
          >
            <X className="h-4 w-4" />
          </FinanceButton>
        </div>

        {/* Info card */}
        <div className="px-6 py-4 bg-white/[0.015] border-b border-white/[0.04] flex items-center justify-between gap-4 shrink-0">
          <div>
            <p className="text-xs text-[var(--fm-text-muted)] font-medium">Total gastado</p>
            <Amount
              masked={masked}
              showSign={false}
              size="lg"
              value={category.amount}
              variant="expense"
              className="font-bold text-2xl"
            />
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--fm-text-muted)] font-medium">Participación</p>
            <p className="text-lg font-bold text-[var(--fm-warm-paper)]">{category.share}%</p>
          </div>
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {transactions.length === 0 ? (
            <div className="py-8">
              <EmptyState
                title="Sin movimientos"
                description="No hay gastos registrados en esta categoría para el período seleccionado."
              />
            </div>
          ) : (
            transactions.map((tx) => {
              const txTitle = buildTransactionFallbackTitle(tx.title, tx.type, category.name);
              const accountName = accountsById.get(tx.accountId)?.name ?? "Cuenta";
              const dateString = tx.date
                ? tx.date.toLocaleDateString("es-CO", { day: "numeric", month: "short" })
                : "Sin fecha";
              // Un reembolso entrante de deuda vinculado a esta categoría no es
              // un gasto: se muestra en tono neutral, nunca en rojo (paridad Android).
              const isReimbursement = isIncomingDebtReimbursement(tx);

              return (
                <div
                  key={tx.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectTransaction(tx)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectTransaction(tx);
                    }
                  }}
                  className="w-full flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition-all cursor-pointer group text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-[var(--fm-warm-paper)] truncate leading-snug">
                      {txTitle}
                    </p>
                    <p className="text-xs text-[var(--fm-text-muted)] truncate mt-0.5">
                      {dateString} · {accountName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <Amount
                      masked={masked}
                      showSign={false}
                      size="sm"
                      value={tx.amount}
                      variant={isReimbursement ? "neutral" : "expense"}
                      className="font-bold text-base"
                    />
                    <ArrowRight className="h-3.5 w-3.5 text-[var(--fm-text-muted)] opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0 group-focus:translate-x-0" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
