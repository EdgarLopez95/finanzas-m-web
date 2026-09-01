import { BOGOTA_TIME_ZONE } from "@/lib/mplus/bogota-date";
import type {
  MplusCategoryMapping,
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
} from "@/lib/mplus/models";

/**
 * Formateadores puros para el Respaldo en ZIP de Finanzas M+.
 *
 * Genera CSVs compatibles con RFC 4180 (UTF-8, montos enteros),
 * snapshot.json canónico, MANIFEST.json, RESTORE.md y el nombre del ZIP.
 */

// ─── Nombres de archivos dentro del ZIP ───────────────────────────────────────

export const BACKUP_FILES = [
  "MANIFEST.json",
  "profile.csv",
  "accounts.csv",
  "categories.csv",
  "movements.csv",
  "household.csv",
  "members.csv",
  "household_categories.csv",
  "category_mappings.csv",
  "member_category_labels.csv",
  "member_account_labels.csv",
  "household_invites.csv",
  "snapshot.json",
  "RESTORE.md",
] as const;

export type BackupFileName = (typeof BACKUP_FILES)[number];

// ─── Texto de RESTORE.md (Contrato exacto e idéntico a Android) ──────────────

export const RESTORE_MD_CONTENT = `# Restaurar Finanzas M+ desde este ZIP

## Alcance
- Incluye: perfil/cuentas/categorías/movimientos del ownerUid; Hogar legible (doc, members, categorías Hogar, mappings, labels); movements compartidos de ambos miembros.
- NO incluye: movements personales privados de la pareja; datos de otros Hogares; Auth Google.

## Fuente de verdad
- \`snapshot.json\` = foto exacta para replace.
- \`CSV\` = vista humana; si discrepa, gana \`snapshot.json\`.

## Cómo debe trabajar un agente
- NO borres \`finanzas-m\`. Solo proyecto \`finanzas-m-plus\`.
- Autenticado como \`ownerUid\` (o con Admin SDK si Felipe lo autoriza explícitamente).
- Orden sugerido de escritura: \`profile\` → \`accounts\` → \`categories\` → \`household\` → \`members\` → \`household_categories\` → \`mappings\` → \`labels\` → \`movements\` → \`invites\` (si aplica).
- Respeta OCC: \`revision\` y \`lastMutationId\` del snapshot. No inventes IDs nuevos para docs existentes.
- Tras restaurar Firestore: en Android, logout/login o purge+bootstrap de Room para ese uid; en Web, recarga dura / reset de stores.
- La pareja debe exportar/restaurar su propio Personal por separado.

## Límites
- Este ZIP no es PITR. No hay import automático en la app.`;

// ─── Formateador de nombre de archivo ZIP ─────────────────────────────────────

const bogotaDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BOGOTA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * Genera el nombre del archivo ZIP de respaldo con el formato canónico:
 * `finanzas-m-plus-backup_{yyyyMMdd-HHmmss}_bogota_{uidCorto}.zip`
 */
export function formatBogotaBackupFilename(millis: number, uid: string): string {
  const parts = bogotaDateTimeFormatter.formatToParts(new Date(millis));
  const findPart = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const year = findPart("year");
  const month = findPart("month");
  const day = findPart("day");
  const hour = findPart("hour");
  const minute = findPart("minute");
  const second = findPart("second");

  const timestampString = `${year}${month}${day}-${hour}${minute}${second}`;
  const uidCorto = uid.length <= 8 ? uid : uid.slice(0, 8);

  return `finanzas-m-plus-backup_${timestampString}_bogota_${uidCorto}.zip`;
}

/**
 * Formatea una fecha y hora legible en Bogotá para el MANIFEST.
 */
