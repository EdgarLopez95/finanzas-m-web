import assert from "node:assert/strict";

import {
  getActiveHouseholdCategories,
  resolveInitialCreateCategoryId,
  resolveEditHouseholdCategories,
  isValidCreateCategoryId,
} from "../../src/features/household/lib/household-category-selection";
import { mapHouseholdCategoryDoc } from "../../src/features/household/services/read-household-categories";
import { createHouseholdCategory } from "../../src/features/household/services/create-household-category";
import { updateHouseholdCategory } from "../../src/features/household/services/update-household-category";
import { archiveHouseholdCategory } from "../../src/features/household/services/archive-household-category";
import type { HouseholdCategory } from "../../src/types/household";

console.log("Running unit tests for household-categories.test.ts...");

async function runHouseholdCategoriesTests() {
  // Test 1: Helper productivo de selección de categorías para Creación y Edición de eventos
  {
    const mixedCategories: HouseholdCategory[] = [
      { id: "cat-archived-1", householdId: "hh-1", name: "Servicios Viejos", iconKey: "zap", color: "#6B7280", archived: true },
      { id: "cat-active-1", householdId: "hh-1", name: "Mercado", iconKey: "shopping-bag", color: "#EF4444", archived: false },
      { id: "cat-archived-2", householdId: "hh-1", name: "Luz Antigua", iconKey: "flame", color: "#9CA3AF", archived: true },
      { id: "cat-active-2", householdId: "hh-1", name: "Mascotas", iconKey: "heart", color: "#10B981", archived: false },
    ];

    // 1a. getActiveHouseholdCategories filtra únicamente activas
    const activeOnly = getActiveHouseholdCategories(mixedCategories);
    assert.deepStrictEqual(activeOnly.map((c) => c.id), ["cat-active-1", "cat-active-2"]);

    // 1b. resolveInitialCreateCategoryId resuelve por defecto a la primera activa (NUNCA a la primera archivada)
    const initialId = resolveInitialCreateCategoryId(mixedCategories);
    assert.strictEqual(initialId, "cat-active-1", "Default creation category must be first active category");

    // 1c. isValidCreateCategoryId rechaza categorías archivadas o inexistentes para creación
    assert.strictEqual(isValidCreateCategoryId("cat-archived-1", mixedCategories), false, "Archived category must be invalid for creation");
    assert.strictEqual(isValidCreateCategoryId("cat-active-1", mixedCategories), true, "Active category must be valid for creation");
    assert.strictEqual(isValidCreateCategoryId("", mixedCategories), true, "Empty categoryId (no category) is allowed");

    // 1d. resolveEditHouseholdCategories conserva la categoría actual archivada pero EXCLUYE otras archivadas
    const currentEventCatId = "cat-archived-1";
    const editOptions = resolveEditHouseholdCategories(mixedCategories, currentEventCatId);
    assert.deepStrictEqual(
      editOptions.map((c) => c.id),
      ["cat-archived-1", "cat-active-1", "cat-active-2"],
      "Edit options must include current event's archived category but exclude all other archived categories"
    );
    assert.strictEqual(editOptions.find((c) => c.id === "cat-archived-2"), undefined, "Other archived categories must be excluded");

    console.log("  ✓ Test 1: Helper productivo household-category-selection probado conductualmente");
  }

  // Test 2: Mapeo real de parentId desde Firestore (categorías raíz y subcategorías)
  {
    // 2a. Categoría raíz -> parentId es null
    const rootDocSnap = {
      id: "cat-root-1",
      data: () => ({
        name: "Hogar",
        iconKey: "house",
        color: "#3B82F6",
        archived: false,
        createdByUserId: "user1",
      }),
    };
    const mappedRoot = mapHouseholdCategoryDoc(rootDocSnap as any, "hh-1");
    assert.strictEqual(mappedRoot.parentId, null, "Root category parentId must map to null");

    // 2b. Subcategoría -> parentId preserva el ID string referenciado
    const subDocSnap = {
      id: "cat-sub-1",
      data: () => ({
        name: "Arriendo",
        iconKey: "house",
        color: "#3B82F6",
        archived: false,
        createdByUserId: "user1",
        parentId: "cat-root-1",
      }),
    };
    const mappedSub = mapHouseholdCategoryDoc(subDocSnap as any, "hh-1");
    assert.strictEqual(mappedSub.parentId, "cat-root-1", "Subcategory parentId must preserve parent reference string");

    console.log("  ✓ Test 2: Mapeo real de parentId verificado (null para raíz, string para subcategorías)");
  }

  // Test 3: Validación real de servicios de categorías (Creación, Edición y Archivado)
  {
    // 3a. Rechazo por nombre vacío en creación
    await assert.rejects(
      async () =>
        createHouseholdCategory({
          householdId: "hh-1",
          createdByUserId: "u1",
          name: "   ",
          iconKey: "shopping-bag",
          color: "#EF4444",
        }),
      /El nombre de la categoría es obligatorio/
    );

    // 3b. Rechazo por ícono inválido
    await assert.rejects(
      async () =>
        createHouseholdCategory({
          householdId: "hh-1",
          createdByUserId: "u1",
          name: "Comida",
          iconKey: "invalid_icon_key_123",
          color: "#EF4444",
        }),
      /no es válido/
    );

    // 3c. Rechazo por color no hexadecimal
    await assert.rejects(
      async () =>
        createHouseholdCategory({
          householdId: "hh-1",
          createdByUserId: "u1",
          name: "Comida",
          iconKey: "shopping-bag",
          color: "red",
        }),
      /El color debe ser hexadecimal válido/
    );

    // 3d. Rechazo por categoryId vacío en update
    await assert.rejects(
      async () =>
        updateHouseholdCategory({
          categoryId: "",
          name: "Mercado",
          iconKey: "shopping-bag",
          color: "#10B981",
        }),
      /El ID de la categoría es obligatorio/
    );

    // 3e. Rechazo por categoryId vacío en archive
    await assert.rejects(
      async () => archiveHouseholdCategory(""),
      /El ID de la categoría es obligatorio/
    );

    console.log("  ✓ Test 3: Servicios productivos de categorías validados directamente");
  }

  // Test 4: Contrato estructural de aislamiento por householdId en el lector productivo
  {
    const readModuleSource = await import("fs").then((fs) =>
      fs.readFileSync("src/features/household/services/read-household-categories.ts", "utf-8")
    );

    assert.ok(
      readModuleSource.includes('where("householdId", "==", householdId)'),
      "readHouseholdCategories productivo debe aislar consultas estrictamente con where('householdId', '==', householdId)"
    );

    console.log("  ✓ Test 4: Contrato estructural de aislamiento por householdId verificado en lector productivo");
  }

  console.log("All household-categories unit tests passed successfully!");
}

runHouseholdCategoriesTests().catch((err) => {
  console.error("Test failure in household-categories.test.ts:", err);
  process.exit(1);
});
