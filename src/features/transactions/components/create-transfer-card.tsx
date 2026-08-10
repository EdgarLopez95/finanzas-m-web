"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeftRight, ArrowRight, Calendar, Wallet } from "lucide-react";

import { EmptyState } from "@/components/finance/empty-state";
import { IconSelect } from "@/components/finance/icon-select";
import { AccountIcon } from "@/components/finance/account-icon";
import { useCreatePersonalTransfer } from "@/features/transactions/hooks/use-create-personal-transfer";
import { readThirdPartyLocationSnapshot } from "@/features/transactions/services/read-third-party-location-snapshot";
import {
  computeThirdPartyAvailability,
  getOccSubmitBlockReason,
  getThirdPartyAvailabilityLabel,
} from "@/features/transactions/lib/third-party-availability";
import { OwnFundsCompositionNotice } from "@/components/finance/own-funds-composition-notice";
import { resolveOwnFundsCompositionFeedback } from "@/lib/finance/own-funds-gate";
import {
  AmountField,
  ComposerFeedback,
  ComposerField,
  ComposerFooter,
  FieldError,
  HelperText,
  StatusNote,
  composerControlClass,
  composerControlErrorClass,
  parseAmountInput,
  toneStyle,
} from "@/features/transactions/components/composer/composer-primitives";

import {
  TransactionFormSurface,
  type TransactionFormRenderMode,
} from "@/features/transactions/components/transaction-form-surface";
import { getTodayDateInputValue, parseDateInputAsLocalDate } from "@/lib/format/date";
import { formatCurrencyCop } from "@/lib/format/currency";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/account";
import type { Pocket } from "@/types/pocket";

type CreateTransferCardProps = {
  ownerId: string;
  accounts: Account[];
  pockets?: Pocket[];
  onCreated: () => Promise<void>;
  renderMode?: TransactionFormRenderMode;
  defaultAccountId?: string;
  defaultPocketId?: string;
  onCancel?: () => void;
};

type TransferField = "amount" | "description" | "date" | "target";

type TransferContainer = {
  id: string;
  type: "available" | "pocket";
  accountId: string;
  pocketId: string | null;
  label: string;
  balance: number;
  account: Account;
  pocket?: Pocket;
  icon?: React.ReactNode;
};

const containerToOption = (container: TransferContainer) => {
  const accentColor = container.account.color || "#60a5fa";
  return {
    id: container.id,
    label: container.label,
    color: accentColor,
    icon: (
      <AccountIcon
        iconType={(container.account.iconType as "generic" | "bank_logo") || "generic"}
        iconKey={container.account.iconKey || "bank"}
        color={accentColor}
        size="xs"
      />
    ),
  };
};

/**
 * Extremo del flujo (origen o destino). No lleva superficie propia: los tres
 * bloques viven dentro del mismo agrupador y el único acento pertenece al
 * monto, que es el centro de la composición.
 */
function TransferEndpoint({
  id,
  label,
  balanceLabel,
  container,
  containers,
  value,
  onChange,
  invalid,
}: {
  id: string;
  label: string;
  balanceLabel: string;
  container?: TransferContainer;
  containers: TransferContainer[];
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[10px] font-bold uppercase tracking-wider text-[var(--fm-text-soft)]"
      >
        {label}
      </label>
      <IconSelect
        id={id}
        required
        searchPlaceholder="Buscar cuenta o bolsillo..."
        value={value}
        onChange={onChange}
        options={containers.map(containerToOption)}
        className={cn(invalid && composerControlErrorClass)}
      />
      <p className="truncate text-[11px] text-[var(--fm-text-muted)] transition-opacity duration-150">
        {balanceLabel}{" "}
        <span className="font-semibold text-[var(--fm-text-soft)]">
          {formatCurrencyCop(container?.balance ?? 0)}
        </span>
      </p>
    </div>
  );
}

export function CreateTransferCard({
  ownerId,
  accounts,
  pockets = [],
  onCreated,
  renderMode = "card",
  defaultAccountId,
  defaultPocketId,
  onCancel,
}: CreateTransferCardProps) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getTodayDateInputValue);
  const [description, setDescription] = useState("");
  const [movesThirdPartyFunds, setMovesThirdPartyFunds] = useState(false);
  const [occAvailabilityLoading, setOccAvailabilityLoading] = useState(false);
  const [occAvailabilityError, setOccAvailabilityError] = useState<string | null>(null);
  const [occAvailability, setOccAvailability] = useState(0);
  const [touched, setTouched] = useState<Partial<Record<TransferField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [swapCount, setSwapCount] = useState(0);

  const markTouched = (field: TransferField) =>
    setTouched((current) => ({ ...current, [field]: true }));

  const { isSubmitting, error, successMessage, submitTransfer, resetFeedback } =
    useCreatePersonalTransfer();

  const containers = useMemo(() => {
    const list: TransferContainer[] = [];

    accounts.forEach((account) => {
      const accountPockets = pockets.filter((p) => p.accountId === account.id);

      list.push({
        id: `available-${account.id}`,
        type: "available",
        accountId: account.id,
        pocketId: null,
        label: `Disponible de ${account.name}`,
        // Paso 1 (cierre): `account.balance` YA es el Disponible crudo.
        balance: account.balance,
        account,
      });

      accountPockets.forEach((pocket) => {
        list.push({
          id: `pocket-${pocket.id}`,
          type: "pocket",
          accountId: account.id,
          pocketId: pocket.id,
          label: `${pocket.name} · ${account.name}`,
          balance: pocket.balance ?? 0,
          account,
          pocket,
          icon: <Wallet className="h-4 w-4" />,
        });
      });
    });

    return list;
  }, [accounts, pockets]);

  const initialContainers = useMemo(() => {
    return containers.map((c) => c.id);
  }, [containers]);

  const [sourceContainerId, setSourceContainerId] = useState(() => {
    const defaultId = defaultPocketId ? `pocket-${defaultPocketId}` : (defaultAccountId ? `available-${defaultAccountId}` : "");
    if (defaultId && initialContainers.includes(defaultId)) {
      return defaultId;
    }
    return initialContainers[0] || "";
  });
  const [targetContainerId, setTargetContainerId] = useState(() => {
    const sourceId = defaultPocketId ? `pocket-${defaultPocketId}` : (defaultAccountId ? `available-${defaultAccountId}` : initialContainers[0]);
    return initialContainers.find((id) => id !== sourceId) || initialContainers[1] || "";
  });

  const [prevInitialContainers, setPrevInitialContainers] = useState(initialContainers);

  if (JSON.stringify(prevInitialContainers) !== JSON.stringify(initialContainers)) {
    setPrevInitialContainers(initialContainers);
    const defaultId = defaultPocketId ? `pocket-${defaultPocketId}` : (defaultAccountId ? `available-${defaultAccountId}` : "");
    const sourceId = defaultId && initialContainers.includes(defaultId) ? defaultId : (initialContainers[0] || "");
    setSourceContainerId(sourceId);
    setTargetContainerId(initialContainers.find((id) => id !== sourceId) || initialContainers[1] || "");
  }

  const selectedSource = useMemo(() => {
    return containers.find((c) => c.id === sourceContainerId) || containers[0];
  }, [containers, sourceContainerId]);

  const selectedTarget = useMemo(() => {
    return containers.find((c) => c.id === targetContainerId) || containers.find((c) => c.id !== selectedSource?.id);
  }, [containers, targetContainerId, selectedSource]);

  const handleSwapContainers = () => {
    const temp = sourceContainerId;
    setSourceContainerId(targetContainerId);
    setTargetContainerId(temp);
    setSwapCount((count) => count + 1);
    resetFeedback();
  };

  // G4 — el held del origen se lee SIEMPRE que haya origen, no solo en modo
  // "No propio": en modo "Mío" alimenta el panel de composición (el físico
  // solo no dice si el movimiento cabe en Mi dinero). Los helpers OCC siguen
  // ignorándolo cuando el toggle está apagado.
  useEffect(() => {
    if (!selectedSource) {
      setOccAvailabilityLoading(false);
      setOccAvailabilityError(null);
      setOccAvailability(0);
      return;
    }

    let cancelled = false;
    setOccAvailabilityLoading(true);
    setOccAvailabilityError(null);

    readThirdPartyLocationSnapshot(ownerId)
      .then((snapshot) => {
        if (cancelled) return;
        const available = computeThirdPartyAvailability(
          { accountId: selectedSource.accountId, pocketId: selectedSource.pocketId },
          snapshot,
        );
        setOccAvailability(available);
      })
      .catch(() => {
        if (cancelled) return;
        setOccAvailabilityError("No se pudo verificar el dinero no propio disponible. Intenta nuevamente.");
      })
      .finally(() => {
        if (!cancelled) setOccAvailabilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSource, ownerId]);

  const parsedAmountForValidation = parseAmountInput(amount);
  const occBlockReason = getOccSubmitBlockReason({
    movesThirdPartyFunds,
    isLoading: occAvailabilityLoading,
    loadError: occAvailabilityError,
    thirdPartyAvailable: occAvailability,
    parsedAmount: parsedAmountForValidation,
  });

  const occLabel = getThirdPartyAvailabilityLabel({
    movesThirdPartyFunds,
    isLoading: occAvailabilityLoading,
    loadError: occAvailabilityError,
    thirdPartyAvailable: occAvailability,
  });

  // G4 — solo aplica al transfer con dinero PROPIO: en modo "No propio" el
  // techo es el held y ya lo cubre `occBlockReason`.
  const ownFundsFeedback = useMemo(
    () =>
      resolveOwnFundsCompositionFeedback({
        physical: selectedSource?.balance ?? 0,
        held: occAvailability,
        amount: parsedAmountForValidation,
      }),
    [selectedSource, occAvailability, parsedAmountForValidation],
  );
  const showOwnFundsNotice =
    !movesThirdPartyFunds &&
    !!selectedSource &&
    !occAvailabilityLoading &&
    !occAvailabilityError &&
    parsedAmountForValidation > 0 &&
    ownFundsFeedback.kind !== "ok";

  const sameContainer = Boolean(
    selectedSource && selectedTarget && selectedSource.id === selectedTarget.id,
  );

  const errors = useMemo(() => {
    const next: Partial<Record<TransferField, string>> = {};

    if (!Number.isFinite(parsedAmountForValidation) || parsedAmountForValidation <= 0) {
      next.amount = "Ingresa un monto mayor a $ 0.";
    } else if (selectedSource && parsedAmountForValidation > selectedSource.balance) {
      next.amount = `Supera el saldo del origen (${formatCurrencyCop(selectedSource.balance)}).`;
    }
    if (!description.trim()) {
      next.description = "Escribe un concepto para identificar la transferencia.";
    }
    if (!date) {
      next.date = "Elige la fecha de la transferencia.";
    }
    if (!selectedSource || !selectedTarget) {
      next.target = "Elige el origen y el destino.";
    } else if (sameContainer) {
      next.target = "Elige un destino diferente al origen.";
    }

    return next;
  }, [
    parsedAmountForValidation,
    selectedSource,
    selectedTarget,
    sameContainer,
    description,
    date,
  ]);

  const isFormValid = useMemo(() => {
    if (Object.keys(errors).length > 0) return false;
    if (occBlockReason !== null) return false;
    // G4 — en modo "Mío" el envío se bloquea si no cabe en Mi dinero (o si
    // el held aún no está verificado): fail-closed, igual que el servicio.
    if (!movesThirdPartyFunds) {
      if (occAvailabilityLoading || occAvailabilityError !== null) return false;
      if (ownFundsFeedback.kind !== "ok") return false;
    }
    return true;
  }, [
    errors,
    occBlockReason,
    movesThirdPartyFunds,
    occAvailabilityLoading,
    occAvailabilityError,
    ownFundsFeedback,
  ]);

  /**
   * Imposibilidad financiera (no "campo por completar"): el dinero elegido no
   * alcanza, el origen no tiene dinero no propio o el destino coincide con el
   * origen. Deshabilita el CTA de inmediato — la pantalla nunca muestra un
   * bloqueo junto a un botón que invita a ejecutarlo. Se recalcula en cada
   * render, así que vuelve a habilitarse solo al corregir la condición.
   */
  const isBlocked =
    sameContainer ||
    (parsedAmountForValidation > 0 &&
      Boolean(selectedSource) &&
      parsedAmountForValidation > (selectedSource?.balance ?? 0)) ||
    (movesThirdPartyFunds &&
      !occAvailabilityLoading &&
      (occAvailabilityError !== null || occAvailability <= 0 || occBlockReason !== null)) ||
    (!movesThirdPartyFunds &&
      !occAvailabilityLoading &&
      occAvailabilityError === null &&
      parsedAmountForValidation > 0 &&
      ownFundsFeedback.kind !== "ok");

  const visibleError = (field: TransferField) =>
    submitAttempted || touched[field] ? errors[field] ?? null : null;

  // El conflicto origen/destino es estructural: se muestra apenas ocurre.
  const endpointError = sameContainer ? errors.target ?? null : visibleError("target");

  const handleSubmit = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }
    setSubmitAttempted(true);

    if (!isFormValid || isSubmitting || !selectedSource || !selectedTarget) {
      return;
    }

    resetFeedback();

    const parsedDate = parseDateInputAsLocalDate(date);
    if (!parsedDate) {
      return;
    }

    const ok = await submitTransfer({
      ownerId,
      amount: parsedAmountForValidation,
      accountId: selectedSource.accountId,
      pocketId: selectedSource.pocketId,
      targetAccountId: selectedTarget.accountId,
      targetPocketId: selectedTarget.pocketId,
      date: parsedDate,
      description: description.trim(),
      movesThirdPartyFunds: movesThirdPartyFunds || undefined,
    });

    if (!ok) {
      return;
    }

    setAmount("");
    setDescription("");
    setTouched({});
    setSubmitAttempted(false);
    await onCreated();
  };

  if (containers.length < 2) {
    return (
      <EmptyState
        description={`Necesitas al menos dos cuentas o bolsillos para realizar una transferencia. (Cuentas: ${accounts.length}, Bolsillos: ${pockets.length}, Contenedores: ${containers.length})`}
        title="Cuentas insuficientes"
      />
    );
  }

  // El footer queda para las acciones: los problemas de origen, disponibilidad
  // o tipo de dinero se explican en su propio bloque, no acá.
  const footerMessage =
    submitAttempted && Object.keys(errors).length > 0 ? "Revisa los campos marcados." : null;

  return (
    <TransactionFormSurface
      renderMode={renderMode}
      subtitle="Mover dinero entre tus cuentas"
      title="Nueva transferencia"
    >
      <form
        style={toneStyle("transfer")}
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        {/* ── 1. Flujo del dinero: sale de → monto → llega a ── */}
        <div className="space-y-2">
          <div
            className={cn(
              "relative rounded-2xl border bg-white/[0.012] p-3 md:p-4",
              endpointError ? "border-[var(--fm-expense)]/30" : "border-white/[0.06]",
            )}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.1fr)_auto_minmax(0,1fr)] md:items-center md:gap-3">
            <TransferEndpoint
              id="transferSourceContainerId"
              label="Sale de (obligatorio)"
              balanceLabel="Saldo disponible:"
              container={selectedSource}
              containers={containers}
              value={sourceContainerId || selectedSource?.id || ""}
              onChange={(val) => {
                setSourceContainerId(val);
                markTouched("target");
                resetFeedback();
              }}
              invalid={Boolean(endpointError)}
            />

            <div
              aria-hidden="true"
              className="flex items-center justify-center text-[color-mix(in_oklch,var(--tone)_70%,transparent)]"
            >
              <ArrowDown className="h-4 w-4 md:hidden" />
              <ArrowRight className="hidden h-4 w-4 md:block" />
            </div>

            <AmountField
              id="transferAmount"
              label="Monto a transferir (obligatorio)"
              ariaLabel="Monto a transferir"
              value={amount}
              autoFocus
              compact
              onChange={(next) => {
                setAmount(next);
                resetFeedback();
              }}
              onBlur={() => markTouched("amount")}
              icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
              error={visibleError("amount")}
            />

            <div
              aria-hidden="true"
              className="flex items-center justify-center text-[color-mix(in_oklch,var(--tone)_70%,transparent)]"
            >
              <ArrowDown className="h-4 w-4 md:hidden" />
              <ArrowRight className="hidden h-4 w-4 md:block" />
            </div>

            <TransferEndpoint
              id="transferTargetContainerId"
              label="Llega a (obligatorio)"
              balanceLabel="Saldo actual:"
              container={selectedTarget}
              containers={containers}
              value={targetContainerId || selectedTarget?.id || ""}
              onChange={(val) => {
                setTargetContainerId(val);
                markTouched("target");
                resetFeedback();
              }}
              invalid={Boolean(endpointError)}
            />
            </div>

            {/*
              El intercambio vive sobre el eje que conecta origen y destino:
              va anclado al borde inferior del bloque, no en una fila aparte.
            */}
            <button
              type="button"
              onClick={handleSwapContainers}
              aria-label="Invertir dirección: intercambiar origen y destino"
              title="Invertir dirección"
              className={cn(
                "absolute -bottom-3.5 left-1/2 flex h-7 w-7 -translate-x-1/2 cursor-pointer",
                "select-none items-center justify-center rounded-full border border-white/10",
                "bg-[var(--fm-surface-dark)] text-[var(--fm-text-muted)] shadow-[0_4px_12px_rgb(2_6_23/0.45)]",
                "transition-colors duration-150 outline-none",
                "hover:border-[color-mix(in_oklch,var(--tone)_45%,transparent)] hover:text-[var(--tone)]",
                "focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklch,var(--tone)_45%,transparent)]",
              )}
            >
              <ArrowLeftRight
                aria-hidden="true"
                className="h-3.5 w-3.5 transition-transform duration-200"
                style={{ transform: `rotate(${swapCount * 180}deg)` }}
              />
            </button>
          </div>

          <div className="pt-2">
            <FieldError>{endpointError}</FieldError>
          </div>

          {/* G4 — composición del origen cuando el físico alcanza pero Mi dinero no. */}
          {showOwnFundsNotice ? <OwnFundsCompositionNotice feedback={ownFundsFeedback} /> : null}
        </div>

        {/* ── 2. Detalles del movimiento ── */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
            <ComposerField
              label="Concepto"
              htmlFor="transferDescription"
              required
              error={visibleError("description")}
            >
              <input
                id="transferDescription"
                type="text"
                placeholder="Título o concepto"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  resetFeedback();
                }}
                onBlur={() => markTouched("description")}
                aria-invalid={visibleError("description") ? true : undefined}
                className={cn(
                  composerControlClass,
                  visibleError("description") && composerControlErrorClass,
                )}
              />
            </ComposerField>

            <ComposerField label="Fecha" htmlFor="transferDate" required error={visibleError("date")}>
              <div className="relative">
                <input
                  id="transferDate"
                  type="date"
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    resetFeedback();
                  }}
                  onBlur={() => markTouched("date")}
                  aria-invalid={visibleError("date") ? true : undefined}
                  className={cn(
                    composerControlClass,
                    "cursor-pointer pr-9 [&::-webkit-calendar-picker-indicator]:opacity-0",
                    visibleError("date") && composerControlErrorClass,
                  )}
                />
                <Calendar
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fm-text-muted)]"
                />
              </div>
            </ComposerField>
          </div>

          {/* ── 3. Opción avanzada: mover dinero no propio ── */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
            <label
              htmlFor="movesThirdPartyFunds"
              className="flex cursor-pointer select-none items-start justify-between gap-4"
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[var(--fm-warm-paper)]">
                  Mover dinero no propio
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-[var(--fm-text-muted)]">
                  Mueve dinero de terceros entre tus cuentas sin convertirlo en dinero propio.
                </span>
              </span>
              {/* Toggle visual */}
              <span
                className={cn(
                  "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
                  movesThirdPartyFunds ? "bg-[var(--tone)]" : "bg-white/[0.08]",
                )}
              >
                <input
                  id="movesThirdPartyFunds"
                  type="checkbox"
                  checked={movesThirdPartyFunds}
                  onChange={(e) => {
                    setMovesThirdPartyFunds(e.target.checked);
                    resetFeedback();
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Mover dinero no propio"
                />
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
                    movesThirdPartyFunds ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </span>
            </label>

            {movesThirdPartyFunds && (
              <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                {occAvailabilityLoading ? (
                  <HelperText>{occLabel}</HelperText>
                ) : occAvailabilityError ? (
                  <StatusNote variant="danger" title="No se pudo verificar el dinero no propio">
                    Intenta nuevamente.
                  </StatusNote>
                ) : occAvailability <= 0 ? (
                  // La imposibilidad se explica donde ocurre, sin esperar al footer.
                  <StatusNote
                    variant="warning"
                    title="No hay dinero no propio disponible en este origen"
                  >
                    Cambia el origen o transfiere dinero propio.
                  </StatusNote>
                ) : (
                  <>
                    <HelperText>
                      {occLabel}. Conserva la atribución del dinero no propio al moverlo entre tus
                      cuentas o bolsillos.
                    </HelperText>
                    {occBlockReason ? (
                      <StatusNote
                        variant="danger"
                        title="El origen no tiene suficiente dinero no propio"
                      >
                        Reduce el monto o elige otro origen.
                      </StatusNote>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── 4. Feedback y footer ── */}
        <div className="space-y-4">
          <ComposerFeedback error={error} successMessage={successMessage} />

          <ComposerFooter
            message={footerMessage}
            messageTone={footerMessage ? "danger" : "muted"}
            submitLabel="Transferir"
            submittingLabel="Transfiriendo…"
            isSubmitting={isSubmitting}
            disabled={isBlocked || !isFormValid}
            onCancel={onCancel}
          />
        </div>
      </form>
    </TransactionFormSurface>
  );
}
