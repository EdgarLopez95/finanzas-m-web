import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";

import {
  BACKUP_FILES,
  buildCsv,
  escapeCsvField,
  formatBogotaBackupFilename,
  formatBogotaReadableDateTime,
  RESTORE_MD_CONTENT,
} from "@/features/backup/services/mplus-backup-formatters";
import type { BackupDoc, MplusBackupGateway } from "@/features/backup/services/mplus-backup-gateway";
import { executeMplusBackupExport, MplusBackupError } from "@/features/backup/services/mplus-backup-service";
import { millisToTimestamp } from "@/lib/mplus/converters";
import { MPLUS_PATHS } from "@/lib/mplus/paths";

/**
 * Suite de pruebas unitarias para el Respaldo en ZIP de Finanzas M+ (Export-Only).
 */

console.log("Iniciando pruebas de respaldo en ZIP (mplus-backup-export.test.ts)...");

/** In-memory gateway simulando Firestore para pruebas */
class InMemoryBackupGateway implements MplusBackupGateway {
  constructor(
    private docs: Map<string, Record<string, unknown>> = new Map(),
    private failInvites: boolean = false,
  ) {}

  private pathToKey(path: readonly string[]): string {
    return path.join("/");
  }

  async readDoc(path: readonly string[]): Promise<Record<string, unknown> | null> {
    const key = this.pathToKey(path);
    if (this.failInvites && path[0] === MPLUS_PATHS.householdInvites) {
      throw new Error("Missing or insufficient permissions on householdInvites");
    }
    return this.docs.get(key) ?? null;
  }

  async listCollection(path: readonly string[]): Promise<BackupDoc[]> {
    const prefix = path.join("/") + "/";
    const results: BackupDoc[] = [];

    for (const [key, data] of this.docs.entries()) {
      if (key.startsWith(prefix)) {
        const subPath = key.slice(prefix.length);
        if (!subPath.includes("/")) {
          const id = subPath;
          results.push({
            id,
            path: [...path, id],
            data,
          });
        }
      }
    }
    return results;
  }

  async queryByField(
    collectionName: string,
    field: string,
    value: string,
    extra?: Readonly<{ field: string; value: string }>,
  ): Promise<BackupDoc[]> {
    if (this.failInvites && collectionName === MPLUS_PATHS.householdInvites) {
      throw new Error("Missing or insufficient permissions on householdInvites query");
    }

    const results: BackupDoc[] = [];
    const prefix = collectionName + "/";

    for (const [key, data] of this.docs.entries()) {
      if (key.startsWith(prefix)) {
        const subPath = key.slice(prefix.length);
        if (!subPath.includes("/")) {
          const id = subPath;
          const matchesField = data[field] === value;
          const matchesExtra = !extra || data[extra.field] === extra.value;
          if (matchesField && matchesExtra) {
            results.push({
              id,
              path: [collectionName, id],
              data,
            });
          }
        }
      }
    }
    return results;
  }
}

