import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const householdButtonVariants = cva("rounded-[16px]", {
  variants: {
    tone: {
      filled: "bg-[var(--hh-primary-action)] text-[var(--hh-on-primary)] hover:bg-[color-mix(in_oklch,var(--hh-primary-action),white_8%)]",
      outlined: "border-[var(--hh-border)] bg-transparent text-[var(--hh-text)] hover:bg-[var(--hh-surface-elevated)]",
      text: "border-transparent bg-transparent text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-elevated)] hover:text-[var(--hh-text)]",
      destructive: "bg-[var(--hh-destructive-border)] text-[var(--hh-on-primary)] hover:bg-[color-mix(in_oklch,var(--hh-destructive-border),var(--hh-background-dark)_8%)]",
    },
  },
});

type HouseholdButtonProps = React.ComponentProps<typeof Button> &
  VariantProps<typeof householdButtonVariants> & {
    variant?: React.ComponentProps<typeof Button>["variant"];
    size?: React.ComponentProps<typeof Button>["size"];
  };

export function HouseholdButton({
  className,
  tone,
  variant = "default",
  size = "default",
  ...props
}: HouseholdButtonProps) {
  const resolvedTone =
    tone ??
    (variant === "ghost" || variant === "link"
      ? "text"
      : variant === "outline"
      ? "outlined"
      : variant === "destructive"
      ? "destructive"
      : "filled");

  return (
    <Button
      className={cn(householdButtonVariants({ tone: resolvedTone }), className)}
      variant={variant}
      size={size}
      {...props}
    />
  );
}
