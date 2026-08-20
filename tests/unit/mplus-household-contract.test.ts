import assert from "node:assert/strict";

import {
  isValidHouseholdInviteCode,
  newHouseholdInviteCode,
  normalizeHouseholdInviteCode,
} from "../../src/lib/mplus/ids";
import {
  expenseByHouseholdCategory,
  incomeByOwnerAndCategory,
  monthlyDifference,
  totalExpense,
  totalIncome,
  UNCLASSIFIED_HOUSEHOLD_CATEGORY_KEY,
} from "../../src/lib/mplus/derived";
import type {
  MplusCategoryMapping,
  MplusHousehold,
  MplusHouseholdExpenseCategory,
  MplusHouseholdInvite,
  MplusHouseholdMember,
  MplusMovement,
  MplusUserProfile,
} from "../../src/lib/mplus/models";
import { HOUSEHOLD_EXPENSE_SEED } from "../../src/lib/mplus/seeds";
import {
  setMplusHouseholdServicesForTesting,
  useMplusHouseholdStore,
} from "../../src/stores/mplus-household-store";
import { resetAllStoresForSessionBoundary } from "../../src/stores/session-boundary";

export const runMplusHouseholdContractTests = async (): Promise<void> => {
  // 1. Validaciones y generación de código de 3 dígitos (DEC-072)
  {
    for (let i = 0; i < 100; i++) {
      const code = newHouseholdInviteCode();
      assert.equal(code.length, 3, "El código generado debe tener exactamente 3 caracteres");
      assert.ok(/^\d{3}$/.test(code), `El código ${code} debe ser puramente numérico`);
      assert.ok(isValidHouseholdInviteCode(code), `isValidHouseholdInviteCode debe aceptar ${code}`);
    }

    assert.equal(isValidHouseholdInviteCode("12"), false);
    assert.equal(isValidHouseholdInviteCode("1234"), false);
    assert.equal(isValidHouseholdInviteCode("abc"), false);
    assert.equal(isValidHouseholdInviteCode("12a"), false);

    assert.equal(normalizeHouseholdInviteCode(" 123 "), "123");
    assert.equal(normalizeHouseholdInviteCode("1-2-3"), "123");
    assert.equal(normalizeHouseholdInviteCode(" 1 2 3 "), "123");
  }

  // 2. Semillas de categorías de Hogar v1 (§13.1)
  {
    assert.equal(HOUSEHOLD_EXPENSE_SEED.length, 16, "El catálogo de Hogar debe sembrar exactamente 16 categorías");
    const seedKeys = new Set(HOUSEHOLD_EXPENSE_SEED.map((s) => s.seedKey));
    assert.equal(seedKeys.size, 16, "Todas las seedKeys de Hogar deben ser únicas");
    assert.ok(seedKeys.has("groceries"));
    assert.ok(seedKeys.has("housing"));
    assert.ok(seedKeys.has("bills"));
  }

  // 3. Cálculos derivados de Hogar (§25)
  {
    const movements: MplusMovement[] = [
      {
        id: "m1",
        schemaVersion: 1,
        ownerId: "user-a",
        type: "expense",
        title: "Mercado",
        amount: 150000,
        categoryId: "cat-personal-1",
        accountId: "acc-1",
        note: "",
        occurredAtMillis: 1000,
        lifecycleState: "active",
        trashedAtMillis: null,
        purgeAfterMillis: null,
        householdId: "hh-1",
        householdCategoryId: "cat-hh-groceries",
        revision: 1,
        lastMutationId: "mut-1",
        createdAtMillis: 1000,
        updatedAtMillis: 1000,
      },
      {
        id: "m2",
        schemaVersion: 1,
        ownerId: "user-b",
        type: "expense",
        title: "Almuerzo",
        amount: 50000,
        categoryId: "cat-personal-2",
        accountId: "acc-2",
        note: "",
        occurredAtMillis: 2000,
        lifecycleState: "active",
        trashedAtMillis: null,
        purgeAfterMillis: null,
        householdId: "hh-1",
        householdCategoryId: null, // Por clasificar
        revision: 1,
        lastMutationId: "mut-2",
        createdAtMillis: 2000,
        updatedAtMillis: 2000,
      },
      {
        id: "m3",
        schemaVersion: 1,
        ownerId: "user-a",
        type: "income",
        title: "Aporte",
        amount: 300000,
        categoryId: "cat-income-1",
        accountId: null,
        note: "",
        occurredAtMillis: 3000,
        lifecycleState: "active",
        trashedAtMillis: null,
        purgeAfterMillis: null,
        householdId: "hh-1",
        householdCategoryId: null,
        revision: 1,
        lastMutationId: "mut-3",
        createdAtMillis: 3000,
        updatedAtMillis: 3000,
      },
    ];

    assert.equal(totalExpense(movements), 200000);
    assert.equal(totalIncome(movements), 300000);
    assert.equal(monthlyDifference(movements), 100000);

    const expenseCats = expenseByHouseholdCategory(movements);
    assert.equal(expenseCats["cat-hh-groceries"], 150000);
    assert.equal(expenseCats[UNCLASSIFIED_HOUSEHOLD_CATEGORY_KEY], 50000);

    const incomeBreakdown = incomeByOwnerAndCategory(movements);
    assert.equal(incomeBreakdown["user-a__cat-income-1"], 300000);
  }

  // 4. Store de Hogar M+ y Frontera de Sesión
  {
    const dummyHousehold: MplusHousehold = {
      id: "hh-test",
      schemaVersion: 1,
      status: "active",
      memberAId: "user-1",
      memberBId: "user-2",
      activeInviteId: null,
      catalogVersion: 1,
      cleanupPhase: "none",
      revision: 1,
      lastMutationId: "mut-1",
      createdAtMillis: 1000,
      updatedAtMillis: 1000,
      name: "Casa Test",
    };

    const dummyMember: MplusHouseholdMember = {
      id: "hh-test__user-1",
      schemaVersion: 1,
      householdId: "hh-test",
      userId: "user-1",
      state: "active",
      displayName: "Usuario 1",
      photoUrl: "",
      joinedAtMillis: 1000,
      leftAtMillis: null,
      revision: 1,
      lastMutationId: "mut-1",
      updatedAtMillis: 1000,
    };

    setMplusHouseholdServicesForTesting({
      readHousehold: async () => dummyHousehold,
      readMembers: async () => [dummyMember],
      readActiveInvite: async () => null,
      readCategories: async () => [],
      readMappings: async () => [],
      readCategoryLabels: async () => [],
      readAccountLabels: async () => [],
      readMovements: async () => [],
    });

    await useMplusHouseholdStore.getState().load("hh-test", { year: 2026, month: 8 });
    assert.equal(useMplusHouseholdStore.getState().status, "success");
    assert.equal(useMplusHouseholdStore.getState().household?.name, "Casa Test");
    assert.equal(useMplusHouseholdStore.getState().members.length, 1);

    // Actualizaciones confirmadas in-place
    const updatedMember: MplusHouseholdMember = { ...dummyMember, displayName: "Nombre Nuevo" };
    useMplusHouseholdStore.getState().applyCommittedMember(updatedMember);
    assert.equal(useMplusHouseholdStore.getState().members[0].displayName, "Nombre Nuevo");

    // Limpieza total en frontera de sesión (logout)
    resetAllStoresForSessionBoundary();
    assert.equal(useMplusHouseholdStore.getState().status, "idle");
    assert.equal(useMplusHouseholdStore.getState().household, null);
    assert.equal(useMplusHouseholdStore.getState().members.length, 0);

    setMplusHouseholdServicesForTesting(null);
  }
};

runMplusHouseholdContractTests().catch((err) => {
  console.error("Test failure in mplus-household-contract.test.ts:", err);
  process.exit(1);
});
