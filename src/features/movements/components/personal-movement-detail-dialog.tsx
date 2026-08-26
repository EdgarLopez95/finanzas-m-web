"use client";

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
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { formatDateEs } from "@/lib/format/date";
import type {
  MplusMovement,
  MplusPersonalAccount,
  MplusPersonalCategory,
} from "@/lib/mplus/models";
import { cn } from "@/lib/utils";

export interface PersonalMovementDetailDialogProps {
  open: boolean;
  movement: MplusMovement | null;
  category?: MplusPersonalCategory | null;
  account?: MplusPersonalAccount | null;
  masked?: boolean;
  onClose: () => void;
  onEdit: (movement: MplusMovement) => void;
  onDelete: (movement: MplusMovement) => void;
}

/**
 * Diálogo de detalle de solo lectura para un movimiento Personal en Finanzas M+.
 *
 * Muestra información completa del documento MplusMovement (monto, título,
 * tipo, fecha, categoría con icono y color, cuenta origen, nota opcional y
 * estado de compartir con Hogar), respetando privacidad de saldo (masked)
 * y ofreciendo acciones directas para Editar o Enviar a Papelera.
 */
export function PersonalMovementDetailDialog({
  open,
  movement,
  category,
  account,
  masked = false,
  onClose,
  onEdit,
  onDelete,
}: PersonalMovementDetailDialogProps) {
  if (!movement) {
    return null;
  }

  const isIncome = movement.type === "income";
  const amountVariant = isIncome ? "income" : "expense";
  const categoryColor = category?.color || "#94A3B8";
  const categoryName = category?.name || (movement.categoryId ? "Categoría no disponible" : "Sin categoría");
  const CategoryIcon = resolveCategoryIcon(category?.iconKey || "other", movement.type);
  const isSharedWithHousehold = Boolean(movement.householdId);

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
            masked={masked}
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
          <div className="flex items-center justify-between py-3">
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
              <span className="font-medium text-[var(--fm-warm-paper)]">
                {categoryName}
              </span>
            </div>
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
            {isSharedWithHousehold ? (
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
        </div>

        {/* Acciones del pie: Eliminar (izquierda), Cerrar y Editar (derecha) */}
        <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-4">
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

          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </div>
    </FinanceDialog>
  );
}
