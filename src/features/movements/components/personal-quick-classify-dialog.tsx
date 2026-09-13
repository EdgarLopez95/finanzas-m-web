"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Home, Sparkles } from "lucide-react";

import { Amount } from "@/components/finance/amount";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { filterPersonalUnclassifiedMovements } from "@/features/movements/lib/personal-quick-classify";
import { updateMovementPersonalCategory } from "@/features/movements/services/movement-mutations";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { formatDateEs } from "@/lib/format/date";
import type { MplusMovement, MplusPersonalCategory } from "@/lib/mplus/models";
import { cn } from "@/lib/utils";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

export interface PersonalQuickClassifyDialogProps {
  open: boolean;
  currentUid: string;
  movements: readonly MplusMovement[];
  categories: readonly MplusPersonalCategory[];
  onClose: () => void;
  onMovementClassified?: (movement: MplusMovement) => void;
}

/**
 * Diálogo de clasificación rápida de derivadas de Hogar en Finanzas M+ Personal.
 *
 * Permite al dueño del movimiento asignar exclusivamente su `categoryId` privado
 * a gastos originados en Hogar sin clasificar (`origin === "household_expense"` y `categoryId === null`),
 * sin alterar el documento fuente del hogar, la categoría del hogar ni la contraparte.
 */
