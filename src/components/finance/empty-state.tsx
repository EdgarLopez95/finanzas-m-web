type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <section className="w-full rounded-[var(--fm-radius-card-large)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)]/70 p-8 text-center flex flex-col items-center justify-center">
      <h2 className="text-2xl font-medium text-[var(--fm-warm-paper)]">{title}</h2>
      <p className="mt-2 text-sm text-[var(--fm-muted)] max-w-md">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 flex min-h-11 cursor-pointer items-center justify-center rounded-[18px] bg-[var(--fm-pending)] px-6 text-sm font-semibold text-[var(--fm-ink)] transition-colors hover:bg-[color-mix(in_oklch,var(--fm-pending),white_8%)]"
        >
          {actionLabel}
        </button>
      )}
    </section>
  );
}
