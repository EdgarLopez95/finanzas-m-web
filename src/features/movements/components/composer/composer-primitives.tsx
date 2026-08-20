"use client";

import type { CSSProperties, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

import { FinanceButton } from "@/components/finance/finance-button";
import { cn } from "@/lib/utils";

export type MovementTone = "expense" | "income" | "transfer";

const TONE_VAR: Record<MovementTone, string> = {
  expense: "var(--fm-expense)",
  income: "var(--fm-income)",
  transfer: "var(--fm-transfer)",
};

export function toneStyle(tone: MovementTone): CSSProperties {
  return { "--tone": TONE_VAR[tone] } as CSSProperties;
}

export const formatAmountInput = (rawValue: string): string => {
  const clean = rawValue.replace(/\D/g, "");
  if (!clean) return "";
  const formattedEn = Number(clean).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
  return formattedEn.replace(/,/g, ".");
};

export const parseAmountInput = (value: string): number => Number(value.replace(/\./g, ""));

export const composerControlClass = cn(
  "h-11 w-full rounded-xl border border-white/8 bg-white/[0.02] px-3.5 text-sm text-[var(--fm-warm-paper)]",
  "outline-none transition-all placeholder:text-white/[0.12]",
  "hover:bg-white/[0.04]",
  "focus-visible:border-[color-mix(in_oklch,var(--tone)_55%,transparent)]",
  "focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklch,var(--tone)_26%,transparent)]",
);

export const composerControlErrorClass = "border-[var(--fm-expense)]/45";

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) {
    return null;
  }
  return (
    <p
      id={id}
      className="flex items-start gap-1.5 text-[11px] font-medium leading-snug text-[var(--fm-expense)] animate-in fade-in duration-150"
    >
      <AlertCircle className="mt-[1px] h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

type ComposerFieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  className?: string;
  children: ReactNode;
};

export function ComposerField({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
}: ComposerFieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-baseline gap-1.5">
        <label
          htmlFor={htmlFor}
          className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
        >
          {label}
        </label>
        {required ? (
          <span className="text-[10px] font-medium tracking-normal text-[var(--fm-text-muted)]">
            (obligatorio)
          </span>
        ) : null}
      </div>
      {children}
      {hint && !error ? (
        <p className="text-[11px] leading-snug text-[var(--fm-text-muted)]">{hint}</p>
      ) : null}
      <FieldError id={htmlFor ? `${htmlFor}-error` : undefined}>{error}</FieldError>
    </div>
  );
}

type AmountFieldProps = {
  id: string;
  label: string;
  ariaLabel: string;
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  icon: ReactNode;
  error?: string | null;
  autoFocus?: boolean;
  compact?: boolean;
};

export function AmountField({
  id,
  label,
  ariaLabel,
  value,
  onChange,
  onBlur,
  icon,
  error,
  autoFocus,
  compact = false,
}: AmountFieldProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-colors duration-200",
        "bg-[color-mix(in_oklch,var(--tone)_4%,transparent)]",
        error
          ? "border-[var(--fm-expense)]/45"
          : "border-[color-mix(in_oklch,var(--tone)_14%,transparent)]",
        "focus-within:border-[color-mix(in_oklch,var(--tone)_45%,transparent)]",
        "focus-within:bg-[color-mix(in_oklch,var(--tone)_7%,transparent)]",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--tone)_16%,transparent)] text-[var(--tone)]">
          {icon}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fm-text-muted)]">
          {label}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          aria-hidden="true"
          className={cn(
            "select-none font-light text-[var(--fm-text-muted)]",
            compact ? "text-xl" : "text-2xl",
          )}
        >
          $
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="0"
          autoFocus={autoFocus}
          data-finance-dialog-initial-focus={autoFocus ? "true" : undefined}
          value={value}
          onChange={(event) => onChange(formatAmountInput(event.target.value))}
          onBlur={onBlur}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "w-full min-w-0 border-none bg-transparent p-0 font-bold tracking-tight",
            "text-[var(--fm-warm-paper)] outline-none placeholder:text-white/[0.08] focus:ring-0",
            compact ? "text-[30px] leading-none" : "text-[38px] leading-none",
          )}
        />
      </div>

      {error ? (
        <div className="mt-2">
          <FieldError id={`${id}-error`}>{error}</FieldError>
        </div>
      ) : null}
    </div>
  );
}

