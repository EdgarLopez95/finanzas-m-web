"use client";

import { Plus } from "lucide-react";

type AddAccountCardProps = {
  onClick: () => void;
};

/**
 * Card fantasma (dashed) que se muestra como un item más del grid de cuentas.
 * Reutiliza el radio de las cards de cuenta (--fm-radius-card-medium) y tokens
 * del design system para mantener la alineación y el look premium en oscuro.
 */
export function AddAccountCard({ onClick }: AddAccountCardProps) {
  return (
    <button
      aria-label="Crear nueva cuenta"
      className="group flex h-full min-h-[150px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--fm-radius-card-medium)] border-2 border-dashed border-[var(--fm-border-dark)] bg-transparent p-6 text-center transition-colors hover:border-[var(--fm-pending)]/55 hover:bg-[var(--fm-surface-dark)]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fm-shell-base,transparent)]"
      onClick={onClick}
      type="button"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/8 bg-[var(--fm-surface-dark-alt)] text-[var(--fm-pending)] transition-colors group-hover:border-[var(--fm-pending)]/45">
        <Plus className="h-5 w-5" />
      </span>

      <span className="space-y-1">
        <span className="block font-[var(--font-display)] text-lg font-semibold tracking-[-0.02em] text-[var(--fm-warm-paper)]">
          Nueva cuenta
        </span>
        <span className="block text-sm text-[var(--fm-text-muted)]">
          Banco, billetera, efectivo o ahorro
        </span>
      </span>
    </button>
  );
}
