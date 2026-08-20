import type {
  AccountIconType,
  AccountType,
  CatalogState,
  HouseholdCleanupPhase,
  HouseholdInviteState,
  HouseholdMemberState,
  HouseholdMembershipState,
  HouseholdStatus,
  MovementLifecycleState,
  MovementType,
  UserStatus,
} from "./enums";

/**
 * Modelos de dominio del contrato v1 — espejo TS de
 * `android/.../domain/model/mplus/MplusModels.kt`.
 *
 * Los timestamps viven como epoch millis (no `Date` ni `Timestamp`) para que
 * la comparación de fixtures entre plataformas sea exacta y no dependa del
 * huso del proceso. La conversión a/desde `Timestamp` ocurre solo en
 * `converters.ts`.
 *
 * `id` nunca viaja como campo del documento: es el ID remoto.
 */

export type MplusUserProfile = {
  uid: string;
  schemaVersion: number;
  status: UserStatus;
  householdId: string | null;
  householdMembershipState: HouseholdMembershipState;
  personalCatalogVersion: number;
  revision: number;
  lastMutationId: string;
  createdAtMillis: number;
  updatedAtMillis: number;
  resetRequestedAtMillis: number | null;
};

export type MplusPersonalAccount = {
  id: string;
  schemaVersion: number;
  ownerId: string;
  name: string;
  type: AccountType;
  iconType: AccountIconType;
  iconKey: string;
  color: string;
  state: CatalogState;
  referenceCount: number;
  lastReferenceMovementId: string | null;
  revision: number;
  lastMutationId: string;
  createdAtMillis: number;
  updatedAtMillis: number;
};

export type MplusPersonalCategory = {
  id: string;
  schemaVersion: number;
  ownerId: string;
  type: MovementType;
  name: string;
  iconKey: string;
  color: string;
  state: CatalogState;
  seedKey: string | null;
  sortOrder: number;
  revision: number;
  lastMutationId: string;
  createdAtMillis: number;
  updatedAtMillis: number;
};

export type MplusMovement = {
  id: string;
  schemaVersion: number;
  ownerId: string;
  type: MovementType;
  title: string;
  amount: number;
  categoryId: string;
  accountId: string | null;
  note: string;
  occurredAtMillis: number;
  lifecycleState: MovementLifecycleState;
  trashedAtMillis: number | null;
  purgeAfterMillis: number | null;
  householdId: string | null;
  householdCategoryId: string | null;
  revision: number;
  lastMutationId: string;
  createdAtMillis: number;
  updatedAtMillis: number;
};

export type MplusHousehold = {
  id: string;
  schemaVersion: number;
  status: HouseholdStatus;
  memberAId: string;
  memberBId: string | null;
  activeInviteId: string | null;
  catalogVersion: number;
  cleanupPhase: HouseholdCleanupPhase;
  revision: number;
  lastMutationId: string;
  createdAtMillis: number;
  updatedAtMillis: number;
  /** Null solo en Hogares heredados sin nombre; los nuevos siempre lo traen (DEC-074). */
  name: string | null;
};

export type MplusHouseholdMember = {
  id: string;
  schemaVersion: number;
  householdId: string;
  userId: string;
  state: HouseholdMemberState;
  displayName: string;
  photoUrl: string;
  joinedAtMillis: number;
  leftAtMillis: number | null;
  revision: number;
  lastMutationId: string;
  updatedAtMillis: number;
};

export type MplusHouseholdInvite = {
  id: string;
  schemaVersion: number;
  householdId: string;
  createdBy: string;
  state: HouseholdInviteState;
  createdAtMillis: number;
  expiresAtMillis: number;
  usedBy: string | null;
  usedAtMillis: number | null;
  /** DEC-076: `null` = primer ingreso abierto; UID = código de reingreso de esa plaza. */
  reservedForUid: string | null;
  revision: number;
  lastMutationId: string;
  updatedAtMillis: number;
};

export type MplusHouseholdExpenseCategory = {
  id: string;
  schemaVersion: number;
  householdId: string;
  name: string;
  iconKey: string;
  color: string;
  state: CatalogState;
  seedKey: string | null;
  sortOrder: number;
  createdBy: string;
  revision: number;
  lastMutationId: string;
  createdAtMillis: number;
  updatedAtMillis: number;
};

export type MplusCategoryMapping = {
  id: string;
  schemaVersion: number;
  householdId: string;
  ownerId: string;
  personalCategoryId: string;
  householdCategoryId: string;
  updatedBy: string;
  revision: number;
  lastMutationId: string;
  createdAtMillis: number;
  updatedAtMillis: number;
};

export type MplusMemberCategoryLabel = {
  id: string;
  schemaVersion: number;
  householdId: string;
  ownerId: string;
  categoryId: string;
  type: MovementType;
  name: string;
  iconKey: string;
  color: string;
  revision: number;
  lastMutationId: string;
  createdAtMillis: number;
  updatedAtMillis: number;
};

export type MplusMemberAccountLabel = {
  id: string;
  schemaVersion: number;
  householdId: string;
  ownerId: string;
  accountId: string;
  name: string;
  type: AccountType;
  iconType: AccountIconType;
  iconKey: string;
  color: string;
  revision: number;
  lastMutationId: string;
  createdAtMillis: number;
  updatedAtMillis: number;
};

export type MplusClosureApproval = {
  id: string;
  schemaVersion: number;
  householdId: string;
  approvedBy: string;
  approvedAtMillis: number;
  lastMutationId: string;
};
