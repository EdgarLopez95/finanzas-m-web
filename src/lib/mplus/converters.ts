import { Timestamp } from "firebase/firestore";

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
import {
  ACCOUNT_ICON_TYPES,
  ACCOUNT_TYPES,
  CATALOG_STATES,
  HOUSEHOLD_CLEANUP_PHASES,
  HOUSEHOLD_INVITE_STATES,
  HOUSEHOLD_MEMBERSHIP_STATES,
  HOUSEHOLD_MEMBER_STATES,
  HOUSEHOLD_STATUSES,
  MOVEMENT_LIFECYCLE_STATES,
  MOVEMENT_TYPES,
  USER_STATUSES,
} from "./enums";
import type {
  MplusCategoryMapping,
  MplusClosureApproval,
  MplusHousehold,
  MplusHouseholdExpenseCategory,
  MplusHouseholdInvite,
  MplusHouseholdMember,
  MplusMemberAccountLabel,
  MplusMemberCategoryLabel,
  MplusMovement,
  MplusPersonalAccount,
  MplusPersonalCategory,
  MplusUserProfile,
} from "./models";

/**
 * Serializacion Dominio <-> Firestore del contrato v1.
 *
 * Es el espejo exacto de `android/.../mapper/MplusFirestoreMappers.kt`: mismas
 * claves, mismo orden semantico, mismos tipos. `id` nunca viaja como campo del
 * mapa: es el ID del documento remoto (contrato §4.1).
 *
 * Lectura estricta: un campo obligatorio ausente o con el tipo equivocado
 * lanza. Web es online-only y no debe "rellenar" datos que el servidor no
 * envio; un documento ilegible es un fallo visible, no un default silencioso.
 */

export class MplusFirestoreMappingError extends Error {
  constructor(
    readonly field: string,
    readonly expectedType: string,
  ) {
    super(`Campo remoto invalido o ausente: '${field}' (se esperaba ${expectedType})`);
    this.name = "MplusFirestoreMappingError";
  }
}

export type FirestoreData = Readonly<Record<string, unknown>>;

// --- conversion de timestamps (paridad con FirestoreTimestamps.kt) ---

export const millisToTimestamp = (millis: number): Timestamp => {
  const seconds = Math.floor(millis / 1000);
  const nanos = Math.round((millis - seconds * 1000) * 1_000_000);
  return new Timestamp(seconds, nanos);
};

export const millisToTimestampOrNull = (millis: number | null): Timestamp | null =>
  millis === null ? null : millisToTimestamp(millis);

export const timestampToMillis = (value: Timestamp): number =>
  value.seconds * 1000 + Math.floor(value.nanoseconds / 1_000_000);

// --- lectores estrictos ---

const requireString = (data: FirestoreData, field: string): string => {
  const value = data[field];
  if (typeof value !== "string") throw new MplusFirestoreMappingError(field, "string");
  return value;
};

const optionalString = (data: FirestoreData, field: string): string | null => {
  const value = data[field];
  return typeof value === "string" ? value : null;
};

const requireNumber = (data: FirestoreData, field: string): number => {
  const value = data[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new MplusFirestoreMappingError(field, "number");
  }
  return value;
};

const requireInt = (data: FirestoreData, field: string): number => {
  const value = requireNumber(data, field);
  if (!Number.isInteger(value)) throw new MplusFirestoreMappingError(field, "int");
  return value;
};

const isTimestampLike = (value: unknown): value is Timestamp =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Timestamp).seconds === "number" &&
  typeof (value as Timestamp).nanoseconds === "number";

const requireTimestampMillis = (data: FirestoreData, field: string): number => {
  const value = data[field];
  if (!isTimestampLike(value)) throw new MplusFirestoreMappingError(field, "Timestamp");
  return timestampToMillis(value);
};

const optionalTimestampMillis = (data: FirestoreData, field: string): number | null => {
  const value = data[field];
  return isTimestampLike(value) ? timestampToMillis(value) : null;
};

