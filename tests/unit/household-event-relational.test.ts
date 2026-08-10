
import assert from "node:assert/strict";

import {
  assertHouseholdEventRelationalIntegrity,
  type HouseholdEventRelationalInput,
} from "../../src/features/household/lib/household-event-relational";
import type { HouseholdCategory } from "../../src/types/household";

console.log("Running unit tests for household-event-relational.test.ts...");

const categories: HouseholdCategory[] = [
  {
    id: "cat-1",
    householdId: "hh-1",
    name: "Mercado",
    iconKey: "cart",
    color: "#000",
    archived: false,
  },
  {
    id: "cat-other",
    householdId: "hh-other",
    name: "Ajena",
    iconKey: "x",
    color: "#111",
    archived: false,
  },
  {
    id: "cat-archived",
    householdId: "hh-1",
    name: "Vieja",
    iconKey: "x",
    color: "#222",
    archived: true,
  },
];

const base: HouseholdEventRelationalInput = {
  householdId: "hh-1",
  householdCategoryId: "cat-1",
  paidByUserId: "u1",
  householdMemberIds: ["u1", "u2"],
  availableCategories: categories,
  memberShares: [
    { memberUserId: "u1", responsibilityAmount: 50 },
    { memberUserId: "u2", responsibilityAmount: 50 },
  ],
};

{
  assert.doesNotThrow(() => assertHouseholdEventRelationalIntegrity(base));
  console.log("  ✓ acepta miembros y categoría del hogar");
}

{
  assert.throws(
    () =>
      assertHouseholdEventRelationalIntegrity({
        ...base,
        paidByUserId: "outsider",
      }),
    /pagador debe pertenecer/,
  );
  console.log("  ✓ rechaza pagador ajeno");
}

{
  assert.throws(
    () =>
      assertHouseholdEventRelationalIntegrity({
        ...base,
        memberShares: [{ memberUserId: "outsider", responsibilityAmount: 100 }],
      }),
    /miembro del hogar/,
  );
  console.log("  ✓ rechaza share de no-miembro");
}

{
  assert.throws(
    () =>
      assertHouseholdEventRelationalIntegrity({
        ...base,
        householdCategoryId: "cat-other",
      }),
    /no pertenece al hogar/,
  );
  console.log("  ✓ rechaza categoría de otro hogar");
}

{
  assert.throws(
    () =>
      assertHouseholdEventRelationalIntegrity({
        ...base,
        householdCategoryId: "cat-archived",
      }),
    /archivada/,
  );
  console.log("  ✓ rechaza categoría archivada");
}

{
  assert.throws(
    () =>
      assertHouseholdEventRelationalIntegrity({
        ...base,
        householdCategoryId: "missing",
      }),
    /ya no está disponible/,
  );
  console.log("  ✓ rechaza categoría inexistente");
}

console.log("All household-event-relational unit tests passed successfully!");
