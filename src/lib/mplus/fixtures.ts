import type {
  MplusHousehold,
  MplusHouseholdInvite,
  MplusMovement,
  MplusPersonalAccount,
  MplusPersonalCategory,
  MplusUserProfile,
} from "./models";

/**
 * Fixtures logicos compartidos con la fundacion Android.
 *
 * Fuente canonica: `android/app/src/test/java/com/finanzasm/app/data/remote/
 * mplus/mapper/MplusFirestoreMapperFixtureTest.kt`. Cada fixture de aqui es el
 * MISMO documento logico que Android usa en su prueba de round-trip, con la
 * misma clave (`user`, `account`, `category`, `movement`, `trashedMovement`,
 * `household`, `householdInvite`).
 *
 * `tests/unit/mplus-android-fixture-parity.test.ts` lee el archivo Kotlin y
 * compara campo por campo contra la serializacion Web: si Android agrega,
 * quita o cambia un campo del contrato y la Web no se entera, la prueba falla.
 * Esa es la validacion de serializacion bidireccional exigida por W1.
 *
 * Los timestamps de Android son `Timestamp(1_700_000_000L, 0)` = segundos, por
 * eso aqui se expresan en millis multiplicados por 1000.
 */

const T = (seconds: number): number => seconds * 1000;

export const FIXTURE_USER_ID = "uid-1";
export const FIXTURE_ACCOUNT_ID = "acc-1";
export const FIXTURE_CATEGORY_ID = "seed_expense_groceries";
export const FIXTURE_MOVEMENT_ID = "mov-1";
export const FIXTURE_TRASHED_MOVEMENT_ID = "mov-2";
export const FIXTURE_HOUSEHOLD_ID = "h-1";
export const FIXTURE_INVITE_ID = "inv-1";

export const fixtureUser: MplusUserProfile = {
  uid: FIXTURE_USER_ID,
  schemaVersion: 1,
  status: "ready",
  householdId: null,
  householdMembershipState: "none",
  personalCatalogVersion: 1,
  revision: 1,
  lastMutationId: "11111111-1111-4111-8111-111111111111",
  createdAtMillis: T(1_700_000_000),
  updatedAtMillis: T(1_700_000_000),
  resetRequestedAtMillis: null,
};

export const fixtureAccount: MplusPersonalAccount = {
  id: FIXTURE_ACCOUNT_ID,
  schemaVersion: 1,
  ownerId: FIXTURE_USER_ID,
  name: "Bancolombia",
  type: "bank",
  iconType: "bank_logo",
  iconKey: "bancolombia",
  color: "#2563EB",
  state: "active",
  referenceCount: 0,
  lastReferenceMovementId: null,
  revision: 1,
  lastMutationId: "22222222-2222-4222-8222-222222222222",
  createdAtMillis: T(1_700_000_000),
  updatedAtMillis: T(1_700_000_000),
};

export const fixtureCategory: MplusPersonalCategory = {
  id: FIXTURE_CATEGORY_ID,
  schemaVersion: 1,
  ownerId: FIXTURE_USER_ID,
  type: "expense",
  name: "Mercado",
  iconKey: "groceries",
  color: "#22C55E",
  state: "active",
  seedKey: "groceries",
  sortOrder: 0,
  revision: 1,
  lastMutationId: "33333333-3333-4333-8333-333333333333",
  createdAtMillis: T(1_700_000_000),
  updatedAtMillis: T(1_700_000_000),
};

export const fixtureMovement: MplusMovement = {
  id: FIXTURE_MOVEMENT_ID,
  schemaVersion: 1,
  ownerId: FIXTURE_USER_ID,
  type: "expense",
  title: "Mercado semanal",
  amount: 85_000,
  categoryId: FIXTURE_CATEGORY_ID,
  accountId: FIXTURE_ACCOUNT_ID,
  note: "",
  occurredAtMillis: T(1_700_000_000),
  lifecycleState: "active",
  trashedAtMillis: null,
  purgeAfterMillis: null,
  householdId: null,
  householdCategoryId: null,
  revision: 1,
  lastMutationId: "44444444-4444-4444-8444-444444444444",
  createdAtMillis: T(1_700_000_000),
  updatedAtMillis: T(1_700_000_000),
};

