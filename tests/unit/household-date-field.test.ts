import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for household-date-field.test.ts...");

const dateFieldSrc = fs.readFileSync(
  path.resolve(__dirname, "../../src/features/household/components/ui/household-date-field.tsx"),
  "utf-8"
);
const createSrc = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../src/features/household/components/create-household-expense-dialog.tsx"
  ),
  "utf-8"
);

function run() {
  assert.match(dateFieldSrc, /WEEKDAYS/, "debe renderizar grilla semanal");
  assert.match(dateFieldSrc, /goPrevMonth|Mes anterior/, "debe navegar mes anterior");
  assert.match(dateFieldSrc, /goNextMonth|Mes siguiente/, "debe navegar mes siguiente");
  assert.match(dateFieldSrc, /var\(--hh-primary-action\)/, "calendario con tokens Hogar");
  assert.doesNotMatch(dateFieldSrc, /--fm-/, "no debe usar tokens Personal");
  assert.match(dateFieldSrc, /createPortal/, "el panel debe portalizarse sobre el modal");
  assert.match(dateFieldSrc, /Hoy/, "atajo Hoy");
  assert.match(
    createSrc,
    /<HouseholdDateField[\s\S]{0,200}id="create-household-expense-date"/,
    "nuevo gasto debe usar HouseholdDateField"
  );
  assert.doesNotMatch(
    createSrc,
    /type="date"/,
    "nuevo gasto ya no usa input type=date nativo para el campo Fecha"
  );

  console.log("  ✓ Calendario Hogar en Fecha (día/mes/año) + cableado en nuevo gasto");
  console.log("All household-date-field unit tests passed successfully!");
}

try {
  run();
} catch (err) {
  console.error("Test failure in household-date-field.test.ts:", err);
  process.exit(1);
}
