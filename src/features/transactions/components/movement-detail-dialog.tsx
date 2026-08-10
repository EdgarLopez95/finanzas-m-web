"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  X,
  Edit3,
  Trash2,
} from "lucide-react";

import { Amount } from "@/components/finance/amount";
import { FinanceButton } from "@/components/finance/finance-button";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { getTransactionVisual } from "@/lib/design/personal-visuals";
import { isTechnicalTransaction } from "@/features/transactions/lib/technical-transactions";
import {
  getPersonalMovementEditBlockReason,
  getPersonalMovementDeleteBlockReason,
  isPersonalMovementEditable,
  isPersonalMovementDeletable,
} from "@/features/transactions/lib/personal-movement-mutability";
import { AccountIcon } from "@/components/finance/account-icon";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";
import type { Pocket } from "@/types/pocket";
import type { Transaction } from "@/types/transaction";
import { EditTransactionCard } from "@/features/transactions/components/edit-transaction-card";

type MovementDetailDialogProps = {
  open: boolean;
  transaction: Transaction | null;
  accounts: Account[];
  pockets: Pocket[];
  categories: Category[];
  masked: boolean;
  ownerId: string;
  onClose: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onUpdated: () => Promise<void>;
};

const TYPE_LABEL: Record<string, string> = {
  income: "Ingreso",
  expense: "Gasto",
  transfer: "Transferencia",
  reimbursement: "Reembolso",
  pending: "Pendiente",
};

