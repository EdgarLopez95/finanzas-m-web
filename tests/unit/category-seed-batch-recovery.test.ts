import assert from "node:assert/strict";

import {
  ensurePersonalCategorySeed,
  resetPersonalCategorySeedState,
  type PersonalCategorySeedDeps,
} from "../../src/features/categories/services/ensure-personal-category-seed";
import {
  ensureHouseholdCategorySeed,
  resetHouseholdCategorySeedState,
  type HouseholdCategorySeedDeps,
} from "../../src/features/household/services/ensure-household-category-seed";
import type { MinimalPersonalCategory } from "../../src/features/categories/lib/personal-category-seed-plan";
import type { MinimalHouseholdCategory } from "../../src/features/household/lib/household-category-seed-plan";

console.log("Running unit tests for category-seed-batch-recovery.test.ts...");

/**
 * Fake de Firestore para el seed Personal — modela la atomicidad real de un
 * `writeBatch`: nada queda "escrito" en `docs` hasta que `commit()` resuelve.
 * `failNextCommits` permite simular N fallos consecutivos antes de un éxito.
 */
function createFakePersonalFirestore() {
  const docs = new Map<string, Record<string, unknown>>();
  let failNextCommits = 0;
  let commitCallCount = 0;
  let createBatchCallCount = 0;
  let incomeIdCounter = 0;

  const deps: PersonalCategorySeedDeps = {
    createBatch: () => {
      createBatchCallCount++;
      const pendingSets: { id: string; data: Record<string, unknown> }[] = [];
      const pendingUpdates: { id: string; data: Record<string, unknown> }[] = [];
      return {
        set: (id, data) => pendingSets.push({ id, data }),
        update: (id, data) => pendingUpdates.push({ id, data }),
        commit: async () => {
          commitCallCount++;
          if (failNextCommits > 0) {
            failNextCommits--;
            throw new Error("Simulated Firestore batch commit failure");
          }
          for (const { id, data } of pendingSets) {
            docs.set(id, { ...(docs.get(id) ?? {}), ...data });
          }
          for (const { id, data } of pendingUpdates) {
            if (!docs.has(id)) throw new Error(`update() on missing doc: ${id}`);
            docs.set(id, { ...docs.get(id), ...data });
          }
        },
      };
    },
    newIncomeId: () => `income-${incomeIdCounter++}`,
  };

  return {
    deps,
    docs,
    failNextCommit: () => {
      failNextCommits = 1;
    },
    get commitCallCount() {
      return commitCallCount;
    },
    get createBatchCallCount() {
      return createBatchCallCount;
    },
  };
}

function createFakeHouseholdFirestore() {
  const docs = new Map<string, Record<string, unknown>>();
  let failNextCommits = 0;
  let commitCallCount = 0;
  let createBatchCallCount = 0;

  const deps: HouseholdCategorySeedDeps = {
    createBatch: () => {
      createBatchCallCount++;
      const pendingSets: { id: string; data: Record<string, unknown> }[] = [];
      const pendingUpdates: { id: string; data: Record<string, unknown> }[] = [];
      return {
        set: (id, data) => pendingSets.push({ id, data }),
        update: (id, data) => pendingUpdates.push({ id, data }),
        commit: async () => {
          commitCallCount++;
          if (failNextCommits > 0) {
            failNextCommits--;
            throw new Error("Simulated Firestore batch commit failure");
          }
          for (const { id, data } of pendingSets) {
            docs.set(id, { ...(docs.get(id) ?? {}), ...data });
          }
          for (const { id, data } of pendingUpdates) {
            if (!docs.has(id)) throw new Error(`update() on missing doc: ${id}`);
            docs.set(id, { ...docs.get(id), ...data });
          }
        },
      };
    },
  };

  return {
    deps,
    docs,
    failNextCommit: () => {
      failNextCommits = 1;
    },
    get commitCallCount() {
      return commitCallCount;
    },
    get createBatchCallCount() {
      return createBatchCallCount;
    },
  };
}

