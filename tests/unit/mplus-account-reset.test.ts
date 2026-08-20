import assert from "node:assert/strict";

import { buildInitialUserProfile, buildSeedCategory } from "../../src/lib/mplus/user-bootstrap";
import { PERSONAL_SEED, personalSeedCategoryId } from "../../src/lib/mplus/seeds";
import { mplusValidators } from "../../src/lib/mplus/schemas";
import type { MplusUserProfile } from "../../src/lib/mplus/models";

/**
 * Pruebas de contrato del Reinicio Profundo (DEC-047 / DEC-079 / DEC-080 / Contrato §17).
 */

const NOW = 1_700_000_000_000;
const MUTATION_ID = "11111111-1111-4111-8111-111111111111";

// 1. Estado inicial de un perfil en ready
const user = buildInitialUserProfile("uid-reset-1", NOW, MUTATION_ID);
assert.equal(user.status, "ready");
assert.equal(user.householdId, null);
assert.equal(user.householdMembershipState, "none");
assert.equal(user.resetRequestedAtMillis, null);
mplusValidators.user(user);

// 2. Transición a resetting durante el reinicio
const resettingUser: MplusUserProfile = {
  ...user,
  status: "resetting",
  resetRequestedAtMillis: NOW + 100,
  revision: user.revision + 1,
  lastMutationId: "22222222-2222-4222-8222-222222222222",
  updatedAtMillis: NOW + 100,
};
assert.equal(resettingUser.status, "resetting");
assert.equal(resettingUser.resetRequestedAtMillis, NOW + 100);
mplusValidators.user(resettingUser);

// 3. Restauración final a ready post-reinicio
const readyUser: MplusUserProfile = {
  ...resettingUser,
  status: "ready",
  householdId: null,
  householdMembershipState: "none",
  resetRequestedAtMillis: null,
  personalCatalogVersion: 1,
  revision: resettingUser.revision + 1,
  lastMutationId: "33333333-3333-4333-8333-333333333333",
  updatedAtMillis: NOW + 200,
};
assert.equal(readyUser.status, "ready");
assert.equal(readyUser.householdId, null);
assert.equal(readyUser.householdMembershipState, "none");
assert.equal(readyUser.resetRequestedAtMillis, null);
assert.equal(readyUser.revision, 3);
mplusValidators.user(readyUser);

// 4. Catálogos restaurados tras el reinicio: exactamente 22 categorías seed
const restoredSeedCategories = PERSONAL_SEED.map((seed) =>
  buildSeedCategory("uid-reset-1", seed, NOW + 200, "44444444-4444-4444-8444-444444444444")
);
assert.equal(restoredSeedCategories.length, 22);
for (const cat of restoredSeedCategories) {
  mplusValidators.category(cat);
  assert.equal(cat.ownerId, "uid-reset-1");
  assert.equal(cat.state, "active");
  assert.equal(cat.revision, 1);
}
