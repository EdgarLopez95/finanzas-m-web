"use client";

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { toneStyle, type MovementTone } from "./composer-primitives";

export type OperationKind = MovementTone;

export const OPERATION_CONTEXT_LINE: Record<OperationKind, string> = {
  expense: "Registrar una salida de dinero",
  income: "Registrar una entrada de dinero",
  transfer: "Mover dinero entre tus cuentas",
};

const OPERATIONS: { value: OperationKind; label: string; icon: typeof ArrowDownLeft }[] = [
  { value: "expense", label: "Gasto", icon: ArrowDownLeft },
  { value: "income", label: "Ingreso", icon: ArrowUpRight },
  { value: "transfer", label: "Transferencia", icon: ArrowLeftRight },
];

type OperationSelectorProps = {
  value: OperationKind;
  onChange: (next: OperationKind) => void;
  /** En edición la operación queda fija: el movimiento ya existe. */
  locked?: boolean;
  /**
   * Operaciones ofrecidas. Por defecto las tres del modelo anterior; Finanzas
   * M+ pasa solo `["expense", "income"]` porque la transferencia se retiró del
   * producto. La rejilla se ajusta al número de opciones para que los botones
   * conserven el mismo tamaño y separación.
   */
  operations?: readonly OperationKind[];
};

/**
 * Cabecera del composer: opciones del mismo tamaño y jerarquía neutral;
 * solo la activa toma el color semántico de su operación.
 */
export function OperationSelector({
  value,
  onChange,
  locked = false,
  operations,
}: OperationSelectorProps) {
  const visibleOperations = operations
    ? OPERATIONS.filter((operation) => operations.includes(operation.value))
    : OPERATIONS;

  return (
    <div
      role="radiogroup"
      aria-label="Tipo de movimiento"
      className={cn(
        "grid w-full gap-0.5 rounded-xl border border-white/5 bg-white/[0.02] p-1",
        visibleOperations.length === 2 ? "grid-cols-2" : "grid-cols-3",
      )}
    >
      {visibleOperations.map((operation) => {
        const isActive = operation.value === value;
        const Icon = operation.icon;
        return (
          <button
            key={operation.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={locked}
            onClick={() => {
              if (!locked) {
                onChange(operation.value);
              }
            }}
            style={toneStyle(operation.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold",
              "cursor-pointer select-none transition-all duration-150 outline-none",
              "focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklch,var(--tone)_50%,transparent)]",
              isActive
                ? "bg-[var(--tone)] font-bold text-slate-950 shadow-sm"
                : "text-[var(--fm-text-muted)] hover:bg-white/[0.04] hover:text-[var(--fm-warm-paper)]",
              locked && !isActive && "cursor-not-allowed opacity-30 hover:bg-transparent",
              locked && isActive && "cursor-default",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{operation.label}</span>
          </button>
        );
      })}
    </div>
  );
}
