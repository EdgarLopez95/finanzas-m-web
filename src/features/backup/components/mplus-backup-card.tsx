"use client";

import React from "react";
import { Download, FileArchive, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceButton } from "@/components/finance/finance-button";
import { useMplusBackupDownload } from "../hooks/use-mplus-backup-download";

export type MplusBackupCardProps = {
  uid: string | null | undefined;
};

export function MplusBackupCard({ uid }: MplusBackupCardProps) {
  const {
    status,
    error,
    lastDownloadedFileName,
    downloadBackup,
  } = useMplusBackupDownload(uid);

  const isExporting = status === "exporting";

  return (
    <FinanceCard
      title="Copia de seguridad y respaldo"
      subtitle="Exporta una copia completa y legible de tu información en un archivo ZIP."
      variant="default"
      className="border-white/8 bg-[rgba(18,25,39,0.96)]"
    >
      <div className="space-y-4 pt-1">
        <div className="rounded-[16px] border border-white/5 bg-white/[0.02] p-4 text-xs leading-relaxed text-[var(--fm-text-muted)] space-y-2">
          <p>
            Incluye tu perfil, cuentas personales, categorías y movimientos (activos y en Papelera),
            así como la información legible de tu Hogar actual y los movimientos compartidos de ambos miembros.
          </p>
          <p className="text-[var(--fm-text-soft)]">
            <strong>Privacidad:</strong> No incluye los movimientos personales privados de tu pareja ni restaura
            datos automáticamente en la aplicación.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-[12px] border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold">Error al exportar el respaldo</p>
              <p className="text-red-300/80">{error}</p>
            </div>
          </div>
        )}

        {status === "success" && lastDownloadedFileName && (
          <div
            aria-live="polite"
            className="flex items-start gap-3 rounded-[12px] border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <div className="flex-1 space-y-0.5">
              <p className="font-semibold">Respaldo generado con éxito</p>
              <p className="font-mono text-[11px] text-emerald-300/90 break-all">{lastDownloadedFileName}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-[var(--fm-text-muted)]">
            <FileArchive className="h-4 w-4 text-[var(--fm-pending)]" />
            <span>Formato ZIP · 14 archivos (CSV, JSON, Markdown)</span>
          </div>

          <FinanceButton
            type="button"
            tone="filled"
            onClick={downloadBackup}
            disabled={isExporting || !uid}
            className="w-full sm:w-auto font-medium gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generando ZIP...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Descargar respaldo</span>
              </>
            )}
          </FinanceButton>
        </div>
      </div>
    </FinanceCard>
  );
}
