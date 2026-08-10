"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdTextField } from "@/features/household/components/ui/household-text-field";
import { HouseholdCategorySelect } from "@/features/household/components/ui/household-category-select";
import { useUpdateHouseholdEvent } from "@/features/household/hooks/use-update-household-event";
import { resolveEditHouseholdCategories } from "@/features/household/lib/household-category-selection";
import { formatDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import { formatCurrencyCop } from "@/lib/format/currency";
import { useFocusTrap } from "@/features/household/hooks/use-focus-trap";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import type { HouseholdCategory, HouseholdEvent, HouseholdMemberProfile } from "@/types/household";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  event: HouseholdEvent;
  householdId: string;
  currentUid: string;
  memberIds: string[];
  memberProfiles: Record<string, HouseholdMemberProfile>;
  categories: HouseholdCategory[];
};

const resolveName = (
  userId: string,
  currentUid: string,
  memberProfiles: Record<string, HouseholdMemberProfile>,
): string => {
  if (userId === currentUid) return "Tú";
  return memberProfiles[userId]?.displayName || "Otro miembro";
};

export function EditHouseholdExpenseDialog({
  open,
  onClose,
  onSuccess,
  event,
  householdId,
  currentUid,
  memberIds,
  memberProfiles,
  categories,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { isSubmitting, error, submit, resetError } = useUpdateHouseholdEvent();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const selectableCategories = useMemo(() => {
    return resolveEditHouseholdCategories(categories, event.categoryId);
  }, [categories, event.categoryId]);

  // Validation
  const [submitted, setSubmitted] = useState(false);
  const titleError = submitted && !title.trim() ? "El título es obligatorio." : undefined;

  const hasSourceTransaction = !!event.sourceTransactionId;

  // Reset/Initialize state on open
  useEffect(() => {
    if (open && event) {
      setTitle(event.title || "");
      setDescription(event.notes || "");
      setDate(formatDateInputValue(event.eventDate ?? event.createdAt));
      setCategoryId(event.categoryId || selectableCategories[0]?.id || "");
      
      setSubmitted(false);
      resetError();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event]);

  // Keyboard / scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useFocusTrap(dialogRef, open, onClose);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (!title.trim() || !categoryId) return;

    const eventDate = parseDateInputAsLocalDate(date) ?? new Date();

    const ok = await submit({
      eventId: event.id,
      householdId,
      title: title.trim(),
      description: description.trim(),
      householdCategoryId: categoryId || "",
      eventDate: hasSourceTransaction ? undefined : eventDate,
      householdMemberIds: memberIds,
      availableCategories: categories,
    });

    if (ok) {
      onSuccess();
      onClose();
    }
  };

  const settlementModeLabel = (mode: string): string => {
    if (mode === "advancedByPayer") return "Pagó por adelantado";
    if (mode === "invitation") return "Invitación";
    if (mode === "eachPaysOwn") return "Cada uno paga lo suyo";
    return "Adelantado";
  };

  const originalPaidByUserId = event.paidByUserId || event.createdByUserId || currentUid;

  return (
    <div
      className="fixed inset-0 z-[98] flex items-end sm:items-center justify-center bg-[var(--hh-overlay)] px-4 pb-4 sm:py-8"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        data-fm-context="household"
        role="dialog"
        aria-modal="true"
        aria-label="Editar gasto del Hogar"
        tabIndex={-1}
        className="w-full max-w-lg rounded-[24px] border border-[var(--hh-border)]/[0.08] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--hh-surface-elevated)_96%,transparent),color-mix(in_srgb,var(--hh-surface)_98%,transparent))] shadow-xl flex flex-col max-h-[90vh] overflow-hidden outline-none animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
      >
        

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">

            {/* Título */}
            <HouseholdTextField
              label="Título *"
              placeholder="Ej: Mercado semanal, Recibo de luz…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              errorText={titleError}
              className="text-[16px] sm:text-[14px]"
            />

            {/* Descripción */}
            <HouseholdTextField
              label="Descripción (opcional)"
              placeholder="Notas adicionales del gasto"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-[16px] sm:text-[14px]"
            />

            {/* Fecha */}
            <div>
              <HouseholdTextField
                label="Fecha *"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={hasSourceTransaction}
                className="text-[16px] sm:text-[14px]"
              />
              {hasSourceTransaction && (
                <p className="mt-1 text-xs text-[var(--hh-text-muted)]">
                  La fecha no se puede cambiar porque este gasto está vinculado a un movimiento Personal.
                </p>
              )}
            </div>

            {/* Categoría */}
            {selectableCategories.length > 0 && (
              <div className="flex flex-col gap-2">
                <label htmlFor="edit-household-expense-category" className="text-[14px] font-medium text-[var(--hh-text)]">
                  Categoría del Hogar
                </label>
                <HouseholdCategorySelect
                  id="edit-household-expense-category"
                  value={categoryId}
                  onChange={setCategoryId}
                  className="h-11 text-[16px] sm:text-[14px]"
                  options={selectableCategories.map((cat) => {
                    const Icon = resolveCategoryIcon(cat.iconKey, "expense");
                    return {
                      id: cat.id,
                      label: cat.name + (cat.archived ? " (Archivada)" : ""),
                      color: cat.color,
                      icon: <Icon className="h-3.5 w-3.5" />,
                    };
                  })}
                />
              </div>
            )}

            {/* Contexto financiero (solo lectura) */}
            <div className="mt-4 pt-4 border-t border-[var(--hh-border)]/[0.06]">
              <p className="mb-3 text-[14px] font-medium text-[var(--hh-text)]">Detalles financieros</p>
              <div className="rounded-[16px] border border-[var(--hh-border-soft)] bg-[var(--hh-surface-elevated)] p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--hh-text-muted)]">Monto total</span>
                  <span className="font-medium text-[var(--hh-text)]">{formatCurrencyCop(event.amount || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--hh-text-muted)]">Pagado por</span>
                  <span className="font-medium text-[var(--hh-text)]">{resolveName(originalPaidByUserId, currentUid, memberProfiles)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--hh-text-muted)]">Modo de liquidación</span>
                  <span className="font-medium text-[var(--hh-text)]">{settlementModeLabel(event.settlementMode || "advancedByPayer")}</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--hh-text-muted)]">
                Para cambiar estos datos, elimina este gasto y registra uno nuevo.
              </p>
            </div>

            {/* Error global */}
            {error && (
              <div className="rounded-[12px] border border-[var(--hh-destructive-border)] bg-[var(--hh-surface)] px-3 py-2.5 text-sm text-[var(--hh-destructive-border)]">
                {error}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-1 border-t border-[var(--hh-border)]/[0.06] flex items-center justify-end gap-3 shrink-0">
            <HouseholdButton
              type="button" tone="text" variant="ghost"
              onClick={onClose} disabled={isSubmitting}
            >
              Cancelar
            </HouseholdButton>
            <HouseholdButton
              type="submit"
              tone="filled"
              disabled={isSubmitting || !categoryId}
              className="min-w-32 bg-[var(--hh-primary-action)] text-[var(--hh-text)] hover:bg-[color-mix(in_oklch,var(--hh-primary-action),white_8%)] shadow-none"
            >
              {isSubmitting ? "Guardando…" : "Guardar cambios"}
            </HouseholdButton>
          </div>
        </form>
      </div>
    </div>
  );
}
