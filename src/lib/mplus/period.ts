import type { SelectedPeriod } from "@/lib/format/date";

/**
 * Periodo en la convencion del contrato: mes calendario 1-12 (§4.6 y §19).
 *
 * Es la unidad que aceptan `resolveMonthRangeFor` y las dos consultas
 * mensuales canonicas (Personal §19.1, Hogar §19.3).
 */
export type MplusContractPeriod = Readonly<{ year: number; month: number }>;

/**
 * Traduce el periodo que elige la UI al periodo del contrato.
 *
 * `SelectedPeriod` usa mes 0-indexado (`@/lib/format/date`) porque nace de
 * `Date.getMonth()` y del selector de meses; el contrato y las consultas usan
 * 1-12. La traduccion vive AQUI, en una sola pieza, y no en cada driver:
 * cuando Personal y Hogar convertian por su cuenta, Hogar olvido el `+1` y
 * consulto siempre el mes anterior al que mostraba en pantalla.
 */
export const toContractPeriod = (period: SelectedPeriod): MplusContractPeriod => ({
  year: period.year,
  month: period.month + 1,
});
