import type { HouseholdCategory } from "@/types/household";

export type HouseholdEventRelationalInput = {
  householdId: string;
  householdCategoryId: string;
  paidByUserId: string;
  householdMemberIds: string[];
  availableCategories: HouseholdCategory[];
  memberShares: { memberUserId: string; responsibilityAmount: number }[];
};

/**
 * Integridad relacional compartida create/update de eventos Hogar.
 * No toca Rules: valida membresía y catálogo del hogar activo en el cliente.
 */
export const assertHouseholdEventRelationalIntegrity = (
  input: HouseholdEventRelationalInput,
): void => {
  const {
    householdId,
    householdCategoryId,
    paidByUserId,
    householdMemberIds,
    availableCategories,
    memberShares,
  } = input;

  if (!Array.isArray(householdMemberIds) || householdMemberIds.length === 0) {
    throw new Error("La lista de miembros del hogar es obligatoria.");
  }

  if (!householdMemberIds.includes(paidByUserId)) {
    throw new Error("El pagador debe pertenecer al hogar activo.");
  }

  if (!householdCategoryId?.trim()) {
    throw new Error("Selecciona una categoría del hogar.");
  }

  if (!Array.isArray(availableCategories)) {
    throw new Error("El catálogo de categorías disponibles es obligatorio.");
  }

  const cat = availableCategories.find((c) => c.id === householdCategoryId);
  if (!cat) {
    throw new Error("La categoría del hogar ya no está disponible.");
  }
  if (cat.householdId !== householdId) {
    throw new Error("La categoría no pertenece al hogar activo.");
  }
  if (cat.archived) {
    throw new Error("La categoría seleccionada está archivada.");
  }

  if (!Array.isArray(memberShares) || memberShares.length === 0) {
    throw new Error("Debe haber al menos una responsabilidad asignada.");
  }

  const seenMembers = new Set<string>();
  for (const share of memberShares) {
    if (seenMembers.has(share.memberUserId)) {
      throw new Error("No puede haber responsabilidades duplicadas para el mismo miembro.");
    }
    seenMembers.add(share.memberUserId);

    if (!householdMemberIds.includes(share.memberUserId)) {
      throw new Error("La responsabilidad asignada debe pertenecer a un miembro del hogar activo.");
    }
  }
};
