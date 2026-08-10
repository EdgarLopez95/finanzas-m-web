"use client";

import { useEffect, useRef, useState } from "react";
import { X, CalendarDays, Tag } from "lucide-react";

import { HouseholdAmount } from "@/features/household/components/ui/household-amount";
import { HouseholdButton } from "@/features/household/components/ui/household-button";
import { HouseholdChip } from "@/features/household/components/ui/household-chip";
import { HouseholdEmptyState } from "@/features/household/components/ui/household-empty-state";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { useAuthStore } from "@/stores/auth-store";
// PUENTE PERSONAL: "Anotar" abre el flujo de gasto propio del usuario (mueve dinero personal), por eso conserva el kit Finance.
import { FinanceButton } from "@/components/finance/finance-button";
import { formatDateEs } from "@/lib/format/date";
import { formatCurrencyCop } from "@/lib/format/currency";
import { resolveCategoryIcon } from "@/lib/categories/category-icons";
import type {
  HouseholdCategory,
  HouseholdDebt,
  HouseholdEvent,
  HouseholdEventShare,
  HouseholdMemberProfile,
} from "@/types/household";
import { useCancelHouseholdEvent } from "@/features/household/hooks/use-cancel-household-event";
import { useCancelPendingShare } from "@/features/household/hooks/use-cancel-pending-share";
import { useFocusTrap } from "@/features/household/hooks/use-focus-trap";
import { isActiveHouseholdDebtStatus, resolveHouseholdEventCancelBlock } from "@/features/household/lib/household-debt-lifecycle";
import {
  resolveDebtPaymentEligibility,
  resolvePayerUserId,
  buildDebtPaymentBlockedCopy,
} from "@/features/household/lib/auto-settle-debt";
import { EditHouseholdExpenseDialog } from "@/features/household/components/edit-household-expense-dialog";
import { CompleteShareDialog } from "@/features/household/components/complete-share-dialog";
import { DeclarePaymentDialog } from "@/features/household/components/declare-payment-dialog";
import { useUndoDeclaredDebtPayment } from "@/features/household/hooks/use-undo-declared-debt-payment";

type Props = {
  open: boolean;
  event: HouseholdEvent | null;
  categories: HouseholdCategory[];
  eventShares: HouseholdEventShare[];
  debts: HouseholdDebt[];
  currentUid: string | null;
  memberProfiles: Record<string, HouseholdMemberProfile>;
  onClose: () => void;
};

const resolvePhotoUrl = (
  userId: string,
  currentUid: string | null,
  selfPhotoUrl: string | null | undefined,
  memberProfiles: Record<string, HouseholdMemberProfile>,
): string | null | undefined => {
  if (!userId) return null;
  if (userId === currentUid) return selfPhotoUrl;
  return memberProfiles[userId]?.photoUrl;
};

const resolveName = (
  userId: string,
  currentUid: string | null,
  memberProfiles: Record<string, HouseholdMemberProfile>,
): string => {
  if (!userId) return "Miembro del hogar";
  if (userId === currentUid) return "Tú";
  return memberProfiles[userId]?.displayName || "Otro miembro";
};

const shareStatusLabel = (isPaid: boolean, status: string): string => {
  if (isPaid) return "Completado";
  const s = status.toLowerCase();
  if (s === "cancelled" || s === "cancelado") return "Cancelado";
  return "Pendiente";
};

const debtStatusLabel = (status: string): string => {
  const s = status.toLowerCase();
  if (s === "paid" || s === "pagado" || s === "resolved") return "Pagado";
  if (s === "cancelled" || s === "cancelado") return "Cancelado";
  if (s === "payment_declared") return "Pendiente confirmación";
  return "Pendiente";
};

/** Paridad Android: modo de liquidación explícito en el detalle del evento. */
const settlementModeLabel = (mode: string): string => {
  if (mode === "advancedByPayer") return "Pagó por adelantado";
  if (mode === "invitation") return "Invitación";
  if (mode === "eachPaysOwn") return "Cada uno paga lo suyo";
  return "Adelantado";
};