function createSampleFirestoreData(ownerUid: string, partnerUid: string, householdId: string) {
  const docs = new Map<string, Record<string, unknown>>();

  // Perfil del usuario
  docs.set(`users/${ownerUid}`, {
    schemaVersion: 1,
    status: "ready",
    householdId,
    householdMembershipState: "active",
    personalCatalogVersion: 1,
    revision: 3,
    lastMutationId: "mut_prof_1",
    createdAt: millisToTimestamp(1700000000000),
    updatedAt: millisToTimestamp(1700001000000),
    resetRequestedAt: null,
  });

  // Cuenta personal
  docs.set(`users/${ownerUid}/accounts/acc_1`, {
    schemaVersion: 1,
    ownerId: ownerUid,
    name: "Nequi",
    type: "digital_wallet",
    iconType: "generic",
    iconKey: "wallet",
    color: "#4A90E2",
    state: "active",
    referenceCount: 2,
    lastReferenceMovementId: "mov_own_1",
    revision: 1,
    lastMutationId: "mut_acc_1",
    createdAt: millisToTimestamp(1700000000000),
    updatedAt: millisToTimestamp(1700000000000),
  });

  // Categoría personal
  docs.set(`users/${ownerUid}/categories/cat_1`, {
    schemaVersion: 1,
    ownerId: ownerUid,
    type: "expense",
    name: "Almuerzos",
    iconKey: "utensils",
    color: "#E74C3C",
    state: "active",
    seedKey: "food",
    sortOrder: 1,
    revision: 1,
    lastMutationId: "mut_cat_1",
    createdAt: millisToTimestamp(1700000000000),
    updatedAt: millisToTimestamp(1700000000000),
  });

  // Movimiento propio activo
  docs.set("movements/mov_own_1", {
    schemaVersion: 1,
    ownerId: ownerUid,
    type: "expense",
    title: "Almuerzo de trabajo",
    amount: 35000,
    categoryId: "cat_1",
    accountId: "acc_1",
    note: "Restaurante centro",
    occurredAt: millisToTimestamp(1700005000000),
    lifecycleState: "active",
    trashedAt: null,
    purgeAfter: null,
    householdId: null,
    householdCategoryId: null,
    revision: 1,
    lastMutationId: "mut_mov_1",
    createdAt: millisToTimestamp(1700005000000),
    updatedAt: millisToTimestamp(1700005000000),
  });

  // Movimiento propio en Papelera
  docs.set("movements/mov_own_trashed", {
    schemaVersion: 1,
    ownerId: ownerUid,
    type: "expense",
    title: "Gasto descartado",
    amount: 12000,
    categoryId: "cat_1",
    accountId: "acc_1",
    note: "",
    occurredAt: millisToTimestamp(1700004000000),
    lifecycleState: "trashed",
    trashedAt: millisToTimestamp(1700010000000),
    purgeAfter: millisToTimestamp(1702602000000),
    householdId: null,
    householdCategoryId: null,
    revision: 2,
    lastMutationId: "mut_mov_trash",
    createdAt: millisToTimestamp(1700004000000),
    updatedAt: millisToTimestamp(1700010000000),
  });

  // Movimiento compartido de la pareja en el Hogar
  docs.set("movements/mov_partner_shared", {
    schemaVersion: 1,
    ownerId: partnerUid,
    type: "expense",
    title: "Mercado compartido",
    amount: 185000,
    categoryId: "partner_cat_food",
    accountId: "partner_acc_bancolombia",
    note: "Éxito quincena",
    occurredAt: millisToTimestamp(1700006000000),
    lifecycleState: "active",
    trashedAt: null,
    purgeAfter: null,
    householdId, // Asociado al Hogar
    householdCategoryId: "hh_cat_groceries",
    revision: 1,
    lastMutationId: "mut_partner_shared",
    createdAt: millisToTimestamp(1700006000000),
    updatedAt: millisToTimestamp(1700006000000),
  });

  // MOVIMIENTO PRIVADO DE LA PAREJA (NUNCA DEBE APARECER EN EL RESPALDO)
  docs.set("movements/mov_partner_private", {
    schemaVersion: 1,
    ownerId: partnerUid,
    type: "expense",
    title: "Gasto ultra privado de la pareja",
    amount: 999000,
    categoryId: "partner_cat_private",
    accountId: "partner_acc_secret",
    note: "Regalo secreto",
    occurredAt: millisToTimestamp(1700007000000),
    lifecycleState: "active",
    trashedAt: null,
    purgeAfter: null,
    householdId: null, // PRIVADO: NO pertenece al Hogar
    householdCategoryId: null,
    revision: 1,
    lastMutationId: "mut_partner_priv",
    createdAt: millisToTimestamp(1700007000000),
    updatedAt: millisToTimestamp(1700007000000),
  });

  // Documento de Hogar
  docs.set(`households/${householdId}`, {
    schemaVersion: 1,
    status: "active",
    name: "Nuestro Hogar",
    memberAId: ownerUid,
    memberBId: partnerUid,
    activeInviteId: "inv_123",
    catalogVersion: 1,
    cleanupPhase: "none",
    revision: 4,
    lastMutationId: "mut_hh_1",
    createdAt: millisToTimestamp(1700000000000),
    updatedAt: millisToTimestamp(1700002000000),
  });

  // Integrantes del Hogar
  docs.set(`households/${householdId}/members/${ownerUid}`, {
    schemaVersion: 1,
    userId: ownerUid,
    state: "active",
    displayName: "Felipe",
    photoUrl: "https://example.com/felipe.png",
    joinedAt: millisToTimestamp(1700000000000),
    leftAt: null,
    revision: 1,
    lastMutationId: "mut_mem_1",
    updatedAt: millisToTimestamp(1700000000000),
  });

  docs.set(`households/${householdId}/members/${partnerUid}`, {
    schemaVersion: 1,
    userId: partnerUid,
    state: "active",
    displayName: "Pareja",
    photoUrl: "https://example.com/partner.png",
    joinedAt: millisToTimestamp(1700001000000),
    leftAt: null,
    revision: 1,
    lastMutationId: "mut_mem_2",
    updatedAt: millisToTimestamp(1700001000000),
  });

  // Categoría de Hogar
  docs.set(`households/${householdId}/expenseCategories/hh_cat_groceries`, {
    schemaVersion: 1,
    householdId,
    name: "Mercado y Comida",
    iconKey: "shopping-cart",
    color: "#2ECC71",
    state: "active",
    seedKey: "groceries",
    sortOrder: 1,
    createdBy: ownerUid,
    revision: 1,
    lastMutationId: "mut_hh_cat_1",
    createdAt: millisToTimestamp(1700000000000),
    updatedAt: millisToTimestamp(1700000000000),
  });

  // Category mapping
  docs.set(`households/${householdId}/categoryMappings/${ownerUid}__cat_1`, {
    schemaVersion: 1,
    householdId,
    ownerId: ownerUid,
    personalCategoryId: "cat_1",
    householdCategoryId: "hh_cat_groceries",
    updatedBy: ownerUid,
    revision: 1,
    lastMutationId: "mut_map_1",
    createdAt: millisToTimestamp(1700000000000),
    updatedAt: millisToTimestamp(1700000000000),
  });

  // Member category label
  docs.set(`households/${householdId}/memberCategoryLabels/${ownerUid}__cat_1`, {
    schemaVersion: 1,
    householdId,
    ownerId: ownerUid,
    categoryId: "cat_1",
    type: "expense",
    name: "Almuerzos",
    iconKey: "utensils",
    color: "#E74C3C",
    revision: 1,
    lastMutationId: "mut_mcl_1",
    createdAt: millisToTimestamp(1700000000000),
    updatedAt: millisToTimestamp(1700000000000),
  });

  // Member account label
  docs.set(`households/${householdId}/memberAccountLabels/${ownerUid}__acc_1`, {
    schemaVersion: 1,
    householdId,
    ownerId: ownerUid,
    accountId: "acc_1",
    name: "Nequi",
    type: "digital_wallet",
    iconType: "generic",
    iconKey: "wallet",
    color: "#4A90E2",
    revision: 1,
    lastMutationId: "mut_mal_1",
    createdAt: millisToTimestamp(1700000000000),
    updatedAt: millisToTimestamp(1700000000000),
  });

  // Household invite
  docs.set("householdInvites/inv_123", {
    schemaVersion: 1,
    householdId,
    createdBy: ownerUid,
    state: "used",
    createdAt: millisToTimestamp(1700000500000),
    expiresAt: millisToTimestamp(1700605300000),
    usedBy: partnerUid,
    usedAt: millisToTimestamp(1700001000000),
    reservedForUid: null,
    revision: 2,
    lastMutationId: "mut_inv_1",
    updatedAt: millisToTimestamp(1700001000000),
  });

  return docs;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function runBackupTests() {
  const OWNER_UID = "user_felipe_123456";
  const PARTNER_UID = "user_partner_999";
  const HOUSEHOLD_ID = "household_alpha_001";
  const fixedNowMillis = 1788269714000; // 2026-09-01 aprox

  const docs = createSampleFirestoreData(OWNER_UID, PARTNER_UID, HOUSEHOLD_ID);
  const gateway = new InMemoryBackupGateway(docs);

  // 1. Ejecutar exportación
  const result = await executeMplusBackupExport(gateway, OWNER_UID, {
    nowMillis: fixedNowMillis,
  });

  // ── Aserción 1: Formato exacto de nombre de archivo ZIP ─────────────────────
  assert.match(
    result.zipFileName,
    /^finanzas-m-plus-backup_\d{8}-\d{6}_bogota_user_fel\.zip$/,
    "El nombre del ZIP debe cumplir finanzas-m-plus-backup_{yyyyMMdd-HHmmss}_bogota_{uidCorto}.zip",
  );
  console.log("  ✓ Formato de nombre de ZIP válido:", result.zipFileName);

  // ── Aserción 2: Los 14 archivos exactos deben estar presentes ────────────────
  assert.equal(Object.keys(result.files).length, 14, "Deben generarse exactamente 14 archivos");
  for (const requiredName of BACKUP_FILES) {
    assert.ok(result.files[requiredName] !== undefined, `Falta el archivo ${requiredName}`);
  }
  console.log("  ✓ Los 14 archivos obligatorios están en filesRecord");

  // ── Aserción 3: Descompresión física del ZIP generado con fflate ─────────────
  const unzipped = unzipSync(result.zipBuffer);
  const unzippedFileNames = Object.keys(unzipped);
  assert.equal(unzippedFileNames.length, 14, "El archivo ZIP físico debe contener 14 entradas");
  for (const requiredName of BACKUP_FILES) {
    assert.ok(unzipped[requiredName] !== undefined, `El ZIP físico no contiene ${requiredName}`);
  }
  console.log("  ✓ El ZIP binario descomprime 14 archivos físicamente idénticos");

  // ── Aserción 4: Privacidad - Inclusión de compartido y EXCLUSIÓN de privado ──
  const movementsCsv = result.files["movements.csv"];
  assert.ok(
    movementsCsv.includes("Almuerzo de trabajo"),
    "Debe incluir movimiento propio activo",
  );
  assert.ok(
    movementsCsv.includes("Gasto descartado"),
    "Debe incluir movimiento propio en papelera",
  );
  assert.ok(
    movementsCsv.includes("Mercado compartido"),
    "Debe incluir movimiento compartido de la pareja en el Hogar",
  );
  assert.ok(
    !movementsCsv.includes("Gasto ultra privado de la pareja"),
    "ESTRICTO: NO debe incluir ningún movimiento privado de la pareja",
  );
  assert.ok(
    !result.files["snapshot.json"].includes("Gasto ultra privado de la pareja"),
    "ESTRICTO: snapshot.json NO debe incluir ningún movimiento privado de la pareja",
  );
  console.log("  ✓ Regla de privacidad: pareja compartida INCLUIDA, pareja privada EXCLUIDA");

  // ── Aserción 5: Montos enteros en CSV (COP) ──────────────────────────────────
  assert.ok(movementsCsv.includes(",35000,"), "Monto debe ser entero");
  assert.ok(movementsCsv.includes(",185000,"), "Monto debe ser entero");
  assert.ok(!movementsCsv.includes(".00"), "No debe haber decimales en montos CSV");
  console.log("  ✓ Montos en CSV son enteros puros");

  // ── Aserción 6: Verificación de MANIFEST.json ────────────────────────────────
  const manifest = result.manifest;
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.product, "finanzas-m-plus");
  assert.equal(manifest.app, "finanzas-m-web");
  assert.equal(manifest.ownerUid, OWNER_UID);
  assert.equal(manifest.householdId, HOUSEHOLD_ID);
  assert.equal(manifest.counts.profile, 1);
  assert.equal(manifest.counts.accounts, 1);
  assert.equal(manifest.counts.categories, 1);
  assert.equal(manifest.counts.movements, 3); // 2 propios + 1 compartido
  assert.equal(manifest.counts.ownMovements, 2);
  assert.equal(manifest.counts.partnerSharedMovements, 1);
  assert.equal(manifest.counts.household, 1);
  assert.equal(manifest.counts.members, 2);
  assert.equal(manifest.counts.householdCategories, 1);
  assert.equal(manifest.counts.categoryMappings, 1);
  assert.equal(manifest.counts.memberCategoryLabels, 1);
  assert.equal(manifest.counts.memberAccountLabels, 1);
  assert.equal(manifest.counts.householdInvites, 1);
  assert.ok(manifest.notes.includes("closureApprovals omitidos (DEC-077)"));
  console.log("  ✓ MANIFEST.json tiene todos los campos, conteos exactos y nota DEC-077");

  // ── Aserción 7: Verbatim RESTORE.md ─────────────────────────────────────────
  const restoreMd = result.files["RESTORE.md"];
  assert.equal(restoreMd, RESTORE_MD_CONTENT);
  assert.ok(restoreMd.includes("# Restaurar Finanzas M+"), "Debe contener encabezado H1");
  assert.ok(restoreMd.includes("## Alcance"), "Debe contener H2 Alcance");
  assert.ok(restoreMd.includes("## Fuente de verdad"), "Debe contener H2 Fuente de verdad");
  assert.ok(restoreMd.includes("## Cómo debe trabajar un agente"), "Debe contener H2 Cómo debe trabajar un agente");
  assert.ok(restoreMd.includes("## Límites"), "Debe contener H2 Límites");
  assert.ok(restoreMd.includes("`snapshot.json` = foto exacta para replace."), "Debe tener backtick en snapshot.json");
  assert.ok(restoreMd.includes("`CSV` = vista humana; si discrepa, gana `snapshot.json`."), "Debe tener backtick en CSV");
  assert.ok(restoreMd.includes("NO incluye: movements personales privados de la pareja"));
  console.log("  ✓ RESTORE.md coincide verbatim con el contrato Android (encabezados H1/H2, bullets y backticks)");

  // ── Aserción 8: Usuario Solo sin Hogar ───────────────────────────────────────
  const soloUid = "user_solo_456";
  const soloDocs = new Map<string, Record<string, unknown>>();
  soloDocs.set(`users/${soloUid}`, {
    schemaVersion: 1,
    status: "ready",
    householdId: null, // Sin Hogar
    householdMembershipState: "none",
    personalCatalogVersion: 1,
    revision: 1,
    lastMutationId: "mut_solo_1",
    createdAt: millisToTimestamp(1700000000000),
    updatedAt: millisToTimestamp(1700000000000),
    resetRequestedAt: null,
  });

  const soloGateway = new InMemoryBackupGateway(soloDocs);
  const soloResult = await executeMplusBackupExport(soloGateway, soloUid, { nowMillis: fixedNowMillis });
  assert.equal(soloResult.manifest.householdId, null);
  assert.equal(soloResult.manifest.counts.household, 0);
  assert.equal(soloResult.manifest.counts.members, 0);
  assert.equal(soloResult.snapshot.household, null);
  assert.ok(soloResult.files["household.csv"].startsWith("id,schemaVersion"));
  console.log("  ✓ Usuario solo sin Hogar genera CSVs vacíos con cabecera y conteos en 0");

  // ── Aserción 9: Fallo en permisos de invitaciones (Best-effort con nota) ──────
  const failInviteGateway = new InMemoryBackupGateway(docs, true);
  const failInviteResult = await executeMplusBackupExport(failInviteGateway, OWNER_UID, {
    nowMillis: fixedNowMillis,
  });
  assert.equal(failInviteResult.manifest.counts.householdInvites, 0);
  assert.ok(failInviteResult.files["household_invites.csv"].startsWith("id,schemaVersion"));
  console.log("  ✓ Fallo de invitaciones produce CSV con cabecera sin abortar la exportación");

  // ── Aserción 10: Validación de UID inválido ─────────────────────────────────
  await assert.rejects(
    async () => executeMplusBackupExport(gateway, ""),
    MplusBackupError,
    "Debe rechazar UID vacío",
  );
  console.log("  ✓ Rechazo de UID inválido");

  // ── Aserción 11: Comprobación Estructural (CERO import/restore en UI) ────────
  const srcDir = path.resolve(process.cwd(), "src");
  const checkFilesRecursively = (dir: string): string[] => {
    let results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(checkFilesRecursively(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        results.push(fullPath);
      }
    }
    return results;
  };

  const allSourceFiles = checkFilesRecursively(srcDir);
  for (const filePath of allSourceFiles) {
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(
      !content.includes("importFromBackup") && !content.includes("restoreFromZip"),
      `Se encontró función de importación no autorizada en ${filePath}`,
    );
  }
  console.log("  ✓ Comprobación estructural: Cero import-from-backup o restoreFromZip en el código fuente");

  console.log("Todas las pruebas de Respaldo en ZIP pasaron exitosamente.\n");
}

runBackupTests().catch((err) => {
  console.error("Error en pruebas de respaldo:", err);
  process.exit(1);
});
