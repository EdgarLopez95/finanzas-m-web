/**
 * G1 — Distribución de dinero por ubicación (panel "Dinero no propio / Mi
 * dinero" del dashboard). Módulo puro: sin React, sin Firestore. Reusa
 * `resolveAccountComposition` (Paso 6) para no duplicar la proyección FIFO
 * localizada — este archivo solo decide qué filas se muestran y en qué modo.
 */

import { resolveAccountComposition } from "@/lib/finance/account-ownership-composition";
import type {
  ThirdPartyLocationConsumption,
  ThirdPartyLocationEntry,
  ThirdPartyLocationMove,
} from "@/lib/finance/third-party-location";

export type OwnershipDistributionMode = "not_mine" | "mine";

export type OwnershipDistributionLocationRow = {
  kind: "available" | "pocket";
  accountId: string;
  accountName: string;
  pocketId: string | null;
  pocketName: string | null;
  physical: number;
  own: number;
  thirdParty: number;
  isInconsistent: boolean;
  /** Monto relevante al mode actual. */
  displayAmount: number;
};

export type OwnershipDistributionAccountGroup = {
  accountId: string;
  accountName: string;
  rows: OwnershipDistributionLocationRow[];
  groupTotal: number;
};

/**
 * G1.1 — Decide qué variante de cuerpo muestra el panel: lista de filas,
 * vacío "de verdad" (sin no propio en ninguna ubicación resoluble), o vacío
 * con legado sin ubicación verificable (nunca se imputa a ninguna cuenta,
 * pero tampoco se muestra como si no hubiera nada pendiente).
 */
export function resolveOwnershipPanelEmptyState(params: {
  groupsLength: number;
  unlocatedAmount: number;
  mode: OwnershipDistributionMode;
}): "legacy" | "empty" | "list" {
  if (params.groupsLength > 0) return "list";
  if (params.unlocatedAmount > 0) return "legacy";
  return "empty";
}

export function buildOwnershipDistribution(params: {
  mode: OwnershipDistributionMode;
  accounts: Array<{ id: string; name: string; balance: number }>;
  pockets: Array<{ id: string; accountId: string; name: string; balance: number }>;
  entries: ThirdPartyLocationEntry[];
  moves: ThirdPartyLocationMove[];
  consumptions: ThirdPartyLocationConsumption[];
}): {
  groups: OwnershipDistributionAccountGroup[];
  grandTotal: number;
  hasInconsistency: boolean;
} {
  const { mode, accounts, pockets, entries, moves, consumptions } = params;

  const sortedAccounts = [...accounts].sort((a, b) => a.name.localeCompare(b.name, "es"));

  const groups: OwnershipDistributionAccountGroup[] = [];
  let grandTotal = 0;
  let hasInconsistency = false;

  for (const account of sortedAccounts) {
    const accountPockets = pockets
      .filter((pocket) => pocket.accountId === account.id)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    const composition = resolveAccountComposition({
      accountId: account.id,
      availableBalance: account.balance,
      pockets: accountPockets.map((pocket) => ({ id: pocket.id, balance: pocket.balance })),
      entries,
      moves,
      consumptions,
    });

    const rows: OwnershipDistributionLocationRow[] = [];

    const availableLocation = composition.byLocation.find((location) => location.location.pocketId === null);
    if (availableLocation) {
      const displayAmount = mode === "not_mine" ? availableLocation.thirdParty : availableLocation.own;
      if (displayAmount !== 0 || availableLocation.isInconsistent) {
        rows.push({
          kind: "available",
          accountId: account.id,
          accountName: account.name,
          pocketId: null,
          pocketName: null,
          physical: availableLocation.physical,
          own: availableLocation.own,
          thirdParty: availableLocation.thirdParty,
          isInconsistent: availableLocation.isInconsistent,
          displayAmount,
        });
      }
    }

    for (const pocket of accountPockets) {
      const location = composition.byLocation.find((item) => item.location.pocketId === pocket.id);
      if (!location) continue;
      const displayAmount = mode === "not_mine" ? location.thirdParty : location.own;
      if (displayAmount === 0 && !location.isInconsistent) continue;
      rows.push({
        kind: "pocket",
        accountId: account.id,
        accountName: account.name,
        pocketId: pocket.id,
        pocketName: pocket.name,
        physical: location.physical,
        own: location.own,
        thirdParty: location.thirdParty,
        isInconsistent: location.isInconsistent,
        displayAmount,
      });
    }

    if (rows.length === 0) continue;

    const groupTotal = rows.reduce((sum, row) => sum + row.displayAmount, 0);
    grandTotal += groupTotal;
    if (rows.some((row) => row.isInconsistent)) hasInconsistency = true;

    groups.push({
      accountId: account.id,
      accountName: account.name,
      rows,
      groupTotal,
    });
  }

  return { groups, grandTotal, hasInconsistency };
}
