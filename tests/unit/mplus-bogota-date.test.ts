import assert from "node:assert/strict";

import {
  INVITE_TTL_MILLIS,
  PURGE_WINDOW_MILLIS,
  isTodayOrPastInBogota,
  monthStartMillis,
  nextMonthStartMillis,
  normalizeOccurredAtMillis,
  startOfDayMillis,
  toBogotaCalendarDate,
} from "../../src/lib/mplus/bogota-date";

/**
 * Fecha financiera en `America/Bogota` (contrato §4.6). El huso del proceso no
 * debe alterar ningun resultado: Colombia es UTC-5 fijo (sin horario de
 * verano), asi que el inicio de dia siempre cae a las 05:00 UTC.
 */

// Inicio de dia = 05:00 UTC del mismo dia calendario bogotano.
assert.equal(
  startOfDayMillis({ year: 2026, month: 8, day: 20 }),
  Date.UTC(2026, 7, 20, 5, 0, 0),
);
assert.equal(
  startOfDayMillis({ year: 2026, month: 1, day: 1 }),
  Date.UTC(2026, 0, 1, 5, 0, 0),
);

// 23:30 del 20/08 en Bogota (04:30 UTC del 21) sigue siendo el dia 20.
{
  const lateNight = Date.UTC(2026, 7, 21, 4, 30, 0);
  assert.deepEqual(toBogotaCalendarDate(lateNight), { year: 2026, month: 8, day: 20 });
  assert.equal(normalizeOccurredAtMillis(lateNight), Date.UTC(2026, 7, 20, 5, 0, 0));
}

// 00:30 UTC del 21/08 son las 19:30 del 20/08 en Bogota.
{
  const utcEarly = Date.UTC(2026, 7, 21, 0, 30, 0);
  assert.deepEqual(toBogotaCalendarDate(utcEarly), { year: 2026, month: 8, day: 20 });
}

// Intervalo mensual semiabierto: [inicioDelMes, inicioDelMesSiguiente).
{
  const mid = Date.UTC(2026, 7, 15, 12, 0, 0);
  assert.equal(monthStartMillis(mid), Date.UTC(2026, 7, 1, 5, 0, 0));
  assert.equal(nextMonthStartMillis(mid), Date.UTC(2026, 8, 1, 5, 0, 0));
}

// Cruce de anio: diciembre -> enero del anio siguiente.
{
  const december = Date.UTC(2026, 11, 20, 12, 0, 0);
  assert.equal(monthStartMillis(december), Date.UTC(2026, 11, 1, 5, 0, 0));
  assert.equal(nextMonthStartMillis(december), Date.UTC(2027, 0, 1, 5, 0, 0));
}

// El ultimo instante del mes cae dentro; el primero del siguiente, fuera.
{
  const now = Date.UTC(2026, 7, 15, 12, 0, 0);
  const lastInstant = nextMonthStartMillis(now) - 1;
  assert.equal(lastInstant >= monthStartMillis(now), true);
  assert.equal(lastInstant < nextMonthStartMillis(now), true);
  assert.equal(monthStartMillis(nextMonthStartMillis(now)), nextMonthStartMillis(now));
}

// "Hoy o pasado, nunca futuro" se evalua por DIA bogotano, no por instante.
{
  const nowBogota = Date.UTC(2026, 7, 20, 16, 0, 0); // 11:00 en Bogota
  assert.equal(isTodayOrPastInBogota(Date.UTC(2026, 7, 20, 5, 0, 0), nowBogota), true);
  // Mismo dia bogotano pero mas tarde que "ahora": sigue siendo hoy -> valido.
  assert.equal(isTodayOrPastInBogota(Date.UTC(2026, 7, 21, 3, 0, 0), nowBogota), true);
  assert.equal(isTodayOrPastInBogota(Date.UTC(2026, 7, 19, 5, 0, 0), nowBogota), true);
  // Manana bogotano: invalido.
  assert.equal(isTodayOrPastInBogota(Date.UTC(2026, 7, 21, 5, 0, 0), nowBogota), false);
}

// Ventanas del contrato.
assert.equal(PURGE_WINDOW_MILLIS, 30 * 24 * 60 * 60 * 1000);
assert.equal(INVITE_TTL_MILLIS, 7 * 24 * 60 * 60 * 1000);

console.log("OK mplus-bogota-date");
