"use client";

import Link from "next/link";

import { useAuthBootstrap } from "@/features/auth/use-auth-bootstrap";

export function Sidebar() {
  const { status } = useAuthBootstrap();
  const isAuthenticated = status === "authenticated";

  return (
    <aside className="rounded-2xl border border-white/10 bg-[var(--fm-navy-soft)]/80 p-4">
      <p className="text-sm uppercase tracking-[0.2em] text-[var(--fm-sage)]">Finanzas M</p>
      <nav className="mt-4 flex flex-col gap-2 text-sm text-[var(--fm-paper)]">
        <Link href="/dashboard">Dashboard</Link>
        {!isAuthenticated ? <Link href="/login">Login</Link> : null}
      </nav>
    </aside>
  );
}