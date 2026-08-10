import { isSameMonthAndYear } from "@/lib/format/date";
import type { SelectedPeriod } from "@/lib/format/date";
import type {
  HouseholdEvent,
  HouseholdIncomeEntry,
  HouseholdCategory,
  HouseholdEventShare,
} from "@/types/household";

export type CategoryBreakdownItem = {
  categoryId: string;
  name: string;
  iconKey: string;
  color: string;
  total: number;
  count: number;
};

export type MemberResponsibility = {
  memberUserId: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  shareCount: number;
  pendingCount: number;
};

export function filterActiveMonthlyEvents(
  events: HouseholdEvent[],
  period: SelectedPeriod
): HouseholdEvent[] {
  return events.filter(
    (event) => event.isActive && isSameMonthAndYear(event.eventDate ?? event.createdAt, period)
  );
}

export function filterActiveMonthlyIncomeEntries(
  incomeEntries: HouseholdIncomeEntry[],
  period: SelectedPeriod
): HouseholdIncomeEntry[] {
  return incomeEntries.filter(
    (entry) =>
      entry.status !== "cancelled" &&
      entry.status !== "cancelado" &&
      isSameMonthAndYear(entry.entryDate ?? entry.createdAt, period)
  );
}

export function calculateMonthlyExpenseTotal(events: HouseholdEvent[]): number {
  return events.reduce((sum, event) => sum + Math.max(event.amount, 0), 0);
}

export function calculateMonthlyIncomeTotal(incomeEntries: HouseholdIncomeEntry[]): number {
  return incomeEntries.reduce((sum, entry) => sum + Math.max(entry.amount, 0), 0);
}

export function calculateMonthlyBalance(incomeTotal: number, expenseTotal: number): number {
  return incomeTotal - expenseTotal;
}

export function groupCategoryBreakdown(
  events: HouseholdEvent[],
  categories: HouseholdCategory[]
): CategoryBreakdownItem[] {
  const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));
  const breakdownMap = new Map<string, CategoryBreakdownItem>();

  for (const event of events) {
    const cat = categoryMap.get(event.categoryId);
    const key = event.categoryId || "__none__";
    const existing = breakdownMap.get(key);
    const amount = Math.max(event.amount, 0);

    if (existing) {
      existing.total += amount;
      existing.count += 1;
    } else {
      breakdownMap.set(key, {
        categoryId: key,
        name: cat?.name ?? "Gasto del hogar",
        iconKey: cat?.iconKey ?? "other",
        color: cat?.color ?? "",
        total: amount,
        count: 1,
      });
    }
  }

  return [...breakdownMap.values()].sort((a, b) => b.total - a.total);
}

/**
 * IDs de eventos `eachPaysOwn` dentro de un conjunto de eventos ya filtrado
 * (p. ej. por mes/estado activo). Paridad Android: el bloque de "Estado de
 * aportes" de Home Hogar solo aplica a `eachPaysOwn` con shares
 * `pending_completion`; un adelanto `advancedByPayer` o una `invitation` no
 * son aportes y no deben aparecer ahí. Se usa para acotar
 * `groupMemberResponsibilities` a las shares de eventos `eachPaysOwn`
 * únicamente.
 */
export function selectEachPaysOwnEventIds(events: HouseholdEvent[]): Set<string> {
  return new Set(
    events.filter((event) => event.settlementMode === "eachPaysOwn").map((event) => event.id)
  );
}

/**
 * IDs de eventos `eachPaysOwn` que además tienen al menos una share activa
 * (no cancelada) en `pending_completion` dentro de las shares recibidas.
 * Paridad Android: el bloque "Estado de aportes" de Home Hogar solo debe
 * existir cuando hay un aporte pendiente real — un evento `eachPaysOwn` donde
 * todas las shares ya se completaron no debe seguir apareciendo ahí.
 * `advancedByPayer` e `invitation` quedan excluidos siempre, sin importar el
 * estado de sus shares.
 */
export function selectEachPaysOwnEventIdsWithPendingShares(
  events: HouseholdEvent[],
  eventShares: HouseholdEventShare[]
): Set<string> {
  const eachPaysOwnIds = selectEachPaysOwnEventIds(events);

  const eventIdsWithPendingShare = new Set(
    eventShares
      .filter(
        (share) =>
          eachPaysOwnIds.has(share.eventId) &&
          share.status !== "cancelled" &&
          share.status !== "cancelado" &&
          (share.status === "pending_completion" || (!share.isPaid && share.status === "pending"))
      )
      .map((share) => share.eventId)
  );

  return new Set([...eachPaysOwnIds].filter((eventId) => eventIdsWithPendingShare.has(eventId)));
}

