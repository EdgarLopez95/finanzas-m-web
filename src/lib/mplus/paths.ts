/**
 * Rutas de colecciones del contrato v1 (§5). Espejo TS de
 * `android/.../data/remote/mplus/MplusFirestorePaths.kt`.
 *
 * Ninguna colección legacy (`pockets`, `household_debts`, `household_events`,
 * `third_party_fund_entries`, …) aparece aquí: el contrato no las declara.
 */
export const MPLUS_PATHS = {
  users: "users",
  /** subcolección de `users/{uid}` */
  accounts: "accounts",
  /** subcolección de `users/{uid}` */
  categories: "categories",
  movements: "movements",
  households: "households",
  householdInvites: "householdInvites",
  /** subcolección de `households/{householdId}` */
  members: "members",
  /** subcolección de `households/{householdId}` */
  expenseCategories: "expenseCategories",
  /** subcolección de `households/{householdId}` */
  categoryMappings: "categoryMappings",
  /** subcolección de `households/{householdId}` */
  memberCategoryLabels: "memberCategoryLabels",
  /** subcolección de `households/{householdId}` */
  memberAccountLabels: "memberAccountLabels",
  /** subcolección de `households/{householdId}` */
  closureApprovals: "closureApprovals",
} as const;

export const userDocPath = (uid: string) => [MPLUS_PATHS.users, uid] as const;
export const accountDocPath = (uid: string, accountId: string) =>
  [MPLUS_PATHS.users, uid, MPLUS_PATHS.accounts, accountId] as const;
export const categoryDocPath = (uid: string, categoryId: string) =>
  [MPLUS_PATHS.users, uid, MPLUS_PATHS.categories, categoryId] as const;
export const movementDocPath = (movementId: string) =>
  [MPLUS_PATHS.movements, movementId] as const;
export const householdDocPath = (householdId: string) =>
  [MPLUS_PATHS.households, householdId] as const;
export const householdInviteDocPath = (inviteId: string) =>
  [MPLUS_PATHS.householdInvites, inviteId] as const;
export const householdMemberDocPath = (householdId: string, uid: string) =>
  [MPLUS_PATHS.households, householdId, MPLUS_PATHS.members, uid] as const;
export const householdExpenseCategoryDocPath = (householdId: string, categoryId: string) =>
  [MPLUS_PATHS.households, householdId, MPLUS_PATHS.expenseCategories, categoryId] as const;
export const categoryMappingDocPath = (householdId: string, mappingId: string) =>
  [MPLUS_PATHS.households, householdId, MPLUS_PATHS.categoryMappings, mappingId] as const;
export const memberCategoryLabelDocPath = (householdId: string, labelId: string) =>
  [MPLUS_PATHS.households, householdId, MPLUS_PATHS.memberCategoryLabels, labelId] as const;
export const memberAccountLabelDocPath = (householdId: string, labelId: string) =>
  [MPLUS_PATHS.households, householdId, MPLUS_PATHS.memberAccountLabels, labelId] as const;
export const closureApprovalDocPath = (householdId: string, uid: string) =>
  [MPLUS_PATHS.households, householdId, MPLUS_PATHS.closureApprovals, uid] as const;
