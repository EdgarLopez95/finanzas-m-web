import type { ReactNode } from "react";

import { FinanceCard } from "@/components/finance/finance-card";
import { cn } from "@/lib/utils";

export type TransactionFormRenderMode = "card" | "panel" | "dialog";

type TransactionFormSurfaceProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  renderMode?: TransactionFormRenderMode;
  className?: string;
};

export function TransactionFormSurface({
  title,
  subtitle,
  children,
  renderMode = "card",
  className,
}: TransactionFormSurfaceProps) {
  if (renderMode === "card") {
    return (
      <FinanceCard title={title} subtitle={subtitle} variant="interactive">
        {children}
      </FinanceCard>
    );
  }

  return <section className={cn("space-y-4", className)}>{children}</section>;
}
