/**
 * Fecha financiera normalizada en `America/Bogota` (contrato §4.6).
 *
 * Espejo TS de `android/.../domain/mplus/BogotaDate.kt`. La zona del navegador
 * es irrelevante: un movimiento creado a las 23:00 en Madrid pertenece al día
 * bogotano correspondiente, igual que en Android. Colombia no aplica horario
 * de verano, por lo que el desplazamiento es fijo (-05:00); aun así el cálculo
 * se hace con `Intl` para no codificar el offset a mano.
 */

export const BOGOTA_TIME_ZONE = "America/Bogota";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BOGOTA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export type BogotaCalendarDate = Readonly<{ year: number; month: number; day: number }>;

const readParts = (millis: number) => {
  const parts = partsFormatter.formatToParts(new Date(millis));
  const lookup = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type)?.value ?? "0";
    return Number(found);
  };
  return {
    year: lookup("year"),
    month: lookup("month"),
    day: lookup("day"),
    hour: lookup("hour") % 24,
    minute: lookup("minute"),
    second: lookup("second"),
  };
};

/** Desplazamiento de Bogotá respecto de UTC, en milisegundos, para [millis]. */
const bogotaOffsetMillis = (millis: number): number => {
  const p = readParts(millis);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncatedToSecond = Math.floor(millis / 1000) * 1000;
  return asUtc - truncatedToSecond;
};

/** Día calendario bogotano que contiene [millis]. */
export const toBogotaCalendarDate = (millis: number): BogotaCalendarDate => {
  const { year, month, day } = readParts(millis);
  return { year, month, day };
};

/** Instante = inicio de día (00:00 Bogotá) de [date], como epoch millis. */
export const startOfDayMillis = (date: BogotaCalendarDate): number => {
  const naiveUtc = Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0);
  // Primera aproximación con el offset del propio instante candidato; se
  // reevalúa una vez porque el offset podría diferir cerca de un cambio de día.
  const firstGuess = naiveUtc - bogotaOffsetMillis(naiveUtc);
  return naiveUtc - bogotaOffsetMillis(firstGuess);
};

/** Inicio del mes bogotano que contiene [millis] (límite inferior, inclusivo). */
export const monthStartMillis = (millis: number): number => {
  const { year, month } = toBogotaCalendarDate(millis);
  return startOfDayMillis({ year, month, day: 1 });
};

/** Inicio del mes siguiente (límite superior semiabierto, contrato §4.6). */
export const nextMonthStartMillis = (millis: number): number => {
  const { year, month } = toBogotaCalendarDate(millis);
  return month === 12
    ? startOfDayMillis({ year: year + 1, month: 1, day: 1 })
    : startOfDayMillis({ year, month: month + 1, day: 1 });
};

/** Normaliza cualquier instante al inicio de su día bogotano (`occurredAt`). */
export const normalizeOccurredAtMillis = (millis: number): number =>
  startOfDayMillis(toBogotaCalendarDate(millis));

/** Clave de día bogotana en formato `yyyy-MM-dd` para un epoch millis. */
export const formatDayKey = (millis: number): string => {
  const { year, month, day } = toBogotaCalendarDate(millis);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
};

/** Clave de mes bogotana en formato `yyyy-MM` para un epoch millis. */
export const formatMonthKey = (millis: number): string => {
  const { year, month } = toBogotaCalendarDate(millis);
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}`;
};

const isAfterDate = (a: BogotaCalendarDate, b: BogotaCalendarDate): boolean =>
  a.year !== b.year
    ? a.year > b.year
    : a.month !== b.month
      ? a.month > b.month
      : a.day > b.day;

/** `true` si [occurredAtMillis] cae hoy o en un día pasado en Bogotá (nunca futuro). */
export const isTodayOrPastInBogota = (occurredAtMillis: number, nowMillis: number): boolean =>
  !isAfterDate(toBogotaCalendarDate(occurredAtMillis), toBogotaCalendarDate(nowMillis));

/** Contrato §9.5: `purgeAfter = trashedAt + 30 días`. */
export const PURGE_WINDOW_MILLIS = 30 * 24 * 60 * 60 * 1000;

/** Contrato §12.1: la invitación vence a los 7 días de creada. */
export const INVITE_TTL_MILLIS = 7 * 24 * 60 * 60 * 1000;

