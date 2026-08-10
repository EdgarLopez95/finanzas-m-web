import assert from "node:assert/strict";

import {
  deletePersonalCollectionByOwner,
  deleteAccountsAndPocketsForOwner,
  resetPersonalDataForCurrentUser,
  QA_RESET_PERSONAL_COLLECTIONS,
  QA_RESET_PAGE_SIZE,
  type ResetPersonalDataDeps,
} from "../../src/features/qa-reset/services/reset-personal-data-for-current-user";

console.log("Running unit tests for reset-personal-data-for-current-user.test.ts...");

const fakeRef = (id: string) => ({ id });

// ==========================================
// TDD: planificación/selección de documentos a borrar, sin depender de datos
// reales — todo mockeado vía el seam de inyección (mismo patrón que
// dissolve-household.ts).
// ==========================================

async function runPaginationAcrossMultiplePagesTest() {
  const allRefs = Array.from({ length: QA_RESET_PAGE_SIZE + 5 }, (_, i) => fakeRef(`tx-${i}`));
  let callCount = 0;
  const deletedRefs: unknown[] = [];

  const deps: ResetPersonalDataDeps = {
    queryOwnerPage: async (_collectionName, _ownerId, pageSize) => {
      callCount += 1;
      const start = (callCount - 1) * pageSize;
      const page = allRefs.slice(start, start + pageSize);
      return { refs: page, hasMore: start + pageSize < allRefs.length };
    },
    commitBatchDelete: async (refs) => {
      assert.ok(refs.length <= QA_RESET_PAGE_SIZE, "ningún writeBatch debe superar QA_RESET_PAGE_SIZE");
      deletedRefs.push(...refs);
    },
  };

  const result = await deletePersonalCollectionByOwner("transactions", "gerson", deps);

  assert.equal(callCount, 2, "debe paginar en 2 páginas cuando hay más docs que QA_RESET_PAGE_SIZE");
  assert.equal(deletedRefs.length, allRefs.length, "debe borrar TODOS los documentos, no solo la primera página");
  assert.deepEqual(result, { deleted: allRefs.length, failed: 0 });

  console.log("Paginación multi-página respeta QA_RESET_PAGE_SIZE y borra todo: 3/3 aserciones pasadas.");
}

async function runEmptyCollectionTest() {
  const deps: ResetPersonalDataDeps = {
    queryOwnerPage: async () => ({ refs: [], hasMore: false }),
    commitBatchDelete: async () => {
      throw new Error("no debe llamarse con 0 refs");
    },
  };

  const result = await deletePersonalCollectionByOwner("categories", "gerson", deps);
  assert.deepEqual(result, { deleted: 0, failed: 0 });

  console.log("Colección vacía: 0 borrados, 0 fallos, sin invocar el batch: 1/1 aserción pasada.");
}

async function runPartialFailureDoesNotThrowTest() {
  const deps: ResetPersonalDataDeps = {
    queryOwnerPage: async () => {
      throw new Error("permission-denied simulado");
    },
  };

  const result = await deletePersonalCollectionByOwner("transactions", "gerson", deps);
  assert.deepEqual(result, { deleted: 0, failed: 1 }, "un fallo debe reportarse como failed:1, sin lanzar (para no abortar el resto del reset)");

  console.log("Fallo parcial no lanza, se reporta como failed:1: 1/1 aserción pasada.");
}

async function runAccountsAndPocketsOrderTest() {
  const operationsOrder: string[] = [];
  const accountA = fakeRef("acc-a");
  const accountB = fakeRef("acc-b");

  const deps: ResetPersonalDataDeps = {
    queryAccountsForOwner: async () => {
      operationsOrder.push("query-accounts");
      return [accountA, accountB];
    },
    queryPocketsForAccount: async (accountRef) => {
      operationsOrder.push(`query-pockets:${(accountRef as { id: string }).id}`);
      return (accountRef as { id: string }).id === "acc-a" ? [fakeRef("pocket-1")] : [];
    },
    commitBatchDelete: async (refs) => {
      operationsOrder.push(`delete:${refs.length}`);
    },
  };

  const result = await deleteAccountsAndPocketsForOwner("gerson", deps);

  // Los pockets de cada cuenta deben borrarse ANTES que el batch final de
  // cuentas (paridad Android: deleteAccountsAndPockets).
  assert.deepEqual(operationsOrder, [
    "query-accounts",
    "query-pockets:acc-a",
    "delete:1", // pockets de acc-a
    "query-pockets:acc-b",
    "delete:2", // batch final de las 2 cuentas
  ]);
  assert.deepEqual(result, { deleted: 3, failed: 0 }, "1 pocket + 2 cuentas = 3 documentos borrados");

  console.log("Cuentas y bolsillos: pockets antes que el documento padre, orden y conteo correctos: 2/2 aserciones pasadas.");
}

