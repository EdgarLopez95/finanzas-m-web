"use client";

import { useMemo } from "react";
import { AlertTriangle, Clock, FileText, Tag, Users } from "lucide-react";

import { AccountIcon } from "@/components/finance/account-icon";
import { Amount } from "@/components/finance/amount";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import type { MovementConflictState } from "@/features/movements/hooks/use-movement-mutations";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { formatDateEs } from "@/lib/format/date";
import type {
  MplusHouseholdExpenseCategory,
  MplusPersonalAccount,
  MplusPersonalCategory,
} from "@/lib/mplus/models";

export type MovementConflictDialogProps = {
  open: boolean;
  conflict: MovementConflictState | null;
  categories: readonly MplusPersonalCategory[];
  accounts: readonly MplusPersonalAccount[];
  householdCategories?: readonly MplusHouseholdExpenseCategory[];
  isSubmitting?: boolean;
  onKeepServer: () => void | Promise<void>;
  onKeepLocal: () => void | Promise<void>;
  onClose: () => void;
};

/**
 * Diálogo de resolución de conflictos OCC (spec §22.2).
 *
 * Muestra la versión local (draft) vs la versión remota (servidor) y permite
 * elegir cuál conservar. Si se conserva la local, se re-aplica con OCC sobre
 * la nueva revisión.
 */