export function formatBogotaReadableDateTime(millis: number): string {
  const parts = bogotaDateTimeFormatter.formatToParts(new Date(millis));
  const findPart = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const year = findPart("year");
  const month = findPart("month");
  const day = findPart("day");
  const hour = findPart("hour");
  const minute = findPart("minute");
  const second = findPart("second");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

// ─── Utilidades CSV (RFC 4180) ───────────────────────────────────────────────

type CsvValue = string | number | boolean | null | undefined;

export function escapeCsvField(val: CsvValue): string {
  if (val === null || val === undefined) {
    return "";
  }
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const headerLine = headers.map(escapeCsvField).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(","));
  return [headerLine, ...dataLines].join("\n") + (dataLines.length > 0 ? "\n" : "\n");
}

// ─── Formateadores CSV por Entidad ───────────────────────────────────────────

export function formatProfileCsv(profile: MplusUserProfile | null): string {
  const headers = [
    "uid",
    "schemaVersion",
    "status",
    "householdId",
    "householdMembershipState",
    "personalCatalogVersion",
    "revision",
    "lastMutationId",
    "createdAtMillis",
    "updatedAtMillis",
    "resetRequestedAtMillis",
  ];

  if (!profile) {
    return buildCsv(headers, []);
  }

  const rows = [
    [
      profile.uid,
      profile.schemaVersion,
      profile.status,
      profile.householdId,
      profile.householdMembershipState,
      profile.personalCatalogVersion,
      profile.revision,
      profile.lastMutationId,
      profile.createdAtMillis,
      profile.updatedAtMillis,
      profile.resetRequestedAtMillis,
    ],
  ];

  return buildCsv(headers, rows);
}

export function formatAccountsCsv(accounts: readonly MplusPersonalAccount[]): string {
  const headers = [
    "id",
    "schemaVersion",
    "ownerId",
    "name",
    "type",
    "iconType",
    "iconKey",
    "color",
    "state",
    "referenceCount",
    "lastReferenceMovementId",
    "revision",
    "lastMutationId",
    "createdAtMillis",
    "updatedAtMillis",
  ];

  const rows = accounts.map((a) => [
    a.id,
    a.schemaVersion,
    a.ownerId,
    a.name,
    a.type,
    a.iconType,
    a.iconKey,
    a.color,
    a.state,
    a.referenceCount,
    a.lastReferenceMovementId,
    a.revision,
    a.lastMutationId,
    a.createdAtMillis,
    a.updatedAtMillis,
  ]);

  return buildCsv(headers, rows);
}

export function formatCategoriesCsv(categories: readonly MplusPersonalCategory[]): string {
  const headers = [
    "id",
    "schemaVersion",
    "ownerId",
    "type",
    "name",
    "iconKey",
    "color",
    "state",
    "seedKey",
    "sortOrder",
    "revision",
    "lastMutationId",
    "createdAtMillis",
    "updatedAtMillis",
  ];

  const rows = categories.map((c) => [
    c.id,
    c.schemaVersion,
    c.ownerId,
    c.type,
    c.name,
    c.iconKey,
    c.color,
    c.state,
    c.seedKey,
    c.sortOrder,
    c.revision,
    c.lastMutationId,
    c.createdAtMillis,
    c.updatedAtMillis,
  ]);

  return buildCsv(headers, rows);
}

export function formatMovementsCsv(movements: readonly MplusMovement[]): string {
  const headers = [
    "id",
    "schemaVersion",
    "ownerId",
    "type",
    "title",
    "amount",
    "categoryId",
    "accountId",
    "note",
    "occurredAtMillis",
    "lifecycleState",
    "trashedAtMillis",
    "purgeAfterMillis",
    "householdId",
    "householdCategoryId",
    "revision",
    "lastMutationId",
    "createdAtMillis",
    "updatedAtMillis",
  ];

  const rows = movements.map((m) => [
    m.id,
    m.schemaVersion,
    m.ownerId,
    m.type,
    m.title,
    Math.round(m.amount), // Montos enteros garantizados (COP)
    m.categoryId,
    m.accountId,
    m.note,
    m.occurredAtMillis,
    m.lifecycleState,
    m.trashedAtMillis,
    m.purgeAfterMillis,
    m.householdId,
    m.householdCategoryId,
    m.revision,
    m.lastMutationId,
    m.createdAtMillis,
    m.updatedAtMillis,
  ]);

  return buildCsv(headers, rows);
}

