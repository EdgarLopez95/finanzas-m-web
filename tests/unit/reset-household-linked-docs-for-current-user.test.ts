import assert from "node:assert/strict";

import {
  resetHouseholdLinkedDocsForCurrentUser,
  QA_RESET_HOUSEHOLD_LINKED_DOC_QUERIES,
  type ResetHouseholdLinkedDocsDeps,
} from "../../src/features/qa-reset/services/reset-household-linked-docs-for-current-user";

console.log("Running unit tests for reset-household-linked-docs-for-current-user.test.ts...");

const fakeRef = (id: string) => ({ id });

// ==========================================
// Item 4 del contrato corregido: cada campo de alcance Android, incluyendo
// AMBAS ramas de deuda (fromUserId y toUserId), debe consultarse — nunca por
// householdId de un Hogar ajeno.
// ==========================================
function runQueriesMatchAndroidScopeExactlyTest() {
  assert.deepEqual(
    QA_RESET_HOUSEHOLD_LINKED_DOC_QUERIES.map((q) => `${q.collection}:${q.field}`),
    [
      "household_events:createdByUserId",
      "household_categories:createdByUserId",
      "household_event_shares:memberUserId",
      "household_income_entries:sourceOwnerId",
      "household_review_items:sourceOwnerId",
      "household_debts:fromUserId",
      "household_debts:toUserId",
    ],
    "debe ser exactamente el mismo alcance que deleteOrphanedHouseholdDocs(userId) de Android, incluidas ambas ramas de household_debts"
  );

  console.log("Alcance exacto de las 7 queries (paridad Android, ambas ramas de deuda): 1/1 aserción pasada.");
}

async function runEachQueryIsExecutedByUidTest() {
  const calls: Array<{ collection: string; field: string; value: string }> = [];

  const deps: ResetHouseholdLinkedDocsDeps = {
    queryFieldPage: async (collectionName, field, value) => {
      calls.push({ collection: collectionName, field, value });
      return { refs: [], hasMore: false };
    },
  };

  await resetHouseholdLinkedDocsForCurrentUser("familia", deps);

  assert.equal(calls.length, 7, "debe ejecutar exactamente las 7 queries del contrato");
  assert.ok(
    calls.every((c) => c.value === "familia"),
    "todas las queries deben filtrar por el UID del usuario actual, nunca por un householdId ajeno"
  );
  const householdDebtCalls = calls.filter((c) => c.collection === "household_debts");
  assert.deepEqual(
    householdDebtCalls.map((c) => c.field).sort(),
    ["fromUserId", "toUserId"],
    "household_debts debe consultarse por AMBAS ramas (deudor Y acreedor)"
  );

  console.log("Las 7 queries se ejecutan filtrando siempre por el UID actual (incluidas ambas ramas de deuda): 3/3 aserciones pasadas.");
}

async function runPartialFailureAccumulatesTest() {
  const deps: ResetHouseholdLinkedDocsDeps = {
    queryFieldPage: async (collectionName) => {
      if (collectionName === "household_events") {
        throw new Error("permission-denied simulado");
      }
      return { refs: [fakeRef("doc-1")], hasMore: false };
    },
    commitBatchDelete: async () => {},
  };

  const result = await resetHouseholdLinkedDocsForCurrentUser("familia", deps);

  assert.equal(result.failed, 1, "un fallo puntual en una de las 7 queries debe acumularse, sin abortar las demás");
  assert.equal(result.deleted, 6, "las otras 6 queries deben completarse igual (1 doc cada una)");

  console.log("Fallo parcial en 1 de 7 queries no detiene las demás: 2/2 aserciones pasadas.");
}

async function runNeverQueriesByHouseholdIdTest() {
  const usedFields = new Set<string>();
  const deps: ResetHouseholdLinkedDocsDeps = {
    queryFieldPage: async (_collectionName, field) => {
      usedFields.add(field);
      return { refs: [], hasMore: false };
    },
  };

  await resetHouseholdLinkedDocsForCurrentUser("familia", deps);

  assert.ok(!usedFields.has("householdId"), "esta limpieza jamás debe filtrar por householdId (eso pertenece a dissolveHousehold, no a esta limpieza por UID)");

  console.log("Nunca filtra por householdId (solo por campos de user-scope): 1/1 aserción pasada.");
}

async function main() {
  runQueriesMatchAndroidScopeExactlyTest();
  await runEachQueryIsExecutedByUidTest();
  await runPartialFailureAccumulatesTest();
  await runNeverQueriesByHouseholdIdTest();

  console.log("OK reset-household-linked-docs-for-current-user");
}

export { main as runResetHouseholdLinkedDocsForCurrentUserUnitTests };
