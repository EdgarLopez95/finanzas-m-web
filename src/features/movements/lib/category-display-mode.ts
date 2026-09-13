/**
 * Modo de visualización para tarjetas y gráficas de categorías (Personal y Hogar).
 * (§ Paridad Android MonthlyCategoryCard / Dev Log 2026-09-02).
 *
 * - "amount": Muestra el monto en pesos ($) en el slot primario sobre la barra (default).
 * - "percentage": Muestra la participación porcentual (%) en el slot primario sobre la barra.
 */
export type CategoryDisplayMode = "amount" | "percentage";

export const DEFAULT_CATEGORY_DISPLAY_MODE: CategoryDisplayMode = "amount";
