"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";

import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { signOutUser } from "@/features/auth/auth-service";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  executeMplusAccountReset,
  MplusAccountResetError,
  type MplusAccountResetResult,
} from "../services/mplus-account-reset-service";

export type MplusResetConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  uid: string;
  hasHousehold: boolean;
};

/**
 * Diálogo de confirmación de Reinicio de Cuenta (spec §20 / DEC-080).
 *
 * Función de producto en Ajustes (zona peligrosa). Borra todos los datos
 * personales, cuentas, categorías, perfil y, si existe, el Hogar compartido
 * completo.
 */
export function MplusResetConfirmDialog({
  open,
  onClose,
  uid,
  hasHousehold,
}: MplusResetConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MplusAccountResetResult | null>(null);

  const handleClose = () => {
    if (isSubmitting) return;
    setError(null);
    setResult(null);
    onClose();
  };

  /**
   * Tras un reinicio, la sesión anterior no puede continuar: sus datos ya no
   * existen y los stores apuntan a documentos borrados. Se cierra sesión en
   * Firebase Auth y se vuelve al acceso inicial — nunca al dashboard
   * autenticado.
   *
   * La navegación es DURA (`window.location`) a propósito, no un
   * `router.replace`:
   *
   * 1. `signOutUser()` dispara el listener de Firebase Auth, que limpia la
   *    sesión del store. Ajustes monta este diálogo solo mientras hay `uid`,
   *    así que para cuando termina el `await` este componente YA se desmontó.
   *    Un `router.replace` lanzado desde el closure de un componente muerto no
   *    llega a navegar.
   * 2. El reinicio acaba de borrar TODO el dato sobre el que está construida la
   *    pantalla. Una recarga completa arranca stores, efectos y contextos de cero.
   */
  const handleFinish = async () => {
    try {
      await signOutUser();
    } catch {
      // Aunque el cierre de sesión falle, la recarga completa deja la pestaña
      // sin estado vivo y el guard de rutas exigirá autenticarse de nuevo.
    }
    window.location.assign("/");
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      const res = await executeMplusAccountReset(db, uid);
      setResult(res);
    } catch (err: unknown) {
      const msg =
        err instanceof MplusAccountResetError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error al reiniciar la cuenta.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FinanceDialog
      open={open}
      onClose={result ? () => void handleFinish() : handleClose}
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
                  Esta acción devolverá tu cuenta al estado inicial de Finanzas
                  M+ borrando tus datos de forma definitiva: no pasan por la
                  Papelera y no hay copia de seguridad ni forma de recuperarlos.
                </p>
                <ul className="list-disc pl-4 space-y-1 text-xs text-[var(--fm-text-muted)]">
                  <li>Elimina todos tus movimientos personales activos y en Papelera.</li>
                  <li>Elimina tus cuentas y tus categorías personales.</li>
                  <li>
                    Elimina tu perfil de Firestore: al volver a entrar, la app creará
                    una cuenta nueva desde cero.
                  </li>
                  {hasHousehold && (
                    <li className="text-[var(--fm-expense)] font-medium">
                      Elimina el Hogar completo y los movimientos compartidos de ambos miembros. Tu pareja quedará sin Hogar.
                    </li>
                  )}
                  <li>Al terminar se cerrará la sesión y volverás al acceso inicial.</li>
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
                {result.deletedUserProfile
                  ? "Se eliminó tu perfil por completo. Al volver a entrar, la app creará una cuenta nueva desde cero."
                  : "Se eliminaron tus datos personales y se restauraron las categorías iniciales."}
                {result.deletedHouseholdId && " El Hogar compartido fue eliminado."}
              </p>
              {result.skipped.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-[var(--fm-pending)]">
                  {result.skipped.map((note) => (
                    <li key={note}>No se pudo limpiar: {note}</li>
                  ))}
                </ul>
              )}
              <p className="mt-2 font-mono text-[11px] text-[var(--fm-text-muted)]">
                movimientos propios: {result.deletedOwnMovementsCount} · compartidos de la
                pareja: {result.deletedPartnerSharedMovementsCount} · cuentas:{" "}
                {result.deletedAccountsCount} · categorías: {result.deletedCategoriesCount} ·
                invitaciones: {result.deletedInvitesCount} · perfil:{" "}
                {result.deletedUserProfile ? "eliminado" : "conservado"}
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <FinanceButton tone="filled" onClick={() => void handleFinish()}>
                Cerrar sesión y volver al acceso
              </FinanceButton>
            </div>
          </div>
        )}
      </div>
    </FinanceDialog>
  );
}
