import { CATEGORY_COLOR_PALETTE, DEFAULT_EXPENSE_COLOR } from "@/lib/categories/category-icons";

/**
 * Catálogo central de colores de categoría del Hogar. Reexporta la misma
 * paleta canónica Android de 16 colores usada por Personal
 * (`src/lib/categories/category-icons.ts#CATEGORY_COLOR_PALETTE`) — Hogar no
 * mantiene una paleta propia divergente.
 */
export const HOUSEHOLD_CATEGORY_COLORS = CATEGORY_COLOR_PALETTE;

export const DEFAULT_HOUSEHOLD_CATEGORY_COLOR = DEFAULT_EXPENSE_COLOR;
