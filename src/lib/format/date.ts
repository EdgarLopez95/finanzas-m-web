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

export const isSameMonthAndYear = (value: Date | null | undefined, reference: Date): boolean => {
  if (!value || !isValidDate(value)) {
    return false;
  }

  const calendarDate = getCalendarDateParts(value);

  return calendarDate.year === reference.getFullYear() && calendarDate.monthIndex === reference.getMonth();
};

export const formatPersonalMovementDateEs = (value: Date): string => {
  const calendarDate = getCalendarDateParts(value);

  return formatDateEs(new Date(calendarDate.year, calendarDate.monthIndex, calendarDate.day));
};
