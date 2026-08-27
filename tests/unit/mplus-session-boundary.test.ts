import assert from "node:assert/strict";

import { shouldResetSessionForUidChange } from "../../src/features/auth/use-auth-bootstrap";
import { useAppContextStore } from "../../src/stores/app-context-store";
import { useAuthStore } from "../../src/stores/auth-store";
import { useMplusComposerStore } from "../../src/stores/mplus-composer-store";
import { useMplusHouseholdStore } from "../../src/stores/mplus-household-store";
import { useMplusPersonalStore } from "../../src/stores/mplus-personal-store";
import { resetAllStoresForSessionBoundary } from "../../src/stores/session-boundary";

/**
 * W1/W4 — Limpieza TOTAL de stores M+ al cambiar de usuario o cerrar sesión.
 */

// La detección de cambio de sesión: primera resolución no limpia,
// mismo uid repetido tampoco, logout y cambio de cuenta sí.
assert.equal(shouldResetSessionForUidChange(undefined, "uid-a"), false);
assert.equal(shouldResetSessionForUidChange("uid-a", "uid-a"), false);
assert.equal(shouldResetSessionForUidChange("uid-a", null), true);
assert.equal(shouldResetSessionForUidChange("uid-a", "uid-b"), true);
assert.equal(shouldResetSessionForUidChange(null, "uid-a"), true);

// --- se ensucia el estado M+ ---
useMplusPersonalStore.setState({
  ownerId: "uid-a",
  status: "success",
  error: null,
  profile: {
    uid: "uid-a",
    schemaVersion: 1,
    status: "ready",
    householdId: "hh-1",
    householdMembershipState: "active",
    personalCatalogVersion: 1,
    revision: 1,
    lastMutationId: "m1",
    createdAtMillis: 1771500000000,
    updatedAtMillis: 1771500000000,
    resetRequestedAtMillis: null,
  },
  accounts: [],
  categories: [],
  movements: [],
});

useMplusHouseholdStore.setState({
  householdId: "hh-1",
  status: "success",
  error: null,
  household: {
    id: "hh-1",
    schemaVersion: 1,
    name: "Casa",
    status: "active",
    memberAId: "uid-a",
    memberBId: "uid-b",
    activeInviteId: null,
    catalogVersion: 1,
    cleanupPhase: "none",
    revision: 1,
    lastMutationId: "m1",
    createdAtMillis: 1771500000000,
    updatedAtMillis: 1771500000000,
  },
  members: [],
  categories: [],
  movements: [],
});

useMplusComposerStore.getState().openCreate("expense");

useAppContextStore.setState({
  activeContext: "household",
  initialContextBootstrapResolved: true,
  contextNotice: "aviso de la sesión anterior" as never,
  householdLossNotifiedFor: "hogar-de-uid-a",
});

useAuthStore.getState().setBootstrapError("bootstrap fallido de la sesión anterior");

resetAllStoresForSessionBoundary();

// --- datos remotos: nada del usuario anterior sobrevive ---
assert.equal(useMplusPersonalStore.getState().ownerId, null);
assert.equal(useMplusPersonalStore.getState().status, "idle");
assert.equal(useMplusPersonalStore.getState().profile, null);
assert.deepEqual(useMplusPersonalStore.getState().movements, []);

assert.equal(useMplusHouseholdStore.getState().householdId, null);
assert.equal(useMplusHouseholdStore.getState().status, "idle");
assert.equal(useMplusHouseholdStore.getState().household, null);
assert.deepEqual(useMplusHouseholdStore.getState().movements, []);

// --- superficies efímeras ---
assert.deepEqual(useMplusComposerStore.getState().mode, { kind: "closed" });

// --- contexto Personal/Hogar ---
assert.equal(useAppContextStore.getState().activeContext, "personal");
assert.equal(useAppContextStore.getState().initialContextBootstrapResolved, false);
assert.equal(useAppContextStore.getState().contextNotice, null);
assert.equal(useAppContextStore.getState().householdLossNotifiedFor, null);

// El error de bootstrap de la sesión anterior no se arrastra al cerrar sesión.
useAuthStore.getState().clearSession();
assert.equal(useAuthStore.getState().bootstrapError, null);
assert.equal(useAuthStore.getState().user, null);
assert.equal(useAuthStore.getState().isAuthenticated, false);

console.log("OK mplus-session-boundary");
