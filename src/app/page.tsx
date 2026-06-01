import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Amount } from "@/components/finance/amount";
import { FinanceCard } from "@/components/finance/finance-card";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-6 md:p-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--fm-sage)]">Finanzas M Web</p>
        <h1 className="text-3xl font-semibold text-[var(--fm-paper)] md:text-4xl">Setup inicial listo para crecer por features</h1>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <FinanceCard title="Balance estimado" subtitle="Placeholder visual de identidad">
          <Amount value={5234000} />
        </FinanceCard>
        <FinanceCard title="Navegacion" subtitle="Rutas base para la fase WEB-R">
          <div className="flex gap-3 text-sm">
            <Link className="inline-flex items-center gap-1 rounded-md border border-[var(--fm-gold)]/40 px-3 py-2 text-[var(--fm-paper)] hover:bg-[var(--fm-gold)]/10" href="/dashboard">
              Dashboard <ArrowRight className="size-4" />
            </Link>
            <Link className="inline-flex items-center gap-1 rounded-md border border-[var(--fm-sage)]/40 px-3 py-2 text-[var(--fm-paper)] hover:bg-[var(--fm-sage)]/10" href="/login">
              Login <ArrowRight className="size-4" />
            </Link>
          </div>
        </FinanceCard>
      </section>
    </main>
  );
}