export function PersonalQuickClassifyDialog({
  open,
  currentUid,
  movements,
  categories,
  onClose,
  onMovementClassified,
}: PersonalQuickClassifyDialogProps) {
  const [initialTotalCount, setInitialTotalCount] = useState(0);
  const [classifiedCount, setClassifiedCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtrar derivados pendientes de clasificar
  const pendingMovements = useMemo(
    () => filterPersonalUnclassifiedMovements(movements, currentUid),
    [movements, currentUid],
  );

  // Reiniciar estado al abrir el diálogo
  useEffect(() => {
    if (open) {
      const initialPending = filterPersonalUnclassifiedMovements(movements, currentUid);
      setInitialTotalCount(initialPending.length);
      setClassifiedCount(0);
      setIsSubmitting(false);
      setError(null);
    }
  }, [open, movements, currentUid]);

  // Categorías personales de gasto activas ordenadas
  const activeCategories = useMemo(
    () =>
      categories
        .filter((cat) => cat.state === "active" && cat.type === "expense")
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const currentMovement = pendingMovements[0] ?? null;
  const totalInSession = Math.max(
    initialTotalCount,
    classifiedCount + pendingMovements.length,
  );

  const handleClassify = async (targetCategoryId: string) => {
    if (!currentMovement || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const outcome = await updateMovementPersonalCategory(
        currentMovement,
        targetCategoryId,
      );

      if (outcome.kind === "success") {
        useMplusPersonalStore.getState().applyCommittedMovement(outcome.value);
        onMovementClassified?.(outcome.value);
        setClassifiedCount((prev) => prev + 1);

        // Si ya no quedan más pendientes después de este, cerrar
        if (pendingMovements.length <= 1) {
          onClose();
        }
      } else if (outcome.kind === "conflict") {
        setError("El movimiento cambió en el servidor. Por favor reintenta.");
      } else if (outcome.kind === "unavailable") {
        setError("Sin conexión. No se pudo guardar la categoría personal.");
      } else {
        setError(outcome.message || "Error al clasificar el movimiento.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado al clasificar el gasto.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Vista vacía segura: no hay pendientes ────────────────────────────────────
  if (pendingMovements.length === 0) {
    return (
      <FinanceDialog
        open={open}
        title="Clasificación rápida"
        subtitle="Gastos de Hogar pendientes de clasificar en tu presupuesto"
        onClose={onClose}
        size="default"
      >
        <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(74,222,128,0.12)] border border-[rgba(74,222,128,0.2)] text-[var(--fm-income)]">
            <CheckCircle2 className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <h3 className="text-base font-semibold text-[var(--fm-warm-paper)] font-[var(--font-display)]">
              ¡Todo al día!
            </h3>
            <p className="text-xs sm:text-sm text-[var(--fm-text-muted)] leading-relaxed">
              No tienes gastos de Hogar pendientes de clasificar en este mes.
            </p>
          </div>
          <div className="pt-2 w-full max-w-xs">
            <FinanceButton
              type="button"
              variant="default"
              size="default"
              className="w-full"
              onClick={onClose}
            >
              Entendido
            </FinanceButton>
          </div>
        </div>
      </FinanceDialog>
    );
  }

  // ── Vista con movimiento pendiente a clasificar ──────────────────────────────
  const progressSubtitle =
    totalInSession > 1
      ? `Gasto ${classifiedCount + 1} de ${totalInSession} pendientes este mes`
      : "1 gasto pendiente este mes";

  return (
    <FinanceDialog
      open={open}
      title="Clasificar gasto de Hogar"
      subtitle={progressSubtitle}
      onClose={onClose}
      size="default"
    >
      <div className="space-y-5">
        {/* Banner de error si falla la mutación */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.1)] px-3.5 py-2.5 text-xs text-[var(--fm-expense)] leading-snug"
          >
            {error}
          </div>
        )}

        {/* Tarjeta del gasto a clasificar */}
        <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-4 sm:p-4.5 space-y-3 shadow-inner">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-medium bg-[rgba(228,179,99,0.12)] border border-[rgba(228,179,99,0.22)] text-[var(--fm-pending)]">
                  <Home className="h-3 w-3 shrink-0" />
                  Gasto de Hogar
                </span>
                <span className="text-[11px] sm:text-xs text-[var(--fm-text-muted)]">
                  {formatDateEs(new Date(currentMovement.occurredAtMillis))}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-[var(--fm-warm-paper)] tracking-tight truncate">
                {currentMovement.title || "Gasto sin concepto"}
              </h3>
            </div>
            <div className="shrink-0 text-right">
              <Amount
                value={currentMovement.amount}
                variant="expense"
                size="lg"
                showSign={false}
                className="font-[var(--font-display)] font-bold text-lg sm:text-xl text-[var(--fm-expense)]"
              />
            </div>
          </div>

          {currentMovement.note && (
            <p className="text-xs text-[var(--fm-text-soft)] bg-white/4 rounded-lg px-3 py-1.5 border border-white/6 italic line-clamp-2">
              “{currentMovement.note}”
            </p>
          )}

          <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-[var(--fm-text-muted)]">
            <Sparkles className="h-3 w-3 shrink-0 text-[var(--fm-pending)]" />
            <span>Asigna cómo quieres contabilizar este gasto en tu presupuesto Personal.</span>
          </div>
        </div>

        {/* Selector de categorías activas */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fm-text-muted)]">
              Selecciona tu categoría Personal
            </span>
            <span className="text-[11px] text-[var(--fm-text-soft)]">
              {activeCategories.length} disponibles
            </span>
          </div>

          {activeCategories.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--fm-text-muted)] rounded-xl border border-white/8 bg-white/2">
              No tienes categorías personales de gasto activas.
            </div>
          ) : (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[260px] overflow-y-auto pr-1 select-none"
              role="group"
              aria-label="Categorías personales de gasto"
            >
              {activeCategories.map((cat) => {
                const IconComponent = resolveCategoryIcon(cat.iconKey, "expense");
                return (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleClassify(cat.id)}
                    className={cn(
                      "flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all outline-none group cursor-pointer",
                      "border-white/8 bg-white/2 hover:bg-white/[0.06] hover:border-white/16",
                      "focus-visible:ring-2 focus-visible:ring-[var(--fm-pending)]",
                      "active:scale-[0.98]",
                      isSubmitting && "opacity-50 pointer-events-none",
                    )}
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm"
                      style={{
                        backgroundColor: `${cat.color}22`,
                        color: cat.color,
                        border: `1px solid ${cat.color}44`,
                      }}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium text-[var(--fm-warm-paper)] truncate group-hover:text-white">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer accesible con botón de salida */}
        <div className="pt-2 flex justify-end">
          <FinanceButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cerrar
          </FinanceButton>
        </div>
      </div>
    </FinanceDialog>
  );
}
