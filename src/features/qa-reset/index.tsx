/**
 * Superficie EXCLUSIVA de desarrollo/QA: diagnóstico de lecturas.
 *
 * Este barril es el punto por el que Ajustes alcanza las herramientas de QA, y
 * existe para que la eliminación en producción NO dependa de que el minificador
 * sepa plegar una condición. `next.config.ts` sustituye el módulo entero por
 * `production-stub.tsx` mediante un alias de webpack cuando el build es de
 * producción y la bandera de QA no está encendida: así el componente y sus
 * textos no llegan siquiera a analizarse.
 *
 * El reinicio de cuenta (DEC-080 / spec §20) es una función de producto en
 * Ajustes (zona peligrosa) y vive en `@/features/settings`, no aquí.
 *
 * El stub debe exportar exactamente los mismos nombres.
 */

export { QaDiagnosticsCard } from "./components/qa-diagnostics-card";

/** Verdadero solo en este módulo real; el stub de producción exporta `false`. */
export const QA_TOOLS_AVAILABLE = true;
