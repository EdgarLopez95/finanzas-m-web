import assert from "node:assert/strict";

import {
  fixtureAccount,
  fixtureCategory,
  fixtureHousehold,
  fixtureMovement,
  fixtureTrashedMovement,
  fixtureUser,
} from "../../src/lib/mplus/fixtures";
import {
  MplusContractValidationError,
  mplusValidators,
} from "../../src/lib/mplus/schemas";
import { AMOUNT_MAX } from "../../src/lib/mplus/catalogs";

/**
 * Validadores del contrato v1: aceptan exactamente lo que aceptan las Rules
 * canonicas y rechazan, ANTES de escribir, todo lo que el servidor rechazaria.
 */

const rejects = (label: string, run: () => unknown) => {
  assert.throws(run, MplusContractValidationError, `deberia rechazarse: ${label}`);
};

// --- casos validos ---
mplusValidators.user(fixtureUser);
mplusValidators.account(fixtureAccount);
mplusValidators.category(fixtureCategory);
mplusValidators.movement(fixtureMovement);
mplusValidators.movement(fixtureTrashedMovement);
mplusValidators.household({ ...fixtureHousehold, activeInviteId: "123" });

// --- users (contrato §6) ---
rejects("campo extra en users", () =>
  mplusValidators.user({ ...fixtureUser, email: "a@b.com" }),
);
rejects("membershipState none con householdId", () =>
  mplusValidators.user({ ...fixtureUser, householdId: "h-1" }),
);
rejects("membershipState active sin householdId", () =>
  mplusValidators.user({ ...fixtureUser, householdMembershipState: "active" }),
);
rejects("resetRequestedAt fuera de resetting", () =>
  mplusValidators.user({ ...fixtureUser, resetRequestedAtMillis: 1 }),
);
rejects("resetting sin resetRequestedAt", () =>
  mplusValidators.user({ ...fixtureUser, status: "resetting" }),
);
rejects("schemaVersion distinto de 1", () =>
  mplusValidators.user({ ...fixtureUser, schemaVersion: 2 }),
);
rejects("lastMutationId que no es UUID", () =>
  mplusValidators.user({ ...fixtureUser, lastMutationId: "abc" }),
);
mplusValidators.user({
  ...fixtureUser,
  status: "resetting",
  resetRequestedAtMillis: 1_700_000_000_000,
});

// --- accounts (contrato §7) ---
rejects("nombre vacio tras recortar", () =>
  mplusValidators.account({ ...fixtureAccount, name: "   " }),
);
rejects("nombre de mas de 50", () =>
  mplusValidators.account({ ...fixtureAccount, name: "x".repeat(51) }),
);
rejects("color sin formato #RRGGBB", () =>
  mplusValidators.account({ ...fixtureAccount, color: "2563EB" }),
);
rejects("referenceCount negativo", () =>
  mplusValidators.account({ ...fixtureAccount, referenceCount: -1 }),
);
rejects("bank con icono generico", () =>
  mplusValidators.account({ ...fixtureAccount, iconType: "generic" }),
);
rejects("iconKey fuera del catalogo del tipo", () =>
  mplusValidators.account({ ...fixtureAccount, iconKey: "nequi" }),
);
rejects("campo legacy 'balance'", () =>
  mplusValidators.account({ ...fixtureAccount, balance: 1000 }),
);
mplusValidators.account({
  ...fixtureAccount,
  type: "digital_wallet",
  iconType: "generic",
  iconKey: "wallet",
});

// --- categories (contrato §8, §24) ---
rejects("icono de ingreso en categoria de gasto", () =>
  mplusValidators.category({ ...fixtureCategory, iconKey: "salary" }),
);
rejects("sortOrder negativo", () =>
  mplusValidators.category({ ...fixtureCategory, sortOrder: -1 }),
);
rejects("parentId (no existen subcategorias)", () =>
  mplusValidators.category({ ...fixtureCategory, parentId: null }),
);

