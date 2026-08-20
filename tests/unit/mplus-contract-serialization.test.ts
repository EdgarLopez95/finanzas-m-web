import assert from "node:assert/strict";

import {
  categoryMappingFromFirestore,
  categoryMappingToFirestore,
  closureApprovalFromFirestore,
  closureApprovalToFirestore,
  householdExpenseCategoryFromFirestore,
  householdExpenseCategoryToFirestore,
  householdFromFirestore,
  householdInviteFromFirestore,
  householdInviteToFirestore,
  householdMemberFromFirestore,
  householdMemberToFirestore,
  householdToFirestore,
  memberAccountLabelFromFirestore,
  memberAccountLabelToFirestore,
  memberCategoryLabelFromFirestore,
  memberCategoryLabelToFirestore,
  millisToTimestamp,
  movementFromFirestore,
  movementToFirestore,
  MplusFirestoreMappingError,
  personalAccountFromFirestore,
  personalAccountToFirestore,
  personalCategoryFromFirestore,
  personalCategoryToFirestore,
  timestampToMillis,
  userProfileFromFirestore,
  userProfileToFirestore,
  type FirestoreData,
} from "../../src/lib/mplus/converters";
import {
  fixtureAccount,
  fixtureCategory,
  fixtureHousehold,
  fixtureHouseholdInvite,
  fixtureMovement,
  fixtureTrashedMovement,
  fixtureUser,
} from "../../src/lib/mplus/fixtures";
import type {
  MplusCategoryMapping,
  MplusClosureApproval,
  MplusHouseholdExpenseCategory,
  MplusHouseholdMember,
  MplusMemberAccountLabel,
  MplusMemberCategoryLabel,
} from "../../src/lib/mplus/models";

/**
 * Serializacion bidireccional del contrato v1: Dominio -> Firestore -> Dominio
 * no pierde ni inventa campos, y el mapa remoto tiene EXACTAMENTE las claves
 * que declara el contrato (las mismas que `keys().hasOnly(...)` exige en las
 * Rules canonicas).
 */

const T = (seconds: number) => seconds * 1000;

const assertKeys = (label: string, map: Record<string, unknown>, expected: string[]) => {
  assert.deepEqual(
    Object.keys(map).slice().sort(),
    expected.slice().sort(),
    `${label}: el conjunto de claves remotas no coincide con el contrato`,
  );
};

// --- users ---
{
  const wire = userProfileToFirestore(fixtureUser);
  assertKeys("users", wire, [
    "schemaVersion", "status", "householdId", "householdMembershipState",
    "personalCatalogVersion", "revision", "lastMutationId", "createdAt",
    "updatedAt", "resetRequestedAt",
  ]);
  assert.equal("email" in wire, false, "users nunca almacena correo (contrato §3.11)");
  assert.equal("displayName" in wire, false, "users nunca almacena nombre (contrato §6.1)");
  assert.deepEqual(userProfileFromFirestore(fixtureUser.uid, wire as FirestoreData), fixtureUser);
}

// --- accounts ---
{
  const wire = personalAccountToFirestore(fixtureAccount);
  assertKeys("accounts", wire, [
    "schemaVersion", "ownerId", "name", "type", "iconType", "iconKey", "color",
    "state", "referenceCount", "lastReferenceMovementId", "revision",
    "lastMutationId", "createdAt", "updatedAt",
  ]);
  assert.deepEqual(
    personalAccountFromFirestore(fixtureAccount.id, wire as FirestoreData),
    fixtureAccount,
  );
}

// --- categories ---
{
  const wire = personalCategoryToFirestore(fixtureCategory);
  assertKeys("categories", wire, [
    "schemaVersion", "ownerId", "type", "name", "iconKey", "color", "state",
    "seedKey", "sortOrder", "revision", "lastMutationId", "createdAt", "updatedAt",
  ]);
  assert.deepEqual(
    personalCategoryFromFirestore(fixtureCategory.id, wire as FirestoreData),
    fixtureCategory,
  );
}

// --- movements (activo y en Papelera) ---
for (const movement of [fixtureMovement, fixtureTrashedMovement]) {
  const wire = movementToFirestore(movement);
  assertKeys("movements", wire, [
    "schemaVersion", "ownerId", "type", "title", "amount", "categoryId",
    "accountId", "note", "occurredAt", "lifecycleState", "trashedAt",
    "purgeAfter", "householdId", "householdCategoryId", "revision",
    "lastMutationId", "createdAt", "updatedAt",
  ]);
  for (const forbidden of ["balance", "pocketId", "targetAccountId", "currency", "isHousehold"]) {
    assert.equal(forbidden in wire, false, `movements no admite '${forbidden}' (contrato §9.1)`);
  }
  assert.deepEqual(movementFromFirestore(movement.id, wire as FirestoreData), movement);
}

