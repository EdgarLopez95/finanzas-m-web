"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { describeQaToolsGate } from "@/lib/qa/qa-tools";
import { cn } from "@/lib/utils";
import { useAppContextStore } from "@/stores/app-context-store";
import { useAuthStore } from "@/stores/auth-store";
import { useMplusHouseholdStore } from "@/stores/mplus-household-store";
import { useMplusPersonalStore } from "@/stores/mplus-personal-store";

/**
 * Diagnóstico de lecturas — EXCLUSIVO de desarrollo/QA.
 *
 * Reemplaza a la card "Sincronización en vivo", que era texto decorativo y un
 * diagnóstico técnico dirigido al usuario final: la especificación lo prohíbe
 * (§19.4) y Web no ofrece sincronización manual (§21.4). Aquí no hay nada que
 * el usuario final pueda accionar; el montaje está detrás de
 * la puerta de QA y no llega al bundle de producción: `next.config.ts`
 * sustituye este módulo por un stub inerte.
 *
 * Todo lo que muestra sale del estado real de los stores del contrato v1: no
 * hay copy inventado ni estados simulados.
 *
 * "Recargar lecturas" NO es un botón de sincronizar: Web lee siempre contra el
 * servidor y no tiene cola ni modo offline. Es un re-`refresh()` de los mismos
 * loaders del producto, seguro de repetir porque el circuito no usa
 * `onSnapshot`: cada lectura es puntual (`getDocs`/`getDoc`) y ambos stores
 * descartan respuestas obsoletas comparando su `generation`.
 */

type ReloadState =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "running" }>
  | Readonly<{ kind: "ok"; at: string }>
  | Readonly<{ kind: "error"; message: string }>;

/** UID abreviado: suficiente para identificar la sesión en QA sin volcarlo entero. */
const shortenUid = (uid: string): string =>
  uid.length <= 12 ? uid : `${uid.slice(0, 6)}…${uid.slice(-4)}`;

const statusTone = (status: string, hasError: boolean): string => {
  if (hasError || status === "error") return "text-[var(--fm-expense)]";
  if (status === "success") return "text-[var(--fm-income)]";
  if (status === "loading") return "text-[var(--fm-pending)]";
  return "text-[var(--fm-text-muted)]";
};

function DiagnosticRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs text-[var(--fm-text-muted)]">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate text-right font-mono text-xs",
          tone ?? "text-[var(--fm-warm-paper)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function QaDiagnosticsCard() {
  const uid = useAuthStore((state) => state.user?.uid ?? "");
  const activeContext = useAppContextStore((state) => state.activeContext);
  const selectedPeriod = useAppContextStore((state) => state.selectedPeriod);

  const personalStatus = useMplusPersonalStore((state) => state.status);
  const personalError = useMplusPersonalStore((state) => state.error);
  const personalPeriod = useMplusPersonalStore((state) => state.period);
  const personalGeneration = useMplusPersonalStore((state) => state.generation);
  const personalMovements = useMplusPersonalStore((state) => state.movements.length);
  const refreshPersonal = useMplusPersonalStore((state) => state.refresh);

  const householdStatus = useMplusHouseholdStore((state) => state.status);
  const householdError = useMplusHouseholdStore((state) => state.error);
  const householdId = useMplusHouseholdStore((state) => state.householdId);
  const householdPeriod = useMplusHouseholdStore((state) => state.period);
  const householdGeneration = useMplusHouseholdStore((state) => state.generation);
  const householdMovements = useMplusHouseholdStore((state) => state.movements.length);
  const refreshHousehold = useMplusHouseholdStore((state) => state.refresh);

  const [online, setOnline] = useState<boolean | null>(null);
  const [reload, setReload] = useState<ReloadState>({ kind: "idle" });

  // Conectividad real del navegador. Se lee en efecto (no en render) porque el
  // servidor no tiene `navigator` y el HTML inicial debe coincidir.
  useEffect(() => {
    const sync = () => setOnline(window.navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const handleReload = useCallback(async () => {
    setReload({ kind: "running" });
    try {
      // Los dos loaders reales del producto, no una simulación.
      await Promise.all([refreshPersonal(), refreshHousehold()]);

      // El éxito se decide con el estado que quedó en los stores, no con el
      // hecho de que la promesa resolviera: `load` atrapa sus propios errores
      // y los deja en `status = "error"`.
      const personal = useMplusPersonalStore.getState();
      const household = useMplusHouseholdStore.getState();
      const failure = personal.error ?? household.error;

      if (failure) {
        setReload({ kind: "error", message: failure });
        return;
      }
      setReload({
        kind: "ok",
        at: new Date().toLocaleTimeString("es-CO", { hour12: false }),
      });
    } catch (err) {
      setReload({
        kind: "error",
        message: err instanceof Error ? err.message : "Fallo desconocido al releer.",
      });
    }
  }, [refreshHousehold, refreshPersonal]);

  const formatPeriod = (period: { year: number; month: number } | null): string =>
    period ? `${period.year}-${String(period.month).padStart(2, "0")}` : "—";

  return (
    <FinanceCard
      className="border-[rgba(234,179,8,0.25)] bg-[rgba(234,179,8,0.03)]"
      title="Diagnóstico de lecturas (QA)"
      variant="default"
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--fm-text-muted)]">
          Solo visible en desarrollo/QA. No es una función de producto: Web lee siempre
          contra el servidor y no tiene sincronización manual ni modo sin conexión.
        </p>

        <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--fm-text-soft)]">
              Sesión
            </p>
            <DiagnosticRow label="UID" value={uid ? shortenUid(uid) : "sin sesión"} />
            <DiagnosticRow label="Contexto" value={activeContext} />
            <DiagnosticRow label="Puerta QA" value={describeQaToolsGate()} />
            <DiagnosticRow
              label="Período UI"
              value={`${selectedPeriod.year}-${String(selectedPeriod.month + 1).padStart(2, "0")}`}
            />
            <DiagnosticRow
              label="Conexión"
              value={online === null ? "—" : online ? "en línea" : "sin conexión"}
              tone={
                online === false ? "text-[var(--fm-expense)]" : "text-[var(--fm-income)]"
              }
            />
          </div>

          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--fm-text-soft)]">
              Personal
            </p>
            <DiagnosticRow
              label="Estado"
              value={personalStatus}
              tone={statusTone(personalStatus, Boolean(personalError))}
            />
            <DiagnosticRow label="Mes cargado" value={formatPeriod(personalPeriod)} />
            <DiagnosticRow label="Movimientos" value={String(personalMovements)} />
            <DiagnosticRow label="Recargas" value={String(personalGeneration)} />
            {personalError && (
              <DiagnosticRow
                label="Error"
                value={personalError}
                tone="text-[var(--fm-expense)]"
              />
            )}
          </div>

          <div className="min-w-0 md:col-start-2">
            <p className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--fm-text-soft)]">
              Hogar
            </p>
            <DiagnosticRow
              label="Estado"
              value={householdStatus}
              tone={statusTone(householdStatus, Boolean(householdError))}
            />
            <DiagnosticRow
              label="Hogar"
              value={householdId ? shortenUid(householdId) : "sin hogar"}
            />
            <DiagnosticRow label="Mes cargado" value={formatPeriod(householdPeriod)} />
            <DiagnosticRow label="Compartidos" value={String(householdMovements)} />
            <DiagnosticRow label="Recargas" value={String(householdGeneration)} />
            {householdError && (
              <DiagnosticRow
                label="Error"
                value={householdError}
                tone="text-[var(--fm-expense)]"
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-3">
          <div className="min-w-0 text-xs" role="status">
            {reload.kind === "ok" && (
              <span className="text-[var(--fm-income)]">
                Lecturas rehechas sin error · {reload.at}
              </span>
            )}
            {reload.kind === "error" && (
              <span className="text-[var(--fm-expense)]">Falló: {reload.message}</span>
            )}
            {reload.kind === "running" && (
              <span className="text-[var(--fm-text-muted)]">Releyendo…</span>
            )}
          </div>

          <FinanceButton
            disabled={reload.kind === "running"}
            onClick={() => void handleReload()}
            tone="text"
            type="button"
            variant="ghost"
          >
            {reload.kind === "running" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recargando…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Recargar lecturas
              </>
            )}
          </FinanceButton>
        </div>
      </div>
    </FinanceCard>
  );
}