const requireEnum = <T extends string>(
  data: FirestoreData,
  field: string,
  allowed: readonly T[],
): T => {
  const value = requireString(data, field);
  if (!(allowed as readonly string[]).includes(value)) {
    throw new MplusFirestoreMappingError(field, `uno de [${allowed.join(", ")}]`);
  }
  return value as T;
};

// --- users/{uid} (contrato §6) ---

export const userProfileToFirestore = (model: MplusUserProfile): Record<string, unknown> => {
  const status: UserStatus = model.status;
  const membershipState: HouseholdMembershipState = model.householdMembershipState;
  return {
    schemaVersion: model.schemaVersion,
    status,
    householdId: model.householdId,
    householdMembershipState: membershipState,
    personalCatalogVersion: model.personalCatalogVersion,
    revision: model.revision,
    lastMutationId: model.lastMutationId,
    createdAt: millisToTimestamp(model.createdAtMillis),
    updatedAt: millisToTimestamp(model.updatedAtMillis),
    resetRequestedAt: millisToTimestampOrNull(model.resetRequestedAtMillis),
  };
};

export const userProfileFromFirestore = (
  uid: string,
  data: FirestoreData,
): MplusUserProfile => ({
  uid,
  schemaVersion: requireInt(data, "schemaVersion"),
  status: requireEnum(data, "status", USER_STATUSES),
  householdId: optionalString(data, "householdId"),
  householdMembershipState: requireEnum(
    data,
    "householdMembershipState",
    HOUSEHOLD_MEMBERSHIP_STATES,
  ),
  personalCatalogVersion: requireInt(data, "personalCatalogVersion"),
  revision: requireInt(data, "revision"),
  lastMutationId: requireString(data, "lastMutationId"),
  createdAtMillis: requireTimestampMillis(data, "createdAt"),
  updatedAtMillis: requireTimestampMillis(data, "updatedAt"),
  resetRequestedAtMillis: optionalTimestampMillis(data, "resetRequestedAt"),
});

// --- users/{uid}/accounts/{accountId} (contrato §7) ---

export const personalAccountToFirestore = (
  model: MplusPersonalAccount,
): Record<string, unknown> => {
  const type: AccountType = model.type;
  const iconType: AccountIconType = model.iconType;
  const state: CatalogState = model.state;
  return {
    schemaVersion: model.schemaVersion,
    ownerId: model.ownerId,
    name: model.name,
    type,
    iconType,
    iconKey: model.iconKey,
    color: model.color,
    state,
    referenceCount: model.referenceCount,
    lastReferenceMovementId: model.lastReferenceMovementId,
    revision: model.revision,
    lastMutationId: model.lastMutationId,
    createdAt: millisToTimestamp(model.createdAtMillis),
    updatedAt: millisToTimestamp(model.updatedAtMillis),
  };
};

export const personalAccountFromFirestore = (
  id: string,
  data: FirestoreData,
): MplusPersonalAccount => ({
  id,
  schemaVersion: requireInt(data, "schemaVersion"),
  ownerId: requireString(data, "ownerId"),
  name: requireString(data, "name"),
  type: requireEnum(data, "type", ACCOUNT_TYPES),
  iconType: requireEnum(data, "iconType", ACCOUNT_ICON_TYPES),
  iconKey: requireString(data, "iconKey"),
  color: requireString(data, "color"),
  state: requireEnum(data, "state", CATALOG_STATES),
  referenceCount: requireInt(data, "referenceCount"),
  lastReferenceMovementId: optionalString(data, "lastReferenceMovementId"),
  revision: requireInt(data, "revision"),
  lastMutationId: requireString(data, "lastMutationId"),
  createdAtMillis: requireTimestampMillis(data, "createdAt"),
  updatedAtMillis: requireTimestampMillis(data, "updatedAt"),
});

// --- users/{uid}/categories/{categoryId} (contrato §8) ---

