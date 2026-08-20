const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

const padDateSegment = (value: number): string => String(value).padStart(2, "0");

type CalendarDateParts = {
  year: number;
  monthIndex: number;
  day: number;
};

const formatCalendarDateParts = ({ year, monthIndex, day }: CalendarDateParts): string =>
  `${year}-${padDateSegment(monthIndex + 1)}-${padDateSegment(day)}`;

const looksLikeUtcMidnightDateOnly = (value: Date): boolean =>
  value.getUTCHours() === 0 &&
  value.getUTCMinutes() === 0 &&
  value.getUTCSeconds() === 0 &&
  value.getUTCMilliseconds() === 0;

export const getLocalDate = (value: Date): Date => {
  if (looksLikeUtcMidnightDateOnly(value)) {
    return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0);
  }
  return value;
};

const getCalendarDateParts = (value: Date): CalendarDateParts => {
  if (looksLikeUtcMidnightDateOnly(value)) {
    return {
      year: value.getUTCFullYear(),
      monthIndex: value.getUTCMonth(),
      day: value.getUTCDate(),
    };
  }

  return {
    year: value.getFullYear(),
    monthIndex: value.getMonth(),
    day: value.getDate(),
  };
};

export const formatDateEs = (value: Date): string =>
  new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);

export const formatDateInputValue = (value: Date | null | undefined, fallbackDate = new Date()): string => {
  if (value && isValidDate(value)) {
    return formatCalendarDateParts(getCalendarDateParts(value));
  }

  return `${fallbackDate.getFullYear()}-${padDateSegment(fallbackDate.getMonth() + 1)}-${padDateSegment(fallbackDate.getDate())}`;
};

export const getTodayDateInputValue = (now = new Date()): string => formatDateInputValue(now, now);

export const parseDateInputAsLocalDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const day = Number(dayRaw);

  const parsed = new Date(year, monthIndex, day);
  if (!isValidDate(parsed)) {
    return null;
  }

  if (parsed.getFullYear() !== year || parsed.getMonth() !== monthIndex || parsed.getDate() !== day) {
    return null;
  }

  return parsed;
};

export type SelectedPeriod = {
  year: number;
  month: number; // 0-indexed (0 = Enero, 11 = Diciembre)
};

export const getMonthDateRange = (period: SelectedPeriod): { start: Date; end: Date } => {
  const start = new Date(period.year, period.month, 1, 0, 0, 0, 0);
  const end = new Date(period.year, period.month + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

export const formatPeriodLabel = (period: SelectedPeriod): string => {
  const date = new Date(period.year, period.month, 1);
  const label = new Intl.DateTimeFormat("es-CO", { month: "long" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const formatPeriodSummary = (period: SelectedPeriod): string => {
  return `${formatPeriodLabel(period)} ${period.year}`;
};

export const isSameMonthAndYear = (
  value: Date | null | undefined,
  reference: Date | SelectedPeriod
): boolean => {
  if (!value || !isValidDate(value)) {
    return false;
  }

  const localDate = getLocalDate(value);
  
  if (reference instanceof Date) {
    const refLocalDate = getLocalDate(reference);
    return localDate.getFullYear() === refLocalDate.getFullYear() && localDate.getMonth() === refLocalDate.getMonth();
  }

  const startOfMonth = new Date(reference.year, reference.month, 1, 0, 0, 0, 0);
  const startOfNextMonth = new Date(reference.year, reference.month + 1, 1, 0, 0, 0, 0);
  
  const time = localDate.getTime();
  return time >= startOfMonth.getTime() && time < startOfNextMonth.getTime();
};

export const formatPersonalMovementDateEs = (value: Date): string => {
  const calendarDate = getCalendarDateParts(value);

  return formatDateEs(new Date(calendarDate.year, calendarDate.monthIndex, calendarDate.day));
};

export const formatMovementGroupLabelEs = (
  date: Date | null,
  referenceDate = new Date(),
): string => {
  if (!date) return "Sin fecha";
  const d = getLocalDate(date);
  const ref = getLocalDate(referenceDate);
  const isToday =
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate();
  if (isToday) return "Hoy";
  const yesterday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "Ayer";
  return formatDateEs(d);
};

