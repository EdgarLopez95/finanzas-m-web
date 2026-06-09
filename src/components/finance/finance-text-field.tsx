import * as React from "react";

import { cn } from "@/lib/utils";

type FinanceTextFieldProps = Omit<React.ComponentProps<"input">, "size"> & {
  label?: string;
  labelClassName?: string;
  helperText?: string;
  errorText?: string;
  containerClassName?: string;
};

export const FinanceTextField = React.forwardRef<HTMLInputElement, FinanceTextFieldProps>(function FinanceTextField(
  { label, labelClassName, helperText, errorText, className, containerClassName, id, ...props },
  ref
) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const helperId = helperText ? `${inputId}-helper` : undefined;
  const errorId = errorText ? `${inputId}-error` : undefined;

  return (
    <div className={cn("flex flex-col gap-2", containerClassName)}>
      {label ? (
        <label className={cn("text-[14px] font-medium text-[var(--fm-warm-paper)]", labelClassName)} htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "h-11 rounded-[var(--fm-radius-input)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[14px] text-[var(--fm-warm-paper)] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]",
          errorText && "border-[var(--fm-expense)] focus-visible:ring-[var(--fm-expense)]",
          className
        )}
        aria-invalid={Boolean(errorText)}
        aria-describedby={[helperId, errorId].filter(Boolean).join(" ") || undefined}
        {...props}
      />
      {errorText ? (
        <p id={errorId} className="text-[12px] text-[var(--fm-expense)]" role="alert">
          {errorText}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-[12px] text-muted-foreground">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
