import { strToU8, zipSync } from "fflate";

import {
  categoryMappingFromFirestore,
  householdExpenseCategoryFromFirestore,
  householdFromFirestore,
  householdInviteFromFirestore,
  householdMemberFromFirestore,
  memberAccountLabelFromFirestore,
  memberCategoryLabelFromFirestore,
  movementFromFirestore,
  personalAccountFromFirestore,
  personalCategoryFromFirestore,
  userProfileFromFirestore,
  type FirestoreData,
} from "@/lib/mplus/converters";
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
import {
  householdDocPath,
  householdInviteDocPath,
  MPLUS_PATHS,
  userDocPath,
} from "@/lib/mplus/paths";

import {
  BACKUP_FILES,
  CANONICAL_BACKUP_NOTES,
  formatAccountsCsv,
  formatBogotaBackupFilename,
  formatBogotaReadableDateTime,
  formatCategoriesCsv,
  formatCategoryMappingsCsv,
  formatHouseholdCategoriesCsv,
  formatHouseholdCsv,
  formatHouseholdInvitesCsv,
  formatManifestJson,
  formatMemberAccountLabelsCsv,
  formatMemberCategoryLabelsCsv,
  formatMembersCsv,
  formatMovementsCsv,
  formatProfileCsv,
  formatSnapshotJson,
  RESTORE_MD_CONTENT,
  type BackupFileName,
  type BackupManifest,
  type BackupSnapshotData,
} from "./mplus-backup-formatters";
import type { MplusBackupGateway } from "./mplus-backup-gateway";

export class MplusBackupError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "MplusBackupError";
  }
}

export type MplusBackupExportResult = {
  zipBuffer: Uint8Array;
  zipFileName: string;
  files: Record<BackupFileName, string>;
  manifest: BackupManifest;
  snapshot: BackupSnapshotData;
};

export type ExecuteMplusBackupOptions = {
  /** Timestamp de referencia (por defecto `Date.now()`). */
  nowMillis?: number;
};

/**
 * Servicio puro de generación de Respaldo ZIP de Finanzas M+ (Export-Only).
 *
 * Recolecta todos los datos legibles del usuario autenticado:
 * - Perfil, cuentas, categorías y movimientos personales (activos y papelera).
 * - Documento del Hogar actual, integrantes, categorías del Hogar, equivalencias y etiquetas.
 * - Movimientos compartidos del Hogar creados por la pareja (`householdId === householdId`).
 * - Excluye estrictamente cualquier movimiento personal privado de la pareja.
 * - Empaqueta 14 archivos en un ZIP ligero generado en memoria con `fflate`.
 */
