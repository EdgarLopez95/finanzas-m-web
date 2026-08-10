import * as React from "react";
import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Campo de texto del kit Hogar. Espejo funcional de `FinanceTextField` pero
 * construido exclusivamente sobre roles `--hh-*`: ningún hex, `rgba()`, `rgb()`
 * ni token `--fm-*` vive aquí.
 */
type HouseholdTextFieldProps = React.ComponentProps<"input"> & {
  label?: string;
  helperText?: string;
  errorText?: string;
};

export function HouseholdTextField({
  label,
  helperText,
  errorText,
  className,
  id,
  ...props
}: HouseholdTextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const describedBy = errorText ? errorId : helperText ? helperId : undefined;

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <label className="text-[14px] font-medium text-[var(--hh-text)]" htmlFor={inputId}>
          {label}
        </label>
      ) : null}

      <input
        aria-describedby={describedBy}
        aria-invalid={errorText ? true : undefined}
        className={cn(
          "min-h-11 w-full rounded-[16px] border bg-[var(--hh-surface)] px-4 text-[16px] text-[var(--hh-text)] outline-none transition-colors sm:text-[14px]",
          "placeholder:text-[var(--hh-text-muted)]",
          "focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]",
          "disabled:opacity-50",
          errorText ? "border-[var(--hh-destructive-border)]" : "border-[var(--hh-border)]",
          className
        )}
        id={inputId}
        {...props}
      />

      {errorText ? (
        <p className="text-[12px] text-[var(--hh-destructive-content)]" id={errorId} role="alert">
          {errorText}
        </p>
      ) : helperText ? (
        <p className="text-[12px] text-[var(--hh-text-muted)]" id={helperId}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
