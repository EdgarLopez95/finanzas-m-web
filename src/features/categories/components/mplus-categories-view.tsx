"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, MoreVertical, Pencil, Plus, X } from "lucide-react";

import { Amount } from "@/components/finance/amount";
import { CategoryBreakdownList } from "@/components/finance/category-breakdown-list";
import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceChip } from "@/components/finance/finance-chip";
import { MplusCategoryDialog } from "@/features/categories/components/mplus-category-dialog";
import {
  archiveMplusCategory,
  unarchiveMplusCategory,
} from "@/features/categories/services/mplus-category-service";
import { useMplusPersonal } from "@/features/movements/hooks/use-mplus-personal";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { formatPeriodLabel } from "@/lib/format/date";
import type { MovementType } from "@/lib/mplus/enums";
import type { MplusPersonalCategory } from "@/lib/mplus/models";
import { cn } from "@/lib/utils";
import { useAppContextStore } from "@/stores/app-context-store";
import { useAuthStore } from "@/stores/auth-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

/**
 * Categorias Personales del contrato v1 (matriz W2).
 *
 * Conserva las dos vistas de la Web base (distribucion y gestion), el mismo
 * control segmentado, el mismo boton punteado de alta y la misma lista con su
 * menu de opciones y confirmacion en linea.
 *
 * Cambios respecto de la Web base:
 *
 * - los catalogos de ingreso y gasto estan separados y son PLANOS: no existen
 *   subcategorias ni `parentId` (contrato §8.2);
 * - la distribucion es del mes seleccionado. El rango "Año" se retiro porque
 *   la consulta canonica del contrato (§19.1) es mensual: ofrecerlo obligaria
 *   a una consulta que el contrato no declara;
 * - se añade el listado de archivadas con su reactivacion, porque en M+
 *   archivar es la unica alternativa a borrar (§8.2).
 */

