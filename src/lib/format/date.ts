export const formatDateEs = (value: Date): string =>
  new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
