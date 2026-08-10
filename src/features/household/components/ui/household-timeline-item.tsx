import { ArrowLeftRight, CircleAlert, CircleDollarSign, CircleMinus } from "lucide-react";

import { HouseholdAmount } from "@/features/household/components/ui/household-amount";
import { HouseholdChip } from "@/features/household/components/ui/household-chip";
import { cn } from "@/lib/utils";

/**
 * Fila de la línea de tiempo del libro compartido. Espejo funcional de
 * `TransactionTimelineItem` (mismo layout, iconos, etiquetas y tonos) pero
 * consumiendo solo roles `--hh-*` y el kit Hogar.
 */
type HouseholdTimelineItemType = "income" | "expense" | "transfer" | "reimbursement" | "pending";

type HouseholdTimelineItemProps = {
  title: string;
  subtitle?: string;
  amount: number;
  type: HouseholdTimelineItemType;
  dateLabel: string;
  metadata?: string;
  className?: string;
  extraIndicator?: React.ReactNode;
};

const toneMap: Record<
  HouseholdTimelineItemType,
  {
    chip: "income" | "pending" | "neutral" | "household";
    amount: "income" | "expense" | "transfer" | "pending" | "neutral";
  }
> = {
  income: { chip: "income", amount: "income" },
  expense: { chip: "household", amount: "expense" },
  transfer: { chip: "neutral", amount: "transfer" },
  reimbursement: { chip: "neutral", amount: "neutral" },
  pending: { chip: "pending", amount: "pending" },
};

const labelMap: Record<HouseholdTimelineItemType, string> = {
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

export function HouseholdTimelineItem({
  title,
  subtitle,
  amount,
  type,
  dateLabel,
  metadata,
  className,
  extraIndicator,
}: HouseholdTimelineItemProps) {
  const Icon = iconMap[type];
  const tone = toneMap[type];

  return (
    <article
      className={cn(
        "flex items-center gap-3 rounded-[20px] border border-[var(--hh-border)] bg-[var(--hh-surface)] px-3 py-3",
        className
      )}
    >
      <div className="grid size-10 place-items-center rounded-full bg-[var(--hh-surface-elevated)] text-[var(--hh-text)]">
        <Icon aria-hidden="true" className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-[var(--hh-text)]">{title}</p>
        <p className="truncate text-[12px] text-[var(--hh-text-muted)]">{subtitle ?? dateLabel}</p>
        {extraIndicator && <div className="mt-1 flex flex-wrap gap-1">{extraIndicator}</div>}
      </div>
      <div className="flex flex-col items-end gap-1">
        <HouseholdAmount value={amount} variant={tone.amount} size="sm" />
        <div className="flex items-center gap-2">
          <HouseholdChip variant={tone.chip}>{labelMap[type]}</HouseholdChip>
          {metadata ? <span className="text-[11px] text-[var(--hh-text-muted)]">{metadata}</span> : null}
        </div>
      </div>
    </article>
  );
}
