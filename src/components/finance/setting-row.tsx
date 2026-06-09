type SettingRowProps = {
  title: string;
  description: string;
  action: React.ReactNode;
};

export function SettingRow({ title, description, action }: SettingRowProps) {
  return (
    <div className="flex flex-col gap-4 border-t border-white/8 py-5 first:border-t-0 first:pt-0 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <p className="font-[var(--font-display)] text-xl font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
          {title}
        </p>
        <p className="text-sm text-[var(--fm-text-muted)]">
          {description}
        </p>
      </div>
      <div>{action}</div>
    </div>
  );
}
