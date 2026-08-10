
import assert from "node:assert/strict";

import {
  filterActiveMonthlyEvents,
  filterActiveMonthlyIncomeEntries,
  calculateMonthlyExpenseTotal,
  calculateMonthlyIncomeTotal,
  calculateMonthlyBalance,
  groupCategoryBreakdown,
  groupMemberResponsibilities,
  selectEachPaysOwnEventIds,
  selectEachPaysOwnEventIdsWithPendingShares,
} from "../../src/features/household/lib/household-view-model";
import type {
  HouseholdEvent,
  HouseholdIncomeEntry,
  HouseholdCategory,
  HouseholdEventShare,
} from "../../src/types/household";

console.log("Running unit tests for household-view-model.test.ts...");

const period = { year: 2026, month: 5 }; // June 2026 (0-indexed month 5)

const events: HouseholdEvent[] = [
  {
    id: "e1",
    householdId: "h1",
    createdByUserId: "u1",
    paidByUserId: "u1",
    settlementMode: "eachPaysOwn",
    categoryId: "cat1",
    title: "Mercado",
    notes: "",
    amount: 150000,
    status: "active",
    isActive: true,
    eventDate: new Date("2026-06-10T10:00:00Z"),
    createdAt: new Date("2026-06-10T10:00:00Z"),
  },
  {
    id: "e2",
    householdId: "h1",
    createdByUserId: "u2",
    paidByUserId: "u2",
    settlementMode: "eachPaysOwn",
    categoryId: "cat2",
    title: "Internet",
    notes: "",
    amount: 80000,
    status: "active",
    isActive: true,
    eventDate: new Date("2026-06-15T12:00:00Z"),
    createdAt: new Date("2026-06-15T12:00:00Z"),
  },
  {
    id: "e3",
    householdId: "h1",
    createdByUserId: "u1",
    paidByUserId: "u1",
    settlementMode: "eachPaysOwn",
    categoryId: "cat1",
    title: "Restaurante",
    notes: "",
    amount: 50000,
    status: "cancelled",
    isActive: false,
    eventDate: new Date("2026-06-20T10:00:00Z"),
    createdAt: new Date("2026-06-20T10:00:00Z"),
  },
  {
    id: "e4",
    householdId: "h1",
    createdByUserId: "u1",
    paidByUserId: "u1",
    settlementMode: "eachPaysOwn",
    categoryId: "cat1",
    title: "Otro mes",
    notes: "",
    amount: 90000,
    status: "active",
    isActive: true,
    eventDate: new Date("2026-07-01T10:00:00Z"),
    createdAt: new Date("2026-07-01T10:00:00Z"),
  },
];

const incomeEntries: HouseholdIncomeEntry[] = [
  {
    id: "inc1",
    householdId: "h1",
    sourceOwnerId: "u1",
    visibleDescription: "Aporte Juan",
    amount: 300000,
    status: "active",
    entryDate: new Date("2026-06-01T10:00:00Z"),
    createdAt: new Date("2026-06-01T10:00:00Z"),
  },
  {
    id: "inc2",
    householdId: "h1",
    sourceOwnerId: "u2",
    visibleDescription: "Aporte Maria",
    amount: 250000,
    status: "cancelled",
    entryDate: new Date("2026-06-05T10:00:00Z"),
    createdAt: new Date("2026-06-05T10:00:00Z"),
  },
  {
    id: "inc3",
    householdId: "h1",
    sourceOwnerId: "u2",
    visibleDescription: "Aporte extra",
    amount: 100000,
    status: "active",
    entryDate: new Date("2026-06-12T10:00:00Z"),
    createdAt: new Date("2026-06-12T10:00:00Z"),
  },
];

const categories: HouseholdCategory[] = [
  { id: "cat1", householdId: "h1", name: "Servicios", iconKey: "home", color: "#FF0000", archived: false, createdAt: new Date() },
  { id: "cat2", householdId: "h1", name: "Alimentación", iconKey: "shopping-cart", color: "#00FF00", archived: false, createdAt: new Date() },
];