// --- households (con nombre y heredado sin nombre) ---
{
  const wire = householdToFirestore(fixtureHousehold);
  assertKeys("households", wire, [
    "schemaVersion", "status", "memberAId", "memberBId", "activeInviteId",
    "catalogVersion", "cleanupPhase", "revision", "lastMutationId",
    "createdAt", "updatedAt", "name",
  ]);
  assert.deepEqual(householdFromFirestore(fixtureHousehold.id, wire as FirestoreData), fixtureHousehold);

  // DEC-074: un Hogar heredado sin nombre OMITE la clave; nunca escribe null.
  const legacy = { ...fixtureHousehold, name: null };
  const legacyWire = householdToFirestore(legacy);
  assert.equal("name" in legacyWire, false, "un Hogar sin nombre no escribe la clave 'name'");
  assert.deepEqual(householdFromFirestore(legacy.id, legacyWire as FirestoreData), legacy);
}

// --- householdInvites ---
{
  const wire = householdInviteToFirestore(fixtureHouseholdInvite);
  assertKeys("householdInvites", wire, [
    "schemaVersion", "householdId", "createdBy", "state", "createdAt",
    "expiresAt", "usedBy", "usedAt", "reservedForUid", "revision",
    "lastMutationId", "updatedAt",
  ]);
  // DEC-076: `reservedForUid` viaja siempre, incluso cuando es null.
  const open = { ...fixtureHouseholdInvite, reservedForUid: null };
  assert.equal("reservedForUid" in householdInviteToFirestore(open), true);
  assert.deepEqual(
    householdInviteFromFirestore(fixtureHouseholdInvite.id, wire as FirestoreData),
    fixtureHouseholdInvite,
  );
}

// --- members ---
{
  const member: MplusHouseholdMember = {
    id: "h-1__uid-1",
    schemaVersion: 1,
    householdId: "h-1",
    userId: "uid-1",
    state: "active",
    displayName: "Felipe",
    photoUrl: "https://example.com/a.png",
    joinedAtMillis: T(1_700_000_000),
    leftAtMillis: null,
    revision: 1,
    lastMutationId: "88888888-8888-4888-8888-888888888888",
    updatedAtMillis: T(1_700_000_000),
  };
  const wire = householdMemberToFirestore(member);
  assertKeys("members", wire, [
    "schemaVersion", "userId", "state", "displayName", "photoUrl", "joinedAt",
    "leftAt", "revision", "lastMutationId", "updatedAt",
  ]);
  assert.equal("email" in wire, false, "members nunca almacena correo (contrato §11.2)");
  assert.deepEqual(householdMemberFromFirestore(member.id, member.householdId, wire as FirestoreData), member);
}

// --- expenseCategories ---
{
  const category: MplusHouseholdExpenseCategory = {
    id: "seed_expense_groceries",
    schemaVersion: 1,
    householdId: "h-1",
    name: "Mercado",
    iconKey: "groceries",
    color: "#22C55E",
    state: "active",
    seedKey: "groceries",
    sortOrder: 0,
    createdBy: "uid-1",
    revision: 1,
    lastMutationId: "99999999-9999-4999-8999-999999999999",
    createdAtMillis: T(1_700_000_000),
    updatedAtMillis: T(1_700_000_000),
  };
  const wire = householdExpenseCategoryToFirestore(category);
  assertKeys("expenseCategories", wire, [
    "schemaVersion", "householdId", "type", "name", "iconKey", "color", "state",
    "seedKey", "sortOrder", "createdBy", "revision", "lastMutationId",
    "createdAt", "updatedAt",
  ]);
  assert.equal(wire.type, "expense", "en Hogar el tipo siempre es gasto (contrato §13)");
  assert.deepEqual(
    householdExpenseCategoryFromFirestore(category.id, wire as FirestoreData),
    category,
  );
}

