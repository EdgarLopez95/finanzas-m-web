/**
 * ============================================================================
 * HERRAMIENTA QA/DEBUG — SOLO PARA DESARROLLO
 * ============================================================================
 *
 * Guard puro y testeable: la herramienta de reinicio de datos de prueba solo
 * puede montarse/ejecutarse cuando `NODE_ENV === "development"` (estrictamente
 * igual, no "distinto de production"). Esto es intencional: `test`,
 * `undefined`, previews o cualquier valor que no sea exactamente
 * `"development"` deben resolver `false`. Next.js fija `NODE_ENV=development`
 * únicamente en `next dev` — no se introduce ninguna variable de entorno
 * nueva.
 *
 * Nota: en `next dev` este guard OCULTA el botón. En builds de producción
 * `next.config.ts` aliasa `@/features/qa-reset` a `production-stub.tsx`, así
 * los servicios de wipe no viajan en el bundle. El retiro físico de la carpeta
 * sigue siendo opcional para limpieza del repo, no obligatorio para release.
 */
export const isQaResetToolAvailable = (nodeEnv: string | undefined = process.env.NODE_ENV): boolean =>
  nodeEnv === "development";