export const personalCategoryToFirestore = (
  model: MplusPersonalCategory,
): Record<string, unknown> => {
  const type: MovementType = model.type;
  const state: CatalogState = model.state;
  return {
    schemaVersion: model.schemaVersion,
    ownerId: model.ownerId,
    type,
    name: model.name,
    iconKey: model.iconKey,
    color: model.color,
    state,
    seedKey: model.seedKey,
    sortOrder: model.sortOrder,
    revision: model.revision,
    lastMutationId: model.lastMutationId,
    createdAt: millisToTimestamp(model.createdAtMillis),
    updatedAt: millisToTimestamp(model.updatedAtMillis),
  };
};

export const personalCategoryFromFirestore = (
  id: string,
  data: FirestoreData,
): MplusPersonalCategory => ({
  id,
  schemaVersion: requireInt(data, "schemaVersion"),
  ownerId: requireString(data, "ownerId"),
  type: requireEnum(data, "type", MOVEMENT_TYPES),
  name: requireString(data, "name"),
  iconKey: requireString(data, "iconKey"),
  color: requireString(data, "color"),
  state: requireEnum(data, "state", CATALOG_STATES),
  seedKey: optionalString(data, "seedKey"),
  sortOrder: requireInt(data, "sortOrder"),
  revision: requireInt(data, "revision"),
  lastMutationId: requireString(data, "lastMutationId"),
  createdAtMillis: requireTimestampMillis(data, "createdAt"),
  updatedAtMillis: requireTimestampMillis(data, "updatedAt"),
});

// --- movements/{movementId} (contrato §9) ---

export const movementToFirestore = (model: MplusMovement): Record<string, unknown> => {
  const type: MovementType = model.type;
  const lifecycleState: MovementLifecycleState = model.lifecycleState;
  return {
    schemaVersion: model.schemaVersion,
    ownerId: model.ownerId,
    type,
    title: model.title,
    amount: model.amount,
    categoryId: model.categoryId,
    accountId: model.accountId,
    note: model.note,
    occurredAt: millisToTimestamp(model.occurredAtMillis),
    lifecycleState,
    trashedAt: millisToTimestampOrNull(model.trashedAtMillis),
    purgeAfter: millisToTimestampOrNull(model.purgeAfterMillis),
    householdId: model.householdId,
    householdCategoryId: model.householdCategoryId,
    revision: model.revision,
    lastMutationId: model.lastMutationId,
    createdAt: millisToTimestamp(model.createdAtMillis),
    updatedAt: millisToTimestamp(model.updatedAtMillis),
  };
};

export const movementFromFirestore = (id: string, data: FirestoreData): MplusMovement => ({
  id,
  schemaVersion: requireInt(data, "schemaVersion"),
  ownerId: requireString(data, "ownerId"),
  type: requireEnum(data, "type", MOVEMENT_TYPES),
  title: requireString(data, "title"),
  amount: requireInt(data, "amount"),
  categoryId: requireString(data, "categoryId"),
  accountId: optionalString(data, "accountId"),
  note: optionalString(data, "note") ?? "",
  occurredAtMillis: requireTimestampMillis(data, "occurredAt"),
  lifecycleState: requireEnum(data, "lifecycleState", MOVEMENT_LIFECYCLE_STATES),
  trashedAtMillis: optionalTimestampMillis(data, "trashedAt"),
  purgeAfterMillis: optionalTimestampMillis(data, "purgeAfter"),
  householdId: optionalString(data, "householdId"),
  householdCategoryId: optionalString(data, "householdCategoryId"),
  revision: requireInt(data, "revision"),
  lastMutationId: requireString(data, "lastMutationId"),
  createdAtMillis: requireTimestampMillis(data, "createdAt"),
  updatedAtMillis: requireTimestampMillis(data, "updatedAt"),
});

// --- households/{householdId} (contrato §10) ---

