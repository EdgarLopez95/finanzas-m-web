import assert from "node:assert/strict";

import {
  expenseByHouseholdCategory,
  expenseByPersonalCategory,
  incomeByOwnerAndCategory,
  monthlyDifference,
  totalExpense,
  totalIncome,
} from "../../src/lib/mplus/derived";
import { MPLUS_MONTHLY_CALC_FIXTURE } from "../../src/lib/mplus/fixtures";

/**
 * Calculos derivados (contrato §25) sobre el fixture mensual compartido.
 * Android y Web deben producir exactamente los mismos enteros.
 */

const { movements, expected } = MPLUS_MONTHLY_CALC_FIXTURE;

assert.equal(totalIncome(movements), expected.totalIncome);
assert.equal(totalExpense(movements), expected.totalExpense);
assert.equal(monthlyDifference(movements), expected.difference);
assert.deepEqual(expenseByPersonalCategory(movements), expected.expenseByPersonalCategory);
assert.deepEqual(expenseByHouseholdCategory(movements), expected.expenseByHouseholdCategory);

// Todos los resultados son enteros: nunca aparece un decimal de punto flotante.
for (const value of [
  totalIncome(movements),
  totalExpense(movements),
  monthlyDifference(movements),
  ...Object.values(expenseByPersonalCategory(movements)),
  ...Object.values(expenseByHouseholdCategory(movements)),
]) {
  assert.equal(Number.isInteger(value), true, `resultado no entero: ${value}`);
}

// La diferencia puede ser negativa; no se recorta a cero.
assert.equal(
  monthlyDifference([
    { type: "income", amount: 100, categoryId: "c1", householdCategoryId: null },
    { type: "expense", amount: 350, categoryId: "c2", householdCategoryId: null },
  ]),
  -250,
);

// Conjunto vacio: todo en cero, sin NaN.
assert.equal(totalIncome([]), 0);
assert.equal(totalExpense([]), 0);
assert.equal(monthlyDifference([]), 0);
assert.deepEqual(expenseByPersonalCategory([]), {});

// Ingreso de Hogar agrupado por pareja ownerId + categoryId (contrato §25).
assert.deepEqual(
  incomeByOwnerAndCategory([
    { ownerId: "uid-1", type: "income", amount: 1000, categoryId: "seed_income_salary", householdCategoryId: null },
    { ownerId: "uid-1", type: "income", amount: 500, categoryId: "seed_income_salary", householdCategoryId: null },
    { ownerId: "uid-2", type: "income", amount: 700, categoryId: "seed_income_salary", householdCategoryId: null },
    { ownerId: "uid-1", type: "expense", amount: 999, categoryId: "seed_expense_other", householdCategoryId: null },
  ]),
  {
    "uid-1__seed_income_salary": 1500,
    "uid-2__seed_income_salary": 700,
  },
);

console.log("OK mplus-derived-calc");