export function formatHouseholdCsv(household: MplusHousehold | null): string {
  const headers = [
    "id",
    "schemaVersion",
    "status",
    "name",
    "memberAId",
    "memberBId",
    "activeInviteId",
    "catalogVersion",
    "cleanupPhase",
    "revision",
    "lastMutationId",
    "createdAtMillis",
    "updatedAtMillis",
  ];

  if (!household) {
    return buildCsv(headers, []);
  }

  const rows = [
    [
      household.id,
      household.schemaVersion,
      household.status,
      household.name,
      household.memberAId,
      household.memberBId,
      household.activeInviteId,
      household.catalogVersion,
      household.cleanupPhase,
      household.revision,
      household.lastMutationId,
      household.createdAtMillis,
      household.updatedAtMillis,
    ],
  ];

  return buildCsv(headers, rows);
}

export function formatMembersCsv(members: readonly MplusHouseholdMember[]): string {
  const headers = [
    "id",
    "schemaVersion",
    "householdId",
    "userId",
    "state",
    "displayName",
    "photoUrl",
    "joinedAtMillis",
    "leftAtMillis",
    "revision",
    "lastMutationId",
    "updatedAtMillis",
  ];

  const rows = members.map((m) => [
    m.id,
    m.schemaVersion,
    m.householdId,
    m.userId,
    m.state,
    m.displayName,
    m.photoUrl,
    m.joinedAtMillis,
    m.leftAtMillis,
    m.revision,
    m.lastMutationId,
    m.updatedAtMillis,
  ]);

  return buildCsv(headers, rows);
}

export function formatHouseholdCategoriesCsv(
  categories: readonly MplusHouseholdExpenseCategory[],
): string {
  const headers = [
    "id",
    "schemaVersion",
    "householdId",
    "name",
    "iconKey",
    "color",
    "state",
    "seedKey",
    "sortOrder",
    "createdBy",
    "revision",
    "lastMutationId",
    "createdAtMillis",
    "updatedAtMillis",
  ];

  const rows = categories.map((c) => [
    c.id,
    c.schemaVersion,
    c.householdId,
    c.name,
    c.iconKey,
    c.color,
    c.state,
    c.seedKey,
    c.sortOrder,
    c.createdBy,
    c.revision,
    c.lastMutationId,
    c.createdAtMillis,
    c.updatedAtMillis,
  ]);

  return buildCsv(headers, rows);
}

export function formatCategoryMappingsCsv(mappings: readonly MplusCategoryMapping[]): string {
  const headers = [
    "id",
    "schemaVersion",
    "householdId",
    "ownerId",
    "personalCategoryId",
    "householdCategoryId",
    "updatedBy",
    "revision",
    "lastMutationId",
    "createdAtMillis",
    "updatedAtMillis",
  ];

  const rows = mappings.map((m) => [
    m.id,
    m.schemaVersion,
    m.householdId,
    m.ownerId,
    m.personalCategoryId,
    m.householdCategoryId,
    m.updatedBy,
    m.revision,
    m.lastMutationId,
    m.createdAtMillis,
    m.updatedAtMillis,
  ]);

  return buildCsv(headers, rows);
}

