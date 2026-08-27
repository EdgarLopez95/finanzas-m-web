"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { AccountIcon } from "@/components/finance/account-icon";
import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceDropdown } from "@/components/finance/finance-dropdown";
import { FinanceShimmer } from "@/components/finance/finance-shimmer";
import { FinanceTextField } from "@/components/finance/finance-text-field";
import { IconSelect } from "@/components/finance/icon-select";
import { PersonalMovementDetailDialog } from "@/features/movements/components/personal-movement-detail-dialog";
import { PersonalTransactionRow } from "@/components/finance/personal-transaction-row";
import {
  applyMovementFilters,
  groupRowsByDay,
  purgeCountdownLabel,
  type MovementFilters,
  type MplusMovementRow,
} from "@/features/movements/lib/personal-month-view-model";
import { useMovementMutations } from "@/features/movements/hooks/use-movement-mutations";
import {
  useMplusCatalogs,
  useMplusPersonal,
} from "@/features/movements/hooks/use-mplus-personal";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import type { MovementType } from "@/lib/mplus/enums";
import type { MplusMovement } from "@/lib/mplus/models";
import { useMplusComposerStore } from "@/stores/mplus-composer-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

/**
 * Historial Personal del contrato v1 (matriz W2).
 *
 * Conserva la barra de filtros y la lista agrupada por dia de la Web base, con
 * los mismos componentes y las mismas clases. Los cambios son los aprobados:
 *
 * - filtros a tipo / categoria / cuenta + busqueda por titulo;
 * - se retiran el filtro de bolsillo y el de titularidad (no existen en M+);
 * - se añade el acceso a la Papelera como segundo modo de la misma lista.
 *
 * Todo el filtrado ocurre en cliente sobre el mes ya cargado, como exige el
 * contrato §19.1: no multiplica indices ni cambia los totales del tablero.
 */

type ListMode = "active" | "trash";

