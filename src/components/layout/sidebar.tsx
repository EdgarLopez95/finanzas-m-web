import Link from "next/link";

export function Sidebar() {
  return (
    <aside className="rounded-2xl border border-white/10 bg-[var(--fm-navy-soft)]/80 p-4">
      <p className="text-sm uppercase tracking-[0.2em] text-[var(--fm-sage)]">Finanzas M</p>
      <nav className="mt-4 flex flex-col gap-2 text-sm text-[var(--fm-paper)]">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/login">Login</Link>
      </nav>
    </aside>
  );
}
