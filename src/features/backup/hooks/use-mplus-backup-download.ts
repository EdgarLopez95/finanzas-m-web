"use client";

import { useCallback, useState } from "react";

import { getFirebaseDb } from "@/lib/firebase/client";

import { createFirestoreBackupGateway } from "../services/mplus-backup-gateway";
import { executeMplusBackupExport } from "../services/mplus-backup-service";

export type BackupDownloadStatus = "idle" | "exporting" | "success" | "error";

export type UseMplusBackupDownloadResult = {
  status: BackupDownloadStatus;
  error: string | null;
  lastDownloadedFileName: string | null;
  downloadBackup: () => Promise<void>;
  reset: () => void;
};

/**
 * Hook para disparar la descarga de respaldo en ZIP desde el navegador.
 *
 * - Valida conectividad activa (DEC-022 / online-only).
 * - Genera el archivo ZIP en memoria con `fflate`.
 * - Dispara la descarga mediante Blob URL y limpia la memoria tras su uso.
 */
export function useMplusBackupDownload(uid: string | null | undefined): UseMplusBackupDownloadResult {
  const [status, setStatus] = useState<BackupDownloadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastDownloadedFileName, setLastDownloadedFileName] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  const downloadBackup = useCallback(async () => {
    if (!uid) {
      setStatus("error");
      setError("No hay una sesión de usuario activa para generar el respaldo.");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("error");
      setError("Sin conexión a internet. Conéctate a la red para descargar el respaldo.");
      return;
    }

    setStatus("exporting");
    setError(null);

    try {
      const db = getFirebaseDb();
      const gateway = createFirestoreBackupGateway(db);
      const result = await executeMplusBackupExport(gateway, uid);

      // Crear Blob y disparar descarga
      const blob = new Blob([result.zipBuffer.buffer as ArrayBuffer], { type: "application/zip" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = result.zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setLastDownloadedFileName(result.zipFileName);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      const message = err instanceof Error ? err.message : "Error inesperado al generar el respaldo.";
      setError(message);
    }
  }, [uid]);

  return {
    status,
    error,
    lastDownloadedFileName,
    downloadBackup,
    reset,
  };
}
