"use client";

import { use, useMemo } from "react";
import Link from "next/link";

import { MplusAccountDetailView } from "@/features/accounts/components/mplus-account-detail-view";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

/**
 * Detalle de cuenta como pantalla propia: enlazable, recargable y navegable
 * con el botón atrás. Acepta cuentas archivadas — es donde vive "Reactivar".
 */
export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const accounts = useMplusPersonalStore((state) => state.accounts);
  const status = useMplusPersonalStore((state) => state.status);

  const account = useMemo(
    () => accounts.find((item) => item.id === accountId) ?? null,
    [accounts, accountId],
  );

  // "Todavía no cargó" y "no existe" son estados DISTINTOS: con la lista aún
  // vacía, afirmar "no encontramos esta cuenta" sería una mentira momentánea.
  if (!account && status !== "success") {
    return (
      <div className="rounded-[28px] border border-white/8 bg-[rgba(18,25,39,0.96)] px-6 py-10 text-center">
        <p className="text-sm text-[var(--fm-text-muted)]" role="status">
          Cargando cuenta…
        </p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="rounded-[28px] border border-white/8 bg-[rgba(18,25,39,0.96)] px-6 py-10 text-center">
        <p className="text-sm text-[var(--fm-text-muted)]">
          No encontramos esta cuenta. Puede que la hayas eliminado.
        </p>
        <Link
          href="/accounts"
          className="mt-4 inline-flex rounded-xl px-3 py-2 text-sm font-semibold text-[var(--fm-pending)] transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
        >
          Volver a Cuentas
        </Link>
      </div>
    );
  }

  return <MplusAccountDetailView account={account} />;
}