const eventShares: HouseholdEventShare[] = [
  { id: "s1", eventId: "e1", householdId: "h1", percentage: null, memberUserId: "u1", amount: 75000, isPaid: true, status: "completed", createdAt: new Date(), updatedAt: new Date() },
  { id: "s2", eventId: "e1", householdId: "h1", percentage: null, memberUserId: "u2", amount: 75000, isPaid: false, status: "pending_completion", createdAt: new Date(), updatedAt: new Date() },
  { id: "s3", eventId: "e2", householdId: "h1", percentage: null, memberUserId: "u1", amount: 40000, isPaid: false, status: "pending_completion", createdAt: new Date(), updatedAt: new Date() },
  { id: "s4", eventId: "e2", householdId: "h1", percentage: null, memberUserId: "u2", amount: 40000, isPaid: true, status: "completed", createdAt: new Date(), updatedAt: new Date() },
];

{
  const filtered = filterActiveMonthlyEvents(events, period);
  assert.strictEqual(filtered.length, 2);
  assert.deepStrictEqual(filtered.map((e) => e.id).sort(), ["e1", "e2"]);
  console.log("  ✓ filterActiveMonthlyEvents");
}

{
  const filtered = filterActiveMonthlyIncomeEntries(incomeEntries, period);
  assert.strictEqual(filtered.length, 2);
  assert.deepStrictEqual(filtered.map((e) => e.id).sort(), ["inc1", "inc3"]);
  console.log("  ✓ filterActiveMonthlyIncomeEntries");
}

{
  const activeEvents = filterActiveMonthlyEvents(events, period);
  assert.strictEqual(calculateMonthlyExpenseTotal(activeEvents), 230000);
  console.log("  ✓ calculateMonthlyExpenseTotal");
}

{
  const activeIncome = filterActiveMonthlyIncomeEntries(incomeEntries, period);
  assert.strictEqual(calculateMonthlyIncomeTotal(activeIncome), 400000);
  console.log("  ✓ calculateMonthlyIncomeTotal");
}

{
  assert.strictEqual(calculateMonthlyBalance(400000, 230000), 170000);
  console.log("  ✓ calculateMonthlyBalance");
}

{
  const activeEvents = filterActiveMonthlyEvents(events, period);
  const breakdown = groupCategoryBreakdown(activeEvents, categories);
  assert.strictEqual(breakdown.length, 2);
  const servicios = breakdown.find((b) => b.categoryId === "cat1");
  const alimentacion = breakdown.find((b) => b.categoryId === "cat2");
  assert.ok(servicios);
  assert.strictEqual(servicios.total, 150000);
  assert.strictEqual(servicios.name, "Servicios");
  assert.ok(alimentacion);
  assert.strictEqual(alimentacion.total, 80000);
  assert.strictEqual(alimentacion.name, "Alimentación");
  console.log("  ✓ groupCategoryBreakdown");
}

{
  const activeEvents = filterActiveMonthlyEvents(events, period);
  const monthlyIds = new Set(activeEvents.map((e) => e.id));
  const responsibilities = groupMemberResponsibilities(eventShares, monthlyIds, "u1");
  assert.strictEqual(responsibilities.length, 2);
  const u1 = responsibilities.find((r) => r.memberUserId === "u1");
  const u2 = responsibilities.find((r) => r.memberUserId === "u2");
  assert.ok(u1);
  assert.ok(u2);
  assert.strictEqual(u1.totalAmount, 115000);
  assert.strictEqual(u2.totalAmount, 115000);
  console.log("  ✓ groupMemberResponsibilities");
}

{
  const ids = selectEachPaysOwnEventIds(events);
  assert.deepStrictEqual([...ids].sort(), ["e1", "e2", "e3", "e4"].sort());
  console.log("  ✓ selectEachPaysOwnEventIds");
}

{
  const ids = selectEachPaysOwnEventIdsWithPendingShares(events, eventShares);
  assert.deepStrictEqual([...ids].sort(), ["e1", "e2"]);
  console.log("  ✓ selectEachPaysOwnEventIdsWithPendingShares");
}

console.log("All household-view-model unit tests passed successfully!");
