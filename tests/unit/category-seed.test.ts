import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  EXPENSE_CATEGORY_SEEDS,
  PERSONAL_INCOME_CATEGORY_SEEDS,
  shouldSeedPersonalIncomeCategories,
} from "../../src/lib/categories/category-seed-catalog";
import {
  buildPersonalExpenseSeedPlan,
  personalExpenseSeedId,
  type MinimalPersonalCategory,
} from "../../src/features/categories/lib/personal-category-seed-plan";
import {
  buildHouseholdExpenseSeedPlan,
  householdExpenseSeedId,
  type MinimalHouseholdCategory,
} from "../../src/features/household/lib/household-category-seed-plan";
import { mapCategoryDoc } from "../../src/features/categories/services/read-personal-categories";
import { mapHouseholdCategoryDoc } from "../../src/features/household/services/read-household-categories";
import { isValidIconKey } from "../../src/lib/categories/category-icons";

console.log("Running unit tests for category-seed.test.ts...");

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

const OWNER_ID = "owner-1";
const HOUSEHOLD_ID = "hh-1";

async function runCategorySeedTests() {
  // Test 1: catálogo exacto de 16 gastos — IDs (seedKey), nombres Personal/Hogar, iconos, colores, orden.
  {
    const EXPECTED = [
      { sortOrder: 1, seedKey: "groceries", personalName: "Mercado", householdName: "Mercado", iconKey: "groceries", color: "#22C55E" },
      { sortOrder: 2, seedKey: "restaurant", personalName: "Restaurantes y domicilios", householdName: "Restaurantes y domicilios", iconKey: "restaurant", color: "#F97316" },
      { sortOrder: 3, seedKey: "housing", personalName: "Arriendo / vivienda", householdName: "Arriendo / vivienda", iconKey: "housing", color: "#6C8E7F" },
      { sortOrder: 4, seedKey: "bills", personalName: "Servicios", householdName: "Servicios del hogar", iconKey: "bills", color: "#E4B363" },
      { sortOrder: 5, seedKey: "cleaning", personalName: "Aseo y hogar", householdName: "Aseo y hogar", iconKey: "cleaning", color: "#14B8A6" },
      { sortOrder: 6, seedKey: "transport", personalName: "Transporte", householdName: "Transporte hogar", iconKey: "transport", color: "#2563EB" },
      { sortOrder: 7, seedKey: "car", personalName: "Vehiculo", householdName: "Vehiculo", iconKey: "car", color: "#64748B" },
      { sortOrder: 8, seedKey: "health", personalName: "Salud", householdName: "Salud hogar", iconKey: "health", color: "#EF4444" },
      { sortOrder: 9, seedKey: "pets", personalName: "Mascota", householdName: "Mascota", iconKey: "pets", color: "#A855F7" },
      { sortOrder: 10, seedKey: "shopping", personalName: "Compras", householdName: "Compras del hogar", iconKey: "shopping", color: "#EC4899" },
      { sortOrder: 11, seedKey: "personal_care", personalName: "Cuidado personal", householdName: "Cuidado personal", iconKey: "personal_care", color: "#D946EF" },
      { sortOrder: 12, seedKey: "entertainment", personalName: "Entretenimiento", householdName: "Salidas y entretenimiento", iconKey: "entertainment", color: "#8B5CF6" },
      { sortOrder: 13, seedKey: "family", personalName: "Familia y regalos", householdName: "Familia y visitas", iconKey: "family", color: "#F59E0B" },
      { sortOrder: 14, seedKey: "education", personalName: "Educacion", householdName: "Educacion", iconKey: "education", color: "#6366F1" },
      { sortOrder: 15, seedKey: "travel", personalName: "Viajes / paseos", householdName: "Viajes / paseos", iconKey: "travel", color: "#06B6D4" },
      { sortOrder: 16, seedKey: "other", personalName: "Otros", householdName: "Otros hogar", iconKey: "other", color: "#6B7280" },
    ];

    assert.strictEqual(EXPENSE_CATEGORY_SEEDS.length, 16, "El catálogo de seed de gasto debe tener exactamente 16 entradas");
    EXPECTED.forEach((expected, index) => {
      const actual = EXPENSE_CATEGORY_SEEDS[index];
      assert.deepStrictEqual(
        {
          sortOrder: actual.sortOrder,
          seedKey: actual.seedKey,
          personalName: actual.personalName,
          householdName: actual.householdName,
          iconKey: actual.iconKey,
          color: actual.color,
        },
        expected,
        `Definición de seed en la posición ${index} no coincide con el catálogo canónico`
      );
      // El color del seed no tiene por qué pertenecer a la paleta de 16 del picker.
      assert.ok(isValidIconKey(actual.iconKey, "expense"), `iconKey '${actual.iconKey}' debe ser un iconKey de gasto válido del catálogo compartido`);
    });

    const seedKeys = new Set(EXPENSE_CATEGORY_SEEDS.map((s) => s.seedKey));
    assert.strictEqual(seedKeys.size, 16, "Los 16 seedKey deben ser únicos");

    console.log("  ✓ Test 1: catálogo exacto de 16 gastos verificado (IDs, nombres, iconos, colores, orden)");
  }

  // Test 2: plan Personal vacío -> 16 gastos deterministas + 6 ingresos exactos.
  {
    const plan = buildPersonalExpenseSeedPlan(OWNER_ID, []);
    assert.strictEqual(plan.backfills.length, 0, "Sin categorías previas no debe haber backfills");
    assert.strictEqual(plan.creations.length, 16, "Sin categorías previas deben crearse los 16 gastos seed");

    const expectedIds = new Set(EXPENSE_CATEGORY_SEEDS.map((s) => personalExpenseSeedId(OWNER_ID, s.seedKey)));
    for (const creation of plan.creations) {
      assert.ok(expectedIds.has(creation.id), `ID determinista inesperado: ${creation.id}`);
      assert.strictEqual(creation.id, `${OWNER_ID}::expense::${creation.definition.seedKey}`, "El ID determinista debe seguir el contrato {userId}::expense::{seedKey}");
    }

    assert.strictEqual(shouldSeedPersonalIncomeCategories(0), true, "Con 0 categorías previas deben sembrarse los ingresos");
    assert.strictEqual(PERSONAL_INCOME_CATEGORY_SEEDS.length, 6, "Deben existir exactamente 6 ingresos seed");
    assert.deepStrictEqual(
      PERSONAL_INCOME_CATEGORY_SEEDS,
      [
        { name: "Salario", iconKey: "salary", color: "#EAB308" },
        { name: "Freelance", iconKey: "freelance", color: "#0EA5E9" },
        { name: "Ventas y negocio", iconKey: "sales", color: "#65A30D" },
        { name: "Inversiones", iconKey: "investment", color: "#F59E0B" },
        { name: "Apoyos y regalos", iconKey: "gift_income", color: "#EF4444" },
        { name: "Otros ingresos", iconKey: "other_income", color: "#8B5CF6" },
      ],
      "Los 6 ingresos seed deben coincidir exactamente con el catálogo Android"
    );
    for (const income of PERSONAL_INCOME_CATEGORY_SEEDS) {
      assert.ok(isValidIconKey(income.iconKey, "income"), `iconKey de ingreso '${income.iconKey}' debe pertenecer al catálogo compartido`);
    }

    console.log("  ✓ Test 2: plan Personal vacío -> 16 gastos deterministas + 6 ingresos exactos");
  }

  // Test 3: plan Personal parcial -> solo crea gastos faltantes; no crea ingresos.
  {
    const existing: MinimalPersonalCategory[] = [
      { id: personalExpenseSeedId(OWNER_ID, "groceries"), name: "Mercado", type: "expense", seedKey: "groceries", archived: false },
      { id: personalExpenseSeedId(OWNER_ID, "housing"), name: "Arriendo / vivienda", type: "expense", seedKey: "housing", archived: false },
      { id: "some-other-id", name: "Categoría propia sin relación", type: "expense", seedKey: null, archived: false },
    ];

    const plan = buildPersonalExpenseSeedPlan(OWNER_ID, existing);
    assert.strictEqual(plan.creations.length, 14, "Debe crear los 14 gastos seed restantes (16 - 2 ya presentes)");
    assert.ok(!plan.creations.some((c) => c.definition.seedKey === "groceries"), "No debe recrear 'groceries', ya existe con ese seedKey");
    assert.ok(!plan.creations.some((c) => c.definition.seedKey === "housing"), "No debe recrear 'housing', ya existe con ese seedKey");
    assert.strictEqual(plan.backfills.length, 0, "Sin alias legacy coincidentes no debe haber backfills");

    assert.strictEqual(
      shouldSeedPersonalIncomeCategories(existing.length),
      false,
      "Con categorías previas (parcial) NO deben sembrarse los ingresos"
    );

    console.log("  ✓ Test 3: plan Personal parcial -> solo gastos faltantes, cero ingresos");
  }

  // Test 4: reejecución Personal -> no duplica ni sobrescribe personalizaciones.
  {
    const fullyCustomizedExisting: MinimalPersonalCategory[] = EXPENSE_CATEGORY_SEEDS.map((seed) => ({
      id: personalExpenseSeedId(OWNER_ID, seed.seedKey),
      name: `${seed.personalName} (renombrada por el usuario)`,
      type: "expense",
      seedKey: seed.seedKey,
      archived: false,
    }));

    const plan1 = buildPersonalExpenseSeedPlan(OWNER_ID, fullyCustomizedExisting);
    assert.strictEqual(plan1.creations.length, 0, "Con las 16 seedKey ya presentes no debe crear nada");
    assert.strictEqual(plan1.backfills.length, 0, "Con las 16 seedKey ya presentes no debe backfillear nada");

    // Reejecutar con el mismo input produce el mismo plan vacío (idempotencia).
    const plan2 = buildPersonalExpenseSeedPlan(OWNER_ID, fullyCustomizedExisting);
    assert.deepStrictEqual(plan2, plan1, "Reejecutar el plan con el mismo estado debe producir el mismo resultado (idempotente)");

    console.log("  ✓ Test 4: reejecución Personal es idempotente, sin duplicados ni sobrescritura");
  }

  // Test 5: backfill seguro de alias legacy sin alterar nombre/icono/color.
  {
    const legacyMercado: MinimalPersonalCategory = {
      id: "legacy-mercado-doc-id",
      name: "Mercado",
      type: "expense",
      seedKey: null,
      archived: false,
      createdAt: new Date("2024-01-01"),
    };
    const legacySalud: MinimalPersonalCategory = {
      id: "legacy-salud-doc-id",
      name: "Salud",
      type: "expense",
      seedKey: null,
      archived: false,
      createdAt: new Date("2024-02-01"),
    };
    const unrelated: MinimalPersonalCategory = {
      id: "unrelated-doc-id",
      name: "Suscripciones personalizadas",
      type: "expense",
      seedKey: null,
      archived: false,
    };

    const plan = buildPersonalExpenseSeedPlan(OWNER_ID, [legacyMercado, legacySalud, unrelated]);

    const groceriesBackfill = plan.backfills.find((b) => b.seedKey === "groceries");
    assert.ok(groceriesBackfill, "Debe backfillear 'Mercado' -> seedKey 'groceries' (alias legacy Android)");
    assert.strictEqual(groceriesBackfill!.categoryId, "legacy-mercado-doc-id");
    assert.strictEqual(groceriesBackfill!.sortOrder, 1);
    // El objeto de backfill NO contiene name/iconKey/color/archived: la firma del tipo
    // ya garantiza que solo se puede tocar categoryId/seedKey/sortOrder.
    assert.deepStrictEqual(Object.keys(groceriesBackfill!).sort(), ["categoryId", "seedKey", "sortOrder"]);

    const healthBackfill = plan.backfills.find((b) => b.seedKey === "health");
    assert.ok(healthBackfill, "Debe backfillear 'Salud' -> seedKey 'health' (alias legacy Android)");
    assert.strictEqual(healthBackfill!.categoryId, "legacy-salud-doc-id");

    assert.ok(!plan.creations.some((c) => c.definition.seedKey === "groceries"), "No debe crear 'groceries' duplicado tras el backfill");
    assert.ok(!plan.creations.some((c) => c.definition.seedKey === "health"), "No debe crear 'health' duplicado tras el backfill");
    assert.strictEqual(plan.creations.length, 14, "Debe crear los 14 seeds restantes que no tienen alias coincidente");

    console.log("  ✓ Test 5: backfill de alias legacy no altera nombre/icono/color, solo asigna seedKey/sortOrder");
  }

  // Test 6: plan Hogar -> 16 gastos deterministas, nombres Hogar exactos, cero ingresos.
  {
    const plan = buildHouseholdExpenseSeedPlan(HOUSEHOLD_ID, []);
    assert.strictEqual(plan.creations.length, 16, "Sin categorías previas deben crearse los 16 gastos seed de Hogar");
    assert.strictEqual(plan.backfills.length, 0);

    for (const creation of plan.creations) {
      assert.strictEqual(creation.id, householdExpenseSeedId(HOUSEHOLD_ID, creation.definition.seedKey));
      assert.strictEqual(creation.id, `${HOUSEHOLD_ID}::expense::${creation.definition.seedKey}`, "El ID determinista debe seguir el contrato {householdId}::expense::{seedKey}");
    }

    // Nombres Hogar (no Personal) — al menos un caso donde difieren explícitamente.
    const billsCreation = plan.creations.find((c) => c.definition.seedKey === "bills");
    assert.strictEqual(billsCreation!.definition.householdName, "Servicios del hogar");
    assert.notStrictEqual(billsCreation!.definition.householdName, billsCreation!.definition.personalName);

    // Cero ingresos: verificación estructural de que Hogar no referencia ningún catálogo de ingreso.
    const planSrc = readSrc("features/household/lib/household-category-seed-plan.ts");
    const serviceSrc = readSrc("features/household/services/ensure-household-category-seed.ts");
    assert.doesNotMatch(planSrc, /incomeIconOptions|incomeIconCatalog|INCOME_ICON_GROUPS|PERSONAL_INCOME_CATEGORY_SEEDS|kind:\s*"income"/, "El planificador Hogar no debe referenciar ningún catálogo/kind de ingreso");
    assert.doesNotMatch(serviceSrc, /incomeIconOptions|incomeIconCatalog|INCOME_ICON_GROUPS|PERSONAL_INCOME_CATEGORY_SEEDS|kind:\s*"income"/, "El helper de seed Hogar no debe referenciar ningún catálogo/kind de ingreso");

    console.log("  ✓ Test 6: plan Hogar -> 16 gastos deterministas, nombres Hogar exactos, cero ingresos");
  }

  // Test 7: reejecución Hogar -> idempotente, sin duplicados.
  {
    const fullyCustomizedExisting: MinimalHouseholdCategory[] = EXPENSE_CATEGORY_SEEDS.map((seed) => ({
      id: householdExpenseSeedId(HOUSEHOLD_ID, seed.seedKey),
      householdId: HOUSEHOLD_ID,
      name: `${seed.householdName} (renombrada)`,
      iconKey: seed.iconKey,
      seedKey: seed.seedKey,
      archived: false,
    }));

    const plan1 = buildHouseholdExpenseSeedPlan(HOUSEHOLD_ID, fullyCustomizedExisting);
    assert.strictEqual(plan1.creations.length, 0);
    assert.strictEqual(plan1.backfills.length, 0);

    const plan2 = buildHouseholdExpenseSeedPlan(HOUSEHOLD_ID, fullyCustomizedExisting);
    assert.deepStrictEqual(plan2, plan1, "Reejecutar el plan Hogar con el mismo estado debe producir el mismo resultado");

    // Un household distinto no interfiere (aislamiento por householdId).
    const otherHouseholdExisting: MinimalHouseholdCategory[] = [
      { id: householdExpenseSeedId("hh-other", "groceries"), householdId: "hh-other", name: "Mercado", iconKey: "groceries", seedKey: "groceries", archived: false },
    ];
    const planIsolated = buildHouseholdExpenseSeedPlan(HOUSEHOLD_ID, [...fullyCustomizedExisting, ...otherHouseholdExisting]);
    assert.strictEqual(planIsolated.creations.length, 0, "Categorías de otro householdId no deben afectar el plan de este hogar");

    console.log("  ✓ Test 7: reejecución Hogar es idempotente, sin duplicados, aislada por householdId");
  }

  // Test 8: el seed no vive en los lectores puros; solo se activa tras lectura/membresía confirmada.
  {
    const readPersonalSrc = readSrc("features/categories/services/read-personal-categories.ts");
    const readHouseholdSrc = readSrc("features/household/services/read-household-categories.ts");
    assert.doesNotMatch(
      readPersonalSrc,
      /ensurePersonalCategorySeed|buildPersonalExpenseSeedPlan/,
      "read-personal-categories.ts (lector puro) no debe invocar el seed"
    );
    assert.doesNotMatch(
      readHouseholdSrc,
      /ensureHouseholdCategorySeed|buildHouseholdExpenseSeedPlan/,
      "read-household-categories.ts (lector puro) no debe invocar el seed"
    );

    const personalStoreSrc = readSrc("stores/personal-data-store.ts");
    assert.match(personalStoreSrc, /ensureCategorySeed/, "personal-data-store.ts debe cablear el helper de seed");
    const categoriesApplyIndex = personalStoreSrc.indexOf('applyPersonalSnapshot({ categories: categoriesResult.value }');
    const seedCallIndex = personalStoreSrc.indexOf("services.ensureCategorySeed?.(ownerId, categoriesResult.value)");
    assert.ok(categoriesApplyIndex > -1 && seedCallIndex > -1 && seedCallIndex > categoriesApplyIndex, "El seed Personal debe dispararse DESPUÉS de aplicar el snapshot de categorías exitoso");

    const householdStoreSrc = readSrc("stores/household-data-store.ts");
    assert.match(householdStoreSrc, /ensureCategorySeed/, "household-data-store.ts debe cablear el helper de seed");
    const successSetIndex = householdStoreSrc.indexOf('status: "success",');
    const householdSeedCallIndex = householdStoreSrc.indexOf("services.ensureCategorySeed?.(activeHouseholdId, uid, categories)");
    assert.ok(successSetIndex > -1 && householdSeedCallIndex > -1 && householdSeedCallIndex > successSetIndex, "El seed Hogar debe dispararse DESPUÉS de confirmar status success (activo + miembro)");
    // No debe dispararse en la rama disuelta ni en la rama vacía/sin household.
    const dissolvedBranch = householdStoreSrc.indexOf('status: "dissolved",');
    const emptyBranch = householdStoreSrc.indexOf('status: "empty",');
    assert.ok(dissolvedBranch > -1 && dissolvedBranch < householdSeedCallIndex, "sanity: la rama dissolved existe antes del seed en el archivo");
    assert.ok(emptyBranch > -1 && emptyBranch < householdSeedCallIndex, "sanity: la rama empty existe antes del seed en el archivo");

    console.log("  ✓ Test 8: seed fuera de los lectores puros; solo se activa tras lectura/membresía confirmada");
  }

  // Test 9: tipos y mappers conservan seedKey y sortOrder.
  {
    const fakePersonalDoc = {
      id: "cat-1",
      data: () => ({
        name: "Mercado",
        kind: "expense",
        iconKey: "groceries",
        color: "#22C55E",
        archived: false,
        seedKey: "groceries",
        sortOrder: 1,
      }),
    };
    const mappedPersonal = mapCategoryDoc(fakePersonalDoc as any, OWNER_ID);
    assert.strictEqual(mappedPersonal.seedKey, "groceries");
    assert.strictEqual(mappedPersonal.sortOrder, 1);

    const fakePersonalDocNoSeed = {
      id: "cat-2",
      data: () => ({ name: "Personalizada", kind: "expense", iconKey: "other", color: "#111111", archived: false }),
    };
    const mappedPersonalNoSeed = mapCategoryDoc(fakePersonalDocNoSeed as any, OWNER_ID);
    assert.strictEqual(mappedPersonalNoSeed.seedKey, null, "Sin seedKey en el doc, el mapper debe exponer null (no crashear)");
    assert.strictEqual(mappedPersonalNoSeed.sortOrder, null);

    const fakeHouseholdDoc = {
      id: "hcat-1",
      data: () => ({
        name: "Mercado",
        iconKey: "groceries",
        color: "#22C55E",
        archived: false,
        createdByUserId: "u1",
        seedKey: "groceries",
        sortOrder: 1,
      }),
    };
    const mappedHousehold = mapHouseholdCategoryDoc(fakeHouseholdDoc as any, HOUSEHOLD_ID);
    assert.strictEqual(mappedHousehold.seedKey, "groceries");
    assert.strictEqual(mappedHousehold.sortOrder, 1);

    console.log("  ✓ Test 9: tipos y mappers (Personal y Hogar) conservan seedKey y sortOrder");
  }

  console.log("All category-seed unit tests passed successfully!");
}

runCategorySeedTests().catch((err) => {
  console.error("Test failure in category-seed.test.ts:", err);
  process.exit(1);
});