// --- movements (contrato §9) ---
rejects("monto 0", () => mplusValidators.movement({ ...fixtureMovement, amount: 0 }));
rejects("monto por encima del limite", () =>
  mplusValidators.movement({ ...fixtureMovement, amount: AMOUNT_MAX + 1 }),
);
rejects("monto con decimales", () =>
  mplusValidators.movement({ ...fixtureMovement, amount: 1500.5 }),
);
rejects("tipo retirado del contrato", () =>
  mplusValidators.movement({ ...fixtureMovement, type: "transfer" }),
);
rejects("titulo de mas de 100", () =>
  mplusValidators.movement({ ...fixtureMovement, title: "x".repeat(101) }),
);
rejects("nota de mas de 500", () =>
  mplusValidators.movement({ ...fixtureMovement, note: "x".repeat(501) }),
);
rejects("activo con trashedAt", () =>
  mplusValidators.movement({ ...fixtureMovement, trashedAtMillis: 1 }),
);
rejects("trashed sin purgeAfter", () =>
  mplusValidators.movement({ ...fixtureTrashedMovement, purgeAfterMillis: null }),
);
rejects("purgeAfter que no es trashedAt + 30 dias", () =>
  mplusValidators.movement({
    ...fixtureTrashedMovement,
    purgeAfterMillis: fixtureTrashedMovement.trashedAtMillis! + 1000,
  }),
);
rejects("householdCategoryId sin householdId", () =>
  mplusValidators.movement({ ...fixtureMovement, householdCategoryId: "seed_expense_groceries" }),
);
rejects("ingreso con householdCategoryId", () =>
  mplusValidators.movement({
    ...fixtureMovement,
    type: "income",
    categoryId: "seed_income_salary",
    householdId: "h-1",
    householdCategoryId: "seed_expense_groceries",
  }),
);
rejects("campo legacy 'pocketId'", () =>
  mplusValidators.movement({ ...fixtureMovement, pocketId: null }),
);
// Gasto compartido y clasificado: valido.
mplusValidators.movement({
  ...fixtureMovement,
  householdId: "h-1",
  householdCategoryId: "seed_expense_groceries",
});
// Gasto compartido "Por clasificar": valido.
mplusValidators.movement({ ...fixtureMovement, householdId: "h-1" });

// --- households (contrato §10, DEC-072/075/076) ---
rejects("codigo de invitacion que no es de 3 digitos", () =>
  mplusValidators.household({ ...fixtureHousehold, activeInviteId: "AB12CD34" }),
);
rejects("waiting sin invitacion activa", () =>
  mplusValidators.household({ ...fixtureHousehold, activeInviteId: null }),
);
rejects("memberB igual a memberA", () =>
  mplusValidators.household({
    ...fixtureHousehold,
    status: "active",
    activeInviteId: null,
    memberBId: fixtureHousehold.memberAId,
  }),
);
rejects("waiting_return con codigo (la pausa regresa sin invitacion)", () =>
  mplusValidators.household({
    ...fixtureHousehold,
    status: "waiting_return",
    memberBId: "uid-2",
    activeInviteId: "123",
  }),
);
rejects("closing con cleanupPhase none", () =>
  mplusValidators.household({
    ...fixtureHousehold,
    status: "closing",
    memberBId: "uid-2",
    activeInviteId: null,
  }),
);
// DEC-075/076: `active` SI admite codigo de reingreso de la plaza desvinculada.
mplusValidators.household({
  ...fixtureHousehold,
  status: "active",
  memberBId: "uid-2",
  activeInviteId: "123",
});

// --- members (contrato §11) ---
const member = {
  id: "h-1__uid-1",
  schemaVersion: 1,
  householdId: "h-1",
  userId: "uid-1",
  state: "active" as const,
  displayName: "Felipe",
  photoUrl: "https://example.com/a.png",
  joinedAtMillis: 1_700_000_000_000,
  leftAtMillis: null,
  revision: 1,
  lastMutationId: "88888888-8888-4888-8888-888888888888",
  updatedAtMillis: 1_700_000_000_000,
};
mplusValidators.householdMember(member);
mplusValidators.householdMember({ ...member, photoUrl: "" });
rejects("photoUrl no HTTPS", () =>
  mplusValidators.householdMember({ ...member, photoUrl: "http://example.com/a.png" }),
);
rejects("left sin leftAt", () =>
  mplusValidators.householdMember({ ...member, state: "left" }),
);
rejects("correo en la membresia", () =>
  mplusValidators.householdMember({ ...member, email: "a@b.com" }),
);

// --- equivalencias y proyecciones (contrato §14, §15) ---
const mapping = {
  id: "uid-1__seed_expense_groceries",
  schemaVersion: 1,
  householdId: "h-1",
  ownerId: "uid-1",
  personalCategoryId: "seed_expense_groceries",
  householdCategoryId: "seed_expense_groceries",
  updatedBy: "uid-1",
  revision: 1,
  lastMutationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  createdAtMillis: 1_700_000_000_000,
  updatedAtMillis: 1_700_000_000_000,
};
mplusValidators.categoryMapping(mapping);
rejects("ID de equivalencia no determinista", () =>
  mplusValidators.categoryMapping({ ...mapping, id: "otro-id" }),
);

console.log("OK mplus-validators");