export function MplusCategoriesView() {
  const { expenseBreakdown, status, error } = useMplusPersonal();
  const categories = useMplusPersonalStore((state) => state.categories);
  const refresh = useMplusPersonalStore((state) => state.refresh);
  const applyCommittedCategory = useMplusPersonalStore((state) => state.applyCommittedCategory);
  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);
  const ownerId = useAuthStore((state) => state.user?.uid ?? "");

  const [viewMode, setViewMode] = useState<"report" | "manage">("report");
  const [activeKind, setActiveKind] = useState<MovementType>("expense");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MplusPersonalCategory | null>(null);

  // `?mode=manage` sigue funcionando igual que en la Web base.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "manage") {
      setViewMode("manage");
    }
  }, []);

  // La distribucion es siempre de gasto: es lo que la pantalla anuncia.
  const total = expenseBreakdown.reduce((sum, item) => sum + item.amount, 0);

  const activeCategories = useMemo(
    () =>
      categories.filter(
        (category) => category.type === activeKind && category.state === "active",
      ),
    [activeKind, categories],
  );

  const archivedCategories = useMemo(
    () =>
      categories.filter(
        (category) => category.type === activeKind && category.state === "archived",
      ),
    [activeKind, categories],
  );

  const runStateChange = async (
    category: MplusPersonalCategory,
    operation: typeof archiveMplusCategory,
  ) => {
    setPendingId(category.id);
    setActionError(null);
    try {
      const outcome = await operation(category);
      if (outcome.kind === "success") {
        if (outcome.replayed) {
          await refresh();
        } else {
          applyCommittedCategory(outcome.value);
        }
        setArchivingId(null);
        return;
      }
      setActionError(
        outcome.kind === "conflict"
          ? "Alguien más cambió esta categoría mientras la editabas. Vuelve a intentarlo."
          : outcome.kind === "unavailable"
            ? "No hay conexión con el servidor. El cambio NO se guardó."
            : outcome.message,
      );
    } catch (thrown) {
      setActionError(
        thrown instanceof Error ? thrown.message : "No se pudo actualizar la categoria.",
      );
    } finally {
      setPendingId(null);
    }
  };

  if (status === "error") {
    return (
      <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" variant="default">
        <div role="alert" className="space-y-4">
          <EmptyState
            title="No pudimos cargar tus categorias"
            description={error ?? "Revisa tu conexion e intenta de nuevo."}
          />
          <div className="flex justify-center">
            <FinanceButton type="button" size="sm" onClick={() => void refresh()}>
              Reintentar
            </FinanceButton>
          </div>
        </div>
      </FinanceCard>
    );
  }

  return (
    <>
      {/* Control segmentado de modo */}
      <div className="flex gap-2 rounded-2xl border border-white/8 bg-[rgba(18,25,39,0.92)] p-1 w-full max-w-md mx-auto mb-2">
        <FinanceButton
          className={cn(
            "flex-1 text-center justify-center rounded-xl py-2",
            viewMode === "report"
              ? "bg-[var(--fm-surface-dark-alt)] text-[var(--fm-warm-paper)] font-semibold"
              : "text-[var(--fm-text-muted)]",
          )}
          onClick={() => setViewMode("report")}
          size="sm"
          tone={viewMode === "report" ? "filled" : "text"}
          type="button"
          variant={viewMode === "report" ? "default" : "ghost"}
        >
          Distribución de gastos
        </FinanceButton>
        <FinanceButton
          className={cn(
            "flex-1 text-center justify-center rounded-xl py-2",
            viewMode === "manage"
              ? "bg-[var(--fm-surface-dark-alt)] text-[var(--fm-warm-paper)] font-semibold"
              : "text-[var(--fm-text-muted)]",
          )}
          onClick={() => setViewMode("manage")}
          size="sm"
          tone={viewMode === "manage" ? "filled" : "text"}
          type="button"
          variant={viewMode === "manage" ? "default" : "ghost"}
        >
          Mis categorías
        </FinanceButton>
      </div>

      {actionError ? (
        <p
          role="alert"
          className="rounded-xl border border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.08)] px-3.5 py-2.5 text-sm text-[var(--fm-expense)]"
        >
          {actionError}
        </p>
      ) : null}

      {viewMode === "report" ? (
        <>
          <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" variant="hero">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--fm-text-soft)]">
                  Total gastado en {formatPeriodLabel(selectedPeriod)}
                </p>
                <Amount
                  showSign={false}
                  size="hero"
                  value={total}
                  variant="expense"
                />
              </div>
            </div>
          </FinanceCard>

          <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" variant="default">
            {!expenseBreakdown.length ? (
              <EmptyState
                title="Sin gastos agrupables"
                description="No hay gastos de este mes para agrupar por categoria."
              />
            ) : (
              <CategoryBreakdownList
                items={expenseBreakdown.map((item) => ({
                  categoryId: item.categoryId,
                  name: item.name,
                  icon: item.iconKey,
                  iconKey: item.iconKey,
                  amount: item.amount,
                  share: item.share,
                  color: item.color,
                }))}
                type="expense"
              />
            )}
          </FinanceCard>
        </>
      ) : (
        <div className="space-y-6">
          {/* Control segmentado Gasto / Ingreso: catalogos separados (§8.2) */}
          <div className="flex gap-2 rounded-2xl border border-white/8 bg-[rgba(18,25,39,0.92)] p-1 w-fit">
            <FinanceButton
              className={cn(
                "rounded-xl py-1.5 px-4 font-semibold transition-all",
                activeKind === "expense"
                  ? "bg-[rgba(251,113,133,0.14)] text-[var(--fm-expense)] border border-[var(--fm-expense)]/10"
                  : "text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]",
              )}
              onClick={() => setActiveKind("expense")}
              size="sm"
              tone={activeKind === "expense" ? "filled" : "text"}
              type="button"
              variant={activeKind === "expense" ? "default" : "ghost"}
            >
              Gastos
            </FinanceButton>
            <FinanceButton
              className={cn(
                "rounded-xl py-1.5 px-4 font-semibold transition-all",
                activeKind === "income"
                  ? "bg-[rgba(52,211,153,0.14)] text-[var(--fm-income)] border border-[var(--fm-income)]/10"
                  : "text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]",
              )}
              onClick={() => setActiveKind("income")}
              size="sm"
              tone={activeKind === "income" ? "filled" : "text"}
              type="button"
              variant={activeKind === "income" ? "default" : "ghost"}
            >
              Ingresos
            </FinanceButton>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => {
                setEditingCategory(null);
                setDialogOpen(true);
              }}
              className={cn(
                "w-full h-14 rounded-2xl border border-dashed flex items-center justify-center gap-2.5 text-sm font-semibold transition-all cursor-pointer outline-none",
                activeKind === "expense"
                  ? "border-[var(--fm-expense)]/20 bg-[rgba(251,113,133,0.02)] text-[var(--fm-expense)] hover:bg-[rgba(251,113,133,0.06)] focus:ring-1 focus:ring-[var(--fm-expense)]/40"
                  : "border-[var(--fm-income)]/20 bg-[rgba(52,211,153,0.02)] text-[var(--fm-income)] hover:bg-[rgba(52,211,153,0.06)] focus:ring-1 focus:ring-[var(--fm-income)]/40",
              )}
              aria-label={`Crear nueva categoría de ${activeKind === "expense" ? "gasto" : "ingreso"}`}
            >
              <Plus className="h-4 w-4" />
              <span>Nueva categoría</span>
            </button>

            {!activeCategories.length ? (
              <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]">
                <EmptyState
                  title="Crea tu primera categoría"
                  description="Te ayudará a entender mejor tus movimientos."
                />
              </FinanceCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeCategories.map((category) => {
                  const IconComponent = resolveCategoryIcon(category.iconKey, activeKind);
                  const isMenuOpen = openMenuId === category.id;
                  const isConfirmingArchive = archivingId === category.id;
                  return (
                    <div
                      key={category.id}
                      className="rounded-2xl border border-white/8 bg-[rgba(18,25,39,0.96)] p-3.5 transition-colors hover:border-white/14 flex flex-col justify-between min-w-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10"
                            style={{
                              backgroundColor: `${category.color}22`,
                              borderColor: `${category.color}44`,
                              color: category.color,
                            }}
                          >
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <span className="font-semibold text-sm text-[var(--fm-warm-paper)] truncate">
                            {category.name}
                          </span>
                        </div>
                        <div className="relative shrink-0">
                          <button
                            className="p-2 rounded-xl text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] hover:bg-white/5 transition-all outline-none"
                            aria-label="Opciones de categoría"
                            onClick={() => setOpenMenuId(isMenuOpen ? null : category.id)}
                          >
                            <MoreVertical className="h-4.5 w-4.5" />
                          </button>
                          {isMenuOpen && (
                            <div className="absolute right-0 top-9 z-20 w-40 rounded-xl border border-white/10 bg-[rgba(18,25,39,0.98)] shadow-xl py-1">
                              <button
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--fm-warm-paper)] hover:bg-white/5 transition-colors"
                                onClick={() => {
                                  setEditingCategory(category);
                                  setDialogOpen(true);
                                  setOpenMenuId(null);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5 text-[var(--fm-text-muted)]" />
                                Editar
                              </button>
                              <button
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--fm-expense)] hover:bg-white/5 transition-colors"
                                onClick={() => {
                                  setArchivingId(category.id);
                                  setOpenMenuId(null);
                                }}
                              >
                                <Archive className="h-3.5 w-3.5" />
                                Archivar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {isConfirmingArchive && (
                        <div className="mt-3 rounded-xl border border-[var(--fm-expense)]/20 bg-[rgba(251,113,133,0.06)] px-3 py-2.5 flex items-center justify-between gap-3">
                          <span className="text-xs text-[var(--fm-text-soft)] truncate">
                            ¿Archivar <strong>{category.name}</strong>?
                          </span>
                          <div className="flex gap-2 shrink-0">
                            <button
                              className="text-xs text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] px-2 py-1 rounded-lg transition-colors"
                              onClick={() => setArchivingId(null)}
                              disabled={pendingId === category.id}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="text-xs text-[var(--fm-expense)] font-semibold px-2.5 py-1 rounded-lg border border-[var(--fm-expense)]/20 hover:bg-[rgba(251,113,133,0.1)] transition-colors disabled:opacity-50"
                              disabled={pendingId === category.id}
                              onClick={() => void runStateChange(category, archiveMplusCategory)}
                            >
                              {pendingId === category.id ? "..." : "Archivar"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {archivedCategories.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--fm-text-soft)]">
                    Archivadas
                  </p>
                  <FinanceChip
                    className="normal-case tracking-normal px-2 py-0.5 text-[10px]"
                    variant="neutral"
                  >
                    {archivedCategories.length}
                  </FinanceChip>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {archivedCategories.map((category) => {
                    const IconComponent = resolveCategoryIcon(category.iconKey, activeKind);
                    return (
                      <div
                        key={category.id}
                        className="rounded-2xl border border-white/8 bg-[rgba(18,25,39,0.7)] p-3.5 opacity-70 transition-opacity hover:opacity-100 flex items-center justify-between gap-3 min-w-0"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10"
                            style={{
                              backgroundColor: `${category.color}22`,
                              borderColor: `${category.color}44`,
                              color: category.color,
                            }}
                          >
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium text-[var(--fm-text-soft)] truncate">
                            {category.name}
                          </span>
                        </div>
                        <FinanceButton
                          type="button"
                          size="sm"
                          tone="text"
                          variant="ghost"
                          disabled={pendingId === category.id}
                          onClick={() => void runStateChange(category, unarchiveMplusCategory)}
                          className="h-8 text-[var(--fm-text-soft)] hover:text-[var(--fm-warm-paper)] shrink-0"
                        >
                          Reactivar
                        </FinanceButton>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      )}

      <MplusCategoryDialog
        open={dialogOpen}
        ownerId={ownerId}
        type={activeKind}
        category={editingCategory}
        onClose={() => {
          setDialogOpen(false);
          setEditingCategory(null);
        }}
      />
    </>
  );
}