export function MplusMovementsView() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams?.get("categoryId") || searchParams?.get("category") || "all";
  const initialType = (searchParams?.get("type") as MovementType) || "all";
  const initialAccount = searchParams?.get("accountId") || "all";

  const { rows, trashRows, status, error, isLoading } = useMplusPersonal();
  const { allCategories, allAccounts } = useMplusCatalogs();
  const movements = useMplusPersonalStore((state) => state.movements);
  const trashed = useMplusPersonalStore((state) => state.trashed);
  const refresh = useMplusPersonalStore((state) => state.refresh);

  const openEdit = useMplusComposerStore((state) => state.openEdit);
  const openTrash = useMplusComposerStore((state) => state.openTrash);
  const mutations = useMovementMutations();

  const [mode, setMode] = useState<ListMode>("active");
  const [selectedMovement, setSelectedMovement] = useState<MplusMovement | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MovementType | "all">(
    initialType === "expense" || initialType === "income" || initialType === "transfer"
      ? initialType
      : "all",
  );
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);
  const [accountFilter, setAccountFilter] = useState<string>(initialAccount);

  useEffect(() => {
    const categoryParam = searchParams?.get("categoryId") || searchParams?.get("category");
    if (categoryParam) {
      setCategoryFilter(categoryParam);
    }
    const typeParam = searchParams?.get("type") as MovementType | null;
    if (typeParam && (typeParam === "expense" || typeParam === "income" || typeParam === "transfer")) {
      setTypeFilter(typeParam);
    }
    const accountParam = searchParams?.get("accountId");
    if (accountParam) {
      setAccountFilter(accountParam);
    }
  }, [searchParams]);

  const categoryById = useMemo(
    () => new Map(allCategories.map((c) => [c.id, c])),
    [allCategories],
  );

  const accountById = useMemo(
    () => new Map(allAccounts.map((a) => [a.id, a])),
    [allAccounts],
  );

  const deferredSearch = useDeferredValue(search);

  const filters: MovementFilters = useMemo(
    () => ({
      search: deferredSearch,
      type: typeFilter,
      categoryId: categoryFilter,
      accountId: accountFilter as MovementFilters["accountId"],
    }),
    [accountFilter, categoryFilter, deferredSearch, typeFilter],
  );

  const sourceRows = mode === "active" ? rows : trashRows;
  const filteredRows = useMemo(
    () => applyMovementFilters(sourceRows, filters),
    [filters, sourceRows],
  );
  const groupedRows = useMemo(() => groupRowsByDay(filteredRows), [filteredRows]);

  // El documento completo es lo que necesitan las mutaciones (revision, estado
  // de ciclo de vida). La fila es solo su proyeccion visual.
  const movementById = useMemo(() => {
    const map = new Map<string, MplusMovement>();
    for (const movement of [...movements, ...trashed]) map.set(movement.id, movement);
    return map;
  }, [movements, trashed]);

  const activeFilterCount = [
    typeFilter !== "all",
    categoryFilter !== "all",
    accountFilter !== "all",
    search.trim() !== "",
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setTypeFilter("all");
    setCategoryFilter("all");
    setAccountFilter("all");
    setSearch("");
  };

  if (status === "error") {
    return (
      <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" variant="default">
        <div role="alert" className="space-y-4">
          <EmptyState
            title="No pudimos cargar tus movimientos"
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
      <FinanceCard className="border-white/8 bg-[rgba(18,25,39,0.96)]" variant="default">
        <div className="flex flex-col xl:flex-row xl:items-center gap-4 xl:gap-5 flex-wrap">
          {/* 1. Busqueda por titulo */}
          <div className="relative w-full xl:w-56 shrink-0">
            <Search className="pointer-events-none absolute inset-y-0 left-4 my-auto h-4 w-4 text-[var(--fm-text-muted)]" />
            <FinanceTextField
              className="pl-11 h-9"
              containerClassName="mb-0"
              label="Buscar movimiento"
              labelClassName="sr-only"
              placeholder="Buscar movimiento..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {/* 2. Tipo */}
          <div className="flex flex-wrap gap-2 shrink-0 xl:border-l xl:border-white/8 xl:pl-5">
            {(
              [
                ["all", "Todos"],
                ["income", "Ingresos"],
                ["expense", "Gastos"],
              ] as const
            ).map(([value, label]) => {
              const active = typeFilter === value;
              return (
                <FinanceButton
                  key={value}
                  className={
                    active
                      ? "h-9 bg-[var(--fm-surface-dark-alt)] text-[var(--fm-warm-paper)]"
                      : "h-9 text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]"
                  }
                  onClick={() => setTypeFilter(value)}
                  size="sm"
                  tone={active ? "filled" : "text"}
                  type="button"
                  variant={active ? "default" : "ghost"}
                >
                  {label}
                </FinanceButton>
              );
            })}
          </div>

          {/* 3. Selects de cuenta y categoria */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 xl:border-l xl:border-white/8 xl:pl-5 shrink-0">
            <div className="w-full sm:w-48">
              <IconSelect
                id="filterAccountId"
                value={accountFilter}
                onChange={setAccountFilter}
                className="h-9 rounded-xl border-white/8 bg-[rgba(18,25,39,0.96)] text-xs"
                options={[
                  { id: "all", label: "Todas las cuentas" },
                  { id: "none", label: "Sin cuenta" },
                  ...allAccounts.map((account) => ({
                    id: account.id,
                    label: account.name,
                    color: account.color,
                    icon: (
                      <AccountIcon
                        iconType={account.iconType}
                        iconKey={account.iconKey}
                        color={account.color}
                        size="xs"
                      />
                    ),
                  })),
                ]}
              />
            </div>

            <div className="w-full sm:w-48">
              <IconSelect
                id="filterCategoryId"
                value={categoryFilter}
                onChange={setCategoryFilter}
                className="h-9 rounded-xl border-white/8 bg-[rgba(18,25,39,0.96)] text-xs"
                options={[
                  { id: "all", label: "Todas las categorias" },
                  ...allCategories
                    .filter(
                      (category) => typeFilter === "all" || category.type === typeFilter,
                    )
                    .map((category) => {
                      const Icon = resolveCategoryIcon(category.iconKey, category.type);
                      return {
                        id: category.id,
                        label: category.name,
                        color: category.color,
                        icon: <Icon className="h-3.5 w-3.5" />,
                      };
                    }),
                ]}
              />
            </div>
          </div>

          {/* 4. Limpiar */}
          {activeFilterCount > 0 && (
            <div className="xl:ml-auto w-full xl:w-auto flex justify-end">
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex w-full xl:w-auto shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 h-9 text-xs text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                <span>Limpiar</span>
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--fm-pending)] text-[9px] font-bold text-slate-950">
                  {activeFilterCount}
                </span>
              </button>
            </div>
          )}
        </div>
      </FinanceCard>

      <FinanceCard
        className="border-white/8 bg-[rgba(18,25,39,0.96)]"
        variant="default"
        headerRight={
          /* Acceso a la Papelera: mismo control que el filtro de tipo. */
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["active", "Movimientos"],
                ["trash", "Papelera"],
              ] as const
            ).map(([value, label]) => {
              const active = mode === value;
              return (
                <FinanceButton
                  key={value}
                  className={
                    active
                      ? "h-9 bg-[var(--fm-surface-dark-alt)] text-[var(--fm-warm-paper)]"
                      : "h-9 text-[var(--fm-text-muted)] hover:text-[var(--fm-warm-paper)]"
                  }
                  onClick={() => setMode(value)}
                  size="sm"
                  tone={active ? "filled" : "text"}
                  type="button"
                  variant={active ? "default" : "ghost"}
                >
                  {label}
                  {value === "trash" && trashRows.length > 0 ? ` (${trashRows.length})` : ""}
                </FinanceButton>
              );
            })}
          </div>
        }
      >
        {mode === "trash" ? (
          <p className="mb-4 text-[12px] leading-snug text-[var(--fm-text-muted)]">
            Un movimiento eliminado queda 30 dias aqui. Al vencer se borra
            definitivamente y deja de contar en cualquier mes.
          </p>
        ) : null}

        {isLoading ? (
          <div className="space-y-3">
            <FinanceShimmer className="h-12 w-full" />
            <FinanceShimmer className="h-12 w-full" />
            <FinanceShimmer className="h-12 w-full" />
          </div>
        ) : !groupedRows.length ? (
          <EmptyState
            title={mode === "trash" ? "Papelera vacia" : "Sin movimientos"}
            description={
              mode === "trash"
                ? "Aqui apareceran los movimientos que elimines, por si te arrepientes."
                : activeFilterCount > 0
                  ? "No encontramos movimientos para ese filtro."
                  : "Aun no registraste movimientos en este mes."
            }
          />
        ) : (
          <div className="space-y-6">
            {groupedRows.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="px-1 text-[11px] uppercase tracking-[0.22em] text-[var(--fm-text-muted)]">
                  {group.label}
                </p>
                <div className="divide-y divide-white/8">
                  {group.rows.map((row) => {
                    const movement = movementById.get(row.id);
                    if (!movement) return null;

                    return (
                      <div key={row.id} className="py-2.5 first:pt-0 last:pb-0 px-1 -mx-1">
                        <PersonalTransactionRow
                          row={row}
                          onSelect={mode === "active" ? () => setSelectedMovement(movement) : undefined}
                          actionSlot={
                            mode === "active" ? (
                              <FinanceDropdown
                                align="right"
                                items={[
                                  { label: "Editar", onClick: () => openEdit(movement) },
                                  {
                                    label: "Eliminar",
                                    onClick: () => openTrash(movement),
                                    variant: "destructive" as const,
                                  },
                                ]}
                              />
                            ) : (
                              <TrashRowActions
                                row={row}
                                disabled={mutations.isSubmitting}
                                onRestore={() => void mutations.restore(movement)}
                              />
                            )
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {mutations.feedback.kind === "conflict" || mutations.feedback.kind === "error" ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.08)] px-3.5 py-2.5 text-sm text-[var(--fm-expense)]"
          >
            {mutations.feedback.message}
          </p>
        ) : null}
      </FinanceCard>

      {/* Diálogo de Detalle Personal (Solo lectura con acciones Editar/Eliminar) */}
      <PersonalMovementDetailDialog
        open={Boolean(selectedMovement)}
        movement={selectedMovement}
        category={
          selectedMovement?.categoryId
            ? categoryById.get(selectedMovement.categoryId) ?? null
            : null
        }
        account={
          selectedMovement?.accountId
            ? accountById.get(selectedMovement.accountId) ?? null
            : null
        }
        onClose={() => setSelectedMovement(null)}
        onEdit={(mov) => {
          setSelectedMovement(null);
          openEdit(mov);
        }}
        onDelete={(mov) => {
          setSelectedMovement(null);
          openTrash(mov);
        }}
      />
    </>
  );
}

/** Acciones de una fila en Papelera: vencimiento visible + restaurar. */
function TrashRowActions({
  row,
  disabled,
  onRestore,
}: {
  row: MplusMovementRow;
  disabled: boolean;
  onRestore: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-[11px] text-[var(--fm-text-muted)] sm:inline">
        {purgeCountdownLabel(row.purgeAfterMillis, Date.now())}
      </span>
      <FinanceButton
        type="button"
        size="sm"
        tone="text"
        variant="ghost"
        disabled={disabled}
        onClick={onRestore}
        className="h-8 text-[var(--fm-text-soft)] hover:text-[var(--fm-warm-paper)]"
      >
        Restaurar
      </FinanceButton>
    </div>
  );
}
