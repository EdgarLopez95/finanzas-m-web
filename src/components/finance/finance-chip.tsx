import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const financeChipVariants = cva(
  "inline-flex min-h-7 items-center rounded-[var(--fm-radius-chip)] border px-3 text-[11px] font-medium uppercase tracking-[0.06em]",
  {
    variants: {
      variant: {
        neutral: "border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] text-[var(--fm-warm-paper)]",
        income: "border-[var(--fm-income)]/30 bg-[var(--fm-income)]/15 text-[var(--fm-income)]",
        expense: "border-[var(--fm-expense)]/30 bg-[var(--fm-expense)]/15 text-[var(--fm-expense)]",
        transfer: "border-[var(--fm-transfer)]/30 bg-[var(--fm-transfer)]/15 text-[var(--fm-transfer)]",
        pending: "border-[var(--fm-pending)]/30 bg-[var(--fm-pending)]/15 text-[var(--fm-pending)]",
        household: "border-[var(--fm-account-wallet)]/30 bg-[var(--fm-account-wallet)]/15 text-[var(--fm-account-wallet)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

type FinanceChipProps = VariantProps<typeof financeChipVariants> & {
  children: React.ReactNode;
  className?: string;
};

export function FinanceChip({ variant, className, children }: FinanceChipProps) {
  return <span className={cn(financeChipVariants({ variant }), className)}>{children}</span>;
}