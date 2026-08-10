import { EXPENSE_CATEGORY_SEEDS, type ExpenseCategorySeedDefinition } from "@/lib/categories/category-seed-catalog";

/**
 * Planificador puro del seed de gasto Hogar — espejo de
 * `HouseholdExpenseSeedPlanner.kt` (`buildHouseholdExpenseSeedPlan`). Sin
 * I/O, sin ingresos (Hogar solo tiene categorías de gasto). Reutiliza
 * EXCLUSIVAMENTE el catálogo compartido `EXPENSE_CATEGORY_SEEDS` — no
 * declara ninguna definición propia.
 */

export interface MinimalHouseholdCategory {
  id: string;
  householdId: string;
  name: string;
  iconKey?: string | null;
  seedKey?: string | null;
  archived?: boolean;
  createdAt?: Date | null;
}

export interface HouseholdExpenseSeedBackfill {
  categoryId: string;
  seedKey: string;
  sortOrder: number;
}

export interface HouseholdExpenseSeedCreation {
  id: string;
  definition: ExpenseCategorySeedDefinition;
}

export interface HouseholdExpenseSeedPlan {
  backfills: HouseholdExpenseSeedBackfill[];
  creations: HouseholdExpenseSeedCreation[];
}

export function householdExpenseSeedId(householdId: string, seedKey: string): string {
  return `${householdId.trim()}::expense::${seedKey}`;
}

const normalizedCategoryKey = (raw: string | null | undefined): string | null => {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const withoutAccents = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}+/gu, "");
  return withoutAccents.replace(/[^\p{L}\p{N}]+/gu, "");
};

const indexOfAlias = (aliases: string[], normalizedAlias: string): number =>
  aliases.findIndex((alias) => normalizedCategoryKey(alias) === normalizedAlias);

function findLegacyCompatibleHouseholdExpenseCategory(
  existingCategories: MinimalHouseholdCategory[],
  seed: ExpenseCategorySeedDefinition,
): MinimalHouseholdCategory | null {
  // Paridad Android: los alias legacy de Hogar incluyen el propio nombre canónico
  // del seed, además de los alias explícitos — así se puede backfillear una
  // categoría ya creada manualmente con el mismo nombre que el seed.
  const aliasSource = [...seed.householdLegacyAliases, seed.householdName];
  const legacyAliases = new Set(
    aliasSource.map((alias) => normalizedCategoryKey(alias)).filter((v): v is string => v !== null),
  );

  const candidates = existingCategories
    .filter((category) => !category.seedKey)
    .map((category) => {
      const normalizedName = normalizedCategoryKey(category.name);
      if (normalizedName === null || !legacyAliases.has(normalizedName)) return null;
      if (category.iconKey && category.iconKey.toLowerCase() !== seed.iconKey.toLowerCase()) return null;
      return { category, normalizedName };
    })
    .filter((v): v is { category: MinimalHouseholdCategory; normalizedName: string } => v !== null);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const archivedA = a.category.archived ? 1 : 0;
    const archivedB = b.category.archived ? 1 : 0;
    if (archivedA !== archivedB) return archivedA - archivedB;

    const aliasIndexA = indexOfAlias(aliasSource, a.normalizedName);
    const aliasIndexB = indexOfAlias(aliasSource, b.normalizedName);
    if (aliasIndexA !== aliasIndexB) return aliasIndexA - aliasIndexB;

    const createdA = a.category.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const createdB = b.category.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return createdA - createdB;
  });

  return candidates[0].category;
}

export function buildHouseholdExpenseSeedPlan(
  householdId: string,
  existingCategories: MinimalHouseholdCategory[],
): HouseholdExpenseSeedPlan {
  const normalizedHouseholdId = householdId.trim();
  const scopedExisting = existingCategories.filter((category) => category.householdId === normalizedHouseholdId);

  const backfills: HouseholdExpenseSeedBackfill[] = [];
  const creations: HouseholdExpenseSeedCreation[] = [];

  for (const seed of EXPENSE_CATEGORY_SEEDS) {
    const exactSeedMatch = scopedExisting.find((category) => category.seedKey === seed.seedKey);
    if (exactSeedMatch) continue;

    const deterministicId = householdExpenseSeedId(normalizedHouseholdId, seed.seedKey);
    const idMatch = scopedExisting.find((category) => category.id === deterministicId);
    const legacyMatch = idMatch ?? findLegacyCompatibleHouseholdExpenseCategory(scopedExisting, seed);

    if (legacyMatch) {
      backfills.push({ categoryId: legacyMatch.id, seedKey: seed.seedKey, sortOrder: seed.sortOrder });
      continue;
    }

    creations.push({ id: deterministicId, definition: seed });
  }

  return { backfills, creations };
}
