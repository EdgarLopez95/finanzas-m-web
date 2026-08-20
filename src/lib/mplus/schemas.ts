import { z } from "zod";

import {
  AMOUNT_MAX,
  AMOUNT_MIN,
  COLOR_PATTERN,
  DERIVED_ID_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  INVITE_CODE_PATTERN,
  NAME_MAX_LENGTH,
  NOTE_MAX_LENGTH,
  PHOTO_URL_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  UID_MAX_LENGTH,
  UUID_PATTERN,
  isValidAccountIcon,
  isValidCategoryIcon,
} from "./catalogs";
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
import { PURGE_WINDOW_MILLIS } from "./bogota-date";

/**
 * Validadores Zod del contrato v1.
 *
 * Replican, en cliente, lo que `android/firestore.rules` exige en servidor:
 * mismos campos, mismos limites, mismos enums, mismas relaciones internas al
 * documento. Su proposito es que la Web NUNCA envie un payload que el servidor
 * vaya a rechazar; no sustituyen a las Rules (son la autoridad real) ni a las
 * validaciones que necesitan leer otros documentos (categoria activa del
 * duenio, contadores de cuenta), que solo pueden resolverse en transaccion.
 *
 * Los objetos se validan con `.strict()`: un campo extra es un error, igual
 * que `keys().hasOnly(...)` en las Rules.
 */

const uuid = z.string().regex(UUID_PATTERN, "lastMutationId debe ser UUID");
const color = z.string().regex(COLOR_PATTERN, "color debe ser #RRGGBB");
const uid = z.string().min(1).max(UID_MAX_LENGTH);
const derivedId = z.string().min(1).max(DERIVED_ID_MAX_LENGTH);
const schemaVersion = z.literal(1);
const revision = z.number().int().min(1);
const millis = z.number().int();
const nullableMillis = z.number().int().nullable();

/** Contrato §4.4: cadena obligatoria, recortada y no vacia. */
const trimmedString = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => value.trim().length >= 1, "no puede quedar vacia tras recortar")
    .refine((value) => value === value.trim(), "no debe traer espacios al inicio/fin");

export const mplusUserProfileSchema = z
  .object({
    uid,
    schemaVersion,
    status: z.enum(USER_STATUSES),
    householdId: derivedId.nullable(),
    householdMembershipState: z.enum(HOUSEHOLD_MEMBERSHIP_STATES),
    personalCatalogVersion: z.literal(1),
    revision,
    lastMutationId: uuid,
    createdAtMillis: millis,
    updatedAtMillis: millis,
    resetRequestedAtMillis: nullableMillis,
  })
  .strict()
  // Contrato §6.3: `none` exige householdId null; `active`/`left` lo exigen presente.
  .refine(
    (u) =>
      u.householdMembershipState === "none"
        ? u.householdId === null
        : u.householdId !== null,
    { message: "householdMembershipState y householdId son incoherentes" },
  )
  // Contrato §6.2: resetRequestedAt solo es distinto de null durante `resetting`.
  .refine(
    (u) =>
      u.status === "resetting"
        ? u.resetRequestedAtMillis !== null
        : u.resetRequestedAtMillis === null,
    { message: "resetRequestedAt solo existe mientras status es resetting" },
  );

export const mplusPersonalAccountSchema = z
  .object({
    id: derivedId,
    schemaVersion,
    ownerId: uid,
    name: trimmedString(NAME_MAX_LENGTH),
    type: z.enum(ACCOUNT_TYPES),
    iconType: z.enum(ACCOUNT_ICON_TYPES),
    iconKey: z.string().min(1),
    color,
    state: z.enum(CATALOG_STATES),
    referenceCount: z.number().int().min(0),
    lastReferenceMovementId: derivedId.nullable(),
    revision,
    lastMutationId: uuid,
    createdAtMillis: millis,
    updatedAtMillis: millis,
  })
  .strict()
  // Contrato §7.2: la terna type/iconType/iconKey debe pertenecer al catalogo.
  .refine((a) => isValidAccountIcon(a.type, a.iconType, a.iconKey), {
    message: "combinacion type/iconType/iconKey fuera del catalogo de cuentas",
  });

