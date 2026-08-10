import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  discoverHouseholdsForCurrentUser,
  type DiscoverHouseholdsDeps,
} from "../../src/features/qa-reset/services/discover-households-for-current-user";

console.log("Running unit tests for discover-households-for-current-user.test.ts...");

// ==========================================
// Item 1 del contrato corregido: el descubrimiento debe funcionar aunque
// `activeHouseholdId` esté vacío/apunte a un Hogar borrado — no depende de
// ese campo en absoluto, solo de la query real por membresía.
// ==========================================
async function runDiscoversRegardlessOfActiveHouseholdIdTest() {
  const deps: DiscoverHouseholdsDeps = {
    queryMemberHouseholds: async (uid) => {
      assert.equal(uid, "gerson");
      return [{ id: "hh-residual", ownerId: "gerson" }];
    },
  };

  // La función ni siquiera recibe activeHouseholdId como parámetro — prueba
  // en sí misma de que el descubrimiento no depende de ese valor de la UI.
  const result = await discoverHouseholdsForCurrentUser("gerson", deps);

  assert.deepEqual(result.owned, [{ id: "hh-residual", ownerId: "gerson" }]);
  assert.deepEqual(result.memberOnly, []);
  assert.equal(result.queryFailed, false);

  console.log("Descubre un Hogar residual sin depender de activeHouseholdId: 3/3 aserciones pasadas.");
}

// ==========================================
// Item 2: usuario dueño de MÁS DE UN Hogar residual -> todos deben aparecer
// en `owned`.
// ==========================================
async function runMultipleOwnedHouseholdsTest() {
  const deps: DiscoverHouseholdsDeps = {
    queryMemberHouseholds: async () => [
      { id: "hh-1", ownerId: "gerson" },
      { id: "hh-2", ownerId: "gerson" },
      { id: "hh-3", ownerId: "otro" },
    ],
  };

  const result = await discoverHouseholdsForCurrentUser("gerson", deps);

  assert.deepEqual(
    result.owned.map((h) => h.id).sort(),
    ["hh-1", "hh-2"],
    "debe descubrir TODOS los Hogares propios, no solo el primero"
  );
  assert.deepEqual(result.memberOnly.map((h) => h.id), ["hh-3"]);

  console.log("Descubre múltiples Hogares propios residuales: 2/2 aserciones pasadas.");
}

function runNeverUsesOwnerIdQueryStructuralTest() {
  // Contrato: el descubrimiento usa whereArrayContains(memberIds), nunca una
  // query whereEqualTo("ownerId", uid) directa (Android documenta que las
  // Rules la rechazan).
  const source = readFileSync(
    path.join(__dirname, "..", "..", "src", "features", "qa-reset", "services", "discover-households-for-current-user.ts"),
    "utf8"
  );

  assert.ok(source.includes('where("memberIds", "array-contains", uid)'), "debe consultar por memberIds array-contains");
  assert.ok(
    !source.includes('collection(db, "households"), where("ownerId"'),
    "nunca debe hacer una query directa where('ownerId', ...) sobre households (solo puede aparecer en comentarios explicando por qué no)"
  );

  console.log("Contrato estructural: nunca usa where('ownerId', ...) sobre households: 2/2 aserciones pasadas.");
}

async function runQueryFailureIsReportedNotHiddenTest() {
  const deps: DiscoverHouseholdsDeps = {
    queryMemberHouseholds: async () => {
      throw new Error("permission-denied simulado");
    },
  };

  const result = await discoverHouseholdsForCurrentUser("gerson", deps);

  assert.equal(result.queryFailed, true, "un fallo de descubrimiento debe reportarse explícitamente");
  assert.deepEqual(result.owned, []);
  assert.deepEqual(result.memberOnly, [], "sin poder confirmar, no debe inventarse una lista de Hogares");

  console.log("Fallo de descubrimiento se reporta, nunca se asume 'sin Hogares' en falso: 3/3 aserciones pasadas.");
}

async function main() {
  await runDiscoversRegardlessOfActiveHouseholdIdTest();
  await runMultipleOwnedHouseholdsTest();
  runNeverUsesOwnerIdQueryStructuralTest();
  await runQueryFailureIsReportedNotHiddenTest();

  console.log("OK discover-households-for-current-user");
}

export { main as runDiscoverHouseholdsForCurrentUserUnitTests };
