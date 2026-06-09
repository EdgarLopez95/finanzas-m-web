import assert from "node:assert/strict";

import {
  formatDateInputValue,
  formatPersonalMovementDateEs,
  isSameMonthAndYear,
  parseDateInputAsLocalDate,
} from "@/lib/format/date";

const juneFirst = parseDateInputAsLocalDate("2026-06-01");
assert.ok(juneFirst, "debe convertir YYYY-MM-DD a Date local valida");
assert.equal(juneFirst.getFullYear(), 2026, "debe conservar el anio elegido");
assert.equal(juneFirst.getMonth(), 5, "debe conservar junio al clasificar por mes");
assert.equal(juneFirst.getDate(), 1, "debe conservar el primer dia del mes");
assert.equal(formatDateInputValue(juneFirst), "2026-06-01", "debe poder volver al valor del input sin corrimiento");

const juneReference = parseDateInputAsLocalDate("2026-06-15");
const juneLast = parseDateInputAsLocalDate("2026-06-30");
const mayLast = parseDateInputAsLocalDate("2026-05-31");
const julyFirst = parseDateInputAsLocalDate("2026-07-01");

assert.ok(juneReference && juneLast && mayLast && julyFirst, "las fechas de borde del test deben parsearse");
assert.equal(isSameMonthAndYear(juneFirst, juneReference), true, "el primer dia del mes debe quedar dentro del mismo mes");
assert.equal(isSameMonthAndYear(juneLast, juneReference), true, "el ultimo dia del mes debe quedar dentro del mismo mes");
assert.equal(isSameMonthAndYear(mayLast, juneReference), false, "mayo no debe contarse como junio");
assert.equal(isSameMonthAndYear(julyFirst, juneReference), false, "julio no debe contarse como junio");

const legacyUtcDateOnly = new Date("2026-06-01");
assert.equal(formatDateInputValue(legacyUtcDateOnly), "2026-06-01", "debe conservar el dia calendario de registros historicos guardados a medianoche UTC");
assert.equal(isSameMonthAndYear(legacyUtcDateOnly, juneReference), true, "un registro historico en UTC medianoche debe seguir clasificando en junio");
assert.match(
  formatPersonalMovementDateEs(legacyUtcDateOnly),
  /01.*jun.*2026/i,
  "el timeline debe mostrar el dia calendario correcto para registros historicos"
);

assert.equal(parseDateInputAsLocalDate("2026-02-31"), null, "debe rechazar fechas de calendario invalidas");

console.log("OK personal-date-input-local");