export function formatMemberCategoryLabelsCsv(
  labels: readonly MplusMemberCategoryLabel[],
): string {
  const headers = [
    "id",
    "schemaVersion",
    "householdId",
    "ownerId",
    "categoryId",
    "type",
    "name",
    "iconKey",
    "color",
    "revision",
    "lastMutationId",
    "createdAtMillis",
    "updatedAtMillis",
  ];

  const rows = labels.map((l) => [
    l.id,
    l.schemaVersion,
    l.householdId,
    l.ownerId,
    l.categoryId,
    l.type,
    l.name,
    l.iconKey,
    l.color,
    l.revision,
    l.lastMutationId,
    l.createdAtMillis,
    l.updatedAtMillis,
  ]);

  return buildCsv(headers, rows);
}

export function formatMemberAccountLabelsCsv(labels: readonly MplusMemberAccountLabel[]): string {
  const headers = [
    "id",
    "schemaVersion",
    "householdId",
    "ownerId",
    "accountId",
    "name",
    "type",
    "iconType",
    "iconKey",
    "color",
    "revision",
    "lastMutationId",
    "createdAtMillis",
    "updatedAtMillis",
  ];

  const rows = labels.map((l) => [
    l.id,
    l.schemaVersion,
    l.householdId,
    l.ownerId,
    l.accountId,
    l.name,
    l.type,
    l.iconType,
    l.iconKey,
    l.color,
    l.revision,
    l.lastMutationId,
    l.createdAtMillis,
    l.updatedAtMillis,
  ]);

  return buildCsv(headers, rows);
}

export function formatHouseholdInvitesCsv(invites: readonly MplusHouseholdInvite[]): string {
  const headers = [
    "id",
    "schemaVersion",
    "householdId",
    "createdBy",
    "state",
    "createdAtMillis",
    "expiresAtMillis",
    "usedBy",
    "usedAtMillis",
    "reservedForUid",
    "revision",
    "lastMutationId",
    "updatedAtMillis",
  ];

  const rows = invites.map((inv) => [
    inv.id,
    inv.schemaVersion,
    inv.householdId,
    inv.createdBy,
    inv.state,
    inv.createdAtMillis,
    inv.expiresAtMillis,
    inv.usedBy,
    inv.usedAtMillis,
    inv.reservedForUid,
    inv.revision,
    inv.lastMutationId,
    inv.updatedAtMillis,
  ]);

  return buildCsv(headers, rows);
}

// ─── Formateadores JSON (MANIFEST y snapshot.json) ───────────────────────────

export type BackupManifestCounts = {
  profile: number;
  accounts: number;
  categories: number;
  movements: number;
  ownMovements: number;
  partnerSharedMovements: number;
  household: number;
  members: number;
  householdCategories: number;
  categoryMappings: number;
  memberCategoryLabels: number;
  memberAccountLabels: number;
  householdInvites: number;
};

export type BackupManifest = {
  schemaVersion: number;
  product: "finanzas-m-plus";
  app: "finanzas-m-web";
  ownerUid: string;
  householdId: string | null;
  exportedAtMillis: number;
  exportedAtBogota: string;
  counts: BackupManifestCounts;
  files: readonly BackupFileName[];
  notes: readonly string[];
};

export function formatManifestJson(manifest: BackupManifest): string {
  return JSON.stringify(manifest, null, 2) + "\n";
}

export type BackupSnapshotData = {
  schemaVersion: number;
  exportedAtMillis: number;
  ownerUid: string;
  householdId: string | null;
  profile: MplusUserProfile | null;
  accounts: readonly MplusPersonalAccount[];
  categories: readonly MplusPersonalCategory[];
  movements: readonly MplusMovement[];
  household: MplusHousehold | null;
  members: readonly MplusHouseholdMember[];
  householdCategories: readonly MplusHouseholdExpenseCategory[];
  categoryMappings: readonly MplusCategoryMapping[];
  memberCategoryLabels: readonly MplusMemberCategoryLabel[];
  memberAccountLabels: readonly MplusMemberAccountLabel[];
  householdInvites: readonly MplusHouseholdInvite[];
};

export function formatSnapshotJson(snapshot: BackupSnapshotData): string {
  return JSON.stringify(snapshot, null, 2) + "\n";
}
