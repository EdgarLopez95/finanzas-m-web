"use client";

import { useEffect, useState } from "react";

import { CategoryIconColorPicker } from "@/components/finance/category-icon-color-picker";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import {
  createMplusCategory,
  findEquivalentCategoryName,
  nextSortOrderFor,
  updateMplusCategory,
} from "@/features/categories/services/mplus-category-service";
import {
  DEFAULT_EXPENSE_COLOR,
  DEFAULT_INCOME_COLOR,
} from "@/lib/categories/category-icons";
import { NAME_MAX_LENGTH } from "@/lib/mplus/catalogs";
import type { MovementType } from "@/lib/mplus/enums";
import type { MplusPersonalCategory } from "@/lib/mplus/models";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

/**
 * Alta y edicion de categorias Personales del contrato v1.
 *
 * Mismo dialogo y mismo selector de icono/color de la Web base. El contrato
 * añade dos reglas: `type` es inmutable despues de crear (§8.1) y la
 * advertencia de nombre repetido es local, solo dentro del mismo tipo, y no
 * bloquea (§8.2) — el ID estable es lo que identifica a la categoria.
 */

const DEFAULT_ICON: Record<MovementType, string> = {
  expense: "other",
  income: "other_income",
};

type MplusCategoryDialogProps = {
  open: boolean;
  ownerId: string;
  /** Tipo del catalogo en curso. Solo se usa al crear: en edicion manda el de la categoria. */
  type: MovementType;
  category: MplusPersonalCategory | null;
  onClose: () => void;
};

export function MplusCategoryDialog({
  open,
  ownerId,
  type,
  category,
  onClose,
}: MplusCategoryDialogProps) {
  const isEditMode = category !== null;
  const effectiveType = category?.type ?? type;

  const categories = useMplusPersonalStore((state) => state.categories);
  const applyCommittedCategory = useMplusPersonalStore((state) => state.applyCommittedCategory);

  const [name, setName] = useState(() => category?.name ?? "");
  const [iconKey, setIconKey] = useState(
    () => category?.iconKey ?? DEFAULT_ICON[effectiveType],
  );
  const [color, setColor] = useState(
    () =>
      category?.color ??
      (effectiveType === "income" ? DEFAULT_INCOME_COLOR : DEFAULT_EXPENSE_COLOR),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const nextType = category?.type ?? type;
    setName(category?.name ?? "");
    setIconKey(category?.iconKey ?? DEFAULT_ICON[nextType]);
    setColor(
      category?.color ??
        (nextType === "income" ? DEFAULT_INCOME_COLOR : DEFAULT_EXPENSE_COLOR),
    );
    setError(null);
  }, [category, open, type]);

  // Advertencia, no bloqueo (contrato §8.2).
  const duplicate =
    name.trim().length > 0
      ? findEquivalentCategoryName(categories, effectiveType, name, category?.id)
      : null;

  const canSubmit = name.trim().length > 0 && !isSubmitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const outcome = isEditMode
        ? await updateMplusCategory(category, { name, visual: { iconKey, color } })
        : await createMplusCategory(
            ownerId,
            effectiveType,
            name,
            { iconKey, color },
            nextSortOrderFor(categories, effectiveType),
          );

      if (outcome.kind === "success") {
        if (!outcome.replayed) {
          applyCommittedCategory(outcome.value);
        }
        onClose();
        return;
      }

      setError(
        outcome.kind === "conflict"
          ? "Alguien mas cambio esta categoria mientras la editabas. Vuelve a abrirla para ver la version del servidor."
          : outcome.kind === "unavailable"
            ? "No hay conexion con el servidor. El cambio NO se guardo."
            : outcome.message,
      );
    } catch (thrown) {
      setError(
        thrown instanceof Error ? thrown.message : "No se pudo guardar la categoria.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FinanceDialog
      onClose={onClose}
      open={open}
      subtitle={
        effectiveType === "expense"
          ? "Para agrupar tus gastos"
          : "Para agrupar tus ingresos"
      }
      title={isEditMode ? "Editar categoria" : "Nueva categoria"}
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-500/20 bg-[rgba(239,68,68,0.1)] p-3 text-xs text-[var(--fm-expense)]"
          >
            {error}
          </div>
        ) : null}

        <FinanceTextField
          disabled={isSubmitting}
          label="Nombre"
          maxLength={NAME_MAX_LENGTH}
          onChange={(event) => setName(event.target.value)}
          placeholder={effectiveType === "expense" ? "Ej. Mercado" : "Ej. Salario"}
          required
          value={name}
        />

        {duplicate ? (
          <p className="text-[11px] leading-snug text-[var(--fm-pending)]">
            Ya tienes una categoria parecida: <strong>{duplicate.name}</strong>. Puedes
            continuar igual; seran categorias distintas.
          </p>
        ) : null}

        <CategoryIconColorPicker
          kind={effectiveType}
          selectedIconKey={iconKey}
          selectedColor={color}
          onSelectIcon={setIconKey}
          onSelectColor={setColor}
        />

        <div className="flex justify-end gap-3 pt-2">
          <FinanceButton
            disabled={isSubmitting}
            onClick={onClose}
            tone="text"
            type="button"
            variant="ghost"
          >
            Cancelar
          </FinanceButton>
          <FinanceButton
            disabled={!canSubmit}
            tone="filled"
            type="submit"
            variant="default"
          >
            {isSubmitting
              ? isEditMode
                ? "Guardando..."
                : "Creando..."
              : isEditMode
                ? "Guardar cambios"
                : "Crear categoria"}
          </FinanceButton>
        </div>
      </form>
    </FinanceDialog>
  );
}
