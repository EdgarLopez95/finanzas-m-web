import assert from "node:assert/strict";
import { resolveHouseholdViewMode } from "../../src/features/household/lib/household-view-model";

console.log("Running unit tests for household-view-mode.test.ts...");

export function runHouseholdViewModeTests() {
  // 1. Loading / idle -> "loading"
  assert.strictEqual(resolveHouseholdViewMode({ status: "loading" }), "loading");
  assert.strictEqual(resolveHouseholdViewMode({ status: "idle" }), "loading");

  // 2. Error -> "error"
  assert.strictEqual(resolveHouseholdViewMode({ status: "error", error: "Fail" }), "error");

  // 3. Empty -> "empty"
  assert.strictEqual(resolveHouseholdViewMode({ status: "empty" }), "empty");

  // 4. Dissolved -> "dissolved"
  assert.strictEqual(resolveHouseholdViewMode({ status: "dissolved" }), "dissolved");

  // 5. Success pero sin documento -> "not_found"
  assert.strictEqual(resolveHouseholdViewMode({ status: "success", household: null }), "not_found");

  // 6. Hogar activo con 1 miembro -> "waiting_for_members"
  assert.strictEqual(
    resolveHouseholdViewMode({
      status: "success",
      household: { memberIds: ["user1"] },
    }),
    "waiting_for_members"
  );

  // 7. Hogar activo con 0 miembros (borde) -> "waiting_for_members"
  assert.strictEqual(
    resolveHouseholdViewMode({
      status: "success",
      household: { memberIds: [] },
    }),
    "waiting_for_members"
  );

  // 8. Hogar activo con 2 miembros -> "dashboard"
  assert.strictEqual(
    resolveHouseholdViewMode({
      status: "success",
      household: { memberIds: ["user1", "user2"] },
    }),
    "dashboard"
  );

  // 9. Hogar activo con 3 miembros -> "dashboard"
  assert.strictEqual(
    resolveHouseholdViewMode({
      status: "success",
      household: { memberIds: ["user1", "user2", "user3"] },
    }),
    "dashboard"
  );

  console.log("  ✓ All 9 resolveHouseholdViewMode scenarios passed successfully");
}

runHouseholdViewModeTests();
