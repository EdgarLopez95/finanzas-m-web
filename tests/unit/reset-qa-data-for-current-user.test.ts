import assert from "node:assert/strict";

import {
  resetQaDataForCurrentUser,
  type ResetQaDataForCurrentUserDeps,
} from "../../src/features/qa-reset/services/reset-qa-data-for-current-user";

console.log("Running unit tests for reset-qa-data-for-current-user.test.ts...");

const emptyPersonalDeps = {
  queryOwnerPage: async () => ({ refs: [], hasMore: false }),
  queryAccountsForOwner: async () => [],
} as const;

const emptyHouseholdLinkedDocsDeps = {
  queryFieldPage: async () => ({ refs: [], hasMore: false }),
} as const;

// clearActiveHousehold real exige config de Firebase real; en las pruebas que
// no verifican explícitamente este paso, se inyecta un no-op para aislar el
// caso bajo prueba (evita ruido de "Firebase web config incompleta").
const noopClearActiveHousehold = async () => {};

// ==========================================
// Item 1 (corrección obligatoria): usuario con activeHouseholdId = null pero
// TODAVÍA miembro de un Hogar (residual) -> el descubrimiento lo encuentra y
// se resuelve correctamente (owner -> dissolve, member -> leave), sin
// depender de ningún hint de la UI (la nueva firma ni siquiera acepta un
// parámetro `household`).
// ==========================================
async function runDiscoversResidualMembershipDespiteNullActiveHouseholdIdTest() {
  let leftHouseholdId: string | null = null;

  const deps: ResetQaDataForCurrentUserDeps = {
    personalDeps: emptyPersonalDeps,
    householdLinkedDocsDeps: emptyHouseholdLinkedDocsDeps,
    discoverDeps: {
      queryMemberHouseholds: async () => [{ id: "hh-residual", ownerId: "otro-uid" }],
    },
    leaveHouseholdFn: async (householdId) => {
      leftHouseholdId = householdId;
    },
    clearActiveHouseholdFn: noopClearActiveHousehold,
  };

  const result = await resetQaDataForCurrentUser({ uid: "familia" }, deps);

  assert.equal(leftHouseholdId, "hh-residual", "debe descubrir la membresía residual y abandonarla, aunque activeHouseholdId ya estuviera vacío");
  assert.equal(result.memberHouseholdsLeft.length, 1);
  assert.equal(result.memberHouseholdsLeft[0].success, true);
  assert.equal(result.hadAnyFailure, false);

  console.log("Item 1 (membresía residual con activeHouseholdId=null): 4/4 aserciones pasadas.");
}

// ==========================================
// Item 2: usuario dueño de MÁS DE UN Hogar residual -> disuelve TODOS los
// propios descubiertos, no solo uno.
// ==========================================
async function runDissolvesAllOwnedResidualHouseholdsTest() {
  const dissolvedIds: string[] = [];

  const deps: ResetQaDataForCurrentUserDeps = {
    personalDeps: emptyPersonalDeps,
    householdLinkedDocsDeps: emptyHouseholdLinkedDocsDeps,
    discoverDeps: {
      queryMemberHouseholds: async () => [
        { id: "hh-owned-1", ownerId: "gerson" },
        { id: "hh-owned-2", ownerId: "gerson" },
      ],
    },
    dissolveHouseholdFn: async (householdId) => {
      dissolvedIds.push(householdId);
    },
    clearActiveHouseholdFn: noopClearActiveHousehold,
  };

  const result = await resetQaDataForCurrentUser({ uid: "gerson" }, deps);

  assert.deepEqual(dissolvedIds.sort(), ["hh-owned-1", "hh-owned-2"], "debe disolver TODOS los Hogares propios descubiertos, no solo el primero");
  assert.equal(result.ownedHouseholdsDissolved.length, 2);
  assert.ok(result.ownedHouseholdsDissolved.every((h) => h.success));
  assert.equal(result.memberHouseholdsLeft.length, 0);
  assert.equal(result.hadAnyFailure, false);

  console.log("Item 2 (múltiples Hogares propios residuales, todos disueltos): 5/5 aserciones pasadas.");
}

// ==========================================
// Item 3: miembro no dueño -> limpia SOLO sus documentos vinculados (shares/
// deudas/etc.) ANTES de abandonar; nunca dissolveHousehold; el Hogar y los
// datos del dueño permanecen (no se toca nada del dueño en este flujo).
// ==========================================
async function runMemberCleansOwnDocsBeforeLeavingTest() {
  const callOrder: string[] = [];
  let dissolveCalled = false;

  const deps: ResetQaDataForCurrentUserDeps = {
    personalDeps: emptyPersonalDeps,
    householdLinkedDocsDeps: {
      queryFieldPage: async (collectionName, field, value) => {
        callOrder.push(`cleanup:${collectionName}:${field}`);
        assert.equal(value, "familia", "la limpieza de documentos vinculados debe filtrar por el UID actual, no por el del dueño");
        return { refs: [], hasMore: false };
      },
    },
    discoverDeps: {
      queryMemberHouseholds: async () => [{ id: "hh-owned-by-gerson", ownerId: "gerson" }],
    },
    leaveHouseholdFn: async (householdId) => {
      callOrder.push(`leave:${householdId}`);
    },
    dissolveHouseholdFn: async () => {
      dissolveCalled = true;
    },
    clearActiveHouseholdFn: noopClearActiveHousehold,
  };

  const result = await resetQaDataForCurrentUser({ uid: "familia" }, deps);

  assert.equal(dissolveCalled, false, "un miembro no dueño NUNCA debe disolver el Hogar (eso borraría los datos del dueño)");
  assert.equal(result.memberHouseholdsLeft[0]?.householdId, "hh-owned-by-gerson");
  assert.equal(result.memberHouseholdsLeft[0]?.success, true);

  // La limpieza de documentos vinculados (7 queries) debe completarse ANTES
  // de la llamada a leaveHousehold — mientras el usuario aún es miembro.
  const lastCleanupIndex = Math.max(...callOrder.map((c, i) => (c.startsWith("cleanup:") ? i : -1)));
  const leaveIndex = callOrder.findIndex((c) => c.startsWith("leave:"));
  assert.ok(leaveIndex > lastCleanupIndex, "la limpieza de documentos propios debe ocurrir ANTES de abandonar el Hogar (mientras aún es miembro)");

  console.log("Item 3 (miembro limpia sus documentos antes de salir, nunca disuelve): 4/4 aserciones pasadas.");
}