export const householdToFirestore = (model: MplusHousehold): Record<string, unknown> => {
  const status: HouseholdStatus = model.status;
  const cleanupPhase: HouseholdCleanupPhase = model.cleanupPhase;
  const map: Record<string, unknown> = {
    schemaVersion: model.schemaVersion,
    status,
    memberAId: model.memberAId,
    memberBId: model.memberBId,
    activeInviteId: model.activeInviteId,
    catalogVersion: model.catalogVersion,
    cleanupPhase,
    revision: model.revision,
    lastMutationId: model.lastMutationId,
    createdAt: millisToTimestamp(model.createdAtMillis),
    updatedAt: millisToTimestamp(model.updatedAtMillis),
  };
  // DEC-074: `name` se omite (no se escribe null) en Hogares heredados sin
  // nombre, exactamente como hace `Household.toFirestoreMap()` en Android.
  if (model.name !== null) {
    map.name = model.name;
  }
  return map;
};

export const householdFromFirestore = (id: string, data: FirestoreData): MplusHousehold => ({
  id,
  schemaVersion: requireInt(data, "schemaVersion"),
  status: requireEnum(data, "status", HOUSEHOLD_STATUSES),
  memberAId: requireString(data, "memberAId"),
  memberBId: optionalString(data, "memberBId"),
  activeInviteId: optionalString(data, "activeInviteId"),
  catalogVersion: requireInt(data, "catalogVersion"),
  cleanupPhase: requireEnum(data, "cleanupPhase", HOUSEHOLD_CLEANUP_PHASES),
  revision: requireInt(data, "revision"),
  lastMutationId: requireString(data, "lastMutationId"),
  createdAtMillis: requireTimestampMillis(data, "createdAt"),
  updatedAtMillis: requireTimestampMillis(data, "updatedAt"),
  name: optionalString(data, "name"),
});

// --- households/{householdId}/members/{uid} (contrato §11) ---

export const householdMemberToFirestore = (
  model: MplusHouseholdMember,
): Record<string, unknown> => {
  const state: HouseholdMemberState = model.state;
  return {
    schemaVersion: model.schemaVersion,
    userId: model.userId,
    state,
    displayName: model.displayName,
    photoUrl: model.photoUrl,
    joinedAt: millisToTimestamp(model.joinedAtMillis),
    leftAt: millisToTimestampOrNull(model.leftAtMillis),
    revision: model.revision,
    lastMutationId: model.lastMutationId,
    updatedAt: millisToTimestamp(model.updatedAtMillis),
  };
};

/** `id` es `{householdId}__{userId}`: el doc remoto no lo incluye. */
export const householdMemberFromFirestore = (
  id: string,
  householdId: string,
  data: FirestoreData,
): MplusHouseholdMember => ({
  id,
  schemaVersion: requireInt(data, "schemaVersion"),
  householdId,
  userId: requireString(data, "userId"),
  state: requireEnum(data, "state", HOUSEHOLD_MEMBER_STATES),
  displayName: requireString(data, "displayName"),
  photoUrl: optionalString(data, "photoUrl") ?? "",
  joinedAtMillis: requireTimestampMillis(data, "joinedAt"),
  leftAtMillis: optionalTimestampMillis(data, "leftAt"),
  revision: requireInt(data, "revision"),
  lastMutationId: requireString(data, "lastMutationId"),
  updatedAtMillis: requireTimestampMillis(data, "updatedAt"),
});

// --- householdInvites/{inviteId} (contrato §12) ---

export const householdInviteToFirestore = (
  model: MplusHouseholdInvite,
): Record<string, unknown> => {
  const state: HouseholdInviteState = model.state;
  return {
    schemaVersion: model.schemaVersion,
    householdId: model.householdId,
    createdBy: model.createdBy,
    state,
    createdAt: millisToTimestamp(model.createdAtMillis),
    expiresAt: millisToTimestamp(model.expiresAtMillis),
    usedBy: model.usedBy,
    usedAt: millisToTimestampOrNull(model.usedAtMillis),
    // DEC-076: obligatorio en `validInviteShape`; nunca se omite, ni cuando es
    // null (una invitacion sin la clave es rechazada por Rules).
    reservedForUid: model.reservedForUid,
    revision: model.revision,
    lastMutationId: model.lastMutationId,
    updatedAt: millisToTimestamp(model.updatedAtMillis),
  };
};

