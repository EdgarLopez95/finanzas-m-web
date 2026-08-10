import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const householdChipVariants = cva(
  "inline-flex min-h-7 items-center rounded-[12px] border px-3 text-[11px] font-medium uppercase tracking-[0.06em]",
  {
    variants: {
      variant: {
        neutral: "border-[var(--hh-border)] bg-[var(--hh-surface-elevated)] text-[var(--hh-text)]",
        primary: "border-[var(--hh-primary)]/30 bg-[var(--hh-primary)]/15 text-[var(--hh-primary-action)]",
        /** Identidad del libro compartido (evento activo). */
        household: "border-[var(--hh-accent)]/40 bg-[var(--hh-accent)]/15 text-[var(--hh-primary-action)]",
        /** Aporte/estado completado dentro del libro compartido. */
        income: "border-[var(--hh-primary-action)]/40 bg-[var(--hh-primary-action)]/15 text-[var(--hh-primary-action)]",
        /** Aporte/estado pendiente dentro del libro compartido. */
        pending: "border-[var(--hh-border-strong)] bg-[var(--hh-surface-elevated)] text-[var(--hh-text-secondary)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

type HouseholdChipProps = VariantProps<typeof householdChipVariants> & {
  children: React.ReactNode;
  className?: string;
};

export function HouseholdChip({ variant, className, children }: HouseholdChipProps) {
  return <span className={cn(householdChipVariants({ variant }), className)}>{children}</span>;
}
