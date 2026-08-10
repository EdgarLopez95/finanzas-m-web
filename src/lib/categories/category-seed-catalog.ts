/**
 * Catálogo canónico de categorías seed (Bloque 2 de paridad Android→Web),
 * única fuente Web para Personal y Hogar. Espejo textual de
 * `ExpenseCategorySeedCatalog.kt` (16 gastos) y de la lista de ingresos
 * hardcodeada en `CategoryRepository.kt#personalIncomeCategorySeeds` (6
 * ingresos, solo Personal — Hogar nunca crea ingresos).
 *
 * Los colores de este catálogo son los colores Android del seed histórico;
 * NO pertenecen a la paleta de 16 colores del picker
 * (`src/lib/categories/category-icons.ts#CATEGORY_COLOR_PALETTE`) y no deben
 * normalizarse a esa paleta.
 */

export interface ExpenseCategorySeedDefinition {
  seedKey: string;
  personalName: string;
  householdName: string;
  iconKey: string;
  color: string;
  sortOrder: number;
  personalLegacyAliases: string[];
  householdLegacyAliases: string[];
}

export const EXPENSE_CATEGORY_SEEDS: ExpenseCategorySeedDefinition[] = [
  {
    seedKey: "groceries",
    personalName: "Mercado",
    householdName: "Mercado",
    iconKey: "groceries",
    color: "#22C55E",
    sortOrder: 1,
    personalLegacyAliases: ["Mercado", "Alimentación"],
    householdLegacyAliases: [],
  },
  {
    seedKey: "restaurant",
    personalName: "Restaurantes y domicilios",
    householdName: "Restaurantes y domicilios",
    iconKey: "restaurant",
    color: "#F97316",
    sortOrder: 2,
    personalLegacyAliases: ["Restaurantes"],
    householdLegacyAliases: [],
  },
  {
    seedKey: "housing",
    personalName: "Arriendo / vivienda",
    householdName: "Arriendo / vivienda",
    iconKey: "housing",
    color: "#6C8E7F",
    sortOrder: 3,
    personalLegacyAliases: ["Vivienda"],
    householdLegacyAliases: [],
  },
  {
    seedKey: "bills",
    personalName: "Servicios",
    householdName: "Servicios del hogar",
    iconKey: "bills",
    color: "#E4B363",
    sortOrder: 4,
    personalLegacyAliases: ["Servicios"],
    householdLegacyAliases: [],
  },
  {
    seedKey: "cleaning",
    personalName: "Aseo y hogar",
    householdName: "Aseo y hogar",
    iconKey: "cleaning",
    color: "#14B8A6",
    sortOrder: 5,
    personalLegacyAliases: [],
    householdLegacyAliases: [],
  },
  {
    seedKey: "transport",
    personalName: "Transporte",
    householdName: "Transporte hogar",
    iconKey: "transport",
    color: "#2563EB",
    sortOrder: 6,
    personalLegacyAliases: ["Transporte"],
    householdLegacyAliases: [],
  },
  {
    seedKey: "car",
    personalName: "Vehiculo",
    householdName: "Vehiculo",
    iconKey: "car",
    color: "#64748B",
    sortOrder: 7,
    personalLegacyAliases: [],
    householdLegacyAliases: [],
  },
  {
    seedKey: "health",
    personalName: "Salud",
    householdName: "Salud hogar",
    iconKey: "health",
    color: "#EF4444",
    sortOrder: 8,
    personalLegacyAliases: ["Salud"],
    householdLegacyAliases: [],
  },
  {
    seedKey: "pets",
    personalName: "Mascota",
    householdName: "Mascota",
    iconKey: "pets",
    color: "#A855F7",
    sortOrder: 9,
    personalLegacyAliases: [],
    householdLegacyAliases: [],
  },
  {
    seedKey: "shopping",
    personalName: "Compras",
    householdName: "Compras del hogar",
    iconKey: "shopping",
    color: "#EC4899",
    sortOrder: 10,
    personalLegacyAliases: ["Compras"],
    householdLegacyAliases: [],
  },
  {
    seedKey: "personal_care",
    personalName: "Cuidado personal",
    householdName: "Cuidado personal",
    iconKey: "personal_care",
    color: "#D946EF",
    sortOrder: 11,
    personalLegacyAliases: [],
    householdLegacyAliases: [],
  },
  {
    seedKey: "entertainment",
    personalName: "Entretenimiento",
    householdName: "Salidas y entretenimiento",
    iconKey: "entertainment",
    color: "#8B5CF6",
    sortOrder: 12,
    personalLegacyAliases: ["Entretenimiento"],
    householdLegacyAliases: [],
  },
  {
    seedKey: "family",
    personalName: "Familia y regalos",
    householdName: "Familia y visitas",
    iconKey: "family",
    color: "#F59E0B",
    sortOrder: 13,
    personalLegacyAliases: [],
    householdLegacyAliases: ["Familia / visitas"],
  },
  {
    seedKey: "education",
    personalName: "Educacion",
    householdName: "Educacion",
    iconKey: "education",
    color: "#6366F1",
    sortOrder: 14,
    personalLegacyAliases: ["Educación"],
    householdLegacyAliases: [],
  },
  {
    seedKey: "travel",
    personalName: "Viajes / paseos",
    householdName: "Viajes / paseos",
    iconKey: "travel",
    color: "#06B6D4",
    sortOrder: 15,
    personalLegacyAliases: [],
    householdLegacyAliases: [],
  },
  {
    seedKey: "other",
    personalName: "Otros",
    householdName: "Otros hogar",
    iconKey: "other",
    color: "#6B7280",
    sortOrder: 16,
    personalLegacyAliases: ["Otros"],
    householdLegacyAliases: [],
  },
];

/**
 * Ingresos seed Personal — solo se crean si el usuario no tenía NINGUNA
 * categoría antes del seed (paridad `CategoryRepository.ensureSeedForCurrentUser`).
 * No tienen `seedKey` ni ID determinista en Android; Hogar nunca los crea.
 */
export interface IncomeCategorySeedDefinition {
  name: string;
  iconKey: string;
  color: string;
}

export const PERSONAL_INCOME_CATEGORY_SEEDS: IncomeCategorySeedDefinition[] = [
  { name: "Salario", iconKey: "salary", color: "#EAB308" },
  { name: "Freelance", iconKey: "freelance", color: "#0EA5E9" },
  { name: "Ventas y negocio", iconKey: "sales", color: "#65A30D" },
  { name: "Inversiones", iconKey: "investment", color: "#F59E0B" },
  { name: "Apoyos y regalos", iconKey: "gift_income", color: "#EF4444" },
  { name: "Otros ingresos", iconKey: "other_income", color: "#8B5CF6" },
];

/** Verdadero solo cuando el usuario no tenía NINGUNA categoría antes del seed (paridad Android). */
export function shouldSeedPersonalIncomeCategories(existingCategoryCountBeforeSeed: number): boolean {
  return existingCategoryCountBeforeSeed === 0;
}
