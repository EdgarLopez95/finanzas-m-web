type TopBarProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <header className="border-b border-[rgba(148,163,184,0.12)] bg-[rgba(9,14,24,0.92)] px-4 py-4 backdrop-blur-xl md:px-6 lg:px-8">
      <div className="flex min-h-[3.75rem] flex-col gap-4 lg:min-h-[4.25rem] lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-0.5">
          <h1 className="font-[var(--font-display)] text-[2rem] font-semibold tracking-[-0.04em] text-[var(--fm-warm-paper)] lg:text-[2.15rem]">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-[var(--fm-text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