export function MovementConflictDialog({
  open,
  conflict,
  categories,
  accounts,
  householdCategories = [],
  isSubmitting = false,
  onKeepServer,
  onKeepLocal,
  onClose,
}: MovementConflictDialogProps) {
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  const householdCategoryById = useMemo(
    () => new Map(householdCategories.map((c) => [c.id, c])),
    [householdCategories],
  );

  if (!open || !conflict) return null;

  const { draft, serverMovement } = conflict;

  const localCategory = categoryById.get(draft.categoryId);
  const localAccount = draft.accountId ? accountById.get(draft.accountId) : null;
  const localHouseholdCategory = draft.householdCategoryId
    ? householdCategoryById.get(draft.householdCategoryId)
    : null;

  const serverCategory = serverMovement
    ? categoryById.get(serverMovement.categoryId)
    : null;
  const serverAccount =
    serverMovement && serverMovement.accountId
      ? accountById.get(serverMovement.accountId)
      : null;
  const serverHouseholdCategory =
    serverMovement && serverMovement.householdCategoryId
      ? householdCategoryById.get(serverMovement.householdCategoryId)
      : null;

  const LocalCategoryIcon = localCategory
    ? resolveCategoryIcon(localCategory.iconKey, localCategory.type)
    : Tag;

  const ServerCategoryIcon = serverCategory
    ? resolveCategoryIcon(serverCategory.iconKey, serverCategory.type)
    : Tag;

  return (
    <FinanceDialog
      open={open}
      onClose={onClose}
      title="Conflicto de versiones"
      subtitle="Este movimiento cambió en el servidor mientras lo editabas."
      size="wide"
    >
      <div className="space-y-5">
        {/* Aviso explicativo */}
        <div className="flex items-start gap-3 rounded-2xl border border-[rgba(228,179,99,0.25)] bg-[rgba(228,179,99,0.06)] p-4 text-xs text-[var(--fm-text-soft)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fm-pending)]" />
          <p className="leading-relaxed">
            Se detectó un cambio simultáneo en el servidor. Revisa las dos
            versiones y elige cuál deseas conservar. La opción elegida se
            validará nuevamente con el servidor.
          </p>
        </div>

        {/* Comparación 2 columnas */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Columna 1: Versión Local (Mi edición) */}
          <div className="flex flex-col justify-between rounded-2xl border border-[var(--fm-pending)]/30 bg-[rgba(228,179,99,0.03)] p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/8 pb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--fm-pending)]">
                  Tu versión (local)
                </span>
                <span className="rounded-md bg-[var(--fm-pending)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--fm-pending)]">
                  Tu borrador
                </span>
              </div>

              {/* Título y Monto */}
              <div>
                <p className="truncate font-semibold text-sm text-[var(--fm-warm-paper)]">
                  {draft.title || "Sin título"}
                </p>
                <div className="mt-1">
                  <Amount
                    value={draft.amount}
                    variant={draft.type}
                    size="md"
                    showSign
                  />
                </div>
              </div>

              {/* Atributos */}
              <div className="space-y-2 pt-1 text-xs text-[var(--fm-text-muted)]">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-[var(--fm-text-muted)] shrink-0" />
                  <span>{formatDateEs(new Date(draft.occurredAtMillis))}</span>
                </div>

                <div className="flex items-center gap-2">
                  <LocalCategoryIcon
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: localCategory?.color }}
                  />
                  <span className="truncate text-[var(--fm-text-soft)]">
                    {localCategory?.name || "Sin categoría"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {localAccount ? (
                    <AccountIcon
                      iconType={localAccount.iconType}
                      iconKey={localAccount.iconKey}
                      color={localAccount.color}
                      size="xs"
                    />
                  ) : (
                    <Tag className="h-3.5 w-3.5 text-[var(--fm-text-muted)] shrink-0" />
                  )}
                  <span className="truncate text-[var(--fm-text-soft)]">
                    {localAccount?.name || "Sin cuenta"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-[var(--fm-text-muted)] shrink-0" />
                  <span className="text-[var(--fm-text-soft)]">
                    {draft.householdId
                      ? `Cuenta en Hogar${localHouseholdCategory ? ` (${localHouseholdCategory.name})` : ""}`
                      : "Solo personal"}
                  </span>
                </div>

                {draft.note && (
                  <div className="flex items-start gap-2 pt-1 border-t border-white/6">
                    <FileText className="mt-0.5 h-3.5 w-3.5 text-[var(--fm-text-muted)] shrink-0" />
                    <p className="italic text-[11px] text-[var(--fm-text-muted)] line-clamp-2">
                      &quot;{draft.note}&quot;
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-white/8">
              <FinanceButton
                type="button"
                tone="filled"
                className="w-full justify-center"
                onClick={() => void onKeepLocal()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Guardando..." : "Conservar mi versión"}
              </FinanceButton>
            </div>
          </div>

          {/* Columna 2: Versión Servidor (Remota) */}
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/8 pb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--fm-text-soft)]">
                  Versión del servidor
                </span>
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--fm-text-muted)]">
                  Remoto
                </span>
              </div>

              {serverMovement ? (
                <>
                  {/* Título y Monto */}
                  <div>
                    <p className="truncate font-semibold text-sm text-[var(--fm-warm-paper)]">
                      {serverMovement.title || "Sin título"}
                    </p>
                    <div className="mt-1">
                      <Amount
                        value={serverMovement.amount}
                        variant={serverMovement.type}
                        size="md"
                        showSign
                      />
                    </div>
                  </div>

                  {/* Atributos */}
                  <div className="space-y-2 pt-1 text-xs text-[var(--fm-text-muted)]">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-[var(--fm-text-muted)] shrink-0" />
                      <span>
                        {formatDateEs(new Date(serverMovement.occurredAtMillis))}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <ServerCategoryIcon
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: serverCategory?.color }}
                      />
                      <span className="truncate text-[var(--fm-text-soft)]">
                        {serverCategory?.name || "Sin categoría"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {serverAccount ? (
                        <AccountIcon
                          iconType={serverAccount.iconType}
                          iconKey={serverAccount.iconKey}
                          color={serverAccount.color}
                          size="xs"
                        />
                      ) : (
                        <Tag className="h-3.5 w-3.5 text-[var(--fm-text-muted)] shrink-0" />
                      )}
                      <span className="truncate text-[var(--fm-text-soft)]">
                        {serverAccount?.name || "Sin cuenta"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-[var(--fm-text-muted)] shrink-0" />
                      <span className="text-[var(--fm-text-soft)]">
                        {serverMovement.householdId
                          ? `Cuenta en Hogar${serverHouseholdCategory ? ` (${serverHouseholdCategory.name})` : ""}`
                          : "Solo personal"}
                      </span>
                    </div>

                    {serverMovement.note && (
                      <div className="flex items-start gap-2 pt-1 border-t border-white/6">
                        <FileText className="mt-0.5 h-3.5 w-3.5 text-[var(--fm-text-muted)] shrink-0" />
                        <p className="italic text-[11px] text-[var(--fm-text-muted)] line-clamp-2">
                          &quot;{serverMovement.note}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-6 text-center text-xs text-[var(--fm-text-muted)]">
                  El movimiento fue eliminado del servidor en otra sesión.
                </div>
              )}
            </div>

            <div className="pt-4 mt-3 border-t border-white/8">
              <FinanceButton
                type="button"
                tone="outlined"
                variant="outline"
                className="w-full justify-center"
                onClick={() => void onKeepServer()}
                disabled={isSubmitting}
              >
                {serverMovement
                  ? "Conservar versión del servidor"
                  : "Aceptar eliminación remota"}
              </FinanceButton>
            </div>
          </div>
        </div>
      </div>
    </FinanceDialog>
  );
}
