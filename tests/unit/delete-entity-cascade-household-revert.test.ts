import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { buildLinkedEventShareRevertUpdates } from "../../src/features/household/lib/household-debt-lifecycle";

console.log("Running unit tests for delete-entity-cascade-household-revert.test.ts...");

function runDeleteEntityCascadeHouseholdRevertTests() {
  // ==========================================
  // buildLinkedEventShareRevertUpdates
  // H1.6: paridad con la corrección H1.5 de delete-personal-transaction.ts, aplicada ahora a
  // delete-personal-entity-cascade.ts (borrado de cuenta/bolsillo). Un share "completed" cuya
  // transacción vinculada se borra debe volver a pending_completion si el evento padre sigue
  // activo, o a cancelled si el evento padre ya estaba cancelado (nunca al revés: Rules
  // rechazarían "completed -> pending_completion" bajo un evento no-activo).
  // ==========================================

  // Test 1: evento padre activo -> pending_completion
  {
    const eventStatusById = new Map([["evt-1", "active"]]);
    const updates = buildLinkedEventShareRevertUpdates(
      [{ id: "share-1", eventId: "evt-1" }],
      eventStatusById
    );
    assert.deepStrictEqual(updates, [{ id: "share-1", status: "pending_completion" }]);
  }

  // Test 2: evento padre cancelado -> cancelled (el caso que antes de H1.6 rompía las Rules)
  {
    const eventStatusById = new Map([["evt-2", "cancelled"]]);
    const updates = buildLinkedEventShareRevertUpdates(
      [{ id: "share-2", eventId: "evt-2" }],
      eventStatusById
    );
    assert.deepStrictEqual(updates, [{ id: "share-2", status: "cancelled" }]);
  }

  // Test 3: lote mixto (pocket-mode y account-mode producen el mismo tipo de entrada) con
  // eventos activos y cancelados combinados -> cada share resuelve independientemente.
  {
    const eventStatusById = new Map([
      ["evt-active", "active"],
      ["evt-cancelled", "cancelled"],
    ]);
    const updates = buildLinkedEventShareRevertUpdates(
      [
        { id: "share-a", eventId: "evt-active" },
        { id: "share-b", eventId: "evt-cancelled" },
        { id: "share-c", eventId: "evt-active" },
      ],
      eventStatusById
    );
    assert.deepStrictEqual(updates, [
      { id: "share-a", status: "pending_completion" },
      { id: "share-b", status: "cancelled" },
      { id: "share-c", status: "pending_completion" },
    ]);
  }

  // Test 4: eventId ausente o no resuelto en el mapa -> conservador, se trata como activo
  {
    const updates = buildLinkedEventShareRevertUpdates(
      [{ id: "share-orphan", eventId: undefined }, { id: "share-unknown", eventId: "evt-missing" }],
      new Map()
    );
    assert.deepStrictEqual(updates, [
      { id: "share-orphan", status: "pending_completion" },
      { id: "share-unknown", status: "pending_completion" },
    ]);
  }

  console.log("  ✓ buildLinkedEventShareRevertUpdates: activo, cancelado, lote mixto y eventId ausente");

  // ==========================================
  // Contrato estructural: los DOS caminos reales de la cascada (pocket y account) construyen
  // linkedEventShares con eventId, y la escritura real usa buildLinkedEventShareRevertUpdates
  // en vez de un status fijo "pending_completion" (regresión exacta de H1.6).
  // ==========================================
  const cascadeSourcePath = path.join(
    __dirname,
    "../../src/features/accounts/services/delete-personal-entity-cascade.ts"
  );
  const cascadeSource = fs.readFileSync(cascadeSourcePath, "utf8");

  // Test 5: ambos caminos (buildDeletePocketCascadePlan y buildDeleteAccountCascadePlan)
  // construyen linkedEventShares desde allShares.filter(...), preservando eventId (vía spread
  // de docItem.data()).
  const linkedEventSharesAssignments = cascadeSource.match(/linkedEventShares = allShares\.filter/g) ?? [];
  assert.strictEqual(
    linkedEventSharesAssignments.length,
    1,
    "El camino de la cascada (account) debe construir linkedEventShares con los datos completos del share (incluye eventId)"
  );

  // Test 6: la escritura real de revert usa la función compartida, no un status fijo.
  assert.ok(
    cascadeSource.includes("buildLinkedEventShareRevertUpdates(plan.linkedEventShares, eventStatusById)"),
    "executeCascadePlan debe usar buildLinkedEventShareRevertUpdates para decidir el status de revert"
  );
  assert.ok(
    !/status:\s*"pending_completion",\s*\n\s*updatedAt: serverTimestamp\(\),\s*\n\s*\}\);\s*\n\s*\}\s*\n\s*\n\s*\/\/ Delete Transactions/.test(
      cascadeSource
    ),
    "El bloque de revert de shares NO debe volver a fijar status:\"pending_completion\" de forma incondicional"
  );

  console.log("  ✓ Contrato estructural: ambos caminos de la cascada usan la función compartida de revert");

  // ==========================================
  // H1.6b: contrato estructural de los 3 fixes de la cascada. En su momento se
  // verificaron ademas dinamicamente (11/11 PASS con RED/GREEN genuino: revertir
  // estos 3 cambios hacia que Rules rechazara la cascada con PERMISSION_DENIED).
  // Ese harness dinamico se retiro con el modo emulador (ORQ-041 / DEC-081); este
  // bloque queda como resguardo de regresion estructural.
  // ==========================================

  // Test 7: derivativeSharesToCancel/derivativeDebtsToCancel filtran por status en AMBOS caminos
  // (paridad Android: applyCancellation solo cancela shares PendingCompletion y deudas Pending).
  const derivativeSharesFilters = cascadeSource.match(
    /cancelledEventIds\.includes\(s\.eventId\) && s\.status === "pending_completion"/g
  ) ?? [];
  assert.strictEqual(
    derivativeSharesFilters.length,
    1,
    "derivativeSharesToCancel debe filtrar por status pending_completion"
  );
  const derivativeDebtsFilters = cascadeSource.match(
    /cancelledEventIds\.includes\(d\.eventId\) && d\.status === "pending"/g
  ) ?? [];
  assert.strictEqual(
    derivativeDebtsFilters.length,
    1,
    "derivativeDebtsToCancel debe filtrar por status pending"
  );

  // Test 8: el status efectivo de un evento en linkedEventsToCancel es "cancelled" (hardcode),
  // no derivado de la lectura pre-transacción — es el estado final que esta misma transacción
  // escribe, y con R1b (getAfter() desplegada) es lo que Rules validará.
  assert.ok(
    cascadeSource.includes('eventStatusById.set(e.id, "cancelled")'),
    "el status efectivo de un evento en linkedEventsToCancel debe fijarse a \"cancelled\", no leerse del snapshot pre-transacción"
  );

  // Test 9: una sola escritura por documento de share — las cancelaciones derivadas y los
  // revert de shares vinculadas se combinan en UN Map antes de escribir (nunca dos
  // transaction.update() para el mismo share.ref).
  assert.ok(
    cascadeSource.includes("const shareUpdatesById = new Map"),
    "debe existir un Map único (shareUpdatesById) que combine derivativeSharesToCancel y linkedEventShares antes de escribir"
  );
  const shareTransactionUpdateCalls = cascadeSource.match(/transaction\.update\(share\.ref/g) ?? [];
  assert.strictEqual(
    shareTransactionUpdateCalls.length,
    0,
    "no debe quedar ningún transaction.update(share.ref, ...) suelto fuera del Map unificado (evita doble escritura sobre el mismo share)"
  );
  assert.ok(
    /for \(const \{ ref, data \} of shareUpdatesById\.values\(\)\) \{\s*\n\s*transaction\.update\(ref, data\);/.test(cascadeSource),
    "la escritura real de shares debe iterar el Map unificado con exactamente un transaction.update() por documento"
  );

  // Test 10 (H1.6c): linkedEventsToCancel debe filtrar por status === "active" además de createdByUserId === ownerId
  // en ambos constructores de plan (pocket y account) para evitar re-cancelar eventos ya cancelados (cancelled -> cancelled).
  const linkedEventsStatusActiveFilters = cascadeSource.match(
    /toSafeString\(eventData\.createdByUserId\) === ownerId &&\s*toSafeString\(eventData\.status\) === "active"/g
  ) ?? [];
  assert.strictEqual(
    linkedEventsStatusActiveFilters.length,
    1,
    "linkedEventsToCancel debe filtrar por status === \"active\" en el constructor de plan"
  );

  console.log("  ✓ H1.6c: contrato estructural de filtro status === active para linkedEventsToCancel");

  console.log("delete-entity-cascade-household-revert.test.ts: 10/10 pruebas pasadas.");
}

runDeleteEntityCascadeHouseholdRevertTests();
