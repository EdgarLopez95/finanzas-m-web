import type { MovementType } from "./enums";
import { expenseSeedCategoryId, incomeSeedCategoryId } from "./ids";

/**
 * Seed Personal v1 (contrato §8.3) y seed de Hogar v1 (contrato §13.1).
 *
 * Espejo TS de `android/.../domain/mplus/MplusPersonalSeed.kt` y
 * `MplusHouseholdSeed.kt`: mismos `seedKey`, mismos nombres, mismos iconos y
 * colores, mismo `sortOrder`. Los IDs son deterministas, asi que el bootstrap
 * es idempotente: si el ID ya existe no se duplica ni se revierten las
 * personalizaciones del usuario.
 */

export type MplusSeedCategory = Readonly<{
  seedKey: string;
  name: string;
  iconKey: string;
  color: string;
  type: MovementType;
  sortOrder: number;
}>;

export const PERSONAL_EXPENSE_SEED: readonly MplusSeedCategory[] = [
  { seedKey: "groceries", name: "Mercado", iconKey: "groceries", color: "#22C55E", type: "expense", sortOrder: 0 },
  { seedKey: "restaurant", name: "Restaurantes y domicilios", iconKey: "restaurant", color: "#F97316", type: "expense", sortOrder: 1 },
  { seedKey: "housing", name: "Arriendo / vivienda", iconKey: "housing", color: "#6C8E7F", type: "expense", sortOrder: 2 },
  { seedKey: "bills", name: "Servicios", iconKey: "bills", color: "#E4B363", type: "expense", sortOrder: 3 },
  { seedKey: "cleaning", name: "Aseo y hogar", iconKey: "cleaning", color: "#14B8A6", type: "expense", sortOrder: 4 },
  { seedKey: "transport", name: "Transporte", iconKey: "transport", color: "#2563EB", type: "expense", sortOrder: 5 },
  { seedKey: "car", name: "Vehiculo", iconKey: "car", color: "#64748B", type: "expense", sortOrder: 6 },
  { seedKey: "health", name: "Salud", iconKey: "health", color: "#EF4444", type: "expense", sortOrder: 7 },
  { seedKey: "pets", name: "Mascota", iconKey: "pets", color: "#A855F7", type: "expense", sortOrder: 8 },
  { seedKey: "shopping", name: "Compras", iconKey: "shopping", color: "#EC4899", type: "expense", sortOrder: 9 },
  { seedKey: "personal_care", name: "Cuidado personal", iconKey: "personal_care", color: "#D946EF", type: "expense", sortOrder: 10 },
  { seedKey: "entertainment", name: "Entretenimiento", iconKey: "entertainment", color: "#8B5CF6", type: "expense", sortOrder: 11 },
  { seedKey: "family", name: "Familia y regalos", iconKey: "family", color: "#F59E0B", type: "expense", sortOrder: 12 },
  { seedKey: "education", name: "Educacion", iconKey: "education", color: "#6366F1", type: "expense", sortOrder: 13 },
  { seedKey: "travel", name: "Viajes / paseos", iconKey: "travel", color: "#06B6D4", type: "expense", sortOrder: 14 },
  { seedKey: "other", name: "Otros", iconKey: "other", color: "#6B7280", type: "expense", sortOrder: 15 },
];

export const PERSONAL_INCOME_SEED: readonly MplusSeedCategory[] = [
  { seedKey: "salary", name: "Salario", iconKey: "salary", color: "#EAB308", type: "income", sortOrder: 0 },
  { seedKey: "freelance", name: "Freelance", iconKey: "freelance", color: "#0EA5E9", type: "income", sortOrder: 1 },
  { seedKey: "sales", name: "Ventas y negocio", iconKey: "sales", color: "#65A30D", type: "income", sortOrder: 2 },
  { seedKey: "investment", name: "Inversiones", iconKey: "investment", color: "#F59E0B", type: "income", sortOrder: 3 },
  { seedKey: "gift_income", name: "Apoyos y regalos", iconKey: "gift_income", color: "#EF4444", type: "income", sortOrder: 4 },
  { seedKey: "other_income", name: "Otros ingresos", iconKey: "other_income", color: "#8B5CF6", type: "income", sortOrder: 5 },
];

export const PERSONAL_SEED: readonly MplusSeedCategory[] = [
  ...PERSONAL_EXPENSE_SEED,
  ...PERSONAL_INCOME_SEED,
];

/** ID determinista de una categoria seed Personal (contrato §8.3). */
export const personalSeedCategoryId = (seed: MplusSeedCategory): string =>
  seed.type === "expense"
    ? expenseSeedCategoryId(seed.seedKey)
    : incomeSeedCategoryId(seed.seedKey);

/**
 * Seed de Hogar v1 (contrato §13.1): mismos `seedKey`, IDs, iconos, colores y
 * orden que el seed Personal de gasto; solo cambian algunos nombres.
 */
const HOUSEHOLD_SEED_NAMES: Readonly<Record<string, string>> = {
  groceries: "Mercado",
  restaurant: "Restaurantes y domicilios",
  housing: "Arriendo / vivienda",
  bills: "Servicios del hogar",
  cleaning: "Aseo y hogar",
  transport: "Transporte hogar",
  car: "Vehiculo",
  health: "Salud hogar",
  pets: "Mascota",
  shopping: "Compras del hogar",
  personal_care: "Cuidado personal",
  entertainment: "Salidas y entretenimiento",
  family: "Familia y visitas",
  education: "Educacion",
  travel: "Viajes / paseos",
  other: "Otros hogar",
};

export const HOUSEHOLD_EXPENSE_SEED: readonly MplusSeedCategory[] =
  PERSONAL_EXPENSE_SEED.map((seed) => ({
    ...seed,
    name: HOUSEHOLD_SEED_NAMES[seed.seedKey] ?? seed.name,
  }));

/** ID determinista de una categoria seed de Hogar (contrato §13.1). */
export const householdSeedCategoryId = (seed: MplusSeedCategory): string =>
  expenseSeedCategoryId(seed.seedKey);
