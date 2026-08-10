"use client";

import { useEffect, useState } from "react";

import { useAutoSettleDebtStore } from "@/stores/auto-settle-debt-store";
import { shouldAutoCloseManualFallback, shouldAutoOpenManualFallback } from "@/features/household/lib/auto-settle-debt";
import { useHouseholdData } from "@/features/household/hooks/use-household-data";
// PUENTE PERSONAL: acreditar el reembolso acredita dinero en mi cuenta personal.
import { ConfirmReceptionDialog } from "@/features/household/components/confirm-reception-dialog";
import type { HouseholdDebt, HouseholdMemberProfile } from "@/types/household";

const resolveMemberName = (
  userId: string,
  currentUid: string | null,
  memberProfiles: Record<string, HouseholdMemberProfile>
): string => {
  if (userId === currentUid) return "Tú";
  return memberProfiles[userId]?.displayName || "Otro miembro";
};

/**
 * Presentador único del sheet de acreditación manual de deudas (household-debt-auto-settle).
 * Paridad Android: el sheet `NeedsManualAccount` aparece en Home Personal y
 * Home Hogar (no en Movimientos/Ajustes/otras rutas) y permanece pendiente en
 * estado mientras el usuario está fuera de Home, mostrándose de nuevo al
 * volver. Por eso este componente se monta una sola vez desde `DashboardShell`
 * solo para las rutas `/dashboard` y `/household`, no dentro de `HouseholdOverview`
 * (que solo vive en `/household`).
 *
 * Lee el estado de deuda y miembro actual de los stores existentes (no recibe
 * props): `useHouseholdData()` para las deudas por cobrar del acreedor actual
 * e identidad mínima segura de miembros, `useAutoSettleDebtStore` para el
 * resultado del observador de auto-settle. No expone cuenta, banco, saldo ni
 * categoría del otro miembro — solo `displayName`.
 */
export function HouseholdDebtReceptionFallback() {
  const { summary } = useHouseholdData();
  const { debtsReceivable, currentUid, memberProfiles } = summary;

  const autoSettleEntries = useAutoSettleDebtStore((state) => state.entries);
  const autoSettleDismissed = useAutoSettleDebtStore((state) => state.dismissed);
  const dismissAutoSettleFallback = useAutoSettleDebtStore((state) => state.dismiss);
  const clearAutoSettleFallback = useAutoSettleDebtStore((state) => state.clear);

  const [selectedDebt, setSelectedDebt] = useState<HouseholdDebt | null>(null);

  // Se abre automáticamente una sola vez por needs_manual_account (paridad
  // Android: sheet Home tras NeedsManualAccount). No reabre si el usuario ya
  // lo descartó para ese debtId en este mismo estado.
  useEffect(() => {
    if (selectedDebt) return;
    const candidate = debtsReceivable.find((debt) =>
      shouldAutoOpenManualFallback({
        entry: autoSettleEntries[debt.id],
        dismissed: Boolean(autoSettleDismissed[debt.id]),
      })
    );
    if (candidate) {
      setSelectedDebt(candidate);
    }
  }, [debtsReceivable, autoSettleEntries, autoSettleDismissed, selectedDebt]);

  // Cierre automático (corrección P1, orden tardío): si la deuda actualmente
  // abierta deja de estar en needs_manual_account -- el observador la puso en
  // processing para reintentar, o la limpió tras settled/skipped (p. ej. una
  // share del pagador se completó mientras el sheet esperaba cuenta manual) --
  // el sheet se cierra solo. Solo mira la entry de `selectedDebt`, así que un
  // cambio en la entry de otra deuda nunca lo cierra.
  useEffect(() => {
    if (!selectedDebt) return;
    if (shouldAutoCloseManualFallback(autoSettleEntries[selectedDebt.id])) {
      setSelectedDebt(null);
    }
  }, [selectedDebt, autoSettleEntries]);

  if (!selectedDebt) return null;

  // Aislamiento HH-VIS-1.4: aunque ConfirmReceptionDialog ya declara
  // data-fm-context="personal", el presentador del fallback también lo ancla
  // para que la frontera del puente quede explícita en este archivo.
  return (
    <div data-fm-context="personal">
      <ConfirmReceptionDialog
        open={selectedDebt !== null}
        onClose={() => setSelectedDebt(null)}
        onDismiss={() => dismissAutoSettleFallback(selectedDebt.id)}
        debtId={selectedDebt.id}
        debtAmount={selectedDebt.amount}
        debtorName={resolveMemberName(selectedDebt.fromUserId, currentUid, memberProfiles)}
        currentUid={currentUid ?? ""}
        onSuccess={() => clearAutoSettleFallback(selectedDebt.id)}
        reason={(() => {
          const entry = autoSettleEntries[selectedDebt.id];
          return entry?.status === "needs_manual_account"
            ? entry.reason
            : "no encontramos la cuenta del gasto origen.";
        })()}
      />
    </div>
  );
}
