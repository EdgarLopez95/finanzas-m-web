/**
 * Reemplazo de `@/features/qa-reset` en compilaciones de producción.
 *
 * `next.config.ts` apunta aquí con un alias de webpack cuando el build es de
 * producción y la bandera de QA está apagada. El panel de diagnóstico técnico
 * no entra en el grafo de módulos.
 *
 * Exporta la MISMA superficie que `index.tsx`, inerte.
 */

/** El panel de diagnóstico no existe en producción. */
export const QaDiagnosticsCard = (): null => null;

export const QA_TOOLS_AVAILABLE = false;
