import type { HouseholdCategory } from "@/types/household";

/**
 * Obtiene únicamente las categorías activas (no archivadas) del Hogar.
 */
export const getActiveHouseholdCategories = (categories: HouseholdCategory[]): HouseholdCategory[] => {
  return categories.filter((c) => !c.archived);
};

/**
 * Resuelve el ID inicial válido para la creación de un evento en el Hogar.
 * Garantiza resolver siempre a la primera categoría activa o cadena vacía si no hay ninguna.
 */
export const resolveInitialCreateCategoryId = (categories: HouseholdCategory[]): string => {
  const active = getActiveHouseholdCategories(categories);
  return active[0]?.id ?? "";
};

/**
 * Resuelve las opciones de categorías disponibles al editar un evento del Hogar.
 * Incluye todas las categorías activas más la categoría actualmente asignada al evento (aunque esté archivada).
 * Excluye todas las demás categorías archivadas.
 */
export const resolveEditHouseholdCategories = (
  categories: HouseholdCategory[],
  currentCategoryId: string
): HouseholdCategory[] => {
  return categories.filter((c) => !c.archived || c.id === currentCategoryId);
};

/**
 * Valida si un ID de categoría es una selección válida para la creación de un nuevo evento.
 * Retorna false si la categoría está archivada, es vacía o no existe en la lista de activas.
 */
export const isValidCreateCategoryId = (
  categoryId: string,
  categories: HouseholdCategory[]
): boolean => {
  if (!categoryId?.trim()) return true; // "Sin categoría" (opcional) es una selección válida en formulario
  const active = getActiveHouseholdCategories(categories);
  return active.some((c) => c.id === categoryId);
};
