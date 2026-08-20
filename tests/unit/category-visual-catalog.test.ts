import assert from "node:assert/strict";

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

    console.log("  ✓ Test 1: catálogos de 40 gastos y 24 ingresos en paridad 1:1 con Android");
  }

  // Test 2: paleta compartida de 16 colores en el mismo orden que Android.
  {
    assert.strictEqual(CATEGORY_COLOR_PALETTE.length, 16, "La paleta debe tener exactamente 16 colores");
    assert.deepStrictEqual(CATEGORY_COLOR_PALETTE, ANDROID_COLOR_PALETTE, "El orden de la paleta debe ser idéntico al de Android");
    for (const color of CATEGORY_COLOR_PALETTE) {
      assert.ok(/^#[0-9A-F]{6}$/i.test(color), `Color '${color}' debe ser un hex de 6 dígitos`);
    }
    console.log("  ✓ Test 2: paleta de 16 colores hex en orden canónico verificado");
  }

  // Test 3: grupos de iconos estructurados y completos.
  {
    assert.strictEqual(EXPENSE_ICON_GROUPS.length > 0, true, "EXPENSE_ICON_GROUPS no debe estar vacío");
    assert.strictEqual(INCOME_ICON_GROUPS.length > 0, true, "INCOME_ICON_GROUPS no debe estar vacío");

    for (const group of EXPENSE_ICON_GROUPS) {
      assert.ok(group.title.length > 0, "Cada grupo de gasto debe tener un título");
      for (const key of group.iconKeys) {
        assert.ok(isValidIconKey(key, "expense"), `IconKey '${key}' en grupo '${group.title}' debe pertenecer al catálogo de gasto`);
      }
    }

    for (const group of INCOME_ICON_GROUPS) {
      assert.ok(group.title.length > 0, "Cada grupo de ingreso debe tener un título");
      for (const key of group.iconKeys) {
        assert.ok(isValidIconKey(key, "income"), `IconKey '${key}' en grupo '${group.title}' debe pertenecer al catálogo de ingreso`);
      }
    }

    console.log("  ✓ Test 3: grupos de iconos estructurados y completos");
  }

  // Test 4: paleta de Hogar contiene los 16 colores + fallback default.
  {
    assert.strictEqual(HOUSEHOLD_CATEGORY_COLORS.length, 16, "HOUSEHOLD_CATEGORY_COLORS debe tener 16 opciones");
    assert.deepStrictEqual(HOUSEHOLD_CATEGORY_COLORS, CATEGORY_COLOR_PALETTE, "HOUSEHOLD_CATEGORY_COLORS debe ser idéntica a la paleta compartida");
    assert.strictEqual(DEFAULT_HOUSEHOLD_CATEGORY_COLOR, "#EF4444", "DEFAULT_HOUSEHOLD_CATEGORY_COLOR debe ser #EF4444");
    console.log("  ✓ Test 4: paleta de Hogar alineada con la compartida");
  }

  // Test 5: validación de icono/color en Personal y Hogar.
  {
    assert.strictEqual(isValidIconKey("food", "expense"), true);
    assert.strictEqual(isValidIconKey("salary", "income"), true);
    assert.strictEqual(isValidIconKey("not_a_real_icon", "expense"), false);
    assert.strictEqual(isValidIconKey("food", "income"), false, "Un iconKey de gasto no es válido como ingreso");
    assert.strictEqual(isValidCategoryColor("#EF4444"), true);
    assert.strictEqual(isValidCategoryColor("red"), false);

    // Hogar acepta el catálogo de gasto compartido (paridad con Personal).
    assert.doesNotThrow(() => {
      if (!isValidIconKey("housing", "expense")) throw new Error("housing debe ser válido para Hogar");
    });

    console.log("  ✓ Test 5: validación de icono/color verificada en Personal y Hogar");
  }

  console.log("All category-visual-catalog unit tests passed successfully!");
}

runCategoryVisualCatalogTests().catch((err) => {
  console.error("Test failure in category-visual-catalog.test.ts:", err);
  process.exit(1);
});
