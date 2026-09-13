"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  CheckCircle2,
  Minus,
  Plus,
  RotateCcw,
  Scale,
  Users,
  X,
} from "lucide-react";

import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { useFocusTrap } from "@/features/household/hooks/use-focus-trap";
import { formatCurrencyCop } from "@/lib/format/currency";
import type { HouseholdExpenseDistributionMode } from "@/lib/mplus/enums";

export interface HouseholdExpenseDistributionDialogProps {
  open: boolean;
  totalAmount: number;
  memberAName: string;
  memberBName: string;
  memberAId: string;
  memberBId: string;
  currentUid?: string | null;
  initialDistributionMode?: HouseholdExpenseDistributionMode;
  initialMemberAAmount?: number;
  initialMemberBAmount?: number;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onConfirm: (result: {
    distributionMode: HouseholdExpenseDistributionMode;
    memberAAmount: number;
    memberBAmount: number;
  }) => void;
  onCancel: () => void;
}

/** Formatea dígitos con separador de miles en punto (ej. 70000 -> "70.000") */
function formatNumberWithDots(val: number): string {
  if (val <= 0) return "";
  const formattedEn = Math.round(val).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
  return formattedEn.replace(/,/g, ".");
}

/**
 * Diálogo interactivo de distribución para gastos originados en Hogar.
 *
 * Principios UX/UI:
 * - Auto-balanceo dinámico de suma cero: el total se preserva automáticamente al editar cualquier lado.
 * - Sin spinners nativos de navegador; inputs monetarios formateados con puntos de miles.
 * - Barra de proporción visual y slider de rango táctil interactivo.
 * - Presets de un toque (50/50, 100% Tú, 100% Pareja).
 * - Botones de micro-ajuste (+ / -) con paso adaptativo en COP.
 */
