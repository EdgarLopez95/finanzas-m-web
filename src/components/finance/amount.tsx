import { cva, type VariantProps } from "class-variance-authority";

import { formatCurrencyCop } from "@/lib/format/currency";
import { cn } from "@/lib/utils";

const amountVariants = cva("font-semibold tabular-nums", {
  variants: {
    variant: {
      default: "text-[var(--fm-warm-paper)]",
      income: "text-[var(--fm-income)]",
      expense: "text-[var(--fm-expense)]",
      transfer: "text-[var(--fm-transfer)]",
      pending: "text-[var(--fm-pending)]",
      neutral: "text-[var(--fm-neutral)]",
    },
    size: {
      hero: "text-[48px] leading-[1.05] tracking-[-0.02em]",
      lg: "text-[32px] leading-[1.2] tracking-[-0.01em]",
      md: "text-[22px] leading-[1.25]",
      sm: "text-[14px] leading-[1.4]",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

type AmountProps = VariantProps<typeof amountVariants> & {
  value: number;
  className?: string;
  showSign?: boolean;
};

const typePrefix: Record<string, string> = {
  income: "+ ",
  expense: "- ",
  transfer: "\u2192 ",
};

export function Amount({ value, variant = "default", size = "md", className, showSign = true }: AmountProps) {
  const prefix = showSign ? (variant ? typePrefix[variant] ?? "" : "") : "";

  return <p className={cn(amountVariants({ variant, size }), className)}>{`${prefix}${formatCurrencyCop(Math.abs(value))}`}</p>;
}
