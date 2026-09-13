"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Pencil,
  Tag,
  Trash2,
  Users,
} from "lucide-react";

import { AccountIcon } from "@/components/finance/account-icon";
import { Amount } from "@/components/finance/amount";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { IconSelect } from "@/components/finance/icon-select";
import { updateMovementPersonalCategory } from "@/features/movements/services/movement-mutations";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { formatDateEs } from "@/lib/format/date";
import type {
  MplusMovement,
  MplusPersonalAccount,
  MplusPersonalCategory,
} from "@/lib/mplus/models";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";
import { cn } from "@/lib/utils";

export interface PersonalMovementDetailDialogProps {
  open: boolean;
  movement: MplusMovement | null;
  category?: MplusPersonalCategory | null;
  account?: MplusPersonalAccount | null;
  categories?: readonly MplusPersonalCategory[];
  onClose: () => void;
  onEdit: (movement: MplusMovement) => void;
  onDelete: (movement: MplusMovement) => void;
  onMovementUpdated?: (movement: MplusMovement) => void;
}

/**
 * Diálogo de detalle de solo lectura para un movimiento Personal en Finanzas M+.
 *
 * Muestra información completa del documento MplusMovement (monto, título,
 * tipo, fecha, categoría con icono y color, cuenta origen, nota opcional y
 * estado de compartir con Hogar)
 * y ofreciendo acciones directas para Editar o Enviar a Papelera.
 */