export function HouseholdExpenseDistributionDialog({
  open,
  totalAmount,
  memberAName,
  memberBName,
  memberAId,
  memberBId,
  currentUid = null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  initialDistributionMode = "equal",
  initialMemberAAmount,
  initialMemberBAmount,
  isSubmitting,
  errorMessage,
  onConfirm,
  onCancel,
}: HouseholdExpenseDistributionDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const equalA = Math.ceil(totalAmount / 2);
  const equalB = Math.floor(totalAmount / 2);

  const [memberAAmount, setMemberAAmount] = useState(equalA);
  const [memberBAmount, setMemberBAmount] = useState(equalB);

  // Inicialización y sincronización cuando abre o cambia totalAmount
  useEffect(() => {
    if (!open) return;
    if (
      initialMemberAAmount !== undefined &&
      initialMemberBAmount !== undefined &&
      initialMemberAAmount + initialMemberBAmount === totalAmount
    ) {
      setMemberAAmount(initialMemberAAmount);
      setMemberBAmount(initialMemberBAmount);
    } else {
      setMemberAAmount(equalA);
      setMemberBAmount(equalB);
    }
  }, [open, totalAmount, initialMemberAAmount, initialMemberBAmount, equalA, equalB]);

  useFocusTrap(panelRef, open, onCancel);

  // Cálculo de paso adaptativo (COP)
  const step = totalAmount >= 100_000 ? 5_000 : totalAmount >= 20_000 ? 2_000 : 1_000;

  // Auto-balanceo bidireccional de suma cero
  const updateFromA = (newA: number) => {
    const clampedA = Math.min(Math.max(0, Math.round(newA)), totalAmount);
    const clampedB = totalAmount - clampedA;
    setMemberAAmount(clampedA);
    setMemberBAmount(clampedB);
  };

  const updateFromB = (newB: number) => {
    const clampedB = Math.min(Math.max(0, Math.round(newB)), totalAmount);
    const clampedA = totalAmount - clampedB;
    setMemberAAmount(clampedA);
    setMemberBAmount(clampedB);
  };

  const handleResetToEqual = () => {
    setMemberAAmount(equalA);
    setMemberBAmount(equalB);
  };

  // Porcentajes
  const percentA = totalAmount > 0 ? Math.round((memberAAmount / totalAmount) * 100) : 50;
  const percentB = 100 - percentA;

  // Detección de presets activos
  const is5050 = memberAAmount === equalA && memberBAmount === equalB;
  const isAllA = memberAAmount === totalAmount && memberBAmount === 0;
  const isAllB = memberBAmount === totalAmount && memberAAmount === 0;

  const isMemberACurrentUser = memberAId === currentUid;
  const isMemberBCurrentUser = memberBId === currentUid;

  // Nombres cortos para presets
  const shortNameA = isMemberACurrentUser ? "Tú" : memberAName.split(" ")[0];
  const shortNameB = isMemberBCurrentUser ? "Tú" : memberBName.split(" ")[0];

  const handleConfirm = () => {
    if (isSubmitting || totalAmount <= 0) return;
    onConfirm({
      distributionMode: is5050 ? "equal" : "custom",
      memberAAmount,
      memberBAmount,
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-[var(--hh-overlay)] px-4 py-6 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onCancel();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="w-full max-w-sm rounded-[24px] border border-[var(--hh-border)] bg-[linear-gradient(180deg,var(--hh-surface-elevated),var(--hh-surface))] p-5 shadow-[var(--hh-shadow)] outline-none animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-4 text-[var(--hh-text)]"
      >
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--hh-primary-action)]/15 text-[var(--hh-primary-action)]">
              <Users className="h-5 w-5" />
            </span>
            <div className="flex flex-col min-w-0">
              <h2
                id={titleId}
                className="font-[var(--font-display)] text-[16px] sm:text-[18px] font-bold tracking-[-0.01em] text-[var(--hh-text)] leading-tight"
              >
                Distribución del gasto
              </h2>
              <p id={descriptionId} className="text-xs text-[var(--hh-text-muted)] leading-tight mt-0.5">
                Total a repartir:{" "}
                <span className="font-semibold text-[var(--hh-text)] font-mono">
                  {formatCurrencyCop(totalAmount)}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Cerrar"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--hh-text-muted)] hover:text-[var(--hh-text)] hover:bg-[var(--hh-surface-subtle)] transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Visualizador de Proporción y Slider Interactivo Unificado */}
        <div className="rounded-[18px] border border-[var(--hh-border-soft)] bg-[var(--hh-surface-subtle)]/30 p-3.5 flex flex-col gap-2.5">
          {/* Etiquetas de porcentaje */}
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="flex items-center gap-1.5 truncate max-w-[48%]">
              <span className="h-2 w-2 rounded-full bg-[var(--hh-primary-action)] shrink-0" />
              <span className="truncate text-[var(--hh-text)] font-semibold">{shortNameA}</span>
              <span className="font-bold text-[var(--hh-primary-action)] font-mono">{percentA}%</span>
            </span>
            <span className="flex items-center gap-1.5 justify-end truncate max-w-[48%]">
              <span className="font-bold text-[#629B8C] font-mono">{percentB}%</span>
              <span className="truncate text-[var(--hh-text)] font-semibold">{shortNameB}</span>
              <span className="h-2 w-2 rounded-full bg-[#336154] shrink-0" />
            </span>
          </div>

          {/* Pista Interactiva Unificada (Barra + Deslizador en una sola pieza) */}
          <div className="relative flex items-center py-2 group select-none">
            {/* Pista con división de colores dual */}
            <div className="h-3 w-full overflow-hidden rounded-full border border-[var(--hh-border-soft)] bg-[var(--hh-surface-subtle)] flex shadow-inner">
              <div
                className="h-full bg-[var(--hh-primary-action)] transition-[width] duration-75 ease-out"
                style={{ width: `${percentA}%` }}
              />
              <div
                className="h-full bg-[#2A5246] transition-[width] duration-75 ease-out"
                style={{ width: `${percentB}%` }}
              />
            </div>

            {/* Selector interactivo centrado exactamente en la división de los dos colores */}
            <div
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-5 rounded-full bg-white shadow-md border-2 border-[var(--hh-primary-action)] flex items-center justify-center transition-[left,transform] duration-75 ease-out group-hover:scale-110 group-active:scale-95"
              style={{ left: `${percentA}%` }}
            >
              <div className="flex gap-0.5">
                <span className="h-2 w-0.5 rounded-full bg-slate-400" />
                <span className="h-2 w-0.5 rounded-full bg-slate-400" />
              </div>
            </div>

            {/* Input range nativo invisible superpuesto para accesibilidad y arrastre */}
            <input
              type="range"
              min={0}
              max={totalAmount}
              step={step}
              value={memberAAmount}
              disabled={isSubmitting}
              onChange={(e) => updateFromA(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
              aria-label="Deslizar para repartir el gasto"
            />
          </div>

          {/* Chips de Presets Rápidos */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={handleResetToEqual}
              disabled={isSubmitting}
              className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                is5050
                  ? "bg-[var(--hh-primary-action)] text-slate-950 shadow-xs"
                  : "bg-[var(--hh-surface-elevated)] text-[var(--hh-text-muted)] hover:text-[var(--hh-text)] border border-[var(--hh-border-soft)]"
              }`}
            >
              <Scale className="h-3 w-3 shrink-0" />
              <span>50 / 50</span>
            </button>

            <button
              type="button"
              onClick={() => updateFromA(totalAmount)}
              disabled={isSubmitting}
              className={`flex-1 inline-flex items-center justify-center py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isAllA
                  ? "bg-[var(--hh-primary-action)] text-slate-950 shadow-xs"
                  : "bg-[var(--hh-surface-elevated)] text-[var(--hh-text-muted)] hover:text-[var(--hh-text)] border border-[var(--hh-border-soft)]"
              }`}
            >
              <span>100% {shortNameA}</span>
            </button>

            <button
              type="button"
              onClick={() => updateFromB(totalAmount)}
              disabled={isSubmitting}
              className={`flex-1 inline-flex items-center justify-center py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isAllB
                  ? "bg-[var(--hh-primary-action)] text-slate-950 shadow-xs"
                  : "bg-[var(--hh-surface-elevated)] text-[var(--hh-text-muted)] hover:text-[var(--hh-text)] border border-[var(--hh-border-soft)]"
              }`}
            >
              <span>100% {shortNameB}</span>
            </button>
          </div>
        </div>

        {/* Tarjetas de Integrantes con Controles Dinámicos */}
        <div className="space-y-2.5">
          {/* Integrante A */}
          <div className="rounded-[18px] border border-[var(--hh-border-soft)] bg-[var(--hh-surface-subtle)]/40 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-[var(--hh-text)] truncate">
                  {memberAName}
                </span>
                {isMemberACurrentUser && (
                  <span className="rounded-md bg-[var(--hh-primary-action)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--hh-primary-action)] shrink-0">
                    Tú
                  </span>
                )}
              </div>
              <span className="font-bold text-[var(--hh-primary-action)] font-mono">
                {percentA}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateFromA(memberAAmount - step)}
                disabled={isSubmitting || memberAAmount <= 0}
                aria-label={`Restar ${formatCurrencyCop(step)} a ${memberAName}`}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-elevated)] text-[var(--hh-text)] hover:bg-[var(--hh-surface)] active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <Minus className="h-4 w-4" />
              </button>

              <div className="relative flex flex-1 items-center justify-center rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-elevated)] px-3 py-1.5 focus-within:ring-2 focus-within:ring-[var(--hh-focus-ring)] focus-within:border-[var(--hh-primary-action)] transition-all">
                <span className="pointer-events-none select-none text-sm font-bold text-[var(--hh-text-muted)] mr-1">
                  $
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberWithDots(memberAAmount)}
                  placeholder="0"
                  disabled={isSubmitting}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "");
                    updateFromA(clean ? Number(clean) : 0);
                  }}
                  className="w-full bg-transparent text-center font-mono text-sm font-bold text-[var(--hh-text)] placeholder:text-[var(--hh-text-muted)]/30 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => updateFromA(memberAAmount + step)}
                disabled={isSubmitting || memberAAmount >= totalAmount}
                aria-label={`Sumar ${formatCurrencyCop(step)} a ${memberAName}`}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-elevated)] text-[var(--hh-text)] hover:bg-[var(--hh-surface)] active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Integrante B */}
          <div className="rounded-[18px] border border-[var(--hh-border-soft)] bg-[var(--hh-surface-subtle)]/40 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-[var(--hh-text)] truncate">
                  {memberBName}
                </span>
                {isMemberBCurrentUser && (
                  <span className="rounded-md bg-[var(--hh-primary-action)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--hh-primary-action)] shrink-0">
                    Tú
                  </span>
                )}
              </div>
              <span className="font-bold text-[#629B8C] font-mono">
                {percentB}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateFromB(memberBAmount - step)}
                disabled={isSubmitting || memberBAmount <= 0}
                aria-label={`Restar ${formatCurrencyCop(step)} a ${memberBName}`}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-elevated)] text-[var(--hh-text)] hover:bg-[var(--hh-surface)] active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <Minus className="h-4 w-4" />
              </button>

              <div className="relative flex flex-1 items-center justify-center rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-elevated)] px-3 py-1.5 focus-within:ring-2 focus-within:ring-[var(--hh-focus-ring)] focus-within:border-[var(--hh-primary-action)] transition-all">
                <span className="pointer-events-none select-none text-sm font-bold text-[var(--hh-text-muted)] mr-1">
                  $
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberWithDots(memberBAmount)}
                  placeholder="0"
                  disabled={isSubmitting}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "");
                    updateFromB(clean ? Number(clean) : 0);
                  }}
                  className="w-full bg-transparent text-center font-mono text-sm font-bold text-[var(--hh-text)] placeholder:text-[var(--hh-text-muted)]/30 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => updateFromB(memberBAmount + step)}
                disabled={isSubmitting || memberBAmount >= totalAmount}
                aria-label={`Sumar ${formatCurrencyCop(step)} a ${memberBName}`}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-elevated)] text-[var(--hh-text)] hover:bg-[var(--hh-surface)] active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Estado y Reseteo Equitativo */}
        <div className="flex items-center justify-between gap-2 px-1 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Reparto 100% balanceado</span>
          </span>

          {!is5050 && (
            <button
              type="button"
              onClick={handleResetToEqual}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--hh-primary-action)] hover:underline cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              Restablecer 50/50
            </button>
          )}
        </div>

        {errorMessage && (
          <p className="text-xs text-rose-400 px-1 leading-snug">
            {errorMessage}
          </p>
        )}

        {/* Botón Confirmar */}
        <HouseholdButton
          ref={primaryButtonRef}
          type="button"
          tone="filled"
          disabled={isSubmitting || totalAmount <= 0}
          aria-busy={isSubmitting}
          onClick={handleConfirm}
          className="w-full cursor-pointer select-none rounded-xl py-2.5 text-sm font-semibold mt-1"
        >
          {isSubmitting ? "Guardando..." : "Confirmar distribución"}
        </HouseholdButton>
      </div>
    </div>
  );
}
