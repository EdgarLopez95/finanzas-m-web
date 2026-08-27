"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, HelpCircle, Plus, Tag } from "lucide-react";

import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { HouseholdCategoryDialog } from "@/features/household/components/household-category-dialog";
import { HouseholdAmount } from "@/features/household/components/ui/household-amount";
import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdDialog } from "@/features/household/components/ui/household-dialog";
import { correctPartnerMovementCategory } from "@/features/household/services/read-household-movements";
import { expenseIconCatalog } from "@/lib/categories/category-icons";
import { formatDateEs } from "@/lib/format/date";
import type {
  MplusCategoryMapping,
  MplusHouseholdExpenseCategory,
  MplusHouseholdMember,
  MplusMemberCategoryLabel,
  MplusMovement,
  MplusPersonalCategory,
} from "@/lib/mplus/models";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

export interface HouseholdQuickClassifyDialogProps {
  open: boolean;
  householdId: string;
  currentUid: string;
  unclassifiedMovements: readonly MplusMovement[];
  categories: readonly MplusHouseholdExpenseCategory[];
  members: readonly MplusHouseholdMember[];
  personalCategories?: readonly MplusPersonalCategory[];
  categoryLabels?: readonly MplusMemberCategoryLabel[];
  onClose: () => void;
  onMovementClassified?: (movement: MplusMovement, mapping: MplusCategoryMapping) => void;
  onCategoryCreated?: (category: MplusHouseholdExpenseCategory) => void;
}

