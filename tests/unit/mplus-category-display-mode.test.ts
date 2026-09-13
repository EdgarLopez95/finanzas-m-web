import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  DEFAULT_CATEGORY_DISPLAY_MODE,
  type CategoryDisplayMode,
} from "../../src/features/movements/lib/category-display-mode";

console.log("Running unit tests for mplus-category-display-mode.test.ts...");

export function runCategoryDisplayModeTests(): void {
  // 1. Contrato del helper puro
  assert.equal(
    DEFAULT_CATEGORY_DISPLAY_MODE,
    "amount",
    "El modo por defecto debe ser 'amount' ($) en paridad con Android",
  );

  const allowedModes: readonly CategoryDisplayMode[] = ["amount", "percentage"];
  assert.ok(allowedModes.includes("amount"));
  assert.ok(allowedModes.includes("percentage"));

  // 2. Guardrails sobre CategoryDisplayModeToggle
  const toggleSource = readFileSync(
    path.join(__dirname, "..", "..", "src", "components", "finance", "category-display-mode-toggle.tsx"),
    "utf8",
  );
  assert.ok(
    toggleSource.includes('role="group"'),
    "CategoryDisplayModeToggle debe usar role='group'",
  );
  assert.ok(
    toggleSource.includes('aria-label="Modo de visualización de categorías"'),
    "CategoryDisplayModeToggle debe incluir aria-label accesible",
  );
  assert.ok(
    toggleSource.includes('aria-pressed={mode === "percentage"}'),
    "El botón % debe tener aria-pressed",
  );
  assert.ok(
    toggleSource.includes('aria-pressed={mode === "amount"}'),
    "El botón $ debe tener aria-pressed",
  );
  assert.ok(
    toggleSource.includes("var(--fm-pending"),
    "Theme personal debe utilizar tokens --fm-*",
  );
  assert.ok(
    toggleSource.includes("var(--hh-primary-action"),
    "Theme household debe utilizar tokens --hh-*",
  );

  // 3. Guardrails sobre PersonalCategoryChart
  const personalChartSource = readFileSync(
    path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-category-chart.tsx"),
    "utf8",
  );
  assert.ok(
    personalChartSource.includes("displayMode = DEFAULT_CATEGORY_DISPLAY_MODE"),
    "PersonalCategoryChart debe tener default 'amount' vía DEFAULT_CATEGORY_DISPLAY_MODE",
  );
  assert.ok(
    personalChartSource.includes('displayMode === "amount" ? ('),
    "PersonalCategoryChart debe ramificar condicionalmente según displayMode",
  );
  assert.ok(
    personalChartSource.includes("<Amount"),
    "En modo amount, PersonalCategoryChart renderiza el componente Amount",
  );
  assert.ok(
    personalChartSource.includes("{item.shareLabel}"),
    "En modo percentage, PersonalCategoryChart renderiza shareLabel en el slot primario",
  );

  // 4. Guardrails sobre personal-home-view.tsx
  const personalHomeSource = readFileSync(
    path.join(__dirname, "..", "..", "src", "features", "movements", "components", "personal-home-view.tsx"),
    "utf8",
  );
  assert.ok(
    personalHomeSource.includes("categoryDisplayMode, setCategoryDisplayMode] = useState<CategoryDisplayMode>(DEFAULT_CATEGORY_DISPLAY_MODE)"),
    "personal-home-view.tsx debe inicializar el estado en DEFAULT_CATEGORY_DISPLAY_MODE ('amount')",
  );
  assert.ok(
    personalHomeSource.includes("<CategoryDisplayModeToggle"),
    "personal-home-view.tsx debe montar CategoryDisplayModeToggle",
  );
  assert.ok(
    personalHomeSource.includes("displayMode={categoryDisplayMode}"),
    "personal-home-view.tsx debe pasar categoryDisplayMode al gráfico",
  );

  // 5. Guardrails sobre HouseholdCategoryChart
  const householdChartSource = readFileSync(
    path.join(__dirname, "..", "..", "src", "features", "household", "components", "household-category-chart.tsx"),
    "utf8",
  );
  assert.ok(
    householdChartSource.includes("displayMode = DEFAULT_CATEGORY_DISPLAY_MODE"),
    "HouseholdCategoryChart debe tener default 'amount' vía DEFAULT_CATEGORY_DISPLAY_MODE",
  );
  assert.ok(
    householdChartSource.includes('displayMode === "amount" ? ('),
    "HouseholdCategoryChart debe ramificar condicionalmente según displayMode",
  );
  assert.ok(
    householdChartSource.includes("<HouseholdAmount"),
    "En modo amount, HouseholdCategoryChart renderiza HouseholdAmount",
  );
  assert.equal(
    householdChartSource.includes("--fm-"),
    false,
    "HouseholdCategoryChart no debe contener tokens --fm-*",
  );

  // 6. Guardrails sobre mplus-household-overview.tsx
  const householdOverviewSource = readFileSync(
    path.join(__dirname, "..", "..", "src", "features", "household", "components", "mplus-household-overview.tsx"),
    "utf8",
  );
  assert.ok(
    householdOverviewSource.includes("categoryDisplayMode, setCategoryDisplayMode] = useState<CategoryDisplayMode>(DEFAULT_CATEGORY_DISPLAY_MODE)"),
    "mplus-household-overview.tsx debe inicializar el estado en DEFAULT_CATEGORY_DISPLAY_MODE ('amount')",
  );
  assert.ok(
    householdOverviewSource.includes("<CategoryDisplayModeToggle"),
    "mplus-household-overview.tsx debe montar CategoryDisplayModeToggle",
  );
  assert.ok(
    householdOverviewSource.includes("displayMode={categoryDisplayMode}"),
    "mplus-household-overview.tsx debe pasar categoryDisplayMode a HouseholdCategoryChart",
  );

  console.log("OK mplus-category-display-mode");
}

runCategoryDisplayModeTests();
