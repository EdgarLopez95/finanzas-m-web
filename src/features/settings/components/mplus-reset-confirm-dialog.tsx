"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { getFirebaseDb } from "@/lib/firebase/client";
import { resetAllStoresForSessionBoundary } from "@/stores/session-boundary";
import {
  executeMplusAccountReset,
  type MplusAccountResetResult,
} from "../services/mplus-account-reset-service";

type MplusResetConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  uid: string;
  hasHousehold: boolean;
};

export function MplusResetConfirmDialog({
  open,
  onClose,
  uid,
  hasHousehold,
}: MplusResetConfirmDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MplusAccountResetResult | null>(null);

  const handleClose = () => {
    if (isSubmitting) return;
    setError(null);
    setResult(null);
    onClose();
  };

  const handleFinish = () => {
    resetAllStoresForSessionBoundary();
    onClose();
    router.replace("/dashboard");
    // Forzar recarga limpia
    window.location.reload();
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      const res = await executeMplusAccountReset(db, uid);
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al reiniciar la cuenta.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FinanceDialog
      open={open}
      onClose={result ? handleFinish : handleClose}
      title="Reiniciar cuenta"
      subtitle="Restaurar estado inicial de Finanzas M+"
    >
      <div className="space-y-4">
        {!result && (
          <>
            <div className="flex items-start gap-3 rounded-[16px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)] p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--fm-expense)]" />
              <div className="space-y-2 text-sm text-[var(--fm-text-soft)]">
                <p>
                  Esta acción devolverá tu cuenta al estado inicial de Finanzas M+:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-xs text-[var(--fm-text-muted)]">
                  <li>Elimina todos tus movimientos personales activos y en Papelera.</li>
                  <li>Elimina tus cuentas y restablece las categorías a los 22 catálogos base.</li>
                  {hasHousehold && (
                    <li className="text-[var(--fm-expense)] font-medium">
                      Elimina el Hogar completo y los movimientos compartidos de ambos miembros. Tu pareja quedará sin Hogar.
                    </li>
                  )}
                  <li>Tu inicio de sesión de Google se conserva.</li>
                </ul>
                <p className="font-semibold text-[var(--fm-expense)]">
                  Esta acción es irreversible y no tiene copia de seguridad.
                </p>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-[14px] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] p-3 text-xs text-[var(--fm-expense)]"
              >
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <FinanceButton
                variant="ghost"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancelar
              </FinanceButton>
              <FinanceButton
                tone="destructive"
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="bg-[var(--fm-expense)] hover:bg-[var(--fm-expense)]/90 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reiniciando cuenta...
                  </>
                ) : (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Sí, reiniciar cuenta
                  </>
                )}
              </FinanceButton>
            </div>
          </>
        )}

        {result && (
          <div className="space-y-4">
            <div className="rounded-[16px] border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.06)] p-4 text-sm text-[var(--fm-text-soft)]">
              <p className="font-semibold text-[var(--fm-income)]">
                Cuenta reiniciada exitosamente
              </p>
              <p className="mt-1 text-xs text-[var(--fm-text-muted)]">
                Se eliminaron tus datos personales y se restauraron las categorías iniciales.
                {result.deletedHouseholdId && " El Hogar compartido fue eliminado."}
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <FinanceButton tone="filled" onClick={handleFinish}>
                Continuar al Inicio
              </FinanceButton>
            </div>
          </div>
        )}
      </div>
    </FinanceDialog>
  );
}