export function groupMemberResponsibilities(
  eventShares: HouseholdEventShare[],
  monthlyEventIds: Set<string>,
  currentUid: string | null
): MemberResponsibility[] {
  const responsibilityMap = new Map<string, MemberResponsibility>();

  for (const share of eventShares) {
    if (!monthlyEventIds.has(share.eventId)) continue;
    if (share.status === "cancelled" || share.status === "cancelado") continue;
    const amount = Math.max(share.amount, 0);
    const existing = responsibilityMap.get(share.memberUserId);

    if (existing) {
      existing.totalAmount += amount;
      existing.shareCount += 1;
      if (share.isPaid) {
        existing.paidAmount += amount;
      } else {
        existing.pendingAmount += amount;
        existing.pendingCount += 1;
      }
    } else {
      responsibilityMap.set(share.memberUserId, {
        memberUserId: share.memberUserId,
        totalAmount: amount,
        paidAmount: share.isPaid ? amount : 0,
        pendingAmount: share.isPaid ? 0 : amount,
        shareCount: 1,
        pendingCount: share.isPaid ? 0 : 1,
      });
    }
  }

  // Sort: current user first, then by pending amount desc
  return [...responsibilityMap.values()].sort((a, b) => {
    if (a.memberUserId === currentUid) return -1;
    if (b.memberUserId === currentUid) return 1;
    return b.pendingAmount - a.pendingAmount;
  });
}

export type EventResponsibility = {
  eventId: string;
  eventName: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  shareCount: number;
  pendingCount: number;
  members: Array<{
    memberUserId: string;
    isPaid: boolean;
  }>;
};

export function groupEventResponsibilities(
  eventShares: HouseholdEventShare[],
  monthlyEventIds: Set<string>,
  events: HouseholdEvent[],
  categories: HouseholdCategory[]
): EventResponsibility[] {
  const responsibilityMap = new Map<string, EventResponsibility>();
  
  const getEventName = (eventId: string) => {
    const ev = events.find(e => e.id === eventId);
    if (!ev) return "Evento";
    if (ev.title.trim()) return ev.title;
    const cat = categories.find(c => c.id === ev.categoryId);
    return cat ? `Gasto · ${cat.name}` : "Gasto del hogar";
  };

  for (const share of eventShares) {
    if (!monthlyEventIds.has(share.eventId)) continue;
    if (share.status === "cancelled" || share.status === "cancelado") continue;
    const amount = Math.max(share.amount, 0);
    const existing = responsibilityMap.get(share.eventId);

    if (existing) {
      existing.totalAmount += amount;
      existing.shareCount += 1;
      if (share.isPaid) {
        existing.paidAmount += amount;
      } else {
        existing.pendingAmount += amount;
        existing.pendingCount += 1;
      }
      existing.members.push({ memberUserId: share.memberUserId, isPaid: share.isPaid });
    } else {
      responsibilityMap.set(share.eventId, {
        eventId: share.eventId,
        eventName: getEventName(share.eventId),
        totalAmount: amount,
        paidAmount: share.isPaid ? amount : 0,
        pendingAmount: share.isPaid ? 0 : amount,
        shareCount: 1,
        pendingCount: share.isPaid ? 0 : 1,
        members: [{ memberUserId: share.memberUserId, isPaid: share.isPaid }],
      });
    }
  }

  // Sort: pendingCount desc, then pendingAmount desc
  return [...responsibilityMap.values()].sort((a, b) => {
    if (a.pendingCount !== b.pendingCount) return b.pendingCount - a.pendingCount;
    return b.pendingAmount - a.pendingAmount;
  });
}

export type HouseholdViewMode =
  | "loading"
  | "error"
  | "empty"
  | "dissolved"
  | "not_found"
  | "waiting_for_members"
  | "dashboard";

export type HouseholdViewStateInput = {
  status: string;
  household?: { memberIds: string[] } | null;
  error?: string | null;
};

export function resolveHouseholdViewMode(input: HouseholdViewStateInput): HouseholdViewMode {
  const { status, household } = input;

  if (status === "loading" || status === "idle") {
    return "loading";
  }

  if (status === "error") {
    return "error";
  }

  if (status === "empty") {
    return "empty";
  }

  if (status === "dissolved") {
    return "dissolved";
  }

  if (!household) {
    return "not_found";
  }

  if ((household.memberIds?.length ?? 0) < 2) {
    return "waiting_for_members";
  }

  return "dashboard";
}
