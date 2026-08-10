"use client";

/**
 * ============================================================================
 * HERRAMIENTA QA/DEBUG — SOLO PARA DESARROLLO
 * Este componente (y todo `src/features/qa-reset/**`) debe RETIRARSE del
 * repositorio en el paso de limpieza preproducción. Está aislado a propósito
 * en su propio feature folder para que ese retiro sea un simple `rm -rf`.
 * No debe existir ningún botón, ruta ni acción ejecutable de este flujo en
 * producción — ver el guard `isQaResetToolAvailable()` en el llamador.
 * ============================================================================
 */
import { useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";

import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { useQaResetData, type QaResetOutcome } from "@/features/qa-reset/hooks/use-qa-reset-data";
import { resolveQaResetRole, resolveQaResetConfirmationCopy } from "@/features/qa-reset/lib/qa-reset-role";
import type { Household } from "@/types/household";

type QaResetConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  uid: string;
  /**
   * Solo se usa para elegir el copy de confirmación mostrado ANTES de
   * ejecutar (identidad mínima segura ya cargada por la UI). La ejecución
   * real (`submit(uid)`) descubre todos los Hogares del usuario por sí
   * misma — nunca depende de este valor para decidir qué borrar.
   */
  household: Household | null;
};

/** Detalle legible de qué categoría falló, para el mensaje de fallo parcial (nunca oculta el problema). */
const buildPartialFailureDetail = (outcome: Extract<QaResetOutcome, { kind: "partial" }>): string[] => {
  const { result } = outcome;
  const lines: string[] = [];
  if (result.discoveryFailed) lines.push("No se pudo confirmar la lista completa de tus Hogares.");
  if (result.personal.failed > 0) lines.push(`Datos personales: ${result.personal.failed} operación(es) fallida(s).`);
  if (result.householdLinkedDocsCleanup.failed > 0) {
    lines.push(`Documentos de Hogar vinculados a ti: ${result.householdLinkedDocsCleanup.failed} operación(es) fallida(s).`);
  }
  const failedOwned = result.ownedHouseholdsDissolved.filter((h) => !h.success);
  if (failedOwned.length > 0) lines.push(`${failedOwned.length} Hogar(es) propio(s) no se pudo(pudieron) disolver.`);
  const failedMember = result.memberHouseholdsLeft.filter((h) => !h.success);
  if (failedMember.length > 0) lines.push(`${failedMember.length} Hogar(es) ajeno(s) no se pudo(pudieron) abandonar.`);
  if (result.activeHouseholdIdClearFailed) lines.push("No se pudo limpiar la referencia final a tu Hogar activo.");
  return lines;
};