type ToggleRowProps = {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  children?: ReactNode;
  disabled?: boolean;
};

export function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
  children,
  disabled = false,
}: ToggleRowProps) {
  const descriptionId = `${id}-description`;
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3",
        disabled && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--fm-warm-paper)]">{title}</p>
          <p id={descriptionId} className="mt-0.5 text-[11px] leading-snug text-[var(--fm-text-muted)]">
            {description}
          </p>
        </div>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={descriptionId}
          aria-label={title}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative mt-0.5 inline-flex h-5 w-9 shrink-0 select-none rounded-full",
            "border-2 border-transparent transition-colors duration-200 ease-in-out",
            "outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklch,var(--tone)_45%,transparent)]",
            disabled ? "cursor-not-allowed" : "cursor-pointer",
            checked ? "bg-[var(--tone)]" : "bg-white/10",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0",
              "transition duration-200 ease-in-out",
              checked ? "translate-x-4" : "translate-x-0",
            )}
          />
        </button>
      </div>
      {children ? (
        <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-150">{children}</div>
      ) : null}
    </div>
  );
}

export function HelperText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] leading-relaxed text-[var(--fm-text-muted)]", className)}>
      {children}
    </p>
  );
}

export type ComposerFooterProps = {
  message?: string | null;
  messageTone?: "muted" | "danger";
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  disabled: boolean;
  onCancel?: () => void;
};

export function ComposerFooter({
  message,
  messageTone = "muted",
  submitLabel,
  submittingLabel,
  isSubmitting,
  disabled,
  onCancel,
}: ComposerFooterProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p
        aria-live="polite"
        className={cn(
          "min-h-[16px] text-[11px] font-medium leading-snug",
          messageTone === "danger" ? "text-[var(--fm-expense)]" : "text-[var(--fm-text-muted)]",
        )}
      >
        {message ?? ""}
      </p>

      <div className="flex items-center justify-end gap-2.5">
        {onCancel ? (
          <FinanceButton
            type="button"
            tone="outlined"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="cursor-pointer select-none rounded-xl px-4"
          >
            Cancelar
          </FinanceButton>
        ) : null}
        <FinanceButton
          type="submit"
          tone="filled"
          disabled={disabled || isSubmitting}
          aria-busy={isSubmitting}
          className={cn(
            "cursor-pointer select-none rounded-xl px-5",
            !disabled && !isSubmitting
              ? "bg-[var(--tone)] font-bold text-slate-950 shadow-[0_12px_28px_color-mix(in_oklch,var(--tone)_22%,transparent)] hover:bg-[color-mix(in_oklch,var(--tone),white_8%)]"
              : "cursor-not-allowed border border-white/5 bg-white/[0.03] text-white/25",
          )}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
              {submittingLabel}
            </span>
          ) : (
            submitLabel
          )}
        </FinanceButton>
      </div>
    </div>
  );
}

export function ComposerFeedback({
  error,
  successMessage,
}: {
  error?: string | null;
  successMessage?: string | null;
}) {
  if (!error && !successMessage) {
    return null;
  }
  return (
    <div className="space-y-2">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.08)] px-3.5 py-2.5 text-sm text-[var(--fm-expense)]"
        >
          {error}
        </p>
      ) : null}
      {successMessage ? (
        <p
          role="status"
          className="rounded-xl border border-[rgba(74,222,128,0.16)] bg-[rgba(74,222,128,0.08)] px-3.5 py-2.5 text-sm text-[var(--fm-income)]"
        >
          {successMessage}
        </p>
      ) : null}
    </div>
  );
}
