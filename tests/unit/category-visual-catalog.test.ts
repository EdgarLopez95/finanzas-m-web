import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  expenseIconCatalog,
  incomeIconCatalog,
  expenseIconOptions,
  incomeIconOptions,
  EXPENSE_ICON_GROUPS,
  INCOME_ICON_GROUPS,
  CATEGORY_COLOR_PALETTE,
  isValidIconKey,
  isValidCategoryColor,
} from "../../src/lib/categories/category-icons";
import {
  HOUSEHOLD_CATEGORY_COLORS,
  DEFAULT_HOUSEHOLD_CATEGORY_COLOR,
} from "../../src/lib/categories/household-category-colors";
import { createCategory } from "../../src/features/categories/services/create-category";
import { updateCategory } from "../../src/features/categories/services/update-category";
import { createHouseholdCategory } from "../../src/features/household/services/create-household-category";
import { updateHouseholdCategory } from "../../src/features/household/services/update-household-category";

console.log("Running unit tests for category-visual-catalog.test.ts...");

// Catálogo canónico Android (CategoryVisualCatalog.kt), sólo lectura, para comparación.
const ANDROID_EXPENSE_ICON_KEYS = [
  "food", "groceries", "housing", "bills", "car", "transport", "credit_card", "health",
  "pets", "entertainment", "subscriptions", "family", "education", "bank", "gasoline",
  "restaurant", "delivery", "coffee", "internet", "phone", "electricity", "water",
  "gas_service", "cleaning", "maintenance", "shopping", "clothes", "personal_care",
  "pharmacy", "fitness", "gifts", "celebration", "travel", "apps", "cloud", "insurance",
  "parking", "toll", "haircut", "other",
];

const ANDROID_INCOME_ICON_KEYS = [
  "salary", "freelance", "design_work", "service_work", "sales", "business",
  "client_payment", "commission", "bonus", "investment", "interest", "dividends",
  "rental_income", "family_support", "gift_income", "cashback", "refund",
  "reimbursement", "loan_received", "content_income", "teaching", "creative_income",
  "other_income", "unknown_income",
];

// Paleta Android (CategoryVisualCatalog.kt#categoryColorPaletteHex), orden exacto.
const ANDROID_COLOR_PALETTE = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16", "#22C55E", "#10B981", "#14B8A6",
  "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1", "#8B5CF6", "#D946EF", "#EC4899", "#FB7185",
];

