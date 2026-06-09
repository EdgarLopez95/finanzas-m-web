type TopBarProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <header className="rounded-[30px] border border-white/8 bg-[var(--fm-shell-topbar)] px-5 py-4 shadow-[var(--fm-shadow-soft)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <h1 className="font-[var(--font-display)] text-[30px] font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-[var(--fm-text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
