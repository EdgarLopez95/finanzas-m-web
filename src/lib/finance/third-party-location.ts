export type MoneyLocation = { accountId: string; pocketId: string | null };

export type ThirdPartyLocationEntry = {
  entryId: string;
  createdAtMillis: number;
  originalAmount: number;
  location: MoneyLocation | null;
};

export type ThirdPartyLocationLine = { entryId: string; amount: number };
export type ThirdPartyLocationMove = {
  entryId: string;
  from: MoneyLocation;
  to: MoneyLocation;
  amount: number;
};
export type ThirdPartyLocationConsumption = {
  entryId: string;
  location: MoneyLocation | null;
  amount: number;
};

const sameLocation = (a: MoneyLocation, b: MoneyLocation): boolean =>
  a.accountId === b.accountId && a.pocketId === b.pocketId;

export const amountOfThirdPartyEntryAtLocation = (
  entry: ThirdPartyLocationEntry,
  location: MoneyLocation,
  moves: ThirdPartyLocationMove[],
  consumptions: ThirdPartyLocationConsumption[],
): number => {
  let amount = entry.location && sameLocation(entry.location, location) ? entry.originalAmount : 0;
  for (const move of moves) {
    if (move.entryId !== entry.entryId) continue;
    if (sameLocation(move.from, location)) amount -= move.amount;
    if (sameLocation(move.to, location)) amount += move.amount;
  }
  for (const consumption of consumptions) {
    if (consumption.entryId === entry.entryId && consumption.location && sameLocation(consumption.location, location)) {
      amount -= consumption.amount;
    }
  }
  return amount;
};

export const projectThirdPartyHeldAtLocation = (
  location: MoneyLocation,
  entries: ThirdPartyLocationEntry[],
  moves: ThirdPartyLocationMove[],
  consumptions: ThirdPartyLocationConsumption[],
): number => entries.reduce((total, entry) => total + amountOfThirdPartyEntryAtLocation(entry, location, moves, consumptions), 0);

export const allocateThirdPartyLocationFifo = (
  amount: number,
  entries: ThirdPartyLocationEntry[],
  moves: ThirdPartyLocationMove[] = [],
  consumptions: ThirdPartyLocationConsumption[] = [],
  source?: MoneyLocation,
): ThirdPartyLocationLine[] => {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Monto inválido para FIFO.");
  if (entries.some((entry) => entry.location === null)) throw new Error("No se puede resolver la ubicación de los fondos.");
  const resolvedSource = source ?? entries[0]?.location ?? null;
  if (!resolvedSource) throw new Error("No hay fondos de terceros en el origen.");
  const available = entries
    .map((entry) => ({ entry, amount: amountOfThirdPartyEntryAtLocation(entry, resolvedSource, moves, consumptions) }))
    .sort((a, b) => a.entry.createdAtMillis - b.entry.createdAtMillis || a.entry.entryId.localeCompare(b.entry.entryId));
  if (available.some((item) => item.amount < 0)) throw new Error("Composición de fondos inconsistente.");
  if (available.reduce((sum, item) => sum + item.amount, 0) < amount) throw new Error("No hay dinero no propio suficiente en el origen.");
  let remaining = amount;
  const lines: ThirdPartyLocationLine[] = [];
  for (const item of available) {
    if (remaining === 0) break;
    const take = Math.min(item.amount, remaining);
    if (take > 0) lines.push({ entryId: item.entry.entryId, amount: take });
    if (lines.length > 50) throw new Error("La operación supera el máximo de 50 líneas FIFO.");
    remaining -= take;
  }
  return lines;
};


