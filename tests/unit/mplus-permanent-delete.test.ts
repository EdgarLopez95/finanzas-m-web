import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MovementPreconditionError } from "../../src/features/movements/services/movement-mutations";
import { resolveDeletePermanentlyResult } from "../../src/features/movements/hooks/use-movement-mutations";
import type { MplusMutationOutcome } from "../../src/lib/mplus/mutation-runner";

console.log("Running unit tests for mplus-permanent-delete.test.ts...");

export function runPermanentDeleteTests(): void {
  // 1. Guardrails sobre movements-view.tsx
  const movementsViewSource = readFileSync(
    path.join(__dirname, "..", "..", "src", "features", "movements", "components", "movements-view.tsx"),
    "utf8",
  );

  assert.ok(
    movementsViewSource.includes("<PermanentDeleteConfirmDialog"),
    "movements-view.tsx debe montar PermanentDeleteConfirmDialog",
  );
  assert.ok(
    movementsViewSource.includes("onDeletePermanently"),
    "TrashRowActions debe recibir onDeletePermanently",
  );
  assert.ok(
    movementsViewSource.includes('aria-label="Eliminar permanentemente"'),
    "Debe existir botón con aria-label 'Eliminar permanentemente'",
  );
  assert.ok(
    movementsViewSource.includes("Restaurar"),
    "La acción de Restaurar debe seguir presente en la fila de Papelera",
  );
  assert.ok(
    movementsViewSource.includes("Los movimientos eliminados aparecen aquí durante 30 días."),
    "EmptyState de Papelera debe tener paridad de microcopy con Android (30 días)",
  );

  // Guardrail específico mini-cierre ítem 4b: NO usar mutations.feedback (stale post-await)
  const handlerStart = movementsViewSource.indexOf("const handleConfirmPermanentDelete = useCallback(async () => {");
  assert.ok(handlerStart !== -1, "handleConfirmPermanentDelete debe existir en movements-view.tsx");
  const handlerEnd = movementsViewSource.indexOf("}, [isDeletingPermanently, mutations, permanentDeleteTarget]);");
  assert.ok(handlerEnd !== -1, "Cierre de handleConfirmPermanentDelete debe existir");
  const handlerSource = movementsViewSource.slice(handlerStart, handlerEnd);

  assert.ok(
    !handlerSource.includes("mutations.feedback"),
    "handleConfirmPermanentDelete NO debe leer mutations.feedback porque queda stale tras await",
  );
  assert.ok(
    handlerSource.includes("const result = await mutations.deletePermanently(permanentDeleteTarget)") ||
    handlerSource.includes("const res = await mutations.deletePermanently(permanentDeleteTarget)"),
    "handleConfirmPermanentDelete debe capturar el resultado retornado por deletePermanently",
  );
  assert.ok(
    handlerSource.includes("result.ok") || handlerSource.includes("res.ok"),
    "handleConfirmPermanentDelete debe verificar el flag ok del resultado",
  );
  assert.ok(
    handlerSource.includes("result.message") || handlerSource.includes("res.message"),
    "handleConfirmPermanentDelete debe propagar el mensaje de error retornado por la mutación",
  );

  // 2. Guardrails sobre permanent-delete-confirm-dialog.tsx
  const dialogSource = readFileSync(
    path.join(__dirname, "..", "..", "src", "features", "movements", "components", "permanent-delete-confirm-dialog.tsx"),
    "utf8",
  );

  assert.ok(
    dialogSource.includes("¿Eliminar permanentemente?"),
    "El diálogo debe contener el título canónico '¿Eliminar permanentemente?'",
  );
  assert.ok(
    dialogSource.includes("Este movimiento se eliminará para siempre y no se podrá recuperar."),
    "El diálogo debe contener la advertencia canónica de Android",
  );
  assert.ok(
    dialogSource.includes("Eliminando…"),
    "El botón primario debe mostrar 'Eliminando…' durante la mutación",
  );
  assert.ok(
    dialogSource.includes("Cancelar"),
    "El botón secundario debe ser 'Cancelar'",
  );
  assert.ok(
    dialogSource.includes("isDeleting ? () => {} : onCancel"),
    "El diálogo no debe permitir descarte por Escape mientras isDeleting es true",
  );
  assert.ok(
    dialogSource.includes("!isDeleting"),
    "El clic en backdrop no debe descartar mientras isDeleting es true",
  );

  // 3. Tests unitarios para resolveDeletePermanentlyResult (retorno enriquecido { ok, message })
  // 3.1 Éxito
  const successOutcome: MplusMutationOutcome<string> = {
    kind: "success",
    value: "mov-123",
    replayed: false,
  };
  const resSuccess = resolveDeletePermanentlyResult(successOutcome);
  assert.deepEqual(resSuccess, { ok: true }, "Outcome de éxito debe retornar { ok: true }");

  // 3.2 Conflicto de concurrencia
  const conflictOutcome: MplusMutationOutcome<string> = {
    kind: "conflict",
    conflict: {
      resource: "movements",
      id: "mov-123",
      baseRevision: 1,
      remoteRevision: 2,
      remoteSnapshot: null,
    },
  };
  const resConflict = resolveDeletePermanentlyResult(conflictOutcome);
  assert.equal(resConflict.ok, false, "Conflicto debe dar ok: false");
  assert.ok(
    resConflict.message?.includes("Alguien más cambió este movimiento"),
    "Conflicto debe retornar el copy canónico de conflicto",
  );

  // 3.3 Red no disponible
  const unavailableOutcome: MplusMutationOutcome<string> = {
    kind: "unavailable",
    code: "unavailable",
    message: "Network unreachable",
  };
  const resUnavailable = resolveDeletePermanentlyResult(unavailableOutcome);
  assert.equal(resUnavailable.ok, false, "Unavailable debe dar ok: false");
  assert.ok(
    resUnavailable.message?.includes("No hay conexión con el servidor"),
    "Unavailable debe retornar el copy de modo offline",
  );

  // 3.4 Rechazo remoto / reglas de Firestore
  const rejectedOutcome: MplusMutationOutcome<string> = {
    kind: "rejected",
    code: "permission-denied",
    message: "Missing or insufficient permissions.",
  };
  const resRejected = resolveDeletePermanentlyResult(rejectedOutcome);
  assert.deepEqual(
    resRejected,
    { ok: false, message: "Missing or insufficient permissions." },
    "Mutación rechazada debe preservar el mensaje de la operación remota",
  );

  // 3.5 Precondición violada (ej. no está en papelera)
  const preconditionErr = new MovementPreconditionError(
    "Solo se pueden eliminar permanentemente movimientos en la Papelera.",
  );
  const resPrecondition = resolveDeletePermanentlyResult(null, preconditionErr);
  assert.deepEqual(
    resPrecondition,
    {
      ok: false,
      message: "Solo se pueden eliminar permanentemente movimientos en la Papelera.",
    },
    "Precondición fallida capturada debe exponer su mensaje síncronamente",
  );

  // 3.6 Excepción genérica capturada
  const genericErr = new Error("Fallo de infraestructura local.");
  const resGeneric = resolveDeletePermanentlyResult(null, genericErr);
  assert.deepEqual(
    resGeneric,
    { ok: false, message: "Fallo de infraestructura local." },
    "Excepción genérica debe exponer su mensaje al diálogo",
  );

  // 3.7 Fallback cuando no hay mensaje
  const resFallback = resolveDeletePermanentlyResult(null, undefined);
  assert.deepEqual(
    resFallback,
    { ok: false, message: "No se pudo eliminar el movimiento." },
    "Sin error ni outcome debe entregar mensaje fallback seguro",
  );

  console.log("OK mplus-permanent-delete");
}

runPermanentDeleteTests();
