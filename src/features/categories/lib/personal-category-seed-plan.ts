import { EXPENSE_CATEGORY_SEEDS, type ExpenseCategorySeedDefinition } from "@/lib/categories/category-seed-catalog";

/**
 * Planificador puro del seed de gasto Personal — espejo de
 * `PersonalExpenseSeedPlanner.kt` (`buildPersonalExpenseSeedPlan`). Sin I/O:
 * solo decide qué categorías faltan (creación con ID determinista) y cuáles
 * ya existen bajo un alias legacy y solo necesitan `seedKey`/`sortOrder`
 * (backfill, nunca toca nombre/ícono/color/archivado).
 */

export interface MinimalPersonalCategory {
  id: string;
  name: string;
  type: string;
  seedKey?: string | null;
  archived?: boolean;
  createdAt?: Date | null;
}

export interface PersonalExpenseSeedBackfill {
  categoryId: string;
  seedKey: string;
  sortOrder: number;
}

export interface PersonalExpenseSeedCreation {
  id: string;
  definition: ExpenseCategorySeedDefinition;
}

export interface PersonalExpenseSeedPlan {
  backfills: PersonalExpenseSeedBackfill[];
  creations: PersonalExpenseSeedCreation[];
}

export function personalExpenseSeedId(ownerId: string, seedKey: string): string {
  return `${ownerId}::expense::${seedKey}`;
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

function findLegacyCompatiblePersonalExpenseCategory(
  existingCategories: MinimalPersonalCategory[],
  seed: ExpenseCategorySeedDefinition,
): MinimalPersonalCategory | null {
  const legacyAliases = new Set(
    seed.personalLegacyAliases.map((alias) => normalizedCategoryKey(alias)).filter((v): v is string => v !== null),
  );
  if (legacyAliases.size === 0) return null;

  const candidates = existingCategories
    .filter((category) => !category.seedKey)
    .map((category) => {
      const normalizedName = normalizedCategoryKey(category.name);
      if (normalizedName === null || !legacyAliases.has(normalizedName)) return null;
      return { category, normalizedName };
    })
    .filter((v): v is { category: MinimalPersonalCategory; normalizedName: string } => v !== null);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const archivedA = a.category.archived ? 1 : 0;
    const archivedB = b.category.archived ? 1 : 0;
    if (archivedA !== archivedB) return archivedA - archivedB;

    const aliasIndexA = indexOfAlias(seed.personalLegacyAliases, a.normalizedName);
    const aliasIndexB = indexOfAlias(seed.personalLegacyAliases, b.normalizedName);
    if (aliasIndexA !== aliasIndexB) return aliasIndexA - aliasIndexB;

    const createdA = a.category.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const createdB = b.category.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return createdA - createdB;
  });

  return candidates[0].category;
}

export function buildPersonalExpenseSeedPlan(
  ownerId: string,
  existingCategories: MinimalPersonalCategory[],
): PersonalExpenseSeedPlan {
  const scopedExisting = existingCategories.filter((category) => category.type === "expense");

  const backfills: PersonalExpenseSeedBackfill[] = [];
  const creations: PersonalExpenseSeedCreation[] = [];

  for (const seed of EXPENSE_CATEGORY_SEEDS) {
    const exactSeedMatch = scopedExisting.find((category) => category.seedKey === seed.seedKey);
    if (exactSeedMatch) continue;

    const deterministicId = personalExpenseSeedId(ownerId, seed.seedKey);
    const idMatch = scopedExisting.find((category) => category.id === deterministicId);
    const legacyMatch = idMatch ?? findLegacyCompatiblePersonalExpenseCategory(scopedExisting, seed);

    if (legacyMatch) {
      backfills.push({ categoryId: legacyMatch.id, seedKey: seed.seedKey, sortOrder: seed.sortOrder });
      continue;
    }

    creations.push({ id: deterministicId, definition: seed });
  }

  return { backfills, creations };
}
