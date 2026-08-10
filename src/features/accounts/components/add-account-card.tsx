"use client";

import { Plus } from "lucide-react";

type AddAccountCardProps = {
  onClick: () => void;
};

/**
 * Slot fantasma (dashed) que cierra el inventario de cuentas.
 *
 * Deliberadamente compacto y horizontal: comparte el ancho de la grilla con las
 * cuentas, pero nunca su altura ni su presencia — no debe competir con una
 * cuenta que tiene dinero real. Reutiliza el radio de las cards
 * (--fm-radius-card-medium) para conservar la alineación.
 */
export function AddAccountCard({ onClick }: AddAccountCardProps) {
  return (
    <button
      aria-label="Agregar otra cuenta"
      className="group flex w-full cursor-pointer items-center gap-3.5 rounded-[var(--fm-radius-card-medium)] border border-dashed border-[var(--fm-border-dark)] bg-transparent px-5 py-4 text-left transition-colors duration-150 hover:border-[var(--fm-pending)]/45 hover:bg-white/[0.02] active:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
      onClick={onClick}
      type="button"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/8 text-[var(--fm-pending)] transition-colors group-hover:border-[var(--fm-pending)]/45">
        <Plus className="h-4 w-4" />
      </span>

      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[var(--fm-warm-paper)]">
          Agregar otra cuenta
        </span>
        <span className="block truncate text-xs text-[var(--fm-text-muted)]">
          Banco, billetera, efectivo o ahorro
        </span>
      </span>
    </button>
  );
}
