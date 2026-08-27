/**
 * Puerta única de las herramientas exclusivas de desarrollo/QA.
 *
 * Finanzas M+ no muestra al usuario final diagnósticos técnicos ni
 * sincronización manual (especificación §19.4 y §21.4).
 *
 * El reinicio de cuenta (DEC-080 / spec §20), en cambio, es una función de
 * producto en Ajustes (zona peligrosa).
 *
 * Aquí está la POLÍTICA para herramientas de QA en forma pura y comprobable.
 * La aplicación de esa política ocurre en dos sitios:
 *
 * 1. `next.config.ts` sustituye el módulo `@/features/qa-reset` entero por un
 *    stub inerte en builds de producción sin bandera. Ese es el corte duro: el
 *    panel de diagnóstico no llega siquiera a analizarse.
 * 2. `MplusSettingsView` repite la condición INLINE para no renderizarlo.
 */

/** Nombre de la bandera explícita, expuesto para pruebas y documentación. */
export const QA_TOOLS_ENV_FLAG = "NEXT_PUBLIC_MPLUS_QA_TOOLS";

/** Valor exacto que habilita la bandera. Cualquier otro valor la deja apagada. */
export const QA_TOOLS_ENV_FLAG_ON = "1";

/**
 * La decisión, sobre un entorno explícito. Se evalúa contra parámetros y no
 * contra `process.env` para que las pruebas puedan recorrer la tabla de verdad
 * completa: en Next.js esas variables están inlineadas y no son reasignables.
 */
export const resolveQaToolsEnabled = (env: {
  nodeEnv: string | undefined;
  qaFlag: string | undefined;
}): boolean =>
  env.nodeEnv !== "production" || env.qaFlag === QA_TOOLS_ENV_FLAG_ON;

/**
 * Explica por qué están visibles las herramientas de QA. Es la primera pregunta
 * de quien ve el panel: si aparece en un artefacto que creía de producción,
 * esta línea dice si fue por `NODE_ENV` o por una bandera encendida a mano.
 */
export const describeQaToolsGate = (): string => {
  if (process.env.NODE_ENV !== "production") {
    return `NODE_ENV=${process.env.NODE_ENV ?? "sin definir"}`;
  }
  return process.env.NEXT_PUBLIC_MPLUS_QA_TOOLS === QA_TOOLS_ENV_FLAG_ON
    ? `${QA_TOOLS_ENV_FLAG}=${QA_TOOLS_ENV_FLAG_ON}`
    : "cerrada";
};
