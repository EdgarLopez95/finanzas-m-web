export function TopBar({ title }: { title: string }) {
  return (
    <header className="rounded-2xl border border-white/10 bg-[var(--fm-navy-soft)]/80 px-4 py-3">
      <h1 className="text-xl font-medium text-[var(--fm-paper)]">{title}</h1>
    </header>
  );
}