export const householdInviteFromFirestore = (
  id: string,
  data: FirestoreData,
): MplusHouseholdInvite => ({
  id,
  schemaVersion: requireInt(data, "schemaVersion"),
  householdId: requireString(data, "householdId"),
  createdBy: requireString(data, "createdBy"),
  state: requireEnum(data, "state", HOUSEHOLD_INVITE_STATES),
  createdAtMillis: requireTimestampMillis(data, "createdAt"),
  expiresAtMillis: requireTimestampMillis(data, "expiresAt"),
  usedBy: optionalString(data, "usedBy"),
  usedAtMillis: optionalTimestampMillis(data, "usedAt"),
  // Opcional (no `require`): una invitacion escrita antes de DEC-076 no trae
  // la clave y debe seguir leyendose.
  reservedForUid: optionalString(data, "reservedForUid"),
  revision: requireInt(data, "revision"),
  lastMutationId: requireString(data, "lastMutationId"),
  updatedAtMillis: requireTimestampMillis(data, "updatedAt"),
});

// --- households/{householdId}/expenseCategories/{categoryId} (contrato §13) ---

export const householdExpenseCategoryToFirestore = (
  model: MplusHouseholdExpenseCategory,
): Record<string, unknown> => {
  const state: CatalogState = model.state;
  return {
    schemaVersion: model.schemaVersion,
    householdId: model.householdId,
    // Constante: en Hogar `type` siempre es 'expense' (contrato §13).
    type: "expense",
    name: model.name,
    iconKey: model.iconKey,
    color: model.color,
    state,
    seedKey: model.seedKey,
    sortOrder: model.sortOrder,
    createdBy: model.createdBy,
    revision: model.revision,
    lastMutationId: model.lastMutationId,
    createdAt: millisToTimestamp(model.createdAtMillis),
    updatedAt: millisToTimestamp(model.updatedAtMillis),
  };
};

export const householdExpenseCategoryFromFirestore = (
  id: string,
  data: FirestoreData,
): MplusHouseholdExpenseCategory => ({
  id,
  schemaVersion: requireInt(data, "schemaVersion"),
  householdId: requireString(data, "householdId"),
  name: requireString(data, "name"),
  iconKey: requireString(data, "iconKey"),
  color: requireString(data, "color"),
  state: requireEnum(data, "state", CATALOG_STATES),
  seedKey: optionalString(data, "seedKey"),
  sortOrder: requireInt(data, "sortOrder"),
  createdBy: requireString(data, "createdBy"),
  revision: requireInt(data, "revision"),
  lastMutationId: requireString(data, "lastMutationId"),
  createdAtMillis: requireTimestampMillis(data, "createdAt"),
  updatedAtMillis: requireTimestampMillis(data, "updatedAt"),
});

// --- households/{householdId}/categoryMappings/{mappingId} (contrato §14) ---

export const categoryMappingToFirestore = (
  model: MplusCategoryMapping,
): Record<string, unknown> => ({
  schemaVersion: model.schemaVersion,
  householdId: model.householdId,
  ownerId: model.ownerId,
  personalCategoryId: model.personalCategoryId,
  householdCategoryId: model.householdCategoryId,
  updatedBy: model.updatedBy,
  revision: model.revision,
  lastMutationId: model.lastMutationId,
  createdAt: millisToTimestamp(model.createdAtMillis),
  updatedAt: millisToTimestamp(model.updatedAtMillis),
});

export const categoryMappingFromFirestore = (
  id: string,
  data: FirestoreData,
): MplusCategoryMapping => ({
  id,
  schemaVersion: requireInt(data, "schemaVersion"),
  householdId: requireString(data, "householdId"),
  ownerId: requireString(data, "ownerId"),
  personalCategoryId: requireString(data, "personalCategoryId"),
  householdCategoryId: requireString(data, "householdCategoryId"),
  updatedBy: requireString(data, "updatedBy"),
  revision: requireInt(data, "revision"),
  lastMutationId: requireString(data, "lastMutationId"),
  createdAtMillis: requireTimestampMillis(data, "createdAt"),
  updatedAtMillis: requireTimestampMillis(data, "updatedAt"),
});

