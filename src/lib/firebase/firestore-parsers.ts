export const toSafeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

export const toSafeString = (value: unknown, fallback = ""): string => {
  return typeof value === "string" ? value : fallback;
};

export const toDateOrNull = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const converted = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(converted.getTime()) ? null : converted;
  }

  if (typeof value === "string" || typeof value === "number") {
    const converted = new Date(value);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }

  return null;
};