const eventStatusLabel = (status: string): string => {
  const s = status.toLowerCase();
  if (s === "active") return "Activo";
  if (s === "cancelled" || s === "canceled" || s === "cancelado") return "Cancelado";
  if (s === "deleted" || s === "archived") return "Archivado";
  return status || "Activo";
};

export function HouseholdEventDetailDialog({
  open,
  event,
  categories,
  eventShares,
  debts,
  currentUid,
  memberProfiles,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isDeclareOpen, setIsDeclareOpen] = useState(false);
  const { submit: undoDeclare, isSubmitting: isUndoing, error: undoError } = useUndoDeclaredDebtPayment();
  // Solo lectura del propio perfil autenticado (nombre/foto) — nunca de otro
  // usuario vía Firebase Auth desde el cliente; los demás miembros vienen de
  // `memberProfiles` (ya scoped al Hogar activo por el store/servicio).
  const selfDisplayName = useAuthStore((state) => state.user?.displayName);
  const selfPhotoUrl = useAuthStore((state) => state.user?.photoUrl);
  const { isSubmitting: isCancelling, error: cancelError, cancel: executeCancel } = useCancelHouseholdEvent();
  const { isSubmitting: isCancellingShare, error: cancelShareError, submit: executeCancelShare } = useCancelPendingShare();

  useEffect(() => {
    if (!open) {
      setIsConfirmCancelOpen(false);
      setIsEditOpen(false);
      setIsPayOpen(false);
      setIsDeclareOpen(false);
    }
  }, [open]);

  const handleCancel = async () => {
    if (!event) return;
    const ok = await executeCancel({ eventId: event.id });
    if (ok) {
      onClose();
    }
  };

  const handleCancelMyShare = async (shareId: string) => {
    if (!currentUid) return;
    await executeCancelShare({ shareId, currentUid });
  };

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useFocusTrap(dialogRef, open, onClose);

  if (!open || !event) return null;

  const category = categories.find((c) => c.id === event.categoryId);
  const Icon = resolveCategoryIcon(category?.iconKey, "expense");

  // Shares de este evento específico
  const sharesForEvent = eventShares.filter((s) => s.eventId === event.id);
  const myShare = sharesForEvent.find((s) => s.memberUserId === currentUid);

  // Deudas de este evento que involucran al usuario actual
  const eventDebtsInvolvingMe = debts.filter(
    (d) => d.eventId === event.id && (d.fromUserId === currentUid || d.toUserId === currentUid),
  );

  // Resumen contextual (paridad Android): la deuda es visible desde el inicio
  // del evento (pending), sin depender de que el pagador complete su anotación.
  // El resumen contextual superior solo debe resumir una deuda ACTIVA
  // (pending/payment_declared). Una deuda ya `paid` (p. ej. tras auto-settle)
  // no debe seguir mostrándose como "te debe"/"debes" — la fila histórica en
  // "Deudas relacionadas" (eventDebtsInvolvingMe, sin este filtro) sí puede
  // conservar el registro pagado con su estado correcto.
  const relevantDebt = eventDebtsInvolvingMe.find((d) => isActiveHouseholdDebtStatus(d.status));
  const contextualDebtSummary = relevantDebt
    ? relevantDebt.toUserId === currentUid
      ? `${resolveName(relevantDebt.fromUserId, currentUid, memberProfiles)} te debe ${formatCurrencyCop(relevantDebt.amount)}`
      : `Debes ${formatCurrencyCop(relevantDebt.amount)} a ${resolveName(relevantDebt.toUserId, currentUid, memberProfiles)}`
    : null;

  // household-debt-payment-gate: si la deuda relevante es del usuario actual
  // como deudor, mostrar por qué aún no puede pagar (misma función pura
  // compartida con la tarjeta "Le debés al hogar" y el servicio). El motivo debe ser
  // consistente con el que bloquea el botón en Home Personal.
  const isDebtorOfRelevantDebt = relevantDebt ? relevantDebt.fromUserId === currentUid : false;
  const paymentEligibility = relevantDebt
    ? resolveDebtPaymentEligibility({ debtStatus: relevantDebt.status, event, eventShares })
    : null;
  const debtPayerId = resolvePayerUserId({
    paidByUserId: event.paidByUserId,
    createdByUserId: event.createdByUserId,
  });
  const debtPayerName = debtPayerId ? resolveName(debtPayerId, currentUid, memberProfiles) : null;
  const paymentBlockedCopy =
    isDebtorOfRelevantDebt && paymentEligibility && paymentEligibility.gateApplies && !paymentEligibility.eligible
      ? buildDebtPaymentBlockedCopy(debtPayerName)
      : null;

  const hasCreator = Boolean(event.createdByUserId);
  const hasNotes = event.notes.trim().length > 0 && event.notes !== event.title;

  return (
    <>
      <div
        className="fixed inset-0 z-[96] flex items-center justify-center bg-[var(--hh-overlay)] px-4 py-8"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
      <div
        ref={dialogRef}
        data-fm-context="household"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-full max-w-lg rounded-[24px] border border-[var(--hh-border)]/[0.08] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--hh-surface-elevated)_96%,transparent),color-mix(in_srgb,var(--hh-surface)_98%,transparent))] shadow-xl flex flex-col max-h-[85vh] overflow-hidden outline-none animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-[var(--hh-border)]/[0.06] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-[var(--hh-border)] bg-[var(--hh-border)] text-[var(--hh-text)]">
              <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-[var(--font-display)] text-lg font-semibold tracking-[-0.03em] text-[var(--hh-text)] truncate">
                {event.title || category?.name || "Evento del hogar"}
              </h2>
              {category && (
                <p className="text-xs text-[var(--hh-text-muted)] truncate">{category.name}</p>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <HouseholdButton
              type="button"
              size="icon"
              tone="text"
              variant="ghost"
              aria-label="Cerrar"
              onClick={onClose}
              className="h-8 w-8 shrink-0 rounded-full"
            >
              <X className="h-4 w-4" />
            </HouseholdButton>
          </div>
        </div>

        {/* Summary strip */}
        <div className="px-6 py-4 bg-[var(--hh-surface)] border-b border-[var(--hh-border)]/[0.04] grid grid-cols-2 gap-4 shrink-0">
          <div>
            <p className="text-xs text-[var(--hh-text-muted)] font-medium mb-1">
              {event.settlementMode === "eachPaysOwn" ? "Tu parte" : "Total pagado"}
            </p>
            <HouseholdAmount 
              value={event.settlementMode === "eachPaysOwn" ? (myShare?.amount ?? event.amount) : event.amount} 
              variant="expense" 
              size="lg" 
            />
          </div>
          <div className="flex flex-col items-end justify-center gap-1">
            <HouseholdChip variant={event.isActive ? "household" : "neutral"}>
              {eventStatusLabel(event.status)}
            </HouseholdChip>
            <HouseholdChip variant="pending">
              {settlementModeLabel(event.settlementMode)}
            </HouseholdChip>
          </div>
        </div>

        {/* Resumen contextual de deuda (paridad Android): visible desde el
            inicio del evento, sin depender de que se complete la anotación. */}
        {contextualDebtSummary && (
          <div className="px-6 py-3 bg-[var(--hh-surface)] border-b border-[var(--hh-border)]/[0.04] shrink-0 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--hh-text)]">{contextualDebtSummary}</p>
              {paymentBlockedCopy && (
                <p className="mt-1 text-xs text-[var(--hh-text)]">{paymentBlockedCopy}</p>
              )}
              {undoError && isDebtorOfRelevantDebt && relevantDebt?.status === "payment_declared" && (
                <p className="mt-1 text-xs text-[var(--hh-destructive-border)]">{undoError}</p>
              )}
            </div>
            {isDebtorOfRelevantDebt && relevantDebt?.status === "pending" && (!paymentEligibility?.gateApplies || paymentEligibility?.eligible) && event.status === "active" && (
              <>
                {/* PUENTE PERSONAL: "Pagar" abre el flujo de declaración de pago que usa tokens compartidos. */}
                <FinanceButton
                  type="button"
                  size="sm"
                  tone="filled"
                  onClick={() => setIsDeclareOpen(true)}
                  className="bg-[var(--hh-primary-action)] text-[var(--hh-on-primary)] hover:bg-[color-mix(in_oklch,var(--hh-primary-action),white_8%)] cursor-pointer whitespace-nowrap shrink-0"
                >
                  Pagar
                </FinanceButton>
              </>
            )}
            {isDebtorOfRelevantDebt && relevantDebt?.status === "payment_declared" && event.status === "active" && (
              <>
                {/* PUENTE PERSONAL: "Deshacer" revierte una declaración de pago de puente personal. */}
                <FinanceButton
                  type="button"
                  size="sm"
                  tone="destructive"
                  variant="ghost"
                  disabled={isUndoing}
                  onClick={() => {
                    if (window.confirm("¿Deshacer la declaración de este pago?")) {
                      undoDeclare({ debtId: relevantDebt.id, ownerId: currentUid! });
                    }
                  }}
                  className="cursor-pointer whitespace-nowrap shrink-0"
                >
                  Deshacer
                </FinanceButton>
              </>
            )}
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Metadata: fecha, categoría, creador, notas */}
          <div className="space-y-2">
            {(event.eventDate ?? event.createdAt) && (
              <div className="flex items-center gap-2.5 text-sm text-[var(--hh-text-secondary)]">
                <CalendarDays className="h-4 w-4 shrink-0 text-[var(--hh-text-muted)]" />
                <span>{formatDateEs((event.eventDate ?? event.createdAt)!)}</span>
              </div>
            )}

            {category && (
              <div className="flex items-center gap-2.5 text-sm text-[var(--hh-text-secondary)]">
                <Tag className="h-4 w-4 shrink-0 text-[var(--hh-text-muted)]" />
                <span>{category.name}</span>
              </div>
            )}

            {hasCreator && (
              <div className="flex items-center gap-2.5 text-sm text-[var(--hh-text-secondary)]">
                <ProfileAvatar
                  name={event.createdByUserId === currentUid ? selfDisplayName : memberProfiles[event.createdByUserId]?.displayName}
                  photoURL={resolvePhotoUrl(event.createdByUserId, currentUid, selfPhotoUrl, memberProfiles)}
                  size="sm"
                  className="h-5 w-5 text-[9px] bg-[var(--hh-surface-elevated)] text-[var(--hh-text)]"
                  decorative
                />
                <span>
                  Creado por{" "}
                  <span className="font-medium text-[var(--hh-text)]">
                    {resolveName(event.createdByUserId, currentUid, memberProfiles)}
                  </span>
                </span>
              </div>
            )}

            {hasNotes && (
              <p className="mt-1 text-sm text-[var(--hh-text-secondary)] rounded-[12px] border border-[var(--hh-border)] bg-[var(--hh-surface)] px-3 py-2.5 leading-relaxed">
                {event.notes}
              </p>
            )}
          </div>

          {/* Anotación/Por anotar (paridad Android: no es una deuda, es la
              share pendiente/completada de cada miembro sobre este evento). */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--hh-text-muted)]">
              Anotación
            </p>
            {sharesForEvent.length > 0 ? (
              <div className="space-y-2">
                {sharesForEvent.map((share) => {
                  const memberName = resolveName(share.memberUserId, currentUid, memberProfiles);
                  const memberDisplayName = share.memberUserId === currentUid ? selfDisplayName : memberProfiles[share.memberUserId]?.displayName;
                  const memberPhotoURL = resolvePhotoUrl(share.memberUserId, currentUid, selfPhotoUrl, memberProfiles);
                  const isCurrentUser = share.memberUserId === currentUid;
                  return (
                    <div key={share.id} className="space-y-2">
                      <div
                        className="flex items-center gap-3 rounded-[12px] border border-[var(--hh-border)] px-3 py-2.5"
                      >
                        <ProfileAvatar
                          name={memberDisplayName}
                          photoURL={memberPhotoURL}
                          size="sm"
                          className="rounded-[8px] border border-[var(--hh-border-soft)] bg-[var(--hh-surface-elevated)] text-[var(--hh-text-secondary)]"
                          decorative
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--hh-text)] truncate">{memberName}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isCurrentUser && !share.isPaid && event.status === "active" && share.status === "pending_completion" && (
                            <>
                              {/* PUENTE PERSONAL: "Anotar" abre el flujo de gasto propio del usuario y mueve dinero personal, por eso conserva el kit Finance. */}
                              <FinanceButton
                                type="button"
                                size="sm"
                                tone="outlined"
                                variant="outline"
                                onClick={() => setIsPayOpen(true)}
                                disabled={isCancellingShare}
                                className="h-7 px-2.5 text-xs font-semibold py-0 border-[var(--hh-accent)]/20 text-[var(--hh-accent)] hover:bg-[var(--hh-accent)]/10 hover:text-[var(--hh-accent)]"
                              >
                                Anotar
                              </FinanceButton>
                              <HouseholdButton
                                type="button"
                                size="sm"
                                tone="text"
                                variant="ghost"
                                onClick={() => handleCancelMyShare(share.id)}
                                disabled={isCancellingShare}
                                className="h-7 px-2 text-xs font-medium py-0 text-[var(--hh-destructive-border)] hover:bg-[var(--hh-destructive-border)]/10"
                              >
                                {isCancellingShare ? "Cancelando..." : "Cancelar cuota"}
                              </HouseholdButton>
                            </>
                          )}
                          <HouseholdChip variant={share.isPaid ? "income" : "pending"}>
                            {shareStatusLabel(share.isPaid, share.status)}
                          </HouseholdChip>
                          <HouseholdAmount value={share.amount} variant={share.isPaid ? "income" : "pending"} size="sm" />
                        </div>
                      </div>

                      {cancelShareError && isCurrentUser && (
                        <p className="px-3 text-xs text-[var(--hh-destructive-border)]">{cancelShareError}</p>
                      )}

                      {/* Helper lines contextuales de HH-SET-v2 */}
                      {isCurrentUser && !share.isPaid && event.status === "active" && (
                        <div className="px-3 py-1.5 text-xs text-[var(--hh-text-muted)] border border-[var(--hh-border)] bg-[var(--hh-border)] rounded-[8px] leading-relaxed">
                          {event.settlementMode === "invitation" && "Anotá en Personal — invitación, tu pareja no debe nada."}
                          {event.settlementMode === "advancedByPayer" && event.paidByUserId === currentUid && "Anotá en Personal lo que salió de tu banco."}
                          {event.settlementMode === "eachPaysOwn" && "Anotá en Personal lo que ya pagaste."}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <HouseholdEmptyState
                title="Sin distribución registrada"
                description="No hay responsabilidades asignadas para este evento."
              />
            )}
          </div>

          {/* Deudas relacionadas que involucran al usuario actual */}
          {eventDebtsInvolvingMe.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--hh-text-muted)]">
                Deudas relacionadas
              </p>
              <div className="space-y-2">
                {eventDebtsInvolvingMe.map((debt) => {
                  const iOwe = debt.fromUserId === currentUid;
                  const counterpart = resolveName(
                    iOwe ? debt.toUserId : debt.fromUserId,
                    currentUid,
                    memberProfiles,
                  );
                  return (
                    <div
                      key={debt.id}
                      className={`flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2.5 ${
                        iOwe
                          ? "border-[var(--hh-destructive-border)] bg-[var(--hh-destructive-border)]"
                          : "border-[var(--hh-success)] bg-[var(--hh-success)]"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--hh-text-muted)] uppercase tracking-wide">
                          {iOwe ? "Tú debes a" : "Te debe"}
                        </p>
                        <p className="text-sm font-medium text-[var(--hh-text)]">{counterpart}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <HouseholdChip variant="pending">{debtStatusLabel(debt.status)}</HouseholdChip>
                        <HouseholdAmount value={debt.amount} variant={iOwe ? "expense" : "income"} size="sm" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer actions */}
        {event.status === "active" && (() => {
          const allDebtsForEvent = debts.filter((d) => d.eventId === event.id);
          // Paridad Android (HouseholdEventCapabilities.kt:64-82): solo el estado de las
          // deudas bloquea la cancelación; las shares completadas nunca bloquean.
          const isBlockedCancel = resolveHouseholdEventCancelBlock(allDebtsForEvent) !== null;

          return (
            <div className="px-6 pb-5 pt-3 border-t border-[var(--hh-border)]/[0.06] flex flex-col gap-3 shrink-0 bg-[var(--hh-surface)]">
              {isConfirmCancelOpen ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-[var(--hh-destructive-border)] font-medium">
                    ¿Confirmar cancelación del evento? Esta acción no se puede deshacer.
                  </p>
                  {cancelError && (
                    <p className="text-xs text-[var(--hh-destructive-border)]">{cancelError}</p>
                  )}
                  <div className="flex items-center justify-end gap-2.5">
                    <HouseholdButton
                      type="button"
                      tone="text"
                      variant="ghost"
                      onClick={() => setIsConfirmCancelOpen(false)}
                      disabled={isCancelling}
                    >
                      No, volver
                    </HouseholdButton>
                    <HouseholdButton
                      type="button"
                      tone="filled"
                      onClick={handleCancel}
                      disabled={isCancelling}
                      className="bg-[var(--hh-destructive-border)] text-[var(--hh-text)] hover:bg-[color-mix(in_oklch,var(--hh-destructive-border),white_8%)]"
                    >
                      {isCancelling ? "Cancelando..." : "Sí, cancelar"}
                    </HouseholdButton>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <HouseholdButton
                    type="button"
                    tone="text"
                    variant="outline"
                    disabled={isBlockedCancel}
                    onClick={() => setIsConfirmCancelOpen(true)}
                    className="text-[var(--hh-destructive-border)] border-[var(--hh-destructive-border)]/20 hover:bg-[var(--hh-destructive-border)]/10 disabled:opacity-40"
                    title={isBlockedCancel ? "Este gasto tiene una deuda declarada o pagada y no se puede cancelar." : undefined}
                  >
                    Cancelar gasto
                  </HouseholdButton>
                  <HouseholdButton
                    type="button"
                    tone="filled"
                    onClick={() => setIsEditOpen(true)}
                    className="bg-[var(--hh-primary-action)] text-[var(--hh-on-primary)] hover:bg-[color-mix(in_oklch,var(--hh-primary-action),white_8%)] min-w-24"
                  >
                    Editar
                  </HouseholdButton>
                </div>
              )}
            </div>
          );
        })()}

      </div>
    </div>

    {isEditOpen && (
        <EditHouseholdExpenseDialog
          open={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSuccess={onClose}
          event={event}
          householdId={event.householdId}
          currentUid={currentUid ?? ""}
          memberIds={Object.keys(memberProfiles)}
          memberProfiles={memberProfiles}
          categories={categories}
        />
      )}

      {isPayOpen && myShare && (
        <CompleteShareDialog
          open={isPayOpen}
          onClose={() => setIsPayOpen(false)}
          onSuccess={onClose}
          shareId={myShare.id}
          shareAmount={myShare.amount}
          eventTitle={event.title}
          currentUid={currentUid ?? ""}
          householdCategoryName={category?.name}
          householdCategoryIconKey={category?.iconKey}
        />
      )}

      {isDeclareOpen && relevantDebt && isDebtorOfRelevantDebt && (
        <DeclarePaymentDialog
          open={isDeclareOpen}
          onClose={() => setIsDeclareOpen(false)}
          debtId={relevantDebt.id}
          debtAmount={relevantDebt.amount}
          creditorName={resolveName(relevantDebt.toUserId, currentUid, memberProfiles)}
          currentUid={currentUid ?? ""}
        />
      )}
    </>
  );
}
