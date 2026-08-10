type HouseholdEmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function HouseholdEmptyState({ title, description, actionLabel, onAction }: HouseholdEmptyStateProps) {
  return (
    <section className="w-full rounded-[24px] border border-[var(--hh-border)] bg-[var(--hh-surface)] p-8 text-center flex flex-col items-center justify-center">
      <h2 className="text-2xl font-medium text-[var(--hh-text)]">{title}</h2>
      <p className="mt-2 text-sm text-[var(--hh-text-muted)] max-w-md">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 flex min-h-11 cursor-pointer items-center justify-center rounded-[18px] bg-[var(--hh-primary-action)] px-6 text-sm font-semibold text-[var(--hh-on-primary)] transition-colors hover:bg-[color-mix(in_oklch,var(--hh-primary-action),white_8%)] focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)] outline-none"
        >
          {actionLabel}
        </button>
      )}
    </section>
  );
}