// --- proyecciones minimas (contrato §15) ---

export const memberCategoryLabelToFirestore = (
  model: MplusMemberCategoryLabel,
): Record<string, unknown> => {
  const type: MovementType = model.type;
  return {
    schemaVersion: model.schemaVersion,
    householdId: model.householdId,
    ownerId: model.ownerId,
    categoryId: model.categoryId,
    type,
    name: model.name,
    iconKey: model.iconKey,
    color: model.color,
    revision: model.revision,
    lastMutationId: model.lastMutationId,
    createdAt: millisToTimestamp(model.createdAtMillis),
    updatedAt: millisToTimestamp(model.updatedAtMillis),
  };
};

export const memberCategoryLabelFromFirestore = (
  id: string,
  data: FirestoreData,
): MplusMemberCategoryLabel => ({
  id,
  schemaVersion: requireInt(data, "schemaVersion"),
  householdId: requireString(data, "householdId"),
  ownerId: requireString(data, "ownerId"),
  categoryId: requireString(data, "categoryId"),
  type: requireEnum(data, "type", MOVEMENT_TYPES),
  name: requireString(data, "name"),
  iconKey: requireString(data, "iconKey"),
  color: requireString(data, "color"),
  revision: requireInt(data, "revision"),
  lastMutationId: requireString(data, "lastMutationId"),
  createdAtMillis: requireTimestampMillis(data, "createdAt"),
  updatedAtMillis: requireTimestampMillis(data, "updatedAt"),
});

export const memberAccountLabelToFirestore = (
  model: MplusMemberAccountLabel,
): Record<string, unknown> => {
  const type: AccountType = model.type;
  const iconType: AccountIconType = model.iconType;
  return {
    schemaVersion: model.schemaVersion,
    householdId: model.householdId,
    ownerId: model.ownerId,
    accountId: model.accountId,
    name: model.name,
    type,
    iconType,
    iconKey: model.iconKey,
    color: model.color,
    revision: model.revision,
    lastMutationId: model.lastMutationId,
    createdAt: millisToTimestamp(model.createdAtMillis),
    updatedAt: millisToTimestamp(model.updatedAtMillis),
  };
};

export const memberAccountLabelFromFirestore = (
  id: string,
  data: FirestoreData,
): MplusMemberAccountLabel => ({
  id,
  schemaVersion: requireInt(data, "schemaVersion"),
  householdId: requireString(data, "householdId"),
  ownerId: requireString(data, "ownerId"),
  accountId: requireString(data, "accountId"),
  name: requireString(data, "name"),
  type: requireEnum(data, "type", ACCOUNT_TYPES),
  iconType: requireEnum(data, "iconType", ACCOUNT_ICON_TYPES),
  iconKey: requireString(data, "iconKey"),
  color: requireString(data, "color"),
  revision: requireInt(data, "revision"),
  lastMutationId: requireString(data, "lastMutationId"),
  createdAtMillis: requireTimestampMillis(data, "createdAt"),
  updatedAtMillis: requireTimestampMillis(data, "updatedAt"),
});

// --- households/{householdId}/closureApprovals/{uid} (contrato §16.1) ---

export const closureApprovalToFirestore = (
  model: MplusClosureApproval,
): Record<string, unknown> => ({
  schemaVersion: model.schemaVersion,
  approvedBy: model.approvedBy,
  approvedAt: millisToTimestamp(model.approvedAtMillis),
  lastMutationId: model.lastMutationId,
});

export const closureApprovalFromFirestore = (
  id: string,
  householdId: string,
  data: FirestoreData,
): MplusClosureApproval => ({
  id,
  schemaVersion: requireInt(data, "schemaVersion"),
  householdId,
  approvedBy: requireString(data, "approvedBy"),
  approvedAtMillis: requireTimestampMillis(data, "approvedAt"),
  lastMutationId: requireString(data, "lastMutationId"),
});