export function HouseholdQuickClassifyDialog({
  open,
  householdId,
  currentUid,
  unclassifiedMovements,
  categories,
  members,
  personalCategories = [],
  categoryLabels = [],
  onClose,
  onMovementClassified,
  onCategoryCreated,
}: HouseholdQuickClassifyDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Reiniciar estado cada vez que se abre el diálogo
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setIsSubmitting(false);
      setError(null);
      setIsCreatingCategory(false);
    }
  }, [open]);

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.userId, m])),
    [members],
  );

  const ownCategoriesMap = useMemo(
    () => new Map(personalCategories.map((c) => [c.id, c])),
    [personalCategories],
  );

  const partnerCategoryMap = useMemo(
    () => new Map(categoryLabels.map((c) => [`${c.ownerId}__${c.categoryId}`, c])),
    [categoryLabels],
  );

  // Filtrar movimientos pendientes
  const pendingMovements = unclassifiedMovements;
  const currentMovement = pendingMovements[currentIndex] ?? null;
  const totalCount = pendingMovements.length;

  const resolvePersonalCategoryName = (movement: MplusMovement): string => {
    if (movement.ownerId === currentUid) {
      const own = ownCategoriesMap.get(movement.categoryId);
      return own?.name || "Categoría personal";
    }
    const partner = partnerCategoryMap.get(`${movement.ownerId}__${movement.categoryId}`);
    return partner?.name || "Categoría personal";
  };

  const handleClassify = async (targetCategoryId: string) => {
    if (!currentMovement) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const outcome = await correctPartnerMovementCategory({
        householdId,
        movement: currentMovement,
        targetHouseholdCategoryId: targetCategoryId,
        updatedByUid: currentUid,
      });

      if (outcome.kind === "success") {
        const { updatedMovement, mapping } = outcome.value;

        // Actualizar store de Hogar
        useMplusHouseholdStore.getState().applyCommittedMovement(updatedMovement);
        useMplusHouseholdStore.getState().applyCommittedMapping(mapping);

        // Actualizar store Personal si el movimiento es del usuario actual
        if (updatedMovement.ownerId === currentUid) {
          useMplusPersonalStore.getState().applyCommittedMovement(updatedMovement);
        }

        onMovementClassified?.(updatedMovement, mapping);

        // Si era el último movimiento o ya no hay más, cerrar modal
        if (currentIndex >= pendingMovements.length - 1) {
          onClose();
        } else {
          // Avanzar al siguiente gasto en la cola
          setCurrentIndex((prev) => prev + 1);
        }
      } else {
        setError(
          outcome.kind === "conflict"
            ? "El movimiento cambió remotamente. Actualiza e inténtalo de nuevo."
            : outcome.message || "Error al clasificar el movimiento.",
        );
      }
    } catch {
      setError("Ocurrió un error inesperado al clasificar el gasto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setError(null);
    if (currentIndex < totalCount - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handleCategoryCreated = async (newCategory: MplusHouseholdExpenseCategory) => {
    useMplusHouseholdStore.getState().applyCommittedCategory(newCategory);
    onCategoryCreated?.(newCategory);
    setIsCreatingCategory(false);

    // Clasificar inmediatamente el gasto actual con la nueva categoría creada
    if (currentMovement) {
      await handleClassify(newCategory.id);
    }
  };

  if (!open) return null;

  // Estado vacío: todos los gastos clasificados
  if (!currentMovement || totalCount === 0) {
    return (
      <HouseholdDialog
        open={open}
        title="Gastos clasificados"
        subtitle="Todos los gastos compartidos están al día."
        onClose={onClose}
      >
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--hh-primary-action)]/15 text-[var(--hh-primary-action)]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-[var(--hh-text)]">
            ¡Todo al día!
          </p>
          <p className="text-xs text-[var(--hh-text-muted)] max-w-xs">
            No tienes gastos compartidos pendientes por clasificar en este período.
          </p>
          <div className="pt-3">
            <HouseholdButton tone="filled" onClick={onClose}>
              Entendido
            </HouseholdButton>
          </div>
        </div>
      </HouseholdDialog>
    );
  }

  const isOwn = currentMovement.ownerId === currentUid;
  const member = memberMap.get(currentMovement.ownerId);
  const ownerLabel = isOwn ? "Tú" : member?.displayName || "Pareja";
  const conceptName = currentMovement.title || "Gasto sin concepto";
  const personalCatName = resolvePersonalCategoryName(currentMovement);

  return (
    <>
      <HouseholdDialog
        open={open && !isCreatingCategory}
        title="Clasificar gasto para el hogar"
        subtitle={`Gasto ${currentIndex + 1} de ${totalCount} por clasificar`}
        onClose={onClose}
      >
        <div className="space-y-4">
          {/* Mensaje de error si falla la clasificación */}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[var(--hh-destructive-border)] bg-[var(--hh-destructive-border)]/10 px-3.5 py-2.5 text-xs text-[var(--hh-destructive-content)] space-y-1 animate-in fade-in"
            >
              <p className="font-medium">{error}</p>
            </div>
          )}

          {/* 1. Tarjeta del Gasto Pendiente */}
          <div className="rounded-2xl border border-[var(--hh-border-soft)] bg-[var(--hh-surface-subtle)] p-4 space-y-2.5 shadow-sm">
            {/* Concepto y Monto */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p
                  className="font-[var(--font-display)] text-base sm:text-lg font-bold text-[var(--hh-text)] truncate"
                  title={conceptName}
                >
                  {conceptName}
                </p>
                <p className="text-xs text-[var(--hh-text-muted)]">
                  {formatDateEs(new Date(currentMovement.occurredAtMillis))}
                </p>
              </div>
              <HouseholdAmount
                value={currentMovement.amount}
                variant="expense"
                size="md"
                className="font-bold text-lg text-[var(--hh-destructive-content)] shrink-0 font-[var(--font-display)]"
              />
            </div>

            {/* Metadatos del Responsable y Categoría Personal */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--hh-border-soft)]/60 text-xs">
              {/* Responsable */}
              <div className="flex items-center gap-1.5 rounded-lg bg-[var(--hh-surface-elevated)] px-2.5 py-1 border border-[var(--hh-border-soft)]">
                <ProfileAvatar
                  name={ownerLabel}
                  photoURL={member?.photoUrl}
                  size="sm"
                  decorative
                  className="h-4 w-4 text-[9px] border border-[var(--hh-primary-action)]/30 bg-[var(--hh-primary-action)]/10 text-[var(--hh-primary-action)]"
                />
                <span className="font-semibold text-[var(--hh-text)]">
                  {ownerLabel}
                </span>
              </div>

              {/* Categoría personal original */}
              <div className="flex items-center gap-1.5 rounded-lg bg-[var(--hh-surface-elevated)] px-2.5 py-1 border border-[var(--hh-border-soft)] text-[var(--hh-text-secondary)]">
                <Tag className="h-3 w-3 text-[var(--hh-text-muted)] shrink-0" />
                <span className="text-[11px] font-medium truncate max-w-[170px]" title={personalCatName}>
                  Personal: {personalCatName}
                </span>
              </div>
            </div>

            {/* Nota adicional si la tiene */}
            {currentMovement.note && (
              <p className="text-[11px] text-[var(--hh-text-muted)] italic pt-0.5 truncate">
                Nota: &quot;{currentMovement.note}&quot;
              </p>
            )}
          </div>

          {/* 2. Selector de Categorías de Hogar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--hh-text-muted)]">
                Elige la categoría del hogar
              </span>
              <span className="text-[11px] text-[var(--hh-text-muted)]">
                Se guardará como regla futura
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {categories.map((cat) => {
                const Icon = expenseIconCatalog[cat.iconKey] || HelpCircle;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleClassify(cat.id)}
                    className="group flex items-center gap-2 p-2.5 rounded-xl border border-[var(--hh-border-soft)] bg-[var(--hh-surface-elevated)] hover:border-[var(--hh-primary-action)]/50 hover:bg-[var(--hh-surface)] transition-all cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm"
                      style={{
                        backgroundColor: `${cat.color}15`,
                        color: cat.color,
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span
                      className="text-xs font-medium text-[var(--hh-text)] group-hover:text-white truncate"
                      title={cat.name}
                    >
                      {cat.name}
                    </span>
                  </button>
                );
              })}

              {/* Botón "+ Nueva categoría" */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsCreatingCategory(true)}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-dashed border-[var(--hh-border-strong)] hover:border-[var(--hh-primary-action)]/70 text-[var(--hh-primary-action)] hover:bg-[var(--hh-primary-action)]/10 text-xs font-semibold transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)] disabled:opacity-50"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>Nueva categoría</span>
              </button>
            </div>
          </div>

          {/* 3. Acciones Inferiores */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--hh-border-soft)]">
            <HouseholdButton
              type="button"
              variant="ghost"
              tone="text"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs text-[var(--hh-text-muted)] hover:text-[var(--hh-text)] px-3 py-1.5 h-auto"
            >
              Cerrar
            </HouseholdButton>

            <HouseholdButton
              type="button"
              variant="ghost"
              tone="text"
              onClick={handleSkip}
              disabled={isSubmitting}
              className="text-xs text-[var(--hh-primary-action)] hover:text-white hover:bg-[var(--hh-primary-action)]/15 px-3 py-1.5 h-auto font-semibold"
            >
              {currentIndex < totalCount - 1 ? "Clasificar después →" : "Terminar"}
            </HouseholdButton>
          </div>
        </div>
      </HouseholdDialog>

      {/* Diálogo auxiliar para crear nueva categoría inline sin perder el contexto */}
      {isCreatingCategory && (
        <HouseholdCategoryDialog
          open={isCreatingCategory}
          householdId={householdId}
          creatorUid={currentUid}
          existingCount={categories.length}
          onClose={() => setIsCreatingCategory(false)}
          onSuccess={handleCategoryCreated}
        />
      )}
    </>
  );
}
