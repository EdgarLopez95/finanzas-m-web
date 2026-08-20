import { generateUUID } from "@/lib/utils/uuid";

/**
 * IDs generados en cliente (contrato §4.2). Espejo TS de
 * `android/.../domain/mplus/ClientIdGenerator.kt`: las funciones
 * deterministas son puras, así un reintento con el mismo insumo produce el
 * mismo ID y los fixtures son reproducibles en ambas plataformas.
 */

/** UUID v4 en minúsculas para movimientos, cuentas, categorías, hogares y mutaciones. */
export const newUuid = (): string => generateUUID().toLowerCase();

/** Alias semántico: identifica la operación lógica (`lastMutationId`, contrato §4.3). */
export const newMutationId = (): string => newUuid();

export const expenseSeedCategoryId = (seedKey: string): string => `seed_expense_${seedKey}`;

export const incomeSeedCategoryId = (seedKey: string): string => `seed_income_${seedKey}`;

export const categoryMappingId = (ownerId: string, personalCategoryId: string): string =>
  `${ownerId}__${personalCategoryId}`;

export const memberCategoryLabelId = (ownerId: string, categoryId: string): string =>
  `${ownerId}__${categoryId}`;

export const memberAccountLabelId = (ownerId: string, accountId: string): string =>
  `${ownerId}__${accountId}`;

export const householdMemberId = (householdId: string, userId: string): string =>
  `${householdId}__${userId}`;

export const closureApprovalId = (householdId: string, uid: string): string =>
  `${householdId}__${uid}`;

/** Código de invitación de Hogar (DEC-072 / contrato §12.1): 3 dígitos numéricos ("000"-"999"). */
export const newHouseholdInviteCode = (): string => {
  const code = Math.floor(Math.random() * 1000);
  return code.toString().padStart(3, "0");
};

export const isValidHouseholdInviteCode = (code: string): boolean =>
  /^[0-9]{3}$/.test(code);

export const normalizeHouseholdInviteCode = (raw: string): string =>
  raw.trim().replace(/-/g, "").replace(/\s/g, "");