const formatDateEs = (date: Date | null | undefined): string => {
  if (!date) return "Sin fecha";
  return date.toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export function MovementDetailDialog({
  open,
  transaction,
  accounts,
  pockets,
  categories,
  masked,
  ownerId,
  onClose,
  onDelete,
  onUpdated,
}: MovementDetailDialogProps) {
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!open) setEditMode(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !transaction) return null;

  const isTechnical = isTechnicalTransaction(transaction.title);
  // G3 — helper único compartido con la lista y alineado con los servicios:
  // reembolsos, gasto que consumió dinero no propio y transfer que
  // movió dinero no propio no se editan ni eliminan. Editar/borrar exigiría
  // revertir consumos u operaciones de ubicación, que hoy no existe.
  // Los movimientos técnicos no se editan, pero SÍ se pueden eliminar.
  const isEditable = isPersonalMovementEditable(transaction);
  const isDeletable = isPersonalMovementDeletable(transaction);
  const editBlockReason = getPersonalMovementEditBlockReason(transaction);
  const deleteBlockReason = getPersonalMovementDeleteBlockReason(transaction);
  const immutabilityReason = editBlockReason || deleteBlockReason;

  const account = accounts.find((a) => a.id === transaction.accountId);
  const targetAccount = transaction.targetAccountId
    ? accounts.find((a) => a.id === transaction.targetAccountId)
    : null;
  const pocket = transaction.pocketId
    ? pockets.find((p) => p.id === transaction.pocketId)
    : null;
  const targetPocket = transaction.targetPocketId
    ? pockets.find((p) => p.id === transaction.targetPocketId)
    : null;
  const category = transaction.categoryId
    ? categories.find((c) => c.id === transaction.categoryId)
    : null;

  // Build visual
  const metadata =
    transaction.type === "transfer"
      ? `Destino: ${targetAccount?.name ?? "Cuenta destino"}`
      : category?.name ?? "";
  let visual = getTransactionVisual(transaction.type, metadata);
  if ((transaction.type === "expense" || transaction.type === "income") && category?.iconKey && !isTechnical) {
    const Icon = resolveCategoryIcon(category.iconKey, category.type);
    visual = {
      accent: category.color || (transaction.type === "income" ? "#34d399" : "#fb7185"),
      accentSoft: (category.color || "#fb7185") + "22",
      icon: Icon,
    };
  }
  const Icon = visual.icon;

  const amountVariant =
    transaction.type === "income"
      ? "income"
      : transaction.type === "expense"
        ? "expense"
        : transaction.type === "transfer"
          ? "transfer"
          : "neutral";

  const typeLabel = TYPE_LABEL[transaction.type] ?? transaction.type;
  const displayDate = formatDateEs(transaction.date ?? transaction.createdAt);

  if (editMode && isEditable) {
    return (
      <div
        className="fixed inset-0 z-[96] flex items-center justify-center bg-[rgba(4,8,15,0.80)] px-4 py-8"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-lg rounded-[24px] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(18,26,40,0.99),rgba(10,16,27,0.99))] shadow-[0_40px_100px_rgba(2,6,23,0.7)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-white/[0.06]">
            <h2 className="font-[var(--font-display)] text-xl font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
              Editar movimiento
            </h2>
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
          <div className="p-6">
            <EditTransactionCard
              ownerId={ownerId}
              movement={transaction}
              accounts={accounts}
              pockets={pockets}
              categories={categories}
              renderMode="card"
              onUpdated={async () => {
                setEditMode(false);
                await onUpdated();
                onClose();
              }}
              onCancel={() => setEditMode(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-[rgba(4,8,15,0.78)] px-4 py-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-[24px] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(18,26,40,0.99),rgba(10,16,27,0.99))] shadow-[0_40px_100px_rgba(2,6,23,0.7),0_0_0_1px_rgba(255,255,255,0.04)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-white/[0.06]">
          <h2 className="font-[var(--font-display)] text-xl font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
            Detalle del movimiento
          </h2>
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

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Amount hero */}
          <div className="flex items-center gap-4">
            <div
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border"
              style={
                isTechnical && account
                  ? {
                      backgroundColor: `${account.color || "#60a5fa"}22`,
                      borderColor: `${account.color || "#60a5fa"}28`,
                      color: account.color || "#60a5fa",
                    }
                  : {
                      backgroundColor: visual.accentSoft,
                      borderColor: `${visual.accent}28`,
                      color: visual.accent,
                    }
              }
            >
              {isTechnical && account ? (
                <AccountIcon
                  iconType={(account.iconType as "generic" | "bank_logo") || "generic"}
                  iconKey={account.iconKey || "bank"}
                  color={account.color || "#60a5fa"}
                  size="md"
                />
              ) : (
                <Icon className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-[var(--font-display)] text-[22px] font-bold tracking-[-0.03em] text-[var(--fm-warm-paper)] leading-none mb-1">
                {transaction.title}
              </p>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                    transaction.type === "income"
                      ? "bg-[rgba(74,222,128,0.1)] text-[var(--fm-income)] border-[rgba(74,222,128,0.2)]"
                      : transaction.type === "expense"
                        ? "bg-[rgba(248,113,113,0.1)] text-[var(--fm-expense)] border-[rgba(248,113,113,0.2)]"
                        : "bg-[rgba(96,165,250,0.1)] text-[#60a5fa] border-[rgba(96,165,250,0.2)]"
                  )}
                >
                  {transaction.type === "income" && <ArrowUpRight className="h-2.5 w-2.5" />}
                  {transaction.type === "expense" && <ArrowDownLeft className="h-2.5 w-2.5" />}
                  {transaction.type === "transfer" && <ArrowLeftRight className="h-2.5 w-2.5" />}
                  {typeLabel}
                </span>
                {isTechnical && (
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[rgba(228,179,99,0.1)] text-[var(--fm-pending)] border border-[rgba(228,179,99,0.2)]">
                    {transaction.title}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.025] px-5 py-4">
            <span className="text-sm text-[var(--fm-text-muted)]">Monto</span>
            <Amount
              masked={masked}
              showSign
              size="lg"
              value={transaction.amount}
              variant={amountVariant}
              className="text-2xl font-bold"
            />
          </div>

          {/* Details grid */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            <DetailRow label="Fecha" value={displayDate} />
            {transaction.notes?.trim() && (
              <DetailRow label="Concepto" value={transaction.notes.trim()} />
            )}
            {account && (
              <DetailRow label="Cuenta" value={account.name} />
            )}
            {pocket && (
              <DetailRow label="Bolsillo" value={pocket.name} />
            )}
            {category && (
              <DetailRow label="Categoría" value={category.name} />
            )}
            {transaction.type === "transfer" && targetAccount && (
              <DetailRow
                label="Cuenta destino"
                value={
                  targetPocket
                    ? `${targetAccount.name} / ${targetPocket.name}`
                    : targetAccount.name
                }
              />
            )}
            {transaction.type === "income" && transaction.countsAsRealIncome === false && (
              <DetailRow label="Tipo de ingreso" value="No cuenta como ingreso real" accent="muted" />
            )}
            {transaction.type === "income" && transaction.countsAsRealIncome !== false && (
              <DetailRow label="Tipo de ingreso" value="Ingreso real" accent="income" />
            )}
          </div>

          {/* G3 — por qué este movimiento no ofrece Editar/Eliminar. */}
          {immutabilityReason ? (
            <p className="text-[12px] leading-relaxed text-[var(--fm-text-muted)]">
              {immutabilityReason}
            </p>
          ) : null}
        </div>

        {/* Footer actions */}
        {(isEditable || isDeletable) && (
          <div className="flex items-center justify-end gap-2.5 px-6 pb-6 pt-2 border-t border-white/[0.05] mt-0">
            {isDeletable && (
              <FinanceButton
                type="button"
                tone="destructive"
                onClick={() => onDelete(transaction)}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </FinanceButton>
            )}
            {isEditable && (
              <FinanceButton
                type="button"
                tone="filled"
                onClick={() => setEditMode(true)}
                className="gap-1.5"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editar
              </FinanceButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "income" | "muted";
}) {
  const valueClass =
    accent === "income"
      ? "text-[var(--fm-income)]"
      : accent === "muted"
        ? "text-[var(--fm-text-muted)]"
        : "text-[var(--fm-warm-paper)]";

  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-[12px] text-[var(--fm-text-muted)] shrink-0 pt-px">{label}</span>
      <span className={cn("text-[13px] font-medium text-right", valueClass)}>{value}</span>
    </div>
  );
}
