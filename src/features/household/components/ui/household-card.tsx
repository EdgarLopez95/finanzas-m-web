import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const householdCardVariants = cva("ring-0 ring-transparent outline-none overflow-hidden text-[var(--hh-text)]", {
  variants: {
    variant: {
      default: "rounded-[20px] border border-[var(--hh-border)] bg-[var(--hh-surface)]",
      elevated: "rounded-[24px] border border-[var(--hh-border-strong)] bg-[var(--hh-surface-elevated)] shadow-[var(--hh-shadow-soft)]",
      interactive: "rounded-[24px] border border-[var(--hh-border-strong)] bg-[var(--hh-surface-elevated)] transition-transform hover:-translate-y-0.5 shadow-[var(--hh-shadow-soft)]",
      /** Bloque principal del libro compartido (resumen/espera). */
      hero: "rounded-[32px] border border-[var(--hh-border-strong)] bg-[linear-gradient(180deg,var(--hh-surface-elevated),var(--hh-surface))] shadow-[var(--hh-shadow-hero)]",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type HouseholdCardProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof householdCardVariants> & {
    title?: string;
    subtitle?: string;
    headerRight?: React.ReactNode;
    children: React.ReactNode;
  };

export function HouseholdCard({ title, subtitle, headerRight, children, className, variant, ...props }: HouseholdCardProps) {
  return (
    <section className={cn(householdCardVariants({ variant }), className)} {...props}>
      {title || subtitle || headerRight ? (
        <header className="grid grid-cols-[1fr_auto] items-start gap-2 p-6 pb-0">
          <div>
            {title ? <h3 className="text-[22px] font-semibold tracking-tight">{title}</h3> : null}
            {subtitle ? <p className="text-[14px] text-[var(--hh-text-secondary)]">{subtitle}</p> : null}
          </div>
          {headerRight ? <div>{headerRight}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-6", (title || subtitle || headerRight) && "pt-6")}>{children}</div>
    </section>
  );
}