export async function executeMplusBackupExport(
  gateway: MplusBackupGateway,
  uid: string,
  options: ExecuteMplusBackupOptions = {},
): Promise<MplusBackupExportResult> {
  if (!uid || uid.trim() === "") {
    throw new MplusBackupError("UID no válido para generar respaldo.");
  }

  const nowMillis = options.nowMillis ?? Date.now();

  // ── 1. Perfil del Usuario ──────────────────────────────────────────────────
  const userPath = userDocPath(uid);
  let userData: Record<string, unknown> | null = null;
  try {
    userData = await gateway.readDoc(userPath);
  } catch (error) {
    throw new MplusBackupError("Error al leer el perfil de usuario en Firestore.", error);
  }

  if (!userData) {
    throw new MplusBackupError("El perfil de usuario no existe en Firestore.");
  }

  const profile: MplusUserProfile = userProfileFromFirestore(uid, userData as FirestoreData);

  // ── 2. Cuentas y Categorías Personales ──────────────────────────────────────
  let accounts: MplusPersonalAccount[] = [];
  let categories: MplusPersonalCategory[] = [];

  try {
    const rawAccounts = await gateway.listCollection([
      MPLUS_PATHS.users,
      uid,
      MPLUS_PATHS.accounts,
    ]);
    accounts = rawAccounts.map((d) =>
      personalAccountFromFirestore(d.id, d.data as FirestoreData),
    );
  } catch (error) {
    throw new MplusBackupError("Error al leer las cuentas personales.", error);
  }

  try {
    const rawCategories = await gateway.listCollection([
      MPLUS_PATHS.users,
      uid,
      MPLUS_PATHS.categories,
    ]);
    categories = rawCategories.map((d) =>
      personalCategoryFromFirestore(d.id, d.data as FirestoreData),
    );
  } catch (error) {
    throw new MplusBackupError("Error al leer las categorías personales.", error);
  }

  // ── 3. Movimientos Personales (Activos + Papelera) ──────────────────────────
  const movementsMap = new Map<string, MplusMovement>();

  try {
    const activeOwn = await gateway.queryByField(
      MPLUS_PATHS.movements,
      "ownerId",
      uid,
      { field: "lifecycleState", value: "active" },
    );
    for (const d of activeOwn) {
      movementsMap.set(d.id, movementFromFirestore(d.id, d.data as FirestoreData));
    }

    const trashedOwn = await gateway.queryByField(
      MPLUS_PATHS.movements,
      "ownerId",
      uid,
      { field: "lifecycleState", value: "trashed" },
    );
    for (const d of trashedOwn) {
      movementsMap.set(d.id, movementFromFirestore(d.id, d.data as FirestoreData));
    }
  } catch (error) {
    throw new MplusBackupError("Error al leer los movimientos personales.", error);
  }

  const ownMovementsCount = movementsMap.size;

  // ── 4. Datos del Hogar (si aplica) ─────────────────────────────────────────
  let household: MplusHousehold | null = null;
  let members: MplusHouseholdMember[] = [];
  let householdCategories: MplusHouseholdExpenseCategory[] = [];
  let categoryMappings: MplusCategoryMapping[] = [];
  let memberCategoryLabels: MplusMemberCategoryLabel[] = [];
  let memberAccountLabels: MplusMemberAccountLabel[] = [];
  const householdInvites: MplusHouseholdInvite[] = [];
  let partnerSharedMovementsCount = 0;

  const householdId = profile.householdId;

  if (householdId) {
    const householdPath = householdDocPath(householdId);

    // Leer documento de Hogar
    try {
      const hData = await gateway.readDoc(householdPath);
      if (hData) {
        household = householdFromFirestore(householdId, hData as FirestoreData);
      }
    } catch {
      // Ignorar fallo de lectura no crítico para continuar exportación
    }

    // Subcolecciones del Hogar
    try {
      const rawMembers = await gateway.listCollection([...householdPath, MPLUS_PATHS.members]);
      members = rawMembers.map((d) =>
        householdMemberFromFirestore(d.id, householdId, d.data as FirestoreData),
      );
    } catch {
      // Ignorar fallo de listado no crítico para continuar exportación
    }

    try {
      const rawExpenseCats = await gateway.listCollection([
        ...householdPath,
        MPLUS_PATHS.expenseCategories,
      ]);
      householdCategories = rawExpenseCats.map((d) =>
        householdExpenseCategoryFromFirestore(d.id, d.data as FirestoreData),
      );
    } catch {
      // Ignorar fallo de listado no crítico para continuar exportación
    }

    try {
      const rawMappings = await gateway.listCollection([
        ...householdPath,
        MPLUS_PATHS.categoryMappings,
      ]);
      categoryMappings = rawMappings.map((d) =>
        categoryMappingFromFirestore(d.id, d.data as FirestoreData),
      );
    } catch {
      // Ignorar fallo de listado no crítico para continuar exportación
    }

    try {
      const rawCatLabels = await gateway.listCollection([
        ...householdPath,
        MPLUS_PATHS.memberCategoryLabels,
      ]);
      memberCategoryLabels = rawCatLabels.map((d) =>
        memberCategoryLabelFromFirestore(d.id, d.data as FirestoreData),
      );
    } catch {
      // Ignorar fallo de listado no crítico para continuar exportación
    }

    try {
      const rawAccLabels = await gateway.listCollection([
        ...householdPath,
        MPLUS_PATHS.memberAccountLabels,
      ]);
      memberAccountLabels = rawAccLabels.map((d) =>
        memberAccountLabelFromFirestore(d.id, d.data as FirestoreData),
      );
    } catch {
      // Ignorar fallo de listado no crítico para continuar exportación
    }

    // Movimientos compartidos de la pareja asociados a este Hogar
    try {
      const sharedDocs = await gateway.queryByField(
        MPLUS_PATHS.movements,
        "householdId",
        householdId,
        { field: "lifecycleState", value: "active" },
      );

      for (const d of sharedDocs) {
        const mov = movementFromFirestore(d.id, d.data as FirestoreData);
        // Garantía de privacidad estricta: solo incluir si pertenece al Hogar actual
        if (mov.householdId === householdId) {
          if (mov.ownerId !== uid) {
            partnerSharedMovementsCount++;
          }
          movementsMap.set(mov.id, mov);
        }
      }
    } catch {
      // Ignorar fallo de consulta no crítico
    }

    // Invitaciones del Hogar: lectura puntual por activeInviteId (Rules niegan list fuera de resetting)
    if (household?.activeInviteId) {
      try {
        const invData = await gateway.readDoc(householdInviteDocPath(household.activeInviteId));
        if (invData) {
          householdInvites.push(
            householdInviteFromFirestore(household.activeInviteId, invData as FirestoreData),
          );
        }
      } catch {
        // Ignorar fallo de invitación puntual
      }
    }
  }

  // Orden canónico de movimientos (espejo de mergeMovements en Android):
  // occurredAtMillis DESC, createdAtMillis DESC, id ASC
  const allMovements = Array.from(movementsMap.values()).sort((a, b) => {
    if (b.occurredAtMillis !== a.occurredAtMillis) {
      return b.occurredAtMillis - a.occurredAtMillis;
    }
    if (b.createdAtMillis !== a.createdAtMillis) {
      return b.createdAtMillis - a.createdAtMillis;
    }
    return a.id.localeCompare(b.id);
  });

  // ── 5. Construcción de Archivos ────────────────────────────────────────────

  const profileCsv = formatProfileCsv(profile);
  const accountsCsv = formatAccountsCsv(accounts);
  const categoriesCsv = formatCategoriesCsv(categories);
  const movementsCsv = formatMovementsCsv(allMovements);
  const householdCsv = formatHouseholdCsv(household);
  const membersCsv = formatMembersCsv(members);
  const householdCategoriesCsv = formatHouseholdCategoriesCsv(householdCategories);
  const categoryMappingsCsv = formatCategoryMappingsCsv(categoryMappings);
  const memberCategoryLabelsCsv = formatMemberCategoryLabelsCsv(memberCategoryLabels);
  const memberAccountLabelsCsv = formatMemberAccountLabelsCsv(memberAccountLabels);
  const householdInvitesCsv = formatHouseholdInvitesCsv(householdInvites);

  const snapshot: BackupSnapshotData = {
    schemaVersion: 1,
    exportedAtMillis: nowMillis,
    ownerUid: uid,
    householdId,
    profile,
    accounts,
    categories,
    movements: allMovements,
    household,
    members,
    householdCategories,
    categoryMappings,
    memberCategoryLabels,
    memberAccountLabels,
    householdInvites,
  };
  const snapshotJson = formatSnapshotJson(snapshot);

  const manifest: BackupManifest = {
    exportVersion: 1,
    product: "finanzas-m-plus",
    app: "finanzas-m-web",
    projectId: "finanzas-m-plus",
    timezone: "America/Bogota",
    exportedAtMillis: nowMillis,
    exportedAtBogota: formatBogotaReadableDateTime(nowMillis),
    ownerUid: uid,
    householdId,
    files: BACKUP_FILES,
    counts: {
      profile: profile ? 1 : 0,
      accounts: accounts.length,
      categories: categories.length,
      movements: allMovements.length,
      ownMovements: ownMovementsCount,
      partnerSharedMovements: partnerSharedMovementsCount,
      household: household ? 1 : 0,
      members: members.length,
      householdCategories: householdCategories.length,
      categoryMappings: categoryMappings.length,
      memberCategoryLabels: memberCategoryLabels.length,
      memberAccountLabels: memberAccountLabels.length,
      householdInvites: householdInvites.length,
    },
    notes: CANONICAL_BACKUP_NOTES,
    source: "firestore",
    offlinePartial: false,
  };
  const manifestJson = formatManifestJson(manifest);

  const filesRecord: Record<BackupFileName, string> = {
    "MANIFEST.json": manifestJson,
    "profile.csv": profileCsv,
    "accounts.csv": accountsCsv,
    "categories.csv": categoriesCsv,
    "movements.csv": movementsCsv,
    "household.csv": householdCsv,
    "members.csv": membersCsv,
    "household_categories.csv": householdCategoriesCsv,
    "category_mappings.csv": categoryMappingsCsv,
    "member_category_labels.csv": memberCategoryLabelsCsv,
    "member_account_labels.csv": memberAccountLabelsCsv,
    "household_invites.csv": householdInvitesCsv,
    "snapshot.json": snapshotJson,
    "RESTORE.md": RESTORE_MD_CONTENT,
  };

  // ── 6. Generación del ZIP en Memoria (fflate) ──────────────────────────────
  const zipEntries: Record<string, Uint8Array> = {};
  for (const fileName of BACKUP_FILES) {
    const textContent = filesRecord[fileName];
    zipEntries[fileName] = strToU8(textContent);
  }

  const zipBuffer = zipSync(zipEntries, { level: 6 });
  const zipFileName = formatBogotaBackupFilename(nowMillis, uid);

  return {
    zipBuffer,
    zipFileName,
    files: filesRecord,
    manifest,
    snapshot,
  };
}
