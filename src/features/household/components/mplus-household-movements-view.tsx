"use client";

import { useMemo, useState } from "react";
import {
  CreditCard,
  Edit2,
  Search,
  Tag,
  User,
  X,
} from "lucide-react";

import { correctPartnerMovementCategory } from "@/features/household/services/read-household-movements";
import { HouseholdAmount } from "@/features/household/components/ui/household-amount";
import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdCard } from "@/features/household/components/ui/household-card";
import { HouseholdDialog } from "@/features/household/components/ui/household-dialog";
import { HouseholdEmptyState } from "@/features/household/components/ui/household-empty-state";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import { formatDateEs } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import type {
  MplusHousehold,
  MplusHouseholdExpenseCategory,
  MplusHouseholdMember,
  MplusMemberAccountLabel,
  MplusMemberCategoryLabel,
  MplusMovement,
} from "@/lib/mplus/models";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

type Props = {
  household: MplusHousehold;
  members: MplusHouseholdMember[];
  categories: MplusHouseholdExpenseCategory[];
  categoryLabels: MplusMemberCategoryLabel[];
  accountLabels: MplusMemberAccountLabel[];
  movements: MplusMovement[];
  currentUid: string;
};

export function MplusHouseholdMovementsView({
  household,
  members,
  categories,
  categoryLabels,
  accountLabels,
  movements,
  currentUid,
}: Props) {
  const masked = useUiPreferencesStore((state) => state.balancesHidden);
  const applyCommittedMovement = useMplusHouseholdStore(
    (state) => state.applyCommittedMovement,
  );
  const applyCommittedMapping = useMplusHouseholdStore(
    (state) => state.applyCommittedMapping,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

  const [selectedMovement, setSelectedMovement] = useState<MplusMovement | null>(null);
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [targetCategoryId, setTargetCategoryId] = useState("");
  const [isSubmittingReclass, setIsSubmittingReclass] = useState(false);
  const [reclassError, setReclassError] = useState<string | null>(null);

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.userId, m])),
    [members],
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const categoryLabelMap = useMemo(
    () => new Map(categoryLabels.map((l) => [l.id, l])),
    [categoryLabels],
  );

  const accountLabelMap = useMemo(
    () => new Map(accountLabels.map((l) => [l.id, l])),
    [accountLabels],
  );

  const activeExpenseCategories = useMemo(
    () => categories.filter((c) => c.state === "active"),
    [categories],
  );

  // Filtros combinables en memoria sobre el mes cargado (§19.3)
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.trim().toLowerCase();
        if (!m.title.toLowerCase().includes(query)) return false;
      }

      if (selectedMemberId !== "all" && m.ownerId !== selectedMemberId) {
        return false;
      }

      if (selectedType !== "all" && m.type !== selectedType) {
        return false;
      }

      if (selectedCategoryId !== "all") {
        if (selectedCategoryId === "unclassified") {
          if (m.type !== "expense" || m.householdCategoryId !== null) return false;
        } else if (m.householdCategoryId !== selectedCategoryId) {
          return false;
        }
      }

      if (selectedAccountId !== "all") {
        if (selectedAccountId === "unassigned") {
          if (m.accountId !== null) return false;
        } else if (m.accountId !== selectedAccountId) {
          return false;
        }
      }

      return true;
    });
  }, [
    movements,
    searchQuery,
    selectedMemberId,
    selectedType,
    selectedCategoryId,
    selectedAccountId,
  ]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedMemberId !== "all" ||
    selectedType !== "all" ||
    selectedCategoryId !== "all" ||
    selectedAccountId !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedMemberId("all");
    setSelectedType("all");
    setSelectedCategoryId("all");
    setSelectedAccountId("all");
  };

  const handleStartReclassify = (movement: MplusMovement) => {
    setSelectedMovement(movement);
    setTargetCategoryId(movement.householdCategoryId ?? "");
    setReclassError(null);
    setIsReclassifying(true);
  };

  const handleSaveReclassify = async () => {
    if (!selectedMovement || !targetCategoryId) return;
    setIsSubmittingReclass(true);
    setReclassError(null);

    const outcome = await correctPartnerMovementCategory({
      householdId: household.id,
      movement: selectedMovement,
      targetHouseholdCategoryId: targetCategoryId,
      updatedByUid: currentUid,
    });

    setIsSubmittingReclass(false);

    if (outcome.kind === "success") {
      applyCommittedMovement(outcome.value.updatedMovement);
      applyCommittedMapping(outcome.value.mapping);
      setIsReclassifying(false);
      setSelectedMovement(outcome.value.updatedMovement);
    } else {
      setReclassError(
        outcome.kind === "conflict"
          ? "El movimiento cambió remotamente. Actualiza e inténtalo de nuevo."
          : outcome.message || "Error al clasificar el movimiento.",
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de Búsqueda y Filtros */}
      <HouseholdCard className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--hh-text-muted)]" />
            <input
              className="h-10 w-full rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] pl-9 pr-4 text-sm text-[var(--hh-text)] placeholder:text-[var(--hh-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
              placeholder="Buscar por título..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--hh-text-muted)] hover:text-[var(--hh-text)]"
                type="button"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <HouseholdButton size="sm" variant="ghost" onClick={clearFilters}>
              Limpiar filtros
            </HouseholdButton>
          )}
        </div>

        {/* Selectores de filtros */}
        <div className="grid gap-3 sm:grid-cols-4">
          {/* Miembro */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--hh-text-muted)]">
              Miembro
            </label>
            <select
              className="h-9 w-full rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] px-3 text-xs font-medium text-[var(--hh-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
            >
              <option value="all">Todos los miembros</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userId === currentUid ? `${m.displayName} (Tú)` : m.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--hh-text-muted)]">
              Tipo
            </label>
            <select
              className="h-9 w-full rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] px-3 text-xs font-medium text-[var(--hh-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="all">Todos los tipos</option>
              <option value="expense">Solo gastos</option>
              <option value="income">Solo ingresos</option>
            </select>
          </div>

          {/* Categoría de Hogar */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--hh-text-muted)]">
              Categoría Hogar
            </label>
            <select
              className="h-9 w-full rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] px-3 text-xs font-medium text-[var(--hh-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
            >
              <option value="all">Todas las categorías</option>
              <option value="unclassified">Por clasificar</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.state === "archived" ? "(Archivada)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Cuenta */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--hh-text-muted)]">
              Cuenta origen
            </label>
            <select
              className="h-9 w-full rounded-xl border border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] px-3 text-xs font-medium text-[var(--hh-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hh-focus-ring)]"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              <option value="all">Todas las cuentas</option>
              <option value="unassigned">Sin cuenta</option>
              {accountLabels.map((a) => (
                <option key={a.id} value={a.accountId}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </HouseholdCard>

      {/* Lista de Movimientos */}
      {filteredMovements.length === 0 ? (
        <HouseholdCard className="py-12">
          <HouseholdEmptyState
            title="Sin resultados"
            description={
              hasActiveFilters
                ? "No encontramos movimientos compartidos con los filtros seleccionados."
                : "No hay movimientos compartidos registrados en este período."
            }
          />
        </HouseholdCard>
      ) : (
        <HouseholdCard className="divide-y divide-[var(--hh-border-soft)] p-0 overflow-hidden">
          {filteredMovements.map((movement) => {
            const member = memberMap.get(movement.ownerId);
            const isOwner = movement.ownerId === currentUid;
            const cat = movement.householdCategoryId
              ? categoryMap.get(movement.householdCategoryId)
              : null;
            const catLabel = categoryLabelMap.get(
              `${movement.ownerId}__${movement.categoryId}`,
            );
            const isUnclassified =
              movement.type === "expense" && movement.householdCategoryId === null;

            const categoryName =
              movement.type === "expense"
                ? cat?.name ?? "Por clasificar"
                : catLabel?.name ?? "Ingreso";

            const iconKey =
              movement.type === "expense"
                ? cat?.iconKey ?? "other"
                : catLabel?.iconKey ?? "salary";

            const color =
              movement.type === "expense"
                ? cat?.color ?? "#94A3B8"
                : catLabel?.color ?? "#22C55E";

            const Icon = resolveCategoryIcon(iconKey, movement.type);

            return (
              <button
                key={movement.id}
                type="button"
                className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-[var(--hh-surface-subtle)] focus-visible:outline-none focus-visible:bg-[var(--hh-surface-subtle)]"
                onClick={() => setSelectedMovement(movement)}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `${color}22`,
                      color,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--hh-text)]">
                      {movement.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--hh-text-muted)]">
                      <span>{formatDateEs(new Date(movement.occurredAtMillis))}</span>
                      <span>·</span>
                      <span className={isUnclassified ? "font-semibold text-[var(--hh-pending)]" : ""}>
                        {categoryName}
                      </span>
                      <span>·</span>
                      <span>{isOwner ? "Registrado por ti" : `Por ${member?.displayName ?? "Pareja"}`}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {isUnclassified && (
                    <span className="hidden sm:inline-flex items-center rounded-lg bg-[var(--hh-pending)]/12 px-2.5 py-1 text-xs font-semibold text-[var(--hh-pending)]">
                      Por clasificar
                    </span>
                  )}
                  <HouseholdAmount
                    className="text-base font-bold"
                    masked={masked}
                    value={movement.amount}
                    variant={movement.type}
                  />
                </div>
              </button>
            );
          })}
        </HouseholdCard>
      )}

      {/* Diálogo de Detalle de Movimiento Compartido (Solo Lectura) */}
      <HouseholdDialog
        open={Boolean(selectedMovement) && !isReclassifying}
        title="Detalle del movimiento compartido"
        subtitle="Movimiento consolidado del libro compartido"
        onClose={() => setSelectedMovement(null)}
      >
        {selectedMovement && (() => {
          const member = memberMap.get(selectedMovement.ownerId);
          const isOwner = selectedMovement.ownerId === currentUid;
          const cat = selectedMovement.householdCategoryId
            ? categoryMap.get(selectedMovement.householdCategoryId)
            : null;
          const catLabel = categoryLabelMap.get(
            `${selectedMovement.ownerId}__${selectedMovement.categoryId}`,
          );
          const accLabel = selectedMovement.accountId
            ? accountLabelMap.get(
                `${selectedMovement.ownerId}__${selectedMovement.accountId}`,
              )
            : null;
          const isUnclassified =
            selectedMovement.type === "expense" &&
            selectedMovement.householdCategoryId === null;

          return (
            <div className="space-y-5">
              {/* Encabezado Monto */}
              <div className="flex flex-col items-center justify-center rounded-2xl bg-[var(--hh-surface-subtle)] p-6 text-center">
                <HouseholdAmount
                  className="font-[var(--font-display)] font-bold text-3xl"
                  masked={masked}
                  value={selectedMovement.amount}
                  variant={selectedMovement.type}
                />
                <p className="mt-1 text-sm font-semibold text-[var(--hh-text)]">
                  {selectedMovement.title}
                </p>
                <p className="mt-0.5 text-xs text-[var(--hh-text-muted)]">
                  {formatDateEs(new Date(selectedMovement.occurredAtMillis))}
                </p>
              </div>

              {/* Atributos */}
              <div className="divide-y divide-[var(--hh-border-soft)] text-sm">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[var(--hh-text-muted)] flex items-center gap-2">
                    <User className="h-4 w-4" /> Registrado por
                  </span>
                  <span className="font-medium text-[var(--hh-text)]">
                    {isOwner ? "Tú" : member?.displayName ?? "Pareja"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[var(--hh-text-muted)] flex items-center gap-2">
                    <Tag className="h-4 w-4" /> Categoría de Hogar
                  </span>
                  <span className={cn("font-medium", isUnclassified ? "text-[var(--hh-pending)] font-semibold" : "text-[var(--hh-text)]")}>
                    {cat?.name ?? "Por clasificar"}
                  </span>
                </div>

                {catLabel && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[var(--hh-text-muted)] flex items-center gap-2">
                      <Tag className="h-4 w-4" /> Categoría Personal
                    </span>
                    <span className="font-medium text-[var(--hh-text)]">
                      {catLabel.name}
                    </span>
                  </div>
                )}

                {accLabel && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[var(--hh-text-muted)] flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> Cuenta informada
                    </span>
                    <span className="font-medium text-[var(--hh-text)]">
                      {accLabel.name}
                    </span>
                  </div>
                )}

                {selectedMovement.note && (
                  <div className="py-2.5">
                    <span className="text-xs font-semibold text-[var(--hh-text-muted)] block mb-1">
                      Nota
                    </span>
                    <p className="text-sm text-[var(--hh-text)] bg-[var(--hh-surface-subtle)] rounded-xl p-3">
                      {selectedMovement.note}
                    </p>
                  </div>
                )}
              </div>

              {/* Botón de Clasificar / Corregir para el compañero (§9.4) */}
              {selectedMovement.type === "expense" && (
                <div className="pt-2">
                  <HouseholdButton
                    className="w-full justify-center"
                    tone="filled"
                    onClick={() => handleStartReclassify(selectedMovement)}
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    {isUnclassified ? "Clasificar gasto para el hogar" : "Cambiar categoría de hogar"}
                  </HouseholdButton>
                </div>
              )}
            </div>
          );
        })()}
      </HouseholdDialog>

      {/* Diálogo de Reclasificación de Gasto (§9.4, §14) */}
      <HouseholdDialog
        open={isReclassifying}
        title="Clasificar gasto para el hogar"
        subtitle="Elige la categoría de hogar adecuada. Finanzas M recordará esta elección para futuros gastos similares de tu pareja."
        onClose={() => setIsReclassifying(false)}
      >
        {selectedMovement && (
          <div className="space-y-4">
            {reclassError && (
              <div
                role="alert"
                className="rounded-xl border border-[var(--hh-destructive-border)] bg-[var(--hh-destructive-border)]/10 p-3 text-xs text-[var(--hh-destructive-content)]"
              >
                {reclassError}
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--hh-text-muted)]">
                Selecciona la categoría de Hogar
              </label>
              <div className="grid max-h-60 gap-2 overflow-y-auto pr-1">
                {activeExpenseCategories.map((c) => {
                  const Icon = resolveCategoryIcon(c.iconKey, "expense");
                  const isSelected = targetCategoryId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                        isSelected
                          ? "border-[var(--hh-primary-action)] bg-[var(--hh-primary-action)]/10 text-[var(--hh-text)]"
                          : "border-[var(--hh-border)] bg-[var(--hh-surface-subtle)] text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-elevated)]",
                      )}
                      onClick={() => setTargetCategoryId(c.id)}
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: `${c.color}22`,
                          color: c.color,
                        }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-sm">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <HouseholdButton
                className="flex-1 justify-center"
                disabled={isSubmittingReclass}
                variant="ghost"
                onClick={() => setIsReclassifying(false)}
              >
                Cancelar
              </HouseholdButton>
              <HouseholdButton
                className="flex-1 justify-center"
                disabled={!targetCategoryId || isSubmittingReclass}
                tone="filled"
                onClick={handleSaveReclassify}
              >
                {isSubmittingReclass ? "Guardando..." : "Guardar clasificación"}
              </HouseholdButton>
            </div>
          </div>
        )}
      </HouseholdDialog>
    </div>
  );
}