async function runNoAccountsIsNoOpTest() {
  const deps: ResetPersonalDataDeps = {
    queryAccountsForOwner: async () => [],
    queryPocketsForAccount: async () => {
      throw new Error("no debe consultarse sin cuentas");
    },
    commitBatchDelete: async () => {
      throw new Error("no debe borrarse sin cuentas");
    },
  };

  const result = await deleteAccountsAndPocketsForOwner("gerson", deps);
  assert.deepEqual(result, { deleted: 0, failed: 0 });

  console.log("Usuario sin cuentas personales: no-op seguro: 1/1 aserción pasada.");
}

// ==========================================
// Item 6 (corrección obligatoria): más de 400 cuentas Y más de 400 pockets en
// una sola cuenta — ningún writeBatch debe exceder QA_RESET_PAGE_SIZE (400).
// ==========================================
async function runMoreThan400AccountsAndPocketsAreSafelyBatchedTest() {
  const accountCount = QA_RESET_PAGE_SIZE + 37;
  const pocketCount = QA_RESET_PAGE_SIZE + 12;

  const accounts = Array.from({ length: accountCount }, (_, i) => fakeRef(`acc-${i}`));
  const pocketsByAccount = new Map<string, ReturnType<typeof fakeRef>[]>();
  // Solo la primera cuenta tiene > 400 pockets, para aislar el caso.
  pocketsByAccount.set(
    "acc-0",
    Array.from({ length: pocketCount }, (_, i) => fakeRef(`pocket-${i}`))
  );

  const batchSizes: number[] = [];
  let totalDeleted = 0;

  const deps: ResetPersonalDataDeps = {
    queryAccountsForOwner: async () => accounts,
    queryPocketsForAccount: async (accountRef) => pocketsByAccount.get((accountRef as { id: string }).id) ?? [],
    commitBatchDelete: async (refs) => {
      batchSizes.push(refs.length);
      totalDeleted += refs.length;
    },
  };

  const result = await deleteAccountsAndPocketsForOwner("gerson", deps);

  assert.ok(batchSizes.every((size) => size <= QA_RESET_PAGE_SIZE), `ningún batch debe superar ${QA_RESET_PAGE_SIZE}; recibidos: ${batchSizes}`);
  assert.ok(batchSizes.length > 2, "más de 400 cuentas + más de 400 pockets debe producir múltiples batches fragmentados");
  assert.equal(totalDeleted, accountCount + pocketCount, "debe borrar TODAS las cuentas y TODOS los pockets, sin perder ninguno por la fragmentación");
  assert.deepEqual(result, { deleted: accountCount + pocketCount, failed: 0 });

  console.log(`Fragmentación segura con ${accountCount} cuentas y ${pocketCount} pockets (ningún batch > ${QA_RESET_PAGE_SIZE}): 4/4 aserciones pasadas.`);
}

async function runFullResetTargetsExactCollectionsTest() {
  const queriedCollections: string[] = [];
  let accountsQueried = false;

  const deps: ResetPersonalDataDeps = {
    queryOwnerPage: async (collectionName) => {
      queriedCollections.push(collectionName);
      return { refs: [], hasMore: false };
    },
    queryAccountsForOwner: async () => {
      accountsQueried = true;
      return [];
    },
  };

  await resetPersonalDataForCurrentUser("gerson", deps);

  assert.deepEqual(
    queriedCollections,
    [...QA_RESET_PERSONAL_COLLECTIONS],
    "debe consultar exactamente las colecciones personales de paridad Android (incluida third_party_fund_location_operations)"
  );
  assert.ok(accountsQueried, "debe consultar accounts por separado (por su subcolección pockets)");
  // Corrección obligatoria: Android SÍ borra third_party_fund_location_operations
  // por ownerId (las Rules lo permiten al dueño) — Web debe incluirla también,
  // aunque su propio flujo normal no la cree, para no dejar residuos.
  assert.ok(
    queriedCollections.includes("third_party_fund_location_operations"),
    "debe incluir third_party_fund_location_operations (paridad Android exacta, Rules lo permiten al dueño)"
  );
  assert.ok(
    !(queriedCollections as string[]).includes("households") && !(queriedCollections as string[]).includes("household_events"),
    "el reset personal no debe tocar ninguna colección de Hogar (eso lo maneja el orquestador por separado)"
  );

  console.log("resetPersonalDataForCurrentUser apunta exactamente a las colecciones personales de paridad Android: 4/4 aserciones pasadas.");
}

async function main() {
  await runPaginationAcrossMultiplePagesTest();
  await runEmptyCollectionTest();
  await runPartialFailureDoesNotThrowTest();
  await runAccountsAndPocketsOrderTest();
  await runNoAccountsIsNoOpTest();
  await runMoreThan400AccountsAndPocketsAreSafelyBatchedTest();
  await runFullResetTargetsExactCollectionsTest();

  console.log("OK reset-personal-data-for-current-user");
}

export { main as runResetPersonalDataForCurrentUserUnitTests };
