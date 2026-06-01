import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const financeButtonVariants = cva("rounded-[var(--fm-radius-button)]", {
  variants: {
    tone: {
      filled: "bg-[var(--fm-primary)] text-[var(--fm-warm-paper)] hover:bg-[color-mix(in_oklch,var(--fm-primary),white_8%)]",
      outlined: "border-[var(--fm-border-dark)] bg-transparent text-[var(--fm-warm-paper)] hover:bg-[var(--fm-surface-dark-alt)]",
      text: "border-transparent bg-transparent text-[var(--fm-warm-paper)] hover:bg-[var(--fm-surface-dark-alt)]",
      destructive: "bg-[var(--fm-expense)] text-[var(--fm-warm-paper)] hover:bg-[color-mix(in_oklch,var(--fm-expense),black_8%)]",
    },
  },
  defaultVariants: {
    tone: "filled",
  },
});

type FinanceButtonProps = React.ComponentProps<typeof Button> &
  VariantProps<typeof financeButtonVariants> & {
    variant?: React.ComponentProps<typeof Button>["variant"];
    size?: React.ComponentProps<typeof Button>["size"];
  };

export function FinanceButton({ className, tone, variant = "default", size = "default", ...props }: FinanceButtonProps) {
  return <Button className={cn(financeButtonVariants({ tone }), className)} variant={variant} size={size} {...props} />;
}