async function runCategoryVisualCatalogTests() {
  // Test 1: catálogo compartido de 40 gastos y 24 ingresos, en paridad exacta con Android.
  {
    const expenseKeys = expenseIconOptions.map((o) => o.iconKey).sort();
    const androidExpenseSorted = [...ANDROID_EXPENSE_ICON_KEYS].sort();
    assert.strictEqual(expenseIconOptions.length, 40, "El catálogo de gasto debe tener exactamente 40 iconKey");
    assert.deepStrictEqual(expenseKeys, androidExpenseSorted, "Las claves de gasto deben coincidir 1:1 con Android");
    for (const key of ANDROID_EXPENSE_ICON_KEYS) {
      assert.ok(expenseIconCatalog[key], `expenseIconCatalog debe resolver un componente para '${key}'`);
    }

    const incomeKeys = incomeIconOptions.map((o) => o.iconKey).sort();
    const androidIncomeSorted = [...ANDROID_INCOME_ICON_KEYS].sort();
    assert.strictEqual(incomeIconOptions.length, 24, "El catálogo de ingreso debe tener exactamente 24 iconKey");
    assert.deepStrictEqual(incomeKeys, androidIncomeSorted, "Las claves de ingreso deben coincidir 1:1 con Android");
    for (const key of ANDROID_INCOME_ICON_KEYS) {
      assert.ok(incomeIconCatalog[key], `incomeIconCatalog debe resolver un componente para '${key}'`);
    }

    console.log("  ✓ Test 1: catálogo compartido de 40 gastos y 24 ingresos verificado contra Android");
  }

  // Test 2: Hogar reutiliza EXCLUSIVAMENTE el catálogo de gasto (sin opciones de ingreso).
  {
    const householdViewSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/features/household/components/views/household-categories-view.tsx"),
      "utf-8"
    );
    assert.doesNotMatch(
      householdViewSource,
      /incomeIconOptions|incomeIconCatalog|INCOME_ICON_GROUPS/,
      "household-categories-view.tsx no debe importar ni referenciar ningún catálogo de ingreso"
    );
    assert.match(
      householdViewSource,
      /expenseIconOptions|expenseIconCatalog/,
      "household-categories-view.tsx debe reutilizar el catálogo de gasto compartido"
    );

    const iconSelectSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/features/household/components/ui/household-icon-select.tsx"),
      "utf-8"
    );
    assert.doesNotMatch(
      iconSelectSource,
      /incomeIconOptions|incomeIconCatalog|INCOME_ICON_GROUPS/,
      "household-icon-select.tsx no debe importar ni referenciar ningún catálogo de ingreso"
    );

    console.log("  ✓ Test 2: Hogar sin opciones de ingreso verificado");
  }

  // Test 3: paleta exacta de 16 colores y orden Android, única fuente para Personal y Hogar.
  {
    assert.deepStrictEqual(CATEGORY_COLOR_PALETTE, ANDROID_COLOR_PALETTE, "CATEGORY_COLOR_PALETTE debe coincidir en valores y orden con Android");
    assert.deepStrictEqual(HOUSEHOLD_CATEGORY_COLORS, CATEGORY_COLOR_PALETTE, "HOUSEHOLD_CATEGORY_COLORS debe ser la misma paleta canónica (sin divergencia de 12 colores)");
    assert.ok(CATEGORY_COLOR_PALETTE.includes(DEFAULT_HOUSEHOLD_CATEGORY_COLOR), "El color por defecto de Hogar debe pertenecer a la paleta canónica");

    console.log("  ✓ Test 3: paleta canónica de 16 colores Android verificada en Personal y Hogar");
  }

  // Test 4: grupos canónicos de filtro para Personal (gasto) — Todos + 8 grupos Android.
  {
    const expenseGroupTitles = EXPENSE_ICON_GROUPS.map((g) => g.title);
    assert.deepStrictEqual(
      expenseGroupTitles,
      ["Hogar", "Movilidad", "Finanzas", "Comida", "Servicios", "Compras", "Ocio", "Otros"],
      "Los grupos de gasto deben ser exactamente los 8 grupos canónicos Android, en ese orden"
    );
    for (const group of EXPENSE_ICON_GROUPS) {
      for (const key of group.iconKeys) {
        assert.ok(ANDROID_EXPENSE_ICON_KEYS.includes(key), `El grupo '${group.title}' referencia una clave de gasto inexistente: '${key}'`);
      }
    }
    assert.ok(INCOME_ICON_GROUPS.length > 0, "Debe existir un catálogo de grupos canónicos para ingreso");

    console.log("  ✓ Test 4: grupos canónicos de filtro de gasto verificados");
  }

  // Test 5: validación de icono/color en creación y edición, Personal y Hogar.
  {
    assert.strictEqual(isValidIconKey("food", "expense"), true);
    assert.strictEqual(isValidIconKey("salary", "income"), true);
    assert.strictEqual(isValidIconKey("not_a_real_icon", "expense"), false);
    assert.strictEqual(isValidIconKey("food", "income"), false, "Un iconKey de gasto no es válido como ingreso");
    assert.strictEqual(isValidCategoryColor("#EF4444"), true);
    assert.strictEqual(isValidCategoryColor("red"), false);

    await assert.rejects(
      async () => createCategory({ ownerId: "u1", name: "Test", kind: "expense", iconKey: "not_a_real_icon", color: "#EF4444" }),
      /no pertenece al catálogo/
    );
    await assert.rejects(
      async () => createCategory({ ownerId: "u1", name: "Test", kind: "expense", iconKey: "food", color: "azul" }),
      /formato hexadecimal válido/
    );
    await assert.rejects(
      async () => updateCategory({ ownerId: "u1", categoryId: "c1", name: "Test", kind: "expense", iconKey: "not_a_real_icon", color: "#EF4444" }),
      /no pertenece al catálogo/
    );

    await assert.rejects(
      async () => createHouseholdCategory({ householdId: "hh1", createdByUserId: "u1", name: "Test", iconKey: "not_a_real_icon", color: "#EF4444" }),
      /no es válido/
    );
    await assert.rejects(
      async () => createHouseholdCategory({ householdId: "hh1", createdByUserId: "u1", name: "Test", iconKey: "food", color: "azul" }),
      /hexadecimal válido/
    );
    await assert.rejects(
      async () => updateHouseholdCategory({ categoryId: "c1", name: "Test", iconKey: "not_a_real_icon", color: "#EF4444" }),
      /no es válido/
    );
    // Hogar acepta el catálogo de gasto compartido (paridad con Personal).
    assert.doesNotThrow(() => {
      if (!isValidIconKey("housing", "expense")) throw new Error("housing debe ser válido para Hogar");
    });

    console.log("  ✓ Test 5: validación de icono/color verificada en creación y edición, Personal y Hogar");
  }

  console.log("All category-visual-catalog unit tests passed successfully!");
}

runCategoryVisualCatalogTests().catch((err) => {
  console.error("Test failure in category-visual-catalog.test.ts:", err);
  process.exit(1);
});