export const mplusPersonalCategorySchema = z
  .object({
    id: derivedId,
    schemaVersion,
    ownerId: uid,
    type: z.enum(MOVEMENT_TYPES),
    name: trimmedString(NAME_MAX_LENGTH),
    iconKey: z.string().min(1),
    color,
    state: z.enum(CATALOG_STATES),
    seedKey: z.string().min(1).max(NAME_MAX_LENGTH).nullable(),
    sortOrder: z.number().int().min(0),
    revision,
    lastMutationId: uuid,
    createdAtMillis: millis,
    updatedAtMillis: millis,
  })
  .strict()
  // Contrato §24: el icono debe pertenecer al catalogo del tipo.
  .refine((c) => isValidCategoryIcon(c.type, c.iconKey), {
    message: "iconKey fuera del catalogo del tipo de categoria",
  });

export const mplusMovementSchema = z
  .object({
    id: derivedId,
    schemaVersion,
    ownerId: uid,
    type: z.enum(MOVEMENT_TYPES),
    title: trimmedString(TITLE_MAX_LENGTH),
    amount: z.number().int().min(AMOUNT_MIN).max(AMOUNT_MAX),
    categoryId: derivedId,
    accountId: derivedId.nullable(),
    note: z.string().max(NOTE_MAX_LENGTH),
    occurredAtMillis: millis,
    lifecycleState: z.enum(MOVEMENT_LIFECYCLE_STATES),
    trashedAtMillis: nullableMillis,
    purgeAfterMillis: nullableMillis,
    householdId: derivedId.nullable(),
    householdCategoryId: derivedId.nullable(),
    revision,
    lastMutationId: uuid,
    createdAtMillis: millis,
    updatedAtMillis: millis,
  })
  .strict()
  // Contrato §9.5: los campos de Papelera existen exactamente en `trashed`.
  .refine(
    (m) =>
      m.lifecycleState === "active"
        ? m.trashedAtMillis === null && m.purgeAfterMillis === null
        : m.trashedAtMillis !== null && m.purgeAfterMillis !== null,
    { message: "trashedAt/purgeAfter solo existen en lifecycleState trashed" },
  )
  // Contrato §9.5: purgeAfter = trashedAt + 30 dias exactos.
  .refine(
    (m) =>
      m.trashedAtMillis === null ||
      m.purgeAfterMillis === m.trashedAtMillis + PURGE_WINDOW_MILLIS,
    { message: "purgeAfter debe ser trashedAt + 30 dias" },
  )
  // Contrato §9.1: sin Hogar no puede haber categoria de Hogar.
  .refine((m) => m.householdId !== null || m.householdCategoryId === null, {
    message: "householdCategoryId exige householdId",
  })
  // Contrato §9.2: un ingreso compartido conserva householdCategoryId = null.
  .refine((m) => m.type !== "income" || m.householdCategoryId === null, {
    message: "un ingreso nunca lleva householdCategoryId",
  });

export const mplusHouseholdSchema = z
  .object({
    id: derivedId,
    schemaVersion,
    status: z.enum(HOUSEHOLD_STATUSES),
    memberAId: uid,
    memberBId: uid.nullable(),
    activeInviteId: z.string().regex(INVITE_CODE_PATTERN).nullable(),
    catalogVersion: z.literal(1),
    cleanupPhase: z.enum(HOUSEHOLD_CLEANUP_PHASES),
    revision,
    lastMutationId: uuid,
    createdAtMillis: millis,
    updatedAtMillis: millis,
    name: trimmedString(NAME_MAX_LENGTH).nullable(),
  })
  .strict()
  // Contrato §10.2: A y B son personas distintas.
  .refine((h) => h.memberBId === null || h.memberBId !== h.memberAId, {
    message: "memberBId no puede ser el mismo UID que memberAId",
  })
  /*
   * Combinaciones legales de estado, copiadas de `validHouseholdShape` en las
   * Rules canonicas. DEC-075/076: `active` es el unico estado que admite
   * `activeInviteId` no nulo con pareja formada (codigo de reingreso de una
   * plaza desvinculada); `waiting_return` (pausa) regresa sin codigo.
   */
  .refine(
    (h) => {
      switch (h.status) {
        case "waiting":
          return h.memberBId === null && h.activeInviteId !== null && h.cleanupPhase === "none";
        case "active":
          return h.memberBId !== null && h.cleanupPhase === "none";
        case "waiting_return":
          return h.memberBId !== null && h.activeInviteId === null && h.cleanupPhase === "none";
        case "closing":
          return h.memberBId !== null && h.activeInviteId === null && h.cleanupPhase !== "none";
      }
    },
    { message: "combinacion status/memberBId/activeInviteId/cleanupPhase invalida" },
  );

