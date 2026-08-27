import React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { formatCurrencyCop } from "@/lib/format/currency";
import { cn } from "@/lib/utils";

/**
 * Monto del libro compartido. Espejo funcional de `Amount` (mismas variantes,
 * tamaños, signo y enmascarado) pero construido solo sobre roles `--hh-*`.
 *
 * `formatCurrencyCop` es formateo de moneda, no un componente visual, así que
 * se comparte sin romper la frontera.
 */
const householdAmountVariants = cva("font-semibold tabular-nums", {
  variants: {
    variant: {
      default: "text-[var(--hh-text)]",
      income: "text-[var(--hh-primary-action)]",
      expense: "text-[var(--hh-destructive-content)]",
      transfer: "text-[var(--hh-accent)]",
      pending: "text-[var(--hh-text-secondary)]",
      neutral: "text-[var(--hh-text-muted)]",
    },
    size: {
      display: "text-[64px] leading-[0.98] tracking-[-0.05em]",
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

type HouseholdAmountProps = VariantProps<typeof householdAmountVariants> & {
  value: number;
  className?: string;
  showSign?: boolean;
};

const typePrefix: Record<string, string> = {
  income: "+ ",
  expense: "- ",
  transfer: "→ ",
};

export function HouseholdAmount({
  value,
  variant = "default",
  size = "md",
  className,
  showSign = true,
}: HouseholdAmountProps) {
  const prefix = showSign ? (variant ? typePrefix[variant] ?? "" : "") : "";
  const normalizedValue = showSign && prefix ? Math.abs(value) : value;

  return (
    <p className={cn(householdAmountVariants({ variant, size }), className)}>
      {`${prefix}${formatCurrencyCop(normalizedValue)}`}
    </p>
  );
}