// --- categoryMappings ---
{
  const mapping: MplusCategoryMapping = {
    id: "uid-1__seed_expense_groceries",
    schemaVersion: 1,
    householdId: "h-1",
    ownerId: "uid-1",
    personalCategoryId: "seed_expense_groceries",
    householdCategoryId: "seed_expense_groceries",
    updatedBy: "uid-1",
    revision: 1,
    lastMutationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    createdAtMillis: T(1_700_000_000),
    updatedAtMillis: T(1_700_000_000),
  };
  const wire = categoryMappingToFirestore(mapping);
  assertKeys("categoryMappings", wire, [
    "schemaVersion", "householdId", "ownerId", "personalCategoryId",
    "householdCategoryId", "updatedBy", "revision", "lastMutationId",
    "createdAt", "updatedAt",
  ]);
  assert.deepEqual(categoryMappingFromFirestore(mapping.id, wire as FirestoreData), mapping);
}

// --- memberCategoryLabels ---
{
  const label: MplusMemberCategoryLabel = {
    id: "uid-1__seed_expense_groceries",
    schemaVersion: 1,
    householdId: "h-1",
    ownerId: "uid-1",
    categoryId: "seed_expense_groceries",
    type: "expense",
    name: "Mercado",
    iconKey: "groceries",
    color: "#22C55E",
    revision: 1,
    lastMutationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    createdAtMillis: T(1_700_000_000),
    updatedAtMillis: T(1_700_000_000),
  };
  const wire = memberCategoryLabelToFirestore(label);
  assertKeys("memberCategoryLabels", wire, [
    "schemaVersion", "householdId", "ownerId", "categoryId", "type", "name",
    "iconKey", "color", "revision", "lastMutationId", "createdAt", "updatedAt",
  ]);
  for (const forbidden of ["amount", "note", "email"]) {
    assert.equal(forbidden in wire, false, `la proyeccion no copia '${forbidden}' (contrato §15.3)`);
  }
  assert.deepEqual(memberCategoryLabelFromFirestore(label.id, wire as FirestoreData), label);
}

// --- memberAccountLabels ---
{
  const label: MplusMemberAccountLabel = {
    id: "uid-1__acc-1",
    schemaVersion: 1,
    householdId: "h-1",
    ownerId: "uid-1",
    accountId: "acc-1",
    name: "Bancolombia",
    type: "bank",
    iconType: "bank_logo",
    iconKey: "bancolombia",
    color: "#2563EB",
    revision: 1,
    lastMutationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    createdAtMillis: T(1_700_000_000),
    updatedAtMillis: T(1_700_000_000),
  };
  const wire = memberAccountLabelToFirestore(label);
  assertKeys("memberAccountLabels", wire, [
    "schemaVersion", "householdId", "ownerId", "accountId", "name", "type",
    "iconType", "iconKey", "color", "revision", "lastMutationId",
    "createdAt", "updatedAt",
  ]);
  assert.deepEqual(memberAccountLabelFromFirestore(label.id, wire as FirestoreData), label);
}

// --- closureApprovals ---
{
  const approval: MplusClosureApproval = {
    id: "h-1__uid-1",
    schemaVersion: 1,
    householdId: "h-1",
    approvedBy: "uid-1",
    approvedAtMillis: T(1_700_000_000),
    lastMutationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  };
  const wire = closureApprovalToFirestore(approval);
  assertKeys("closureApprovals", wire, [
    "schemaVersion", "approvedBy", "approvedAt", "lastMutationId",
  ]);
  assert.deepEqual(
    closureApprovalFromFirestore(approval.id, approval.householdId, wire as FirestoreData),
    approval,
  );
}

// --- timestamps: millis <-> Timestamp sin perdida en el rango del contrato ---
{
  for (const millis of [0, 1_700_000_000_000, 1_703_092_000_000, 999]) {
    assert.equal(timestampToMillis(millisToTimestamp(millis)), millis);
  }
}

// --- lectura estricta: un campo ausente o mal tipado NO se rellena en silencio ---
{
  const wire = movementToFirestore(fixtureMovement) as Record<string, unknown>;

  const missingAmount = { ...wire };
  delete missingAmount.amount;
  assert.throws(
    () => movementFromFirestore("mov-1", missingAmount as FirestoreData),
    MplusFirestoreMappingError,
  );

  assert.throws(
    () => movementFromFirestore("mov-1", { ...wire, amount: "85000" } as FirestoreData),
    MplusFirestoreMappingError,
  );

  assert.throws(
    () => movementFromFirestore("mov-1", { ...wire, type: "transfer" } as FirestoreData),
    MplusFirestoreMappingError,
    "un tipo retirado del contrato (transfer) no se lee como valido",
  );
}

console.log("OK mplus-contract-serialization");