async function runCategorySeedBatchRecoveryTests() {
  // Test 1: seed Personal vacío -> un único batch atómico de 22 operaciones (16 gastos + 6 ingresos).
  {
    resetPersonalCategorySeedState();
    const fake = createFakePersonalFirestore();

    const result = await ensurePersonalCategorySeed("owner-1", [], fake.deps);

    assert.strictEqual(fake.createBatchCallCount, 1, "Debe crear exactamente 1 batch");
    assert.strictEqual(fake.commitCallCount, 1, "Debe hacer exactamente 1 commit");
    assert.strictEqual(fake.docs.size, 22, "El batch debe persistir exactamente 22 documentos (16 gastos + 6 ingresos)");
    assert.strictEqual(result, true, "Debe reportar que sí hubo cambios");

    const expenseDocs = [...fake.docs.values()].filter((d) => d.kind === "expense");
    const incomeDocs = [...fake.docs.values()].filter((d) => d.kind === "income");
    assert.strictEqual(expenseDocs.length, 16, "Deben persistirse los 16 gastos seed");
    assert.strictEqual(incomeDocs.length, 6, "Deben persistirse los 6 ingresos seed");

    console.log("  ✓ Test 1: seed Personal vacío produce un único batch atómico de 22 operaciones");
  }

  // Test 2: si el batch Personal falla, nada queda parcialmente aplicado; una segunda llamada reintenta.
  {
    resetPersonalCategorySeedState();
    const fake = createFakePersonalFirestore();
    fake.failNextCommit();

    const firstResult = await ensurePersonalCategorySeed("owner-2", [], fake.deps);
    assert.strictEqual(firstResult, false, "Debe reportar fallo cuando el commit rechaza");
    assert.strictEqual(fake.docs.size, 0, "Ningún documento debe quedar parcialmente aplicado tras un commit fallido");
    assert.strictEqual(fake.commitCallCount, 1, "El primer intento debe haber llamado a commit una vez (y fallado)");

    const secondResult = await ensurePersonalCategorySeed("owner-2", [], fake.deps);
    assert.strictEqual(secondResult, true, "Una segunda llamada para el mismo usuario debe reintentar y esta vez tener éxito");
    assert.strictEqual(fake.commitCallCount, 2, "El reintento debe producir un segundo commit real");
    assert.strictEqual(fake.docs.size, 22, "Tras el reintento exitoso deben quedar los 22 documentos");

    console.log("  ✓ Test 2: fallo de batch Personal no deja estado parcial; segunda llamada reintenta con éxito");
  }

  // Test 3: tras un commit Personal exitoso, una segunda llamada en la misma sesión no duplica nada.
  {
    resetPersonalCategorySeedState();
    const fake = createFakePersonalFirestore();

    await ensurePersonalCategorySeed("owner-3", [], fake.deps);
    assert.strictEqual(fake.docs.size, 22);
    assert.strictEqual(fake.commitCallCount, 1);

    const secondResult = await ensurePersonalCategorySeed("owner-3", [], fake.deps);
    assert.strictEqual(secondResult, false, "Segunda llamada tras éxito no debe reportar cambios nuevos");
    assert.strictEqual(fake.commitCallCount, 1, "No debe producirse un segundo commit");
    assert.strictEqual(fake.createBatchCallCount, 1, "No debe siquiera crear un segundo batch");
    assert.strictEqual(fake.docs.size, 22, "El número de documentos no debe cambiar");

    console.log("  ✓ Test 3: segunda llamada Personal tras éxito no crea ingresos ni gastos duplicados");
  }

  // Test 4: seed Hogar usa un batch atómico para sus gastos y backfills.
  {
    resetHouseholdCategorySeedState();
    const fake = createFakeHouseholdFirestore();

    const result = await ensureHouseholdCategorySeed("hh-1", "user-a", [], fake.deps);

    assert.strictEqual(fake.createBatchCallCount, 1, "Debe crear exactamente 1 batch");
    assert.strictEqual(fake.commitCallCount, 1, "Debe hacer exactamente 1 commit");
    assert.strictEqual(fake.docs.size, 16, "El batch debe persistir exactamente los 16 gastos seed de Hogar");
    assert.strictEqual(result, true);
    for (const docData of fake.docs.values()) {
      assert.strictEqual(docData.kind, "expense", "Hogar nunca debe crear categorías de ingreso");
    }

    console.log("  ✓ Test 4: seed Hogar usa un único batch atómico para gastos y backfills");
  }

  // Test 5: si el batch Hogar falla, una segunda llamada para el mismo householdId reintenta.
  {
    resetHouseholdCategorySeedState();
    const fake = createFakeHouseholdFirestore();
    fake.failNextCommit();

    const firstResult = await ensureHouseholdCategorySeed("hh-2", "user-a", [], fake.deps);
    assert.strictEqual(firstResult, false);
    assert.strictEqual(fake.docs.size, 0, "Ningún documento debe quedar parcialmente aplicado tras un commit fallido");

    const secondResult = await ensureHouseholdCategorySeed("hh-2", "user-a", [], fake.deps);
    assert.strictEqual(secondResult, true, "Debe reintentar y tener éxito en la segunda llamada");
    assert.strictEqual(fake.commitCallCount, 2);
    assert.strictEqual(fake.docs.size, 16);

    console.log("  ✓ Test 5: fallo de batch Hogar no deja estado parcial; segunda llamada reintenta con éxito");
  }

  // Test 6: tras un commit Hogar exitoso, una segunda llamada no duplica categorías.
  {
    resetHouseholdCategorySeedState();
    const fake = createFakeHouseholdFirestore();

    await ensureHouseholdCategorySeed("hh-3", "user-a", [], fake.deps);
    assert.strictEqual(fake.docs.size, 16);

    const secondResult = await ensureHouseholdCategorySeed("hh-3", "user-a", [], fake.deps);
    assert.strictEqual(secondResult, false);
    assert.strictEqual(fake.commitCallCount, 1, "No debe producirse un segundo commit");
    assert.strictEqual(fake.docs.size, 16, "El número de categorías de Hogar no debe cambiar");

    console.log("  ✓ Test 6: segunda llamada Hogar tras éxito no duplica categorías");
  }

  // Test 7: dos llamadas simultáneas para el mismo usuario/Hogar comparten el trabajo en vuelo -> un solo batch real.
  {
    resetPersonalCategorySeedState();
    const fakePersonal = createFakePersonalFirestore();

    const [r1, r2] = await Promise.all([
      ensurePersonalCategorySeed("owner-concurrent", [], fakePersonal.deps),
      ensurePersonalCategorySeed("owner-concurrent", [], fakePersonal.deps),
    ]);
    assert.strictEqual(fakePersonal.createBatchCallCount, 1, "Dos llamadas simultáneas Personal deben producir un único batch real");
    assert.strictEqual(fakePersonal.commitCallCount, 1);
    assert.strictEqual(r1, true);
    assert.strictEqual(r2, true, "La segunda llamada concurrente debe compartir el resultado de la primera, no bloquearse en silencio");

    resetHouseholdCategorySeedState();
    const fakeHousehold = createFakeHouseholdFirestore();
    const [h1, h2] = await Promise.all([
      ensureHouseholdCategorySeed("hh-concurrent", "user-a", [], fakeHousehold.deps),
      ensureHouseholdCategorySeed("hh-concurrent", "user-a", [], fakeHousehold.deps),
    ]);
    assert.strictEqual(fakeHousehold.createBatchCallCount, 1, "Dos llamadas simultáneas Hogar deben producir un único batch real");
    assert.strictEqual(h1, true);
    assert.strictEqual(h2, true);

    console.log("  ✓ Test 7: llamadas concurrentes comparten el trabajo en vuelo -> un solo batch real (Personal y Hogar)");
  }

  // Test 8: las categorías legacy solo reciben seedKey/sortOrder(+updatedAt técnico) — nunca nombre/icono/color/archivado.
  {
    resetPersonalCategorySeedState();
    const fake = createFakePersonalFirestore();
    // El nombre debe ser un alias legacy EXACTO ("Mercado") para que el planificador lo
    // reconozca como backfill; el ícono/color personalizados no coinciden con el seed
    // canónico a propósito, para probar que el backfill no los toca.
    const legacyMercado: MinimalPersonalCategory = {
      id: "legacy-mercado-doc-id",
      name: "Mercado",
      type: "expense",
      seedKey: null,
      archived: false,
    };
    // El doc "legacy" ya debe existir en el fake para que update() no falle (como en Firestore real).
    fake.docs.set("legacy-mercado-doc-id", {
      name: legacyMercado.name,
      iconKey: "custom-icon-key",
      color: "#123456",
      archived: false,
      kind: "expense",
    });

    await ensurePersonalCategorySeed("owner-legacy", [legacyMercado], fake.deps);

    const backfilled = fake.docs.get("legacy-mercado-doc-id")!;
    assert.strictEqual(backfilled.seedKey, "groceries");
    assert.strictEqual(backfilled.sortOrder, 1);
    // Personalizaciones existentes intactas.
    assert.strictEqual(backfilled.name, legacyMercado.name, "El backfill no debe tocar el nombre existente");
    assert.strictEqual(backfilled.iconKey, "custom-icon-key", "El backfill no debe tocar el iconKey existente");
    assert.strictEqual(backfilled.color, "#123456", "El backfill no debe tocar el color existente");

    resetHouseholdCategorySeedState();
    const fakeHH = createFakeHouseholdFirestore();
    const legacyHH: MinimalHouseholdCategory = {
      id: "legacy-hh-mercado",
      householdId: "hh-legacy",
      name: "Mercado",
      iconKey: "groceries",
      seedKey: null,
      archived: false,
    };
    fakeHH.docs.set("legacy-hh-mercado", {
      name: legacyHH.name,
      iconKey: "groceries",
      color: "#654321",
      archived: false,
      kind: "expense",
    });
    await ensureHouseholdCategorySeed("hh-legacy", "user-a", [legacyHH], fakeHH.deps);
    const backfilledHH = fakeHH.docs.get("legacy-hh-mercado")!;
    assert.strictEqual(backfilledHH.seedKey, "groceries");
    assert.strictEqual(backfilledHH.color, "#654321", "El backfill Hogar no debe tocar el color existente");

    console.log("  ✓ Test 8: backfill de categorías legacy solo toca seedKey/sortOrder, nunca personalizaciones (Personal y Hogar)");
  }

  console.log("All category-seed-batch-recovery unit tests passed successfully!");
}

runCategorySeedBatchRecoveryTests().catch((err) => {
  console.error("Test failure in category-seed-batch-recovery.test.ts:", err);
  process.exit(1);
});