export function PersonalMovementDetailDialog({
  open,
  movement,
  category,
  account,
  categories,
  onClose,
  onEdit,
  onDelete,
  onMovementUpdated,
}: PersonalMovementDetailDialogProps) {
  const storeCategories = useMplusPersonalStore((state) => state.categories);
  const availableExpenseCategories = useMemo(() => {
    const cats = categories ?? storeCategories;
    return cats.filter((c) => c.type === "expense" && c.state === "active");
  }, [categories, storeCategories]);

  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  useEffect(() => {
    if (movement) {
      setSelectedCategoryId(movement.categoryId);
    }
    setIsEditingCategory(false);
    setIsSavingCategory(false);
    setCategoryError(null);
  }, [movement, open]);

  if (!movement) {
    return null;
  }

  const isIncome = movement.type === "income";
  const amountVariant = isIncome ? "income" : "expense";
  const categoryColor = category?.color || "#94A3B8";
  const categoryName =
    category?.name ||
    (movement.categoryId === null
      ? "Por clasificar"
      : movement.categoryId
        ? "Categoría no disponible"
        : "Por clasificar");
  const CategoryIcon = resolveCategoryIcon(category?.iconKey || "other", movement.type);
  const isSharedWithHousehold = Boolean(movement.householdId);
  const isHouseholdExpense = movement.origin === "household_expense";

  const handleSaveCategory = async () => {
    if (!movement || isSavingCategory) return;
    setIsSavingCategory(true);
    setCategoryError(null);
    try {
      const outcome = await updateMovementPersonalCategory(movement, selectedCategoryId);
      if (outcome.kind === "success") {
        useMplusPersonalStore.getState().applyCommittedMovement(outcome.value);
        onMovementUpdated?.(outcome.value);
        setIsEditingCategory(false);
      } else if (outcome.kind === "conflict") {
        setCategoryError("El movimiento cambió en el servidor. Por favor recarga.");
      } else if (outcome.kind === "unavailable") {
        setCategoryError("Sin conexión. No se pudo guardar la categoría.");
      } else {
        setCategoryError(outcome.message || "Error al actualizar la categoría.");
      }
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "Error al actualizar la categoría.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  return (
    <FinanceDialog
      open={open}
      title="Detalle del movimiento"
      subtitle="Información completa del registro personal"
      onClose={onClose}
      size="default"
    >
      <div className="space-y-5">
        {/* Encabezado Principal: Monto, título y fecha */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-center">
          <Amount
            className="font-[var(--font-display)] text-3xl font-bold"
            showSign
            size="display"
            value={movement.amount}
            variant={amountVariant}
          />
          <p className="mt-1.5 font-[var(--font-display)] text-base font-semibold text-[var(--fm-warm-paper)]">
            {movement.title}
          </p>
          <p className="mt-0.5 text-xs text-[var(--fm-text-muted)]">
            {formatDateEs(new Date(movement.occurredAtMillis))}
          </p>
        </div>

        {/* Lista de Atributos */}
        <div className="divide-y divide-white/8 text-sm">
          {/* Tipo de movimiento */}
          <div className="flex items-center justify-between py-3">
            <span className="flex items-center gap-2 text-xs font-medium text-[var(--fm-text-muted)]">
              {isIncome ? (
                <ArrowUpRight className="h-4 w-4 text-[var(--fm-income)]" />
              ) : (
                <ArrowDownLeft className="h-4 w-4 text-[var(--fm-expense)]" />
              )}
              Tipo
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                isIncome
                  ? "bg-[rgba(74,222,128,0.12)] text-[var(--fm-income)]"
                  : "bg-[rgba(239,68,68,0.12)] text-[var(--fm-expense)]",
              )}
            >
              {isIncome ? "Ingreso" : "Gasto"}
            </span>
          </div>

          {/* Categoría */}
          <div className="flex flex-col py-3 gap-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-medium text-[var(--fm-text-muted)]">
                <Tag className="h-4 w-4" />
                Categoría
              </span>
              <div className="flex items-center gap-2">
                <div
                  className="grid h-6 w-6 place-items-center rounded-lg border text-xs"
                  style={{
                    backgroundColor: `${categoryColor}22`,
                    borderColor: `${categoryColor}44`,
                    color: categoryColor,
                  }}
                >
                  <CategoryIcon className="h-3.5 w-3.5" />
                </div>
                <span
                  className={cn(
                    "font-medium",
                    movement.categoryId === null
                      ? "text-[var(--fm-pending)] font-semibold"
                      : "text-[var(--fm-warm-paper)]",
                  )}
                >
                  {categoryName}
                </span>
                {isHouseholdExpense && !isEditingCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(movement.categoryId);
                      setCategoryError(null);
                      setIsEditingCategory(true);
                    }}
                    className="ml-1 text-xs font-semibold text-[var(--fm-primary)] hover:underline cursor-pointer flex items-center gap-1"
                    aria-label="Cambiar categoría personal"
                  >
                    <Pencil className="h-3 w-3" />
                    {movement.categoryId === null ? "Clasificar" : "Cambiar"}
                  </button>
                )}
              </div>
            </div>

            {/* Selector de categoría privada para derivados */}
            {isHouseholdExpense && isEditingCategory && (
              <div className="mt-1 space-y-2 rounded-xl border border-white/8 bg-white/[0.02] p-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--fm-text-muted)]">
                    Selecciona tu categoría privada:
                  </span>
                  {selectedCategoryId !== null && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId(null)}
                      className="text-[11px] text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] underline cursor-pointer"
                    >
                      Dejar Por clasificar
                    </button>
                  )}
                </div>
                <IconSelect
                  id="personalCategorySelect"
                  value={selectedCategoryId ?? ""}
                  placeholder="Por clasificar..."
                  options={availableExpenseCategories.map((c) => {
                    const Icon = resolveCategoryIcon(c.iconKey, "expense");
                    return {
                      id: c.id,
                      label: c.name,
                      color: c.color,
                      icon: <Icon className="h-3.5 w-3.5" />,
                    };
                  })}
                  onChange={(val) => setSelectedCategoryId(val || null)}
                  disabled={isSavingCategory}
                />
                {categoryError && (
                  <p role="alert" className="text-xs text-[var(--fm-expense)]">
                    {categoryError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Cuenta */}
          <div className="flex items-center justify-between py-3">
            <span className="flex items-center gap-2 text-xs font-medium text-[var(--fm-text-muted)]">
              <CreditCard className="h-4 w-4" />
              Cuenta
            </span>
            <div className="flex items-center gap-2">
              {movement.accountId ? (
                account ? (
                  <>
                    <AccountIcon
                      color={account.color}
                      iconKey={account.iconKey}
                      iconType={account.iconType}
                      size="xs"
                    />
                    <span className="font-medium text-[var(--fm-warm-paper)]">
                      {account.name}
                    </span>
                  </>
                ) : (
                  <span className="font-medium text-[var(--fm-text-muted)]">
                    Cuenta no disponible
                  </span>
                )
              ) : (
                <span className="font-medium text-[var(--fm-text-muted)]">
                  Sin cuenta asignada
                </span>
              )}
            </div>
          </div>

          {/* Estado de compartir con Hogar */}
          <div className="flex items-center justify-between py-3">
            <span className="flex items-center gap-2 text-xs font-medium text-[var(--fm-text-muted)]">
              <Users className="h-4 w-4" />
              Destino
            </span>
            {isHouseholdExpense ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(228,179,99,0.12)] px-2.5 py-0.5 text-xs font-semibold text-[var(--fm-pending)]">
                Gasto de Hogar
              </span>
            ) : isSharedWithHousehold ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(228,179,99,0.12)] px-2.5 py-0.5 text-xs font-semibold text-[var(--fm-pending)]">
                Cuenta en Hogar
              </span>
            ) : (
              <span className="text-xs text-[var(--fm-text-muted)]">
                Solo personal
              </span>
            )}
          </div>

          {/* Nota opcional */}
          {movement.note ? (
            <div className="py-3">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--fm-text-muted)]">
                Nota
              </span>
              <p className="whitespace-pre-wrap break-words rounded-xl border border-white/8 bg-white/[0.03] p-3 text-sm text-[var(--fm-warm-paper)]">
                {movement.note}
              </p>
            </div>
          ) : null}

          {isHouseholdExpense && (
            <div className="py-3">
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-xs text-[var(--fm-text-muted)] leading-relaxed">
                Este gasto se originó en las cuentas del Hogar y se administra desde allí.
              </div>
            </div>
          )}
        </div>

        {/* Acciones del pie: Eliminar (izquierda), Cerrar y Editar/Guardar (derecha) */}
        <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-4">
          {!isHouseholdExpense ? (
            <FinanceButton
              className="text-[var(--fm-expense)] hover:bg-[rgba(239,68,68,0.12)] cursor-pointer"
              onClick={() => {
                onClose();
                onDelete(movement);
              }}
              size="sm"
              tone="destructive"
              type="button"
              variant="ghost"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Eliminar
            </FinanceButton>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {isHouseholdExpense && isEditingCategory ? (
              <>
                <FinanceButton
                  className="text-[var(--fm-text-soft)] hover:text-[var(--fm-warm-paper)] cursor-pointer"
                  onClick={() => {
                    setIsEditingCategory(false);
                    setSelectedCategoryId(movement.categoryId);
                    setCategoryError(null);
                  }}
                  disabled={isSavingCategory}
                  size="sm"
                  tone="text"
                  type="button"
                  variant="ghost"
                >
                  Cancelar
                </FinanceButton>
                <FinanceButton
                  className="cursor-pointer bg-[var(--fm-primary)] text-[var(--fm-warm-paper)] hover:bg-[color-mix(in_oklch,var(--fm-primary),white_8%)]"
                  onClick={handleSaveCategory}
                  disabled={isSavingCategory || selectedCategoryId === movement.categoryId}
                  size="sm"
                  tone="filled"
                  type="button"
                  variant="default"
                >
                  {isSavingCategory ? "Guardando..." : "Guardar categoría"}
                </FinanceButton>
              </>
            ) : (
              <>
                <FinanceButton
                  className="text-[var(--fm-text-soft)] hover:text-[var(--fm-warm-paper)] cursor-pointer"
                  onClick={onClose}
                  size="sm"
                  tone="text"
                  type="button"
                  variant="ghost"
                >
                  Cerrar
                </FinanceButton>
                {!isHouseholdExpense ? (
                  <FinanceButton
                    className="cursor-pointer bg-[var(--fm-primary)] text-[var(--fm-warm-paper)] hover:bg-[color-mix(in_oklch,var(--fm-primary),white_8%)]"
                    onClick={() => {
                      onClose();
                      onEdit(movement);
                    }}
                    size="sm"
                    tone="filled"
                    type="button"
                    variant="default"
                  >
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Editar
                  </FinanceButton>
                ) : (
                  <FinanceButton
                    className="cursor-pointer bg-[var(--fm-primary)] text-[var(--fm-warm-paper)] hover:bg-[color-mix(in_oklch,var(--fm-primary),white_8%)]"
                    onClick={() => {
                      setSelectedCategoryId(movement.categoryId);
                      setCategoryError(null);
                      setIsEditingCategory(true);
                    }}
                    size="sm"
                    tone="filled"
                    type="button"
                    variant="default"
                  >
                    <Pencil className="mr-1.5 h-4 w-4" />
                    {movement.categoryId === null ? "Clasificar" : "Cambiar categoría"}
                  </FinanceButton>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </FinanceDialog>
  );
}