export const mplusHouseholdMemberSchema = z
  .object({
    id: derivedId,
    schemaVersion,
    householdId: derivedId,
    userId: uid,
    state: z.enum(HOUSEHOLD_MEMBER_STATES),
    displayName: trimmedString(DISPLAY_NAME_MAX_LENGTH),
    photoUrl: z
      .string()
      .max(PHOTO_URL_MAX_LENGTH)
      .refine((value) => value === "" || value.startsWith("https://"), {
        message: "photoUrl debe estar vacia o ser una URL HTTPS",
      }),
    joinedAtMillis: millis,
    leftAtMillis: nullableMillis,
    revision,
    lastMutationId: uuid,
    updatedAtMillis: millis,
  })
  .strict()
  // Contrato §11.1: leftAt es obligatorio en `left` y nulo en `active`.
  .refine(
    (m) => (m.state === "left" ? m.leftAtMillis !== null : m.leftAtMillis === null),
    { message: "leftAt solo existe cuando state es left" },
  );

export const mplusHouseholdInviteSchema = z
  .object({
    id: z.string().regex(INVITE_CODE_PATTERN, "el codigo debe tener 3 digitos"),
    schemaVersion,
    householdId: derivedId,
    createdBy: uid,
    state: z.enum(HOUSEHOLD_INVITE_STATES),
    createdAtMillis: millis,
    expiresAtMillis: millis,
    usedBy: uid.nullable(),
    usedAtMillis: nullableMillis,
    reservedForUid: uid.nullable(),
    revision,
    lastMutationId: uuid,
    updatedAtMillis: millis,
  })
  .strict()
  // Contrato §12.2: usedBy/usedAt existen exactamente cuando la invitacion se uso.
  .refine(
    (i) =>
      i.state === "used"
        ? i.usedBy !== null && i.usedAtMillis !== null
        : i.usedBy === null && i.usedAtMillis === null,
    { message: "usedBy/usedAt solo existen cuando state es used" },
  );

export const mplusHouseholdExpenseCategorySchema = z
  .object({
    id: derivedId,
    schemaVersion,
    householdId: derivedId,
    name: trimmedString(NAME_MAX_LENGTH),
    iconKey: z.string().min(1),
    color,
    state: z.enum(CATALOG_STATES),
    seedKey: z.string().min(1).max(NAME_MAX_LENGTH).nullable(),
    sortOrder: z.number().int().min(0),
    createdBy: uid,
    revision,
    lastMutationId: uuid,
    createdAtMillis: millis,
    updatedAtMillis: millis,
  })
  .strict()
  // Contrato §13: en Hogar el tipo siempre es gasto, luego el icono es de gasto.
  .refine((c) => isValidCategoryIcon("expense", c.iconKey), {
    message: "iconKey fuera del catalogo de gasto",
  });

export const mplusCategoryMappingSchema = z
  .object({
    id: derivedId,
    schemaVersion,
    householdId: derivedId,
    ownerId: uid,
    personalCategoryId: derivedId,
    householdCategoryId: derivedId,
    updatedBy: uid,
    revision,
    lastMutationId: uuid,
    createdAtMillis: millis,
    updatedAtMillis: millis,
  })
  .strict()
  // Contrato §14: el ID es determinista `{ownerId}__{personalCategoryId}`.
  .refine((m) => m.id === `${m.ownerId}__${m.personalCategoryId}`, {
    message: "el ID de la equivalencia debe ser {ownerId}__{personalCategoryId}",
  });