export function QaResetConfirmDialog({ open, onClose, uid, household }: QaResetConfirmDialogProps) {
  const [hasConfirmedStep, setHasConfirmedStep] = useState(false);
  const { isSubmitting, outcome, submit, finish, resetOutcome } = useQaResetData();

  const role = resolveQaResetRole(uid, household);
  const confirmationCopy = resolveQaResetConfirmationCopy(role);

  // Cierre "sin efectos": solo válido ANTES de que exista un resultado (el
  // usuario canceló sin haber ejecutado nada todavía). No limpia stores ni
  // recarga porque no hay nada que limpiar.
  const handleClose = () => {
    if (isSubmitting) return;
    setHasConfirmedStep(false);
    resetOutcome();
    onClose();
  };

  // Cierre "con resultado": el reset remoto ya corrió (éxito, parcial o
  // error). Nunca se deja al usuario viendo datos locales que pudieron
  // cambiar en el remoto — `finish()` limpia stores y hace una recarga
  // completa controlada hacia una ruta segura. Idempotente (una sola vez).
  const handleFinish = () => {
    if (isSubmitting) return;
    finish();
  };

  const handleConfirm = async () => {
    await submit(uid);
  };

  return (
    <FinanceDialog
      open={open}
      onClose={outcome ? handleFinish : handleClose}
      title="Reiniciar datos de prueba"
      subtitle="Herramienta de QA — no disponible en producción"
    >
      <div className="space-y-4">
        {!outcome && (
          <>
            <div className="flex items-start gap-3 rounded-[16px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)] p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--fm-expense)]" />
              <div className="space-y-2 text-sm text-[var(--fm-text-soft)]">
                <p>{confirmationCopy}</p>
                <p className="font-semibold text-[var(--fm-expense)]">
                  Esta acción es irreversible. Tu sesión no se cerrará.
                </p>
              </div>
            </div>

            {!hasConfirmedStep ? (
              <div className="flex justify-end gap-3">
                <FinanceButton type="button" tone="text" variant="ghost" onClick={handleClose}>
                  Cancelar
                </FinanceButton>
                <FinanceButton
                  type="button"
                  tone="filled"
                  onClick={() => setHasConfirmedStep(true)}
                  className="bg-[var(--fm-expense)] text-white hover:bg-[color-mix(in_oklch,var(--fm-expense),black_10%)]"
                >
                  Entiendo, continuar
                </FinanceButton>
              </div>
            ) : (
              <div className="flex justify-end gap-3">
                <FinanceButton type="button" tone="text" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                  Cancelar
                </FinanceButton>
                <FinanceButton
                  type="button"
                  tone="filled"
                  disabled={isSubmitting}
                  onClick={handleConfirm}
                  className="bg-[var(--fm-expense)] text-white hover:bg-[color-mix(in_oklch,var(--fm-expense),black_10%)]"
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Reiniciando datos...
                    </span>
                  ) : (
                    "Sí, reiniciar mis datos de prueba"
                  )}
                </FinanceButton>
              </div>
            )}
          </>
        )}

        {outcome?.kind === "success" && (
          <div className="space-y-4">
            <div className="rounded-[16px] border border-[rgba(74,222,128,0.25)] bg-[rgba(74,222,128,0.06)] p-4 text-sm text-[var(--fm-text-soft)]">
              Listo. Tus datos de prueba quedaron eliminados y tu cuenta sigue creada e iniciada — puedes empezar una
              prueba desde cero.
            </div>
            <div className="flex justify-end">
              <FinanceButton type="button" tone="filled" onClick={handleFinish}>
                Entendido
              </FinanceButton>
            </div>
          </div>
        )}

        {outcome?.kind === "partial" && (
          <div className="space-y-4">
            <div className="space-y-2 rounded-[16px] border border-[rgba(228,179,99,0.3)] bg-[rgba(228,179,99,0.08)] p-4 text-sm text-[var(--fm-text-soft)]">
              <p>
                El reinicio terminó, pero algunos datos podrían no haberse eliminado por completo. Puedes reintentar
                sin riesgo — la operación es segura de repetir.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-[var(--fm-pending)]">
                {buildPartialFailureDetail(outcome).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-3">
              <FinanceButton type="button" tone="text" variant="ghost" onClick={handleFinish}>
                Cerrar
              </FinanceButton>
              <FinanceButton
                type="button"
                tone="filled"
                disabled={isSubmitting}
                onClick={handleConfirm}
                className="bg-[var(--fm-expense)] text-white hover:bg-[color-mix(in_oklch,var(--fm-expense),black_10%)]"
              >
                <span className="inline-flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Reintentar
                </span>
              </FinanceButton>
            </div>
          </div>
        )}

        {outcome?.kind === "error" && (
          <div className="space-y-4">
            <div className="rounded-[16px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)] p-4 text-sm text-[var(--fm-expense)]">
              {outcome.message} Algunos datos podrían no haberse eliminado. Puedes reintentar sin riesgo.
            </div>
            <div className="flex justify-end gap-3">
              <FinanceButton type="button" tone="text" variant="ghost" onClick={handleFinish}>
                Cerrar
              </FinanceButton>
              <FinanceButton
                type="button"
                tone="filled"
                disabled={isSubmitting}
                onClick={handleConfirm}
                className="bg-[var(--fm-expense)] text-white hover:bg-[color-mix(in_oklch,var(--fm-expense),black_10%)]"
              >
                <span className="inline-flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Reintentar
                </span>
              </FinanceButton>
            </div>
          </div>
        )}
      </div>
    </FinanceDialog>
  );
}
