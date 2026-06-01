type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section className="w-full rounded-[var(--fm-radius-card-large)] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)]/70 p-8 text-center">
      <h2 className="text-2xl font-medium text-[var(--fm-warm-paper)]">{title}</h2>
      <p className="mt-2 text-sm text-[var(--fm-muted)]">{description}</p>
    </section>
  );
}
