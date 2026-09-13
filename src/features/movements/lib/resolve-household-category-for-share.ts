import { categoryMappingId } from "@/lib/mplus/ids";
import type {
  MplusCategoryMapping,
  MplusHouseholdExpenseCategory,
} from "@/lib/mplus/models";

export interface ResolveHouseholdCategoryForShareInput {
  householdId: string;
  type: "expense" | "income";
  ownerId: string;
  personalCategoryId: string;
  mappings: readonly MplusCategoryMapping[];
  householdCategories: readonly MplusHouseholdExpenseCategory[];
}

/**
 * Resuelve la categoría de Hogar para un movimiento compartido desde Personal
 * (§ 15.3, § 16, paridad Android b7a39d8).
 *
 * Reglas exactas:
 * 1. Ingresos: siempre null (§ 16: Hogar no administra categorías propias de ingreso;
 *    cada ingreso compartido conserva la categoría personal de su dueño).
 * 2. Gastos: busca mapping del dueño para la categoría personal dada en el hogar activo
 *    (usando categoryMappingId(ownerId, personalCategoryId) o coincidencia de ownerId y personalCategoryId).
 * 3. Si no existe mapping en ese hogar → null ("Por clasificar").
 * 4. Localiza la categoría de Hogar por mapping.householdCategoryId en el mismo hogar.
 * 5. Si no existe o su estado no es "active" (ej. archivada) → null ("Por clasificar").
 *    NO se borra el mapping; NO se reclasifica historial pasado (§ 15.3).
 * 6. Si la categoría destino existe en el hogar y está activa → retorna su id.
 * 7. En este paso NO se crea ni se aprende equivalencia (§ 15.5).
 */
export function resolveHouseholdCategoryIdForShare(
  input: ResolveHouseholdCategoryForShareInput,
): string | null {
  if (input.type === "income") {
    return null;
  }

  if (!input.householdId || !input.ownerId || !input.personalCategoryId) {
    return null;
  }

  const expectedMappingId = categoryMappingId(input.ownerId, input.personalCategoryId);
  const mapping =
    input.mappings.find(
      (m) =>
        m.householdId === input.householdId &&
        (m.id === expectedMappingId ||
          (m.ownerId === input.ownerId && m.personalCategoryId === input.personalCategoryId)),
    ) ?? null;

  if (!mapping) {
    return null;
  }

  const targetCategory = input.householdCategories.find(
    (c) => c.id === mapping.householdCategoryId && c.householdId === input.householdId,
  );

  if (!targetCategory || targetCategory.state !== "active") {
    return null;
  }

  return targetCategory.id;
}
