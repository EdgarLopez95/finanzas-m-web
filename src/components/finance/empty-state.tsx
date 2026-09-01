type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  children?: React.ReactNode;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  children,
}: EmptyStateProps) {
  return (
    <section className="w-full rounded-[var(--fm-radius-card-large)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)]/70 p-8 text-center flex flex-col items-center justify-center">
      <h2 className="text-2xl font-medium text-[var(--fm-warm-paper)]">{title}</h2>
      <p className="mt-2 text-sm text-[var(--fm-muted)] max-w-md">{description}</p>
      {((actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) || children) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="flex min-h-11 cursor-pointer items-center justify-center rounded-[18px] border border-[var(--fm-border-dark)] bg-white/[0.04] px-6 text-sm font-semibold text-[var(--fm-text-soft)] transition-colors hover:bg-white/[0.08]"
            >
              {secondaryActionLabel}
            </button>
          )}
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="flex min-h-11 cursor-pointer items-center justify-center rounded-[18px] bg-[var(--fm-pending)] px-6 text-sm font-semibold text-[var(--fm-ink)] transition-colors hover:bg-[color-mix(in_oklch,var(--fm-pending),white_8%)]"
            >
              {actionLabel}
            </button>
          )}
          {children}
        </div>
      )}
    </section>
  );
}
