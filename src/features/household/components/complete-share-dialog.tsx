"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Wallet, FolderKanban, Tag, Calendar, FileText, Loader2 } from "lucide-react";

// PUENTE PERSONAL: completar "Por anotar" registra un gasto desde mi cuenta personal.
import { FinanceButton } from "@/components/finance/finance-button";
import { useCompleteHouseholdEventShare } from "@/features/household/hooks/use-complete-household-event-share";
import { useFocusTrap } from "@/features/household/hooks/use-focus-trap";
import { usePersonalDataStore, canSubmitPersonalData } from "@/stores/personal-data-store";
import { getTodayDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import { formatCurrencyCop } from "@/lib/format/currency";
import { resolveCompleteShareSuggestionEffect } from "@/features/household/lib/resolve-suggested-personal-category";
import { OwnFundsCompositionNotice } from "@/components/finance/own-funds-composition-notice";
import { resolveOwnFundsCompositionFeedback } from "@/lib/finance/own-funds-gate";
import { readThirdPartyLocationSnapshot } from "@/features/transactions/services/read-third-party-location-snapshot";
import { computeThirdPartyAvailability } from "@/features/transactions/lib/third-party-availability";


type Props = {
  open: boolean;
  onClose: () => void;
  shareId: string;
  shareAmount: number;
  eventTitle: string;
  currentUid: string;
  onSuccess?: () => void;
  /**
   * Nombre e iconKey de la categoría de gasto del hogar del evento — únicos
   * datos compartidos permitidos para sugerir en silencio una categoría
   * Personal equivalente (Bloque 3). Nunca el registro completo de esa
   * categoría, ni su ID, color u otros campos.
   */
  householdCategoryName?: string;
  householdCategoryIconKey?: string;
};

export function CompleteShareDialog({
  open,
  onClose,
  shareId,
  shareAmount,
  eventTitle,
  currentUid,
  onSuccess,
  householdCategoryName,
  householdCategoryIconKey,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { isSubmitting, error: submitError, submit, resetError } = useCompleteHouseholdEventShare();

  // Obtener datos personales (cuentas, bolsillos, categorías)
  const accounts = usePersonalDataStore((state) => state.data.accounts);
  const pockets = usePersonalDataStore((state) => state.data.pockets);
  const categories = usePersonalDataStore((state) => state.data.categories);
  const personalStatus = usePersonalDataStore((state) => state.status);
  const loadPersonalData = usePersonalDataStore((state) => state.load);

  // Form states
  const [accountId, setAccountId] = useState("");
  const [pocketId, setPocketId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(getTodayDateInputValue);
  const [description, setDescription] = useState("");

  // Cargar cuentas si está abierto
  useEffect(() => {
    if (open && currentUid) {
      void loadPersonalData(currentUid);
    }
  }, [open, currentUid, loadPersonalData]);

  // Cuentas personales activas
  const activeAccounts = useMemo(() => {
    return accounts.filter((a) => !a.archived);
  }, [accounts]);

  // Categorías personales de tipo gasto activas
  const expenseCategories = useMemo(() => {
    return categories.filter((c) => c.type === "expense" && !c.archived);
  }, [categories]);

  // Bolsillos de la cuenta seleccionada
  const filteredPockets = useMemo(() => {
    if (!accountId) return [];
    return pockets.filter((p) => p.accountId === accountId);
  }, [pockets, accountId]);

  // Resetear estados al abrir
  useEffect(() => {
    if (open) {
      setAccountId(activeAccounts[0]?.id ?? "");
      setPocketId("");
      setDate(getTodayDateInputValue());
      setDescription(eventTitle);
      resetError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeAccounts, eventTitle]);

  // Sugerencia silenciosa de categoría Personal (Bloque 3, paridad Android
  // ExpenseCategorySuggestionMatcher.kt): se calcula UNA sola vez por
  // apertura del diálogo, después de que exista al menos una categoría
  // personal activa de gasto (corrección P1: esperar solo a que
  // personalStatus deje de ser "loading"/"idle" no basta — en un usuario
  // nuevo la primera lectura puede llegar con categorías vacías ANTES de que
  // el seed termine de crearlas, y decidir en ese momento dejaba la
  // sugerencia real sin evaluarse nunca). Una vez aplicada (con o sin
  // sugerencia), `suggestionAppliedRef` evita que renders/recargas
  // posteriores sobrescriban una selección manual del usuario mientras el
  // diálogo sigue abierto.
  const suggestionAppliedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      suggestionAppliedRef.current = false;
      return;
    }

    const step = resolveCompleteShareSuggestionEffect({
      open,
      personalStatus,
      expenseCategories,
      householdCategoryName,
      householdCategoryIconKey,
      alreadyApplied: suggestionAppliedRef.current,
    });

    if (step.shouldApply) {
      setCategoryId(step.categoryId);
      suggestionAppliedRef.current = true;
    }
  }, [open, personalStatus, expenseCategories, householdCategoryName, householdCategoryIconKey]);

  // Si cambia la cuenta, limpiar el bolsillo o elegir uno válido
  useEffect(() => {
    setPocketId("");
  }, [accountId]);

  // Bloquear scroll del body al abrir
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Determinar saldo disponible de la fuente seleccionada
  const selectedBalance = useMemo(() => {
    if (!accountId) return 0;
    if (pocketId) {
      const p = pockets.find((p) => p.id === pocketId);
      return p?.balance ?? 0;
    }
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return 0;
    // Paso 1 (cierre): `acc.balance` YA es el Disponible crudo — no restar bolsillos.
    return acc.balance;
  }, [accountId, pocketId, accounts, pockets]);

  // G4 — completar una responsabilidad es un débito con dinero PROPIO: el
  // físico solo no basta. Se lee el held de la ubicación origen (lazy, al
  // abrir o al cambiar de origen) y la barrera pasa a ser la del servicio.
  const [heldLoading, setHeldLoading] = useState(false);
  const [heldError, setHeldError] = useState<string | null>(null);
  const [heldAtSource, setHeldAtSource] = useState(0);

  useEffect(() => {
    if (!open || !currentUid || !accountId) {
      setHeldLoading(false);
      setHeldError(null);
      setHeldAtSource(0);
      return;
    }

    let cancelled = false;
    setHeldLoading(true);
    setHeldError(null);

    readThirdPartyLocationSnapshot(currentUid)
      .then((snapshot) => {
        if (cancelled) return;
        setHeldAtSource(
          computeThirdPartyAvailability({ accountId, pocketId: pocketId || null }, snapshot),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setHeldError("No se pudo verificar tu dinero propio disponible. Intenta nuevamente.");
      })
      .finally(() => {
        if (!cancelled) setHeldLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, currentUid, accountId, pocketId]);

  const ownFundsFeedback = useMemo(
    () =>
      resolveOwnFundsCompositionFeedback({
        physical: selectedBalance,
        held: heldAtSource,
        amount: shareAmount,
      }),
    [selectedBalance, heldAtSource, shareAmount],
  );

  // Fail-closed: sin el held verificado no se habilita el envío.
  const hasEnoughBalance = !heldLoading && !heldError && ownFundsFeedback.kind === "ok";

  useFocusTrap(dialogRef, open, onClose);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmitPersonalData(personalStatus)) return;
    if (!accountId || !categoryId) return;
    if (!hasEnoughBalance) return;




    const parsedDate = parseDateInputAsLocalDate(date) ?? new Date();

    const ok = await submit({
      shareId,
      ownerId: currentUid,
      accountId,
      pocketId: pocketId || null,
      categoryId,
      date: parsedDate,
      description: description.trim() || undefined,
    });

    if (ok) {
      if (onSuccess) onSuccess();
      onClose();
    }
  };

  return (
    <div
      data-fm-context="personal"
      className="fixed inset-0 z-[98] flex items-end sm:items-center justify-center bg-black/80 px-4 pb-4 sm:py-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Anotar en Personal"
        tabIndex={-1}
        className="w-full max-w-md rounded-[24px] border border-white/[0.08] bg-[var(--fm-surface-dark)] shadow-xl flex flex-col max-h-[90vh] overflow-hidden outline-none animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
          <div>
            <h2 className="font-[var(--font-display)] text-lg font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
              Completar mi parte
            </h2>
            <p className="text-xs text-[var(--fm-text-muted)] mt-0.5 max-w-[280px] truncate">
              {eventTitle}
            </p>
          </div>
          <FinanceButton
            type="button"
            size="icon"
            tone="text"
            variant="ghost"
            aria-label="Cerrar"
            onClick={onClose}
            className="h-8 w-8 shrink-0 rounded-full"
          >
            <X className="h-4 w-4" />
          </FinanceButton>
        </div>

        {personalStatus === "loading" && accounts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--fm-pending)]" />
            <p className="text-sm text-[var(--fm-text-muted)]">Cargando tus finanzas personales...</p>
          </div>
        ) : activeAccounts.length === 0 ? (
          <div className="flex-1 p-6 text-center space-y-4">
            <p className="text-sm text-[var(--fm-text-muted)]">
              No tienes cuentas personales activas registradas. Primero debes crear una cuenta en la sección &quot;Personal&quot; para poder registrar pagos.
            </p>
            <FinanceButton onClick={onClose} className="w-full">
              Entendido
            </FinanceButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-4">
              {/* Resumen del monto a registrar (paridad Android: "Tu parte", copy neutral de anotación, no de obligación pendiente). */}
              <div className="rounded-[16px] bg-[var(--fm-expense)] border border-[var(--fm-expense)] p-4 text-center">
                <span className="text-xs text-[var(--fm-text-muted)] uppercase tracking-wider font-semibold">
                  Tu parte
                </span>
                <p className="text-2xl font-bold tracking-tight text-[var(--fm-expense)] mt-1">
                  {formatCurrencyCop(shareAmount)}
                </p>
              </div>

              {/* Cuenta Origen */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="complete-share-account" className="text-[13px] font-medium text-[var(--fm-warm-paper)] flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-[var(--fm-text-muted)]" />
                  Cuenta de pago *
                </label>
                <select
                  id="complete-share-account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  required
                  className="h-11 rounded-[16px] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[16px] sm:text-[14px] text-[var(--fm-warm-paper)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)] appearance-none cursor-pointer"
                >
                  {activeAccounts.map((acc) => {
                    // Paso 1 (cierre): `acc.balance` YA es el Disponible crudo — no restar bolsillos.
                    return (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatCurrencyCop(acc.balance)})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Bolsillo Origen (Opcional, si hay bolsillos en la cuenta) */}
              {filteredPockets.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="complete-share-pocket" className="text-[13px] font-medium text-[var(--fm-warm-paper)] flex items-center gap-1.5">
                    <FolderKanban className="h-3.5 w-3.5 text-[var(--fm-text-muted)]" />
                    Bolsillo origen (opcional)
                  </label>
                  <select
                    id="complete-share-pocket"
                    value={pocketId}
                    onChange={(e) => setPocketId(e.target.value)}
                    className="h-11 rounded-[16px] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[16px] sm:text-[14px] text-[var(--fm-warm-paper)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)] appearance-none cursor-pointer"
                  >
                    <option value="">Ninguno (Debitar de la cuenta directamente)</option>
                    {filteredPockets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatCurrencyCop(p.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Categoría Personal de Gasto */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="complete-share-category" className="text-[13px] font-medium text-[var(--fm-warm-paper)] flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-[var(--fm-text-muted)]" />
                  Categoría personal *
                </label>
                <select
                  id="complete-share-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  className="h-11 rounded-[16px] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[16px] sm:text-[14px] text-[var(--fm-warm-paper)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)] appearance-none cursor-pointer"
                >
                  {expenseCategories.length === 0 ? (
                    <option value="">Sin categorías de gasto</option>
                  ) : (
                    <>
                      <option value="">Elegir categoría</option>
                      {expenseCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Fecha y Detalle */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="complete-share-date" className="text-[13px] font-medium text-[var(--fm-warm-paper)] flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[var(--fm-text-muted)]" />
                    Fecha pago *
                  </label>
                  <input
                    id="complete-share-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="h-11 rounded-[16px] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[16px] sm:text-[14px] text-[var(--fm-warm-paper)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="complete-share-description" className="text-[13px] font-medium text-[var(--fm-warm-paper)] flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[var(--fm-text-muted)]" />
                    Descripción
                  </label>
                  <input
                    id="complete-share-description"
                    type="text"
                    placeholder="Descripción del gasto"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-11 rounded-[16px] border border-[var(--fm-border-dark)] bg-[var(--fm-surface-dark-alt)] px-3 text-[16px] sm:text-[14px] text-[var(--fm-warm-paper)] placeholder:text-[var(--fm-text-muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]"
                  />
                </div>
              </div>

              {/* G4 — Validación de composición: físico / retenido / Mi dinero. */}
              {accountId && heldLoading && (
                <div className="rounded-[12px] bg-white/[0.02] border border-white/[0.06] p-3 text-xs text-[var(--fm-text-muted)] leading-relaxed">
                  Calculando tu dinero propio disponible…
                </div>
              )}

              {accountId && !heldLoading && heldError && (
                <div className="rounded-[12px] bg-[var(--fm-expense)] border border-[var(--fm-expense)] p-3 text-xs text-[var(--fm-expense)] font-medium leading-relaxed">
                  {heldError}
                </div>
              )}

              {accountId && !heldLoading && !heldError && (
                <OwnFundsCompositionNotice feedback={ownFundsFeedback} />
              )}

              {/* Advertencia de Impacto */}
              {hasEnoughBalance && accountId && (
                <div className="rounded-[12px] bg-white/[0.02] border border-white/[0.06] p-3 text-xs text-[var(--fm-text-muted)] leading-relaxed">
                  Se debitarán <span className="font-semibold text-[var(--fm-warm-paper)]">{formatCurrencyCop(shareAmount)}</span> de tu saldo disponible personal ({pocketId ? "bolsillo" : "cuenta"}).
                </div>
              )}

              {personalStatus !== "success" && (
                <div className="rounded-[12px] bg-[var(--fm-expense)] border border-[var(--fm-expense)] p-3 text-xs text-[var(--fm-expense)] font-medium leading-relaxed">
                  No puedes registrar este pago porque tus datos personales no están completamente verificados (estado: {personalStatus}). Reintenta antes de continuar.
                </div>
              )}

              {submitError && (
                <div className="rounded-[12px] bg-[var(--fm-expense)] border border-[var(--fm-expense)] p-3 text-xs text-[var(--fm-expense)] font-medium">
                  {submitError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06] bg-white/[0.01] shrink-0">
              <FinanceButton
                type="button"
                tone="text"
                variant="ghost"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </FinanceButton>
              <FinanceButton
                type="submit"
                tone="filled"
                disabled={isSubmitting || !canSubmitPersonalData(personalStatus) || !accountId || !categoryId || !hasEnoughBalance}
                className="bg-[var(--fm-pending)] text-[var(--fm-ink)] hover:bg-[color-mix(in_oklch,var(--fm-pending),white_8%)]"
              >

                {isSubmitting ? "Completando..." : "Completar mi parte"}
              </FinanceButton>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}
