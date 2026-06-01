import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const financeCardVariants = cva("border ring-0", {
  variants: {
    variant: {
      default: "rounded-[var(--fm-radius-card-medium)] border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark)]",
      elevated: "rounded-[var(--fm-radius-card-large)] border-[var(--fm-divider-dark)] bg-[var(--fm-surface-dark-alt)] shadow-[0_12px_30px_rgb(0_0_0/0.25)]",
      hero: "rounded-[var(--fm-radius-hero)] border-[var(--fm-divider-dark)] bg-[linear-gradient(165deg,var(--fm-hero-surface),var(--fm-hero-base))] shadow-[0_20px_50px_rgb(0_0_0/0.35)]",
      interactive: "rounded-[var(--fm-radius-card-large)] border-[var(--fm-divider-dark)] bg-[var(--fm-surface-dark-alt)] transition-transform hover:-translate-y-0.5",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type FinanceCardProps = React.ComponentProps<typeof Card> &
  VariantProps<typeof financeCardVariants> & {
    title?: string;
    subtitle?: string;
    headerRight?: React.ReactNode;
    children: React.ReactNode;
  };

export function FinanceCard({ title, subtitle, headerRight, children, className, variant, ...props }: FinanceCardProps) {
  return (
    <Card className={cn(financeCardVariants({ variant }), className)} {...props}>
      {title || subtitle || headerRight ? (
        <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-2">
          <div>
            {title ? <CardTitle className="text-[22px] font-semibold text-[var(--fm-warm-paper)]">{title}</CardTitle> : null}
            {subtitle ? <CardDescription className="text-[14px] text-muted-foreground">{subtitle}</CardDescription> : null}
          </div>
          {headerRight ? <div>{headerRight}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent>{children}</CardContent>
    </Card>
  );
}