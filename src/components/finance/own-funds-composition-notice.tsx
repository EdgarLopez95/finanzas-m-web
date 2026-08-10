/**
 * G4 — Panel de composición para débitos con dinero PROPIO.
 *
 * Cuando la barrera falla, "saldo insuficiente" a secas es engañoso: el físico
 * puede alcanzar de sobra y aun así el movimiento no caber en Mi dinero. Este
 * aviso muestra los tres montos que explican el rechazo (físico / retenido no
 * propio / propio usable) además del motivo canónico.
 *
 * No decide nada: solo pinta el `feedback` que ya calculó `own-funds-gate`.
 */

import { Amount } from "@/components/finance/amount";
import type { OwnFundsCompositionFeedback } from "@/lib/finance/own-funds-gate";
import { cn } from "@/lib/utils";

type OwnFundsCompositionNoticeProps = {
  feedback: OwnFundsCompositionFeedback;
  masked?: boolean;
  className?: string;
};

export function OwnFundsCompositionNotice({
  feedback,
  masked = false,
  className,
}: OwnFundsCompositionNoticeProps) {
  if (feedback.kind === "ok") return null;

  // Mi dinero se resalta en rojo cuando es negativo o la composición es
  // imposible: es la cifra que explica el rechazo, no se suaviza.
  const ownIsAlarming = feedback.kind === "inconsistent" || feedback.own < 0;

  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border border-[rgba(248,113,113,0.16)] bg-[rgba(239,68,68,0.08)] px-3.5 py-3 space-y-2.5",
        className,
      )}
    >
      <div className="space-y-1.5">
        <CompositionRow label="Físico en origen" masked={masked} value={feedback.physical} />
        <CompositionRow
          label="Retenido no propio"
          masked={masked}
          value={feedback.held}
          valueClassName="text-[var(--fm-transfer)]"
        />
        <CompositionRow
          label="Mi dinero (usable)"
          masked={masked}
          value={feedback.own}
          valueClassName={
            ownIsAlarming ? "text-[var(--fm-expense)]" : "text-[var(--fm-warm-paper)]"
          }
        />
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--fm-expense)] border-t border-[rgba(248,113,113,0.14)] pt-2">
        {feedback.message}
      </p>
    </div>
  );
}

function CompositionRow({
  label,
  value,
  masked,
  valueClassName,
}: {
  label: string;
  value: number;
  masked: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-[var(--fm-text-muted)]">{label}</span>
      <Amount
        className={cn("text-[12px] font-semibold", valueClassName)}
        masked={masked}
        showSign={false}
        size="sm"
        value={value}
      />
    </div>
  );
}