export const fixtureTrashedMovement: MplusMovement = {
  id: FIXTURE_TRASHED_MOVEMENT_ID,
  schemaVersion: 1,
  ownerId: FIXTURE_USER_ID,
  type: "income",
  title: "Salario",
  amount: 3_000_000,
  categoryId: "seed_income_salary",
  accountId: null,
  note: "Quincena",
  occurredAtMillis: T(1_700_000_000),
  lifecycleState: "trashed",
  trashedAtMillis: T(1_700_500_000),
  // Contrato §9.5: trashedAt + 30 dias exactos.
  purgeAfterMillis: T(1_703_092_000),
  householdId: null,
  householdCategoryId: null,
  revision: 3,
  lastMutationId: "55555555-5555-4555-8555-555555555555",
  createdAtMillis: T(1_700_000_000),
  updatedAtMillis: T(1_700_500_000),
};

export const fixtureHousehold: MplusHousehold = {
  id: FIXTURE_HOUSEHOLD_ID,
  schemaVersion: 1,
  status: "waiting",
  memberAId: FIXTURE_USER_ID,
  memberBId: null,
  activeInviteId: FIXTURE_INVITE_ID,
  catalogVersion: 1,
  cleanupPhase: "none",
  revision: 1,
  lastMutationId: "66666666-6666-4666-8666-666666666666",
  createdAtMillis: T(1_700_000_000),
  updatedAtMillis: T(1_700_000_000),
  name: "Casa Nueva",
};

export const fixtureHouseholdInvite: MplusHouseholdInvite = {
  id: FIXTURE_INVITE_ID,
  schemaVersion: 1,
  householdId: FIXTURE_HOUSEHOLD_ID,
  createdBy: FIXTURE_USER_ID,
  state: "active",
  createdAtMillis: T(1_700_000_000),
  // Contrato §12.2: createdAt + 7 dias.
  expiresAtMillis: T(1_700_604_800),
  usedBy: null,
  usedAtMillis: null,
  reservedForUid: "uid-2",
  revision: 1,
  lastMutationId: "77777777-7777-4777-8777-777777777777",
  updatedAtMillis: T(1_700_000_000),
};

/**
 * Nombre logico -> fixture. La clave coincide con el nombre que usa la prueba
 * de paridad para localizar el bloque equivalente en el archivo Kotlin.
 */
export const MPLUS_SHARED_FIXTURES = {
  user: fixtureUser,
  account: fixtureAccount,
  category: fixtureCategory,
  movement: fixtureMovement,
  trashedMovement: fixtureTrashedMovement,
  household: fixtureHousehold,
  householdInvite: fixtureHouseholdInvite,
} as const;

export type MplusSharedFixtureName = keyof typeof MPLUS_SHARED_FIXTURES;

/**
 * Fixtures de calculo derivado (contrato §25). Android y Web deben producir
 * exactamente los mismos enteros para el mismo conjunto mensual.
 */
export const MPLUS_MONTHLY_CALC_FIXTURE = {
  /** Movimientos `active` de un mismo mes (montos enteros COP). */
  movements: [
    { type: "income" as const, amount: 3_000_000, categoryId: "seed_income_salary", householdCategoryId: null },
    { type: "income" as const, amount: 450_000, categoryId: "seed_income_freelance", householdCategoryId: null },
    { type: "expense" as const, amount: 85_000, categoryId: "seed_expense_groceries", householdCategoryId: "seed_expense_groceries" },
    { type: "expense" as const, amount: 120_500, categoryId: "seed_expense_groceries", householdCategoryId: null },
    { type: "expense" as const, amount: 1_200_000, categoryId: "seed_expense_housing", householdCategoryId: "seed_expense_housing" },
  ],
  expected: {
    totalIncome: 3_450_000,
    totalExpense: 1_405_500,
    difference: 2_044_500,
    expenseByPersonalCategory: {
      seed_expense_groceries: 205_500,
      seed_expense_housing: 1_200_000,
    } as Record<string, number>,
    /** `null` se agrupa como `Por clasificar` (contrato §25). */
    expenseByHouseholdCategory: {
      seed_expense_groceries: 85_000,
      seed_expense_housing: 1_200_000,
      unclassified: 120_500,
    } as Record<string, number>,
  },
} as const;
