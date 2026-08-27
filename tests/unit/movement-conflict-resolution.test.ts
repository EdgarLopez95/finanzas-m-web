import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { movementFromFirestore } from "../../src/lib/mplus/converters";
import type { MplusMovement } from "../../src/lib/mplus/models";
import { millisToTimestamp } from "../../src/lib/mplus/converters";

/**
 * Pruebas de resolución de conflictos OCC (spec §22.2).
 *
 * Verifica:
 * 1. Deserialización segura del snapshot remoto recibido en el conflicto.
 * 2. NO refrescar silenciosamente en ramas de conflicto (previene last-write-wins).
 * 3. Estructura y contrato del diálogo de conflicto (MovementConflictDialog).
 * 4. Manejo de elección del usuario: conservar local (reintento con nueva revisión base)
 *    vs conservar servidor (adopción del snapshot remoto).
 * 5. Ausencia de refrescos silenciosos en vistas de cuentas y categorías.
 */

export const runMovementConflictResolutionTests = async (): Promise<void> => {
  const root = path.resolve(__dirname, "../..");
  const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

  const NOW = Date.UTC(2026, 7, 27, 12, 0, 0);

  // 1. Deserialización de snapshot remoto de conflicto
  const rawRemoteData = {
    schemaVersion: 1,
    ownerId: "user-1",
    householdId: "house-1",
    householdCategoryId: "hh-cat-1",
    type: "expense",
    amount: 150000,
    title: "Mercado D1 - Modificado por Pareja",
    note: "Compramos frutas y verduras",
    categoryId: "cat-groceries",
    accountId: "acc-nequi",
    occurredAt: millisToTimestamp(NOW),
    dayKey: "2026-08-27",
    monthKey: "2026-08",
    yearKey: "2026",
    lifecycleState: "active",
    trashedAt: null,
    purgeAfter: null,
    revision: 5,
    lastMutationId: "mut-remote-999",
    createdAt: millisToTimestamp(NOW - 3600000),
    updatedAt: millisToTimestamp(NOW),
  };

  const parsedRemote = movementFromFirestore("mov-123", rawRemoteData as never);
  assert.equal(parsedRemote.id, "mov-123");
  assert.equal(parsedRemote.revision, 5);
  assert.equal(parsedRemote.title, "Mercado D1 - Modificado por Pareja");
  assert.equal(parsedRemote.amount, 150000);
  assert.equal(parsedRemote.accountId, "acc-nequi");
  assert.equal(parsedRemote.householdId, "house-1");

  // 2. Verificación estricta de NO refresco silencioso en use-movement-mutations.ts
  const hookSource = read("src/features/movements/hooks/use-movement-mutations.ts");
  assert.ok(
    hookSource.includes("conflictState"),
    "useMovementMutations debe exponer conflictState",
  );
  assert.ok(
    hookSource.includes("resolveConflictKeepServer"),
    "useMovementMutations debe exponer resolveConflictKeepServer",
  );
  assert.ok(
    hookSource.includes("resolveConflictKeepLocal"),
    "useMovementMutations debe exponer resolveConflictKeepLocal",
  );
  assert.ok(
    hookSource.includes("movementFromFirestore"),
    "useMovementMutations debe deserializar el snapshot remoto de Firestore",
  );

  // LA PRUEBA CLAVE: run() no puede llamar a refresh() cuando outcome.kind === "conflict".
  // Si alguien añade `if (outcome.kind === "conflict") await refresh()` o similar, debe fallar.
  assert.equal(
    /outcome\.kind\s*===\s*["']conflict["'][\s\S]{0,80}refresh\(/.test(hookSource),
    false,
    "run() NO puede llamar a refresh() en la rama de conflicto: pisaría el store antes de que el usuario elija (spec §22.2)",
  );

  // 3. Verificación de ausencia de refrescos silenciosos en vistas de Cuentas y Categorías
  const accountsViewSource = read("src/features/accounts/components/mplus-accounts-view.tsx");
  assert.equal(
    /outcome\.kind\s*===\s*["']conflict["'][\s\S]{0,80}refresh\(/.test(accountsViewSource),
    false,
    "mplus-accounts-view NO debe hacer refresh silencioso en conflicto",
  );

  const accountDetailViewSource = read("src/features/accounts/components/mplus-account-detail-view.tsx");
  assert.equal(
    /outcome\.kind\s*===\s*["']conflict["'][\s\S]{0,80}refresh\(/.test(accountDetailViewSource),
    false,
    "mplus-account-detail-view NO debe hacer refresh silencioso en conflicto",
  );

  const categoriesViewSource = read("src/features/categories/components/mplus-categories-view.tsx");
  assert.equal(
    /outcome\.kind\s*===\s*["']conflict["'][\s\S]{0,80}refresh\(/.test(categoriesViewSource),
    false,
    "mplus-categories-view NO debe hacer refresh silencioso en conflicto",
  );

  // 4. Verificación estructural de MovementConflictDialog
  const dialogSource = read("src/features/movements/components/movement-conflict-dialog.tsx");
  assert.ok(
    dialogSource.includes("Tu versión (local)"),
    "MovementConflictDialog debe mostrar la versión local",
  );
  assert.ok(
    dialogSource.includes("Versión del servidor"),
    "MovementConflictDialog debe mostrar la versión del servidor",
  );
  assert.ok(
    dialogSource.includes("Conservar mi versión"),
    "MovementConflictDialog debe ofrecer la opción de conservar versión local",
  );
  assert.ok(
    dialogSource.includes("Conservar versión del servidor"),
    "MovementConflictDialog debe ofrecer la opción de conservar versión del servidor",
  );
  assert.ok(
    dialogSource.includes("onKeepLocal") && dialogSource.includes("onKeepServer"),
    "MovementConflictDialog debe conectar las acciones de resolución",
  );

  // 5. Verificación de montaje en MovementComposerDialog
  const composerSource = read("src/features/movements/components/movement-composer-dialog.tsx");
  assert.ok(
    composerSource.includes("MovementConflictDialog"),
    "MovementComposerDialog debe montar MovementConflictDialog",
  );
  assert.ok(
    composerSource.includes("mutations.conflictState"),
    "MovementComposerDialog debe pasar conflictState al diálogo",
  );
  assert.ok(
    composerSource.includes("resolveConflictKeepLocal") &&
      composerSource.includes("resolveConflictKeepServer"),
    "MovementComposerDialog debe cablear los métodos de resolución",
  );

  console.log("movement-conflict-resolution.test.ts: OK");
};

void runMovementConflictResolutionTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
