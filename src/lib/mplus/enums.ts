/**
 * Enums del contrato v1 (`CONTRATO_DATOS_REGLAS_COMPARTIDAS.md`).
 *
 * Cada valor es el `wireValue` EXACTO que viaja a Firestore. Es el espejo TS
 * de `android/.../domain/model/mplus/Enums.kt`: si un valor cambia aquí y no
 * allá, la paridad de serialización se rompe. No se agregan alias legacy —
 * Finanzas M+ inicia desde cero (contrato §24.2, §26.1).
 */

export const USER_STATUSES = ["ready", "resetting"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const HOUSEHOLD_MEMBERSHIP_STATES = ["none", "active", "left"] as const;
export type HouseholdMembershipState = (typeof HOUSEHOLD_MEMBERSHIP_STATES)[number];

export const ACCOUNT_TYPES = ["bank", "digital_wallet", "cash", "savings", "other"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_ICON_TYPES = ["bank_logo", "generic"] as const;
export type AccountIconType = (typeof ACCOUNT_ICON_TYPES)[number];

export const CATALOG_STATES = ["active", "archived"] as const;
export type CatalogState = (typeof CATALOG_STATES)[number];

export const MOVEMENT_TYPES = ["income", "expense"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_LIFECYCLE_STATES = ["active", "trashed"] as const;
export type MovementLifecycleState = (typeof MOVEMENT_LIFECYCLE_STATES)[number];

export const HOUSEHOLD_STATUSES = ["waiting", "active", "waiting_return", "closing"] as const;
export type HouseholdStatus = (typeof HOUSEHOLD_STATUSES)[number];

/**
 * Contrato §16.3: la limpieza solo avanza al siguiente valor de esta
 * secuencia; nunca retrocede ni salta fases.
 */
export const HOUSEHOLD_CLEANUP_PHASES = [
  "none",
  "detach_movements",
  "delete_projections",
  "delete_mappings",
  "delete_categories",
  "delete_members",
  "finalize",
] as const;
export type HouseholdCleanupPhase = (typeof HOUSEHOLD_CLEANUP_PHASES)[number];

export const HOUSEHOLD_MEMBER_STATES = ["active", "left"] as const;
export type HouseholdMemberState = (typeof HOUSEHOLD_MEMBER_STATES)[number];

export const HOUSEHOLD_INVITE_STATES = ["active", "used", "revoked"] as const;
export type HouseholdInviteState = (typeof HOUSEHOLD_INVITE_STATES)[number];

/** `true` si [value] es el siguiente valor legal de `cleanupPhase` tras [current]. */
export const isNextCleanupPhase = (
  current: HouseholdCleanupPhase,
  next: HouseholdCleanupPhase,
): boolean => HOUSEHOLD_CLEANUP_PHASES.indexOf(next) === HOUSEHOLD_CLEANUP_PHASES.indexOf(current) + 1;
