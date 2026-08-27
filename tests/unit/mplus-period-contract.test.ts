import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveMonthRangeFor } from "../../src/features/movements/services/read-personal-movements";
import { startOfDayMillis, toBogotaCalendarDate } from "../../src/lib/mplus/bogota-date";
import { toContractPeriod } from "../../src/lib/mplus/period";

/**
 * Frontera "periodo elegido en la UI -> rango consultado" (contrato §4.6 y §19).
 *
 * Regresion real: `SelectedPeriod.month` es 0-indexado y `resolveMonthRangeFor`
 * exige mes calendario 1-12. Personal traducia con `+1`; el driver de Hogar
 * pasaba el valor crudo, asi que con "Agosto 2026" en pantalla consultaba
 * `occurredAt >= 2026-07-01 AND < 2026-08-01`. Todo movimiento compartido de
 * agosto quedaba fuera del rango y el Inicio de Hogar mostraba $0 con el
 * rotulo "Agosto 2026". Con Enero (mes 0) consultaba diciembre del año
 * anterior.
 *
 * Estas pruebas fijan la traduccion y el rango resultante para los tres casos
 * que rompen: mes intermedio, primer mes y ultimo mes del año.
 */

console.log("Running unit tests for mplus-period-contract.test.ts...");

// --- 1. La traduccion sube el mes a la convencion del contrato ---

assert.deepEqual(toContractPeriod({ year: 2026, month: 7 }), { year: 2026, month: 8 });
assert.deepEqual(toContractPeriod({ year: 2026, month: 0 }), { year: 2026, month: 1 });
assert.deepEqual(toContractPeriod({ year: 2026, month: 11 }), { year: 2026, month: 12 });

// --- 2. El rango consultado corresponde al mes que la UI muestra ---

/** Recorre la frontera completa tal como la ejecutan los dos drivers. */
const rangeForSelectedMonth = (year: number, month: number) => {
  const period = toContractPeriod({ year, month });
  return resolveMonthRangeFor(period.year, period.month);
};

// Agosto 2026: el caso reportado.
const august = rangeForSelectedMonth(2026, 7);
assert.deepEqual(
  toBogotaCalendarDate(august.startMillis),
  { year: 2026, month: 8, day: 1 },
  "el mes seleccionado 'Agosto' debe consultar desde el 1 de agosto, no de julio",
);
assert.deepEqual(
  toBogotaCalendarDate(august.endMillis),
  { year: 2026, month: 9, day: 1 },
  "el limite superior semiabierto de agosto es el 1 de septiembre",
);

// Enero 2026: el mes 0 no puede caer en el año anterior.
const january = rangeForSelectedMonth(2026, 0);
assert.deepEqual(toBogotaCalendarDate(january.startMillis), { year: 2026, month: 1, day: 1 });
assert.deepEqual(toBogotaCalendarDate(january.endMillis), { year: 2026, month: 2, day: 1 });

// Diciembre 2026: el limite superior cruza de año.
const december = rangeForSelectedMonth(2026, 11);
assert.deepEqual(toBogotaCalendarDate(december.startMillis), { year: 2026, month: 12, day: 1 });
assert.deepEqual(toBogotaCalendarDate(december.endMillis), { year: 2027, month: 1, day: 1 });

// --- 3. Un movimiento del mes seleccionado cae dentro del rango consultado ---

// 20 de agosto de 2026, el dia financiero tal como lo normaliza el composer.
const sharedMovementOccurredAt = startOfDayMillis({ year: 2026, month: 8, day: 20 });

assert.equal(
  sharedMovementOccurredAt >= august.startMillis && sharedMovementOccurredAt < august.endMillis,
  true,
  "un movimiento del 20 de agosto debe entrar en el rango que consulta 'Agosto 2026'",
);

// El mismo movimiento NO pertenece al mes vecino: el rango es semiabierto.
const july = rangeForSelectedMonth(2026, 6);
assert.equal(
  sharedMovementOccurredAt >= july.startMillis && sharedMovementOccurredAt < july.endMillis,
  false,
  "el rango de julio no puede contener un movimiento de agosto",
);

// --- 4. Los dos drivers usan la MISMA pieza de traduccion ---

const repoRoot = path.resolve(__dirname, "../..");

/**
 * Un driver esta bien conectado si (a) usa la pieza compartida y (b) no
 * construye el periodo a mano. Se comprueba sobre el codigo con las llamadas a
 * `toContractPeriod(...)` ya recortadas: lo que quede es periodo SIN traducir.
 */
export const assertDriverTranslatesPeriod = (driver: string, source: string): void => {
  assert.match(
    source,
    /toContractPeriod/,
    `${driver} debe traducir el periodo con la pieza compartida, no por su cuenta`,
  );

  // `[^}]` ya cruza saltos de linea: no hace falta el flag `s`.
  const untranslated = source.replace(/toContractPeriod\(\{[^}]*\}\)/g, "toContractPeriod(...)");

  // Esta es exactamente la forma que produjo el desfase de un mes:
  //   const period = { year: selectedPeriod.year, month: selectedPeriod.month };
  assert.doesNotMatch(
    untranslated,
    /month:\s*selectedPeriod\.month/,
    `${driver} no puede armar el periodo con el mes 0-indexado crudo`,
  );

  // Ni pasar un periodo literal directamente a la consulta.
  assert.doesNotMatch(
    untranslated,
    /\bload\([^;]*\{\s*year:/,
    `${driver} no puede pasar un periodo literal sin traducir a la consulta`,
  );
};

for (const driver of [
  "src/features/household/hooks/use-mplus-household.ts",
  "src/features/movements/hooks/use-mplus-personal.ts",
]) {
  assertDriverTranslatesPeriod(driver, fs.readFileSync(path.resolve(repoRoot, driver), "utf-8"));
}

// La guarda se prueba a si misma contra el codigo que tenia el bug: si estas
// aserciones dejaran de disparar, la prueba de arriba seria decorativa.
for (const buggy of [
  // Driver de Hogar antes del arreglo (commit 48afd0e).
  `const period = { year: selectedPeriod.year, month: selectedPeriod.month };\nvoid load(householdId, period);`,
  // Variante equivalente: periodo literal directo en la consulta.
  `void load(householdId, { year: selectedPeriod.year, month: selectedPeriod.month });`,
]) {
  assert.throws(
    () => assertDriverTranslatesPeriod("driver-con-bug", buggy),
    /debe traducir el periodo con la pieza compartida|mes 0-indexado crudo|periodo literal/,
    "la guarda debe rechazar el codigo que causo el desfase de un mes",
  );
}

console.log("mplus-period-contract.test.ts: OK");