export const mplusMemberCategoryLabelSchema = z
  .object({
    id: derivedId,
    schemaVersion,
    householdId: derivedId,
    ownerId: uid,
    categoryId: derivedId,
    type: z.enum(MOVEMENT_TYPES),
    name: trimmedString(NAME_MAX_LENGTH),
    iconKey: z.string().min(1),
    color,
    revision,
    lastMutationId: uuid,
    createdAtMillis: millis,
    updatedAtMillis: millis,
  })
  .strict()
  .refine((l) => isValidCategoryIcon(l.type, l.iconKey), {
    message: "iconKey fuera del catalogo del tipo",
  })
  .refine((l) => l.id === `${l.ownerId}__${l.categoryId}`, {
    message: "el ID de la proyeccion debe ser {ownerId}__{categoryId}",
  });

export const mplusMemberAccountLabelSchema = z
  .object({
    id: derivedId,
    schemaVersion,
    householdId: derivedId,
    ownerId: uid,
    accountId: derivedId,
    name: trimmedString(NAME_MAX_LENGTH),
    type: z.enum(ACCOUNT_TYPES),
    iconType: z.enum(ACCOUNT_ICON_TYPES),
    iconKey: z.string().min(1),
    color,
    revision,
    lastMutationId: uuid,
    createdAtMillis: millis,
    updatedAtMillis: millis,
  })
  .strict()
  .refine((l) => isValidAccountIcon(l.type, l.iconType, l.iconKey), {
    message: "combinacion type/iconType/iconKey fuera del catalogo de cuentas",
  })
  .refine((l) => l.id === `${l.ownerId}__${l.accountId}`, {
    message: "el ID de la proyeccion debe ser {ownerId}__{accountId}",
  });

export const mplusClosureApprovalSchema = z
  .object({
    id: derivedId,
    schemaVersion,
    householdId: derivedId,
    approvedBy: uid,
    approvedAtMillis: millis,
    lastMutationId: uuid,
  })
  .strict();

/**
 * Error de validacion de contrato: la Web se detiene ANTES de escribir.
 * Nunca se degrada a "escribir de todos modos y ver si Rules lo acepta".
 */
export class MplusContractValidationError extends Error {
  constructor(
    readonly resource: string,
    readonly issues: readonly string[],
  ) {
    super(`Payload invalido para el contrato v1 (${resource}): ${issues.join("; ")}`);
    this.name = "MplusContractValidationError";
  }
}

const parseOrThrow = <T>(resource: string, schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  const issues = result.error.issues.map(
    (issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.message}`,
  );
  throw new MplusContractValidationError(resource, issues);
};

/**
 * Puerta unica de validacion antes de cualquier escritura. Devuelve el modelo
 * validado (mismo objeto, tipado) o lanza `MplusContractValidationError`.
 */
export const mplusValidators = {
  user: (value: unknown) => parseOrThrow("users", mplusUserProfileSchema, value),
  account: (value: unknown) => parseOrThrow("accounts", mplusPersonalAccountSchema, value),
  category: (value: unknown) =>
    parseOrThrow("categories", mplusPersonalCategorySchema, value),
  movement: (value: unknown) => parseOrThrow("movements", mplusMovementSchema, value),
  household: (value: unknown) => parseOrThrow("households", mplusHouseholdSchema, value),
  householdMember: (value: unknown) =>
    parseOrThrow("members", mplusHouseholdMemberSchema, value),
  householdInvite: (value: unknown) =>
    parseOrThrow("householdInvites", mplusHouseholdInviteSchema, value),
  householdExpenseCategory: (value: unknown) =>
    parseOrThrow("expenseCategories", mplusHouseholdExpenseCategorySchema, value),
  categoryMapping: (value: unknown) =>
    parseOrThrow("categoryMappings", mplusCategoryMappingSchema, value),
  memberCategoryLabel: (value: unknown) =>
    parseOrThrow("memberCategoryLabels", mplusMemberCategoryLabelSchema, value),
  memberAccountLabel: (value: unknown) =>
    parseOrThrow("memberAccountLabels", mplusMemberAccountLabelSchema, value),
  closureApproval: (value: unknown) =>
    parseOrThrow("closureApprovals", mplusClosureApprovalSchema, value),
} as const;
