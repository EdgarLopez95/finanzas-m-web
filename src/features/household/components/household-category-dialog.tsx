"use client";

import React, { useEffect, useMemo, useState } from "react";

import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdDialog } from "@/features/household/components/ui/household-dialog";
import {
  HouseholdIconSelect,
  type HouseholdIconSelectOption,
} from "@/features/household/components/ui/household-icon-select";
import { HouseholdTextField } from "@/features/household/components/ui/household-text-field";
import {
  createHouseholdExpenseCategory,
  updateHouseholdExpenseCategory,
} from "@/features/household/services/mplus-household-categories-service";
import {
  EXPENSE_ICON_GROUPS,
  expenseIconCatalog,
  expenseIconOptions,
} from "@/lib/categories/category-icons";
import {
  DEFAULT_HOUSEHOLD_CATEGORY_COLOR,
  HOUSEHOLD_CATEGORY_COLORS,
} from "@/lib/categories/household-category-colors";
import type { MplusHouseholdExpenseCategory } from "@/lib/mplus/models";

export type HouseholdCategoryDialogProps = {
  open: boolean;
  householdId: string;
  creatorUid: string;
  existingCount: number;
  editingCategory?: MplusHouseholdExpenseCategory | null;
  onClose: () => void;
  onSuccess: (category: MplusHouseholdExpenseCategory) => void | Promise<void>;
};

export function HouseholdCategoryDialog({
  open,
  householdId,
  creatorUid,
  existingCount,
  editingCategory = null,
  onClose,
  onSuccess,
}: HouseholdCategoryDialogProps) {
  const [formName, setFormName] = useState("");
  const [formIconKey, setFormIconKey] = useState("shopping");
  const [formColor, setFormColor] = useState(DEFAULT_HOUSEHOLD_CATEGORY_COLOR);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const iconSelectOptions: HouseholdIconSelectOption[] = useMemo(() => {
    return expenseIconOptions.map((opt) => {
      const Icon = expenseIconCatalog[opt.iconKey];
      return {
        id: opt.iconKey,
        label: opt.label,
        keywords: opt.keywords,
        icon: Icon ? <Icon className="h-5 w-5" /> : undefined,
      };
    });
  }, []);

  useEffect(() => {
    if (open) {
      if (editingCategory) {
        setFormName(editingCategory.name);
        setFormIconKey(editingCategory.iconKey);
        setFormColor(editingCategory.color);
      } else {
        setFormName("");
        setFormIconKey("shopping");
        setFormColor(DEFAULT_HOUSEHOLD_CATEGORY_COLOR);
      }
      setFormError(null);
      setIsSubmitting(false);
    }
  }, [open, editingCategory]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = formName.trim();
    if (trimmed.length < 1 || trimmed.length > 50) {
      setFormError("El nombre debe tener entre 1 y 50 caracteres.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingCategory) {
        const outcome = await updateHouseholdExpenseCategory({
          householdId,
          categoryId: editingCategory.id,
          name: trimmed,
          iconKey: formIconKey,
          color: formColor,
          expectedRevision: editingCategory.revision,
          existingCategory: editingCategory,
        });

        if (outcome.kind === "success") {
          await onSuccess(outcome.value);
          onClose();
        } else {
          setFormError(
            outcome.kind === "conflict"
              ? "La categoría cambió remotamente. Actualiza e inténtalo de nuevo."
              : outcome.message || "Error al actualizar categoría.",
          );
        }
      } else {
        const outcome = await createHouseholdExpenseCategory({
          householdId,
          creatorUid,
          name: trimmed,
          iconKey: formIconKey,
          color: formColor,
          existingCount,
        });

        if (outcome.kind === "success") {
          await onSuccess(outcome.value);
          onClose();
        } else {
          setFormError(
            outcome.kind === "conflict"
              ? "La categoría cambió remotamente. Actualiza e inténtalo de nuevo."
              : outcome.message || "Error al crear la categoría.",
          );
        }
      }
    } catch {
      setFormError("Ocurrió un error inesperado al guardar la categoría.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <HouseholdDialog
      open={open}
      title={editingCategory ? "Editar categoría del hogar" : "Nueva categoría del hogar"}
      subtitle="Las categorías de gasto de hogar son compartidas por ambos miembros."
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSave}>
        {formError && (
          <div
            role="alert"
            className="rounded-xl border border-[var(--hh-destructive-border)] bg-[var(--hh-destructive-border)]/10 p-3 text-xs text-[var(--hh-destructive-content)]"
          >
            {formError}
          </div>
        )}

        <HouseholdTextField
          label="Nombre de la categoría"
          placeholder="Ej. Servicios, Compras, Paseos..."
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
        />

        <HouseholdIconSelect
          colorPalette={HOUSEHOLD_CATEGORY_COLORS}
          groups={EXPENSE_ICON_GROUPS}
          options={iconSelectOptions}
          selectedColor={formColor}
          selectedIconKey={formIconKey}
          onSelectColor={setFormColor}
          onSelectIcon={setFormIconKey}
        />

        <div className="flex gap-3 pt-3">
          <HouseholdButton
            className="flex-1 justify-center"
            disabled={isSubmitting}
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Cancelar
          </HouseholdButton>
          <HouseholdButton
            className="flex-1 justify-center"
            disabled={!formName.trim() || isSubmitting}
            tone="filled"
            type="submit"
          >
            {isSubmitting ? "Guardando..." : "Guardar categoría"}
          </HouseholdButton>
        </div>
      </form>
    </HouseholdDialog>
  );
}
