import { ArrowLeftRight, CircleAlert, CircleDollarSign, CircleMinus } from "lucide-react";

import { Amount } from "@/components/finance/amount";
import { FinanceChip } from "@/components/finance/finance-chip";
import { cn } from "@/lib/utils";

type TransactionType = "income" | "expense" | "transfer" | "reimbursement" | "pending";

type TransactionTimelineItemProps = {
  title: string;
  subtitle?: string;
  amount: number;
  type: TransactionType;
  dateLabel: string;
  metadata?: string;
  className?: string;
};

const toneMap: Record<TransactionType, { chip: "income" | "expense" | "transfer" | "pending" | "neutral"; amount: "income" | "expense" | "transfer" | "pending" | "neutral" }> = {
  income: { chip: "income", amount: "income" },
  expense: { chip: "expense", amount: "expense" },
  transfer: { chip: "transfer", amount: "transfer" },
  reimbursement: { chip: "neutral", amount: "neutral" },
  pending: { chip: "pending", amount: "pending" },
};

const labelMap: Record<TransactionType, string> = {
  income: "Ingreso",
  expense: "Gasto",
  transfer: "Transferencia",
  reimbursement: "Reembolso",
  pending: "Pendiente",
};

const iconMap = {
  income: CircleDollarSign,
  expense: CircleMinus,
  transfer: ArrowLeftRight,
  reimbursement: CircleDollarSign,
  pending: CircleAlert,
} as const;

export function TransactionTimelineItem({
  title,
  subtitle,
  amount,
  type,
  dateLabel,
  metadata,
  className,
}: TransactionTimelineItemProps) {
  const Icon = iconMap[type];
  const tone = toneMap[type];

  return (
    <article className={cn("flex items-center gap-3 rounded-[var(--fm-radius-card-medium)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark)] px-3 py-3", className)}>
      <div className="grid size-10 place-items-center rounded-full bg-[var(--fm-surface-dark-alt)] text-[var(--fm-warm-paper)]">
        <Icon aria-hidden="true" className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-[var(--fm-warm-paper)]">{title}</p>
        <p className="truncate text-[12px] text-muted-foreground">{subtitle ?? dateLabel}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Amount value={amount} variant={tone.amount} size="sm" />
        <div className="flex items-center gap-2">
          <FinanceChip variant={tone.chip}>{labelMap[type]}</FinanceChip>
          {metadata ? <span className="text-[11px] text-muted-foreground">{metadata}</span> : null}
        </div>
      </div>
    </article>
  );
}