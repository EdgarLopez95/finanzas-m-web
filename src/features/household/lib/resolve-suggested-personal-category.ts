/**
 * Sugerencia silenciosa de categoría Personal al completar "Mi parte" de un
 * evento Hogar (Bloque 3 de paridad Android→Web). Espejo exacto de
 * `ExpenseCategorySuggestionMatcher.kt` — sin React, sin Firestore, puro y
 * testeable en aislamiento.
 *
 * Solo recibe el nombre e `iconKey` de la categoría Hogar (datos compartidos
 * permitidos) — nunca IDs compartidos, color, seedKey, ni ningún dato de
 * otro miembro. Nunca puntúa por esos campos.
 */

export interface SuggestionCandidateCategory {
  id: string;
  name: string;
  type: string;
  iconKey?: string | null;
  archived?: boolean;
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

const normalizedCategoryTokens = (raw: string | null | undefined): string[] => {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return [];
  const withoutAccents = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}+/gu, "");
  return withoutAccents
    .split(/[^\p{L}\p{N}]+/gu)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
};

const tokenOverlapScore = (householdTokens: string[], candidateTokens: string[]): number => {
  if (householdTokens.length === 0 || candidateTokens.length === 0) return 0;

  const candidateSet = new Set(candidateTokens);
  let common = 0;
  for (const token of new Set(householdTokens)) {
    if (candidateSet.has(token)) common++;
  }

  if (common === 0) return 0;
  if (common === 1) return 12;
  if (common === 2) return 20;
  return 28;
};

/**
 * Puntúa una categoría personal candidata contra el nombre/iconKey de la
 * categoría Hogar del evento. Espejo de `categorySuggestionScore` (Kotlin):
 * key exacta -> 100; una key contiene la otra -> +85; tokens comunes ->
 * +0/+12/+20/+28; iconKey igual (sin distinguir mayúsculas) -> +12; tope 100.
 */
export function categorySuggestionScore(
  householdCategoryName: string | null | undefined,
  householdCategoryIconKey: string | null | undefined,
  candidate: SuggestionCandidateCategory,
): number {
  const householdKey = normalizedCategoryKey(householdCategoryName);
  if (householdKey === null) return 0;

  const candidateKey = normalizedCategoryKey(candidate.name);
  if (candidateKey === null) return 0;

  if (candidateKey === householdKey) return 100;

  let score = 0;
  if (candidateKey.includes(householdKey) || householdKey.includes(candidateKey)) {
    score += 85;
  }

  const householdTokens = normalizedCategoryTokens(householdCategoryName);
  const candidateTokens = normalizedCategoryTokens(candidate.name);
  score += tokenOverlapScore(householdTokens, candidateTokens);

  if (
    householdCategoryIconKey &&
    householdCategoryIconKey.trim() !== "" &&
    candidate.iconKey &&
    householdCategoryIconKey.toLowerCase() === candidate.iconKey.toLowerCase()
  ) {
    score += 12;
  }

  return Math.min(score, 100);
}

/**
 * Resuelve la categoría personal sugerida para precargar en `CompleteShareDialog`,
 * o `null` si ninguna candidata alcanza el umbral (70). Candidatas: solo
 * categorías personales activas de tipo `expense`. Empates: gana la primera
 * candidata en el orden de entrada (paridad con `maxByOrNull` de Kotlin, que
 * retiene el primer elemento máximo encontrado).
 */
export function resolveSuggestedPersonalCategoryForPending(
  householdCategoryName: string | null | undefined,
  householdCategoryIconKey: string | null | undefined,
  personalCategories: SuggestionCandidateCategory[],
): SuggestionCandidateCategory | null {
  const householdKey = normalizedCategoryKey(householdCategoryName);
  if (householdKey === null) return null;

  const candidates = personalCategories.filter((c) => c.type === "expense" && !c.archived);

  let best: SuggestionCandidateCategory | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    const score = categorySuggestionScore(householdCategoryName, householdCategoryIconKey, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (best === null || bestScore < 70) return null;
  return best;
}

/**
 * Unidad extraíble (sin React) del `useEffect` de sugerencia en
 * `CompleteShareDialog` — corrección P1: no decide (ni marca como aplicado)
 * mientras `expenseCategories` sigue vacío, porque una lista vacía puede
 * significar "todavía no llegaron las categorías seed", no "el usuario no
 * tiene categorías". Antes de esta corrección, el guard solo esperaba a que
 * `personalStatus` dejara de ser `idle`/`loading`, lo que podía marcar la
 * sugerencia como aplicada (con `categoryId` vacío) ANTES de que el seed
 * terminara de crear las 16 categorías de gasto — la sugerencia real nunca
 * llegaba a evaluarse.
 *
 * Contrato: se llama en cada render mientras el diálogo está abierto,
 * pasando `alreadyApplied` (el valor actual de `suggestionAppliedRef`).
 * `shouldApply: true` es la única señal para que el componente llame
 * `setCategoryId(...)` y marque `suggestionAppliedRef.current = true` — una
 * vez aplicada, llamadas posteriores con `alreadyApplied: true` SIEMPRE
 * devuelven `shouldApply: false`, sin importar cambios en las categorías o
 * el status, preservando cualquier selección manual posterior del usuario.
 */
export interface CompleteShareSuggestionEffectInput {
  open: boolean;
  personalStatus: string;
  expenseCategories: SuggestionCandidateCategory[];
  householdCategoryName?: string | null;
  householdCategoryIconKey?: string | null;
  alreadyApplied: boolean;
}

export interface CompleteShareSuggestionEffectResult {
  shouldApply: boolean;
  categoryId: string;
}

export function resolveCompleteShareSuggestionEffect(
  input: CompleteShareSuggestionEffectInput,
): CompleteShareSuggestionEffectResult {
  if (!input.open) return { shouldApply: false, categoryId: "" };
  if (input.alreadyApplied) return { shouldApply: false, categoryId: "" };
  if (input.personalStatus === "idle" || input.personalStatus === "loading") {
    return { shouldApply: false, categoryId: "" };
  }
  if (input.expenseCategories.length === 0) {
    return { shouldApply: false, categoryId: "" };
  }

  const suggested = resolveSuggestedPersonalCategoryForPending(
    input.householdCategoryName,
    input.householdCategoryIconKey,
    input.expenseCategories,
  );
  return { shouldApply: true, categoryId: suggested?.id ?? "" };
}
