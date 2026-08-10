import assert from "node:assert/strict";

import { resolveQaResetRole, resolveQaResetConfirmationCopy } from "../../src/features/qa-reset/lib/qa-reset-role";
import type { Household } from "../../src/types/household";

console.log("Running unit tests for qa-reset-role.test.ts...");

const household = (overrides: Partial<Household> = {}): Household => ({
  id: "hh-1",
  name: "Hogar",
  ownerId: "gerson",
  memberIds: ["gerson", "familia"],
  memberCount: 2,
  inviteCode: null,
  inviteCodeExpiresAt: null,
  status: "active",
  ...overrides,
});

function runRoleResolutionTests() {
  assert.equal(resolveQaResetRole("gerson", null), "none", "sin Hogar debe ser 'none'");
  assert.equal(resolveQaResetRole("gerson", undefined), "none");
  assert.equal(resolveQaResetRole("gerson", household()), "owner", "el ownerId coincidente debe ser 'owner'");
  assert.equal(resolveQaResetRole("familia", household()), "member", "un miembro no-owner debe ser 'member'");
  assert.equal(
    resolveQaResetRole("ajeno", household()),
    "none",
    "un uid que no pertenece al Hogar (dato inconsistente) no debe clasificarse como member/owner"
  );
  assert.equal(resolveQaResetRole("", household()), "none", "uid vacío nunca debe resolver un rol");

  console.log("Resolución de rol (none/owner/member): 6/6 aserciones pasadas.");
}

function runConfirmationCopyTests() {
  const noneCopy = resolveQaResetConfirmationCopy("none");
  const ownerCopy = resolveQaResetConfirmationCopy("owner");
  const memberCopy = resolveQaResetConfirmationCopy("member");

  assert.equal(
    noneCopy,
    "Se eliminarán tus cuentas, bolsillos, categorías, movimientos y demás datos personales de prueba. Tu cuenta seguirá creada."
  );
  assert.equal(
    ownerCopy,
    "Se eliminarán tus datos personales y se disolverá el Hogar. También se borrarán sus eventos, categorías, ingresos compartidos, deudas e invitación. Esta acción afecta a todos los miembros."
  );
  assert.equal(
    memberCopy,
    "Se eliminarán tus datos personales y saldrás del Hogar. El Hogar y los datos del otro miembro permanecerán."
  );

  // Ninguno de los 3 copys debe exponer identificadores técnicos ni datos
  // privados de otro usuario (nombre, cuenta, email, IDs de documento).
  const forbidden = ["accountId", "ownerId", "@", "hh-", "acc-", "cat-", "tx-"];
  for (const copy of [noneCopy, ownerCopy, memberCopy]) {
    for (const term of forbidden) {
      assert.ok(!copy.includes(term), `el copy "${copy}" no debe contener "${term}"`);
    }
  }

  console.log("Copys de confirmación por rol (contenido exacto + sin datos privados): 9/9 aserciones pasadas.");
}

runRoleResolutionTests();
runConfirmationCopyTests();

console.log("OK qa-reset-role");