// ==========================================
// Item 8: fallo parcial de UNA colección o de UN Hogar -> el resultado queda
// reintentable (hadAnyFailure=true) y nunca informa éxito falso.
// ==========================================
async function runPartialFailureNeverReportsFalseSuccessTest() {
  const deps: ResetQaDataForCurrentUserDeps = {
    personalDeps: {
      queryOwnerPage: async (collectionName) => {
        if (collectionName === "transactions") throw new Error("permission-denied simulado");
        return { refs: [], hasMore: false };
      },
      queryAccountsForOwner: async () => [],
    },
    householdLinkedDocsDeps: emptyHouseholdLinkedDocsDeps,
    discoverDeps: {
      queryMemberHouseholds: async () => [{ id: "hh-1", ownerId: "gerson" }],
    },
    dissolveHouseholdFn: async () => {
      throw new Error("fallo de red simulado disolviendo el Hogar");
    },
    clearActiveHouseholdFn: noopClearActiveHousehold,
  };

  const result = await resetQaDataForCurrentUser({ uid: "gerson" }, deps);

  assert.equal(result.hadAnyFailure, true, "un fallo parcial (personal o Hogar) debe marcarse explícitamente, nunca ocultarse");
  assert.ok(result.personal.failed > 0, "el conteo de fallos personales debe reflejar el fallo real");
  assert.equal(result.ownedHouseholdsDissolved[0]?.success, false, "el Hogar que falló al disolverse debe reportarse como no exitoso");

  console.log("Item 8 (fallo parcial: resultado reintentable, nunca éxito falso): 3/3 aserciones pasadas.");
}

async function runDiscoveryFailureIsReportedTest() {
  const deps: ResetQaDataForCurrentUserDeps = {
    personalDeps: emptyPersonalDeps,
    householdLinkedDocsDeps: emptyHouseholdLinkedDocsDeps,
    discoverDeps: {
      queryMemberHouseholds: async () => {
        throw new Error("permission-denied simulado");
      },
    },
    clearActiveHouseholdFn: noopClearActiveHousehold,
  };

  const result = await resetQaDataForCurrentUser({ uid: "gerson" }, deps);

  assert.equal(result.discoveryFailed, true);
  assert.equal(result.hadAnyFailure, true, "un fallo de descubrimiento debe marcar el resultado global como parcial, nunca como éxito");

  console.log("Fallo de descubrimiento de Hogares se refleja en hadAnyFailure: 2/2 aserciones pasadas.");
}

// ==========================================
// Item 9: no regresión — sesión y documento de usuario se conservan; solo se
// limpia activeHouseholdId (nunca se borra/reescribe el perfil).
// ==========================================
async function runOnlyClearsActiveHouseholdIdNeverTouchesProfileTest() {
  let clearActiveHouseholdCalled = false;
  const deps: ResetQaDataForCurrentUserDeps = {
    personalDeps: emptyPersonalDeps,
    householdLinkedDocsDeps: emptyHouseholdLinkedDocsDeps,
    discoverDeps: { queryMemberHouseholds: async () => [] },
    clearActiveHouseholdFn: async (uid) => {
      assert.equal(uid, "gerson");
      clearActiveHouseholdCalled = true;
    },
  };

  const result = await resetQaDataForCurrentUser({ uid: "gerson" }, deps);

  assert.equal(clearActiveHouseholdCalled, true, "debe intentar limpiar activeHouseholdId como paso final, sin importar el rol");
  assert.equal(result.activeHouseholdIdClearFailed, false);

  console.log("Item 9 (solo limpia activeHouseholdId, no toca el resto del perfil): 2/2 aserciones pasadas.");
}

async function main() {
  await runDiscoversResidualMembershipDespiteNullActiveHouseholdIdTest();
  await runDissolvesAllOwnedResidualHouseholdsTest();
  await runMemberCleansOwnDocsBeforeLeavingTest();
  await runPartialFailureNeverReportsFalseSuccessTest();
  await runDiscoveryFailureIsReportedTest();
  await runOnlyClearsActiveHouseholdIdNeverTouchesProfileTest();

  console.log("OK reset-qa-data-for-current-user");
}

export { main as runResetQaDataForCurrentUserUnitTests };
