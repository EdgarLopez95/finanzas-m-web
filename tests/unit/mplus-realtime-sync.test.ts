import assert from "node:assert/strict";

import {
  SubscriptionRegistry,
  subscriptionRegistry,
} from "../../src/lib/firestore/subscription-registry";
import type {
  MplusCategoryMapping,
  MplusHousehold,
  MplusHouseholdExpenseCategory,
  MplusHouseholdInvite,
  MplusHouseholdMember,
  MplusMovement,
  MplusPersonalAccount,
  MplusPersonalCategory,
  MplusUserProfile,
} from "../../src/lib/mplus/models";
import {
  createMplusPersonalStore,
  type MplusPersonalServices,
} from "../../src/stores/mplus-personal-store";
import {
  setMplusHouseholdServicesForTesting,
  useMplusHouseholdStore,
  type MplusHouseholdServices,
} from "../../src/stores/mplus-household-store";
import { resetAllStoresForSessionBoundary } from "../../src/stores/session-boundary";

// ─── Helpers de Fixtures ────────────────────────────────────────────────────

const sampleProfile = (uid: string): MplusUserProfile => ({
  uid,
  schemaVersion: 1,
  status: "ready",
  householdId: "h-100",
  householdMembershipState: "active",
  personalCatalogVersion: 1,
  revision: 1,
  lastMutationId: "mut-1",
  createdAtMillis: 1700000000000,
  updatedAtMillis: 1700000000000,
  resetRequestedAtMillis: null,
});

const sampleAccount = (id: string, name: string): MplusPersonalAccount => ({
  id,
  schemaVersion: 1,
  ownerId: "user-1",
  name,
  type: "bank",
  iconType: "generic",
  iconKey: "bank",
  color: "#000000",
  state: "active",
  referenceCount: 0,
  lastReferenceMovementId: null,
  revision: 1,
  lastMutationId: "mut-1",
  createdAtMillis: 1700000000000,
  updatedAtMillis: 1700000000000,
});

const sampleCategory = (id: string, name: string, sortOrder = 0): MplusPersonalCategory => ({
  id,
  schemaVersion: 1,
  ownerId: "user-1",
  type: "expense",
  name,
  iconKey: "food",
  color: "#ff0000",
  state: "active",
  seedKey: null,
  sortOrder,
  revision: 1,
  lastMutationId: "mut-1",
  createdAtMillis: 1700000000000,
  updatedAtMillis: 1700000000000,
});

const sampleMovement = (id: string, amount: number, occurredAtMillis: number): MplusMovement => ({
  id,
  schemaVersion: 1,
  ownerId: "user-1",
  amount,
  type: "expense",
  title: `Movimiento ${id}`,
  categoryId: "cat-1",
  accountId: "acc-1",
  note: "",
  occurredAtMillis,
  lifecycleState: "active",
  trashedAtMillis: null,
  purgeAfterMillis: null,
  householdId: null,
  householdCategoryId: null,
  revision: 1,
  lastMutationId: `mut-${id}`,
  createdAtMillis: occurredAtMillis,
  updatedAtMillis: occurredAtMillis,
});

const sampleHousehold = (id: string, status: "waiting" | "active" = "active"): MplusHousehold => ({
  id,
  schemaVersion: 1,
  status,
  name: "Hogar Familia",
  memberAId: "user-1",
  memberBId: status === "active" ? "user-2" : null,
  activeInviteId: status === "waiting" ? "inv-100" : null,
  catalogVersion: 1,
  cleanupPhase: "none",
  revision: 1,
  lastMutationId: "mut-h-1",
  createdAtMillis: 1700000000000,
  updatedAtMillis: 1700000000000,
});

export const runRealtimeSyncTests = async (): Promise<void> => {
  console.log("Iniciando pruebas unitarias de sincronización en tiempo real (mplus-realtime-sync.test.ts)...");

  // ─── 1. Sincronización en vivo de movimientos creados/modificados en Personal

  {
    let pushMovementsUpdate: ((movements: MplusMovement[]) => void) | undefined;
    const unsubCalls: string[] = [];

    const mockServices: Partial<MplusPersonalServices> = {
      subscribeProfile: (uid, onUpdate) => {
        onUpdate(sampleProfile(uid));
        return () => { unsubCalls.push("profile"); };
      },
      subscribeAccounts: (_owner, onUpdate) => {
        onUpdate([]);
        return () => { unsubCalls.push("accounts"); };
      },
      subscribeCategories: (_owner, onUpdate) => {
        onUpdate([]);
        return () => { unsubCalls.push("categories"); };
      },
      subscribeMonthMovements: (_owner, _range, onUpdate) => {
        pushMovementsUpdate = onUpdate;
        onUpdate([sampleMovement("m-1", 50000, 1786800000000)]); // 2026-08
        return () => { unsubCalls.push("movements"); };
      },
      subscribeTrashed: (_owner, onUpdate) => {
        onUpdate([]);
        return () => { unsubCalls.push("trashed"); };
      },
    };

    const store = createMplusPersonalStore(mockServices);
    await store.getState().load("user-1", { year: 2026, month: 8 });

    assert.equal(store.getState().status, "success");
    assert.equal(store.getState().movements.length, 1);
    assert.equal(store.getState().movements[0].id, "m-1");

    // Simular inserción remota desde Android / otra pestaña vía push de snapshot
    assert.ok(typeof pushMovementsUpdate === "function", "pushMovementsUpdate debe estar registrado");
    pushMovementsUpdate([
      sampleMovement("m-2", 120000, 1786900000000),
      sampleMovement("m-1", 50000, 1786800000000),
    ]);

    assert.equal(store.getState().movements.length, 2, "debe reflejar el nuevo movimiento sin recargar");
    assert.equal(store.getState().movements[0].id, "m-2", "debe respetar el orden descendente");
    assert.equal(store.getState().movements[1].id, "m-1");

    console.log("  ✓ Escenario 1: Sincronización en vivo de movimientos Personales OK");
  }

  // ─── 2. Sincronización en vivo de cuentas y categorías en Personal ──────────

  {
    let pushAccountsUpdate: ((accounts: MplusPersonalAccount[]) => void) | undefined;
    let pushCategoriesUpdate: ((categories: MplusPersonalCategory[]) => void) | undefined;

    const mockServices: Partial<MplusPersonalServices> = {
      subscribeProfile: (uid, onUpdate) => {
        onUpdate(sampleProfile(uid));
        return () => {};
      },
      subscribeAccounts: (_owner, onUpdate) => {
        pushAccountsUpdate = onUpdate;
        onUpdate([sampleAccount("acc-1", "Bancolombia")]);
        return () => {};
      },
      subscribeCategories: (_owner, onUpdate) => {
        pushCategoriesUpdate = onUpdate;
        onUpdate([sampleCategory("cat-1", "Alimentación", 1)]);
        return () => {};
      },
      subscribeMonthMovements: (_owner, _range, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeTrashed: (_owner, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
    };

    const store = createMplusPersonalStore(mockServices);
    await store.getState().load("user-1", { year: 2026, month: 8 });

    assert.equal(store.getState().accounts.length, 1);
    assert.equal(store.getState().categories.length, 1);

    // Simular creación de cuenta y categoría en Android
    assert.ok(pushAccountsUpdate && pushCategoriesUpdate);
    pushAccountsUpdate([
      sampleAccount("acc-1", "Bancolombia"),
      sampleAccount("acc-2", "Nequi"),
    ]);
    pushCategoriesUpdate([
      sampleCategory("cat-1", "Alimentación", 1),
      sampleCategory("cat-2", "Transporte", 2),
    ]);

    assert.equal(store.getState().accounts.length, 2);
    assert.equal(store.getState().accounts[1].name, "Nequi");
    assert.equal(store.getState().categories.length, 2);
    assert.equal(store.getState().categories[1].name, "Transporte");

    console.log("  ✓ Escenario 2: Sincronización en vivo de cuentas y categorías Personales OK");
  }

  // ─── 3. Sincronización en vivo de papelera en Personal ───────────────────────

  {
    let pushTrashedUpdate: ((trashed: MplusMovement[]) => void) | undefined;

    const mockServices: Partial<MplusPersonalServices> = {
      subscribeProfile: (uid, onUpdate) => {
        onUpdate(sampleProfile(uid));
        return () => {};
      },
      subscribeAccounts: (_owner, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeCategories: (_owner, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeMonthMovements: (_owner, _range, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeTrashed: (_owner, onUpdate) => {
        pushTrashedUpdate = onUpdate;
        onUpdate([]);
        return () => {};
      },
    };

    const store = createMplusPersonalStore(mockServices);
    await store.getState().load("user-1", { year: 2026, month: 8 });

    assert.equal(store.getState().trashed.length, 0);

    const trashedMovement: MplusMovement = {
      ...sampleMovement("m-trash-1", 30000, 1786800000000),
      lifecycleState: "trashed",
      trashedAtMillis: 1786800000000,
      purgeAfterMillis: 1789000000000,
    };

    assert.ok(pushTrashedUpdate);
    pushTrashedUpdate([trashedMovement]);

    assert.equal(store.getState().trashed.length, 1);
    assert.equal(store.getState().trashed[0].id, "m-trash-1");

    console.log("  ✓ Escenario 3: Sincronización en vivo de papelera Personal OK");
  }

  // ─── 4. Sincronización en vivo de documento de Hogar (waiting -> active) ────

  {
    useMplusHouseholdStore.getState().reset();
    let pushHouseholdUpdate: ((household: MplusHousehold | null) => void) | undefined;

    const mockHouseholdServices: Partial<MplusHouseholdServices> = {
      subscribeHousehold: (_hid, onUpdate) => {
        pushHouseholdUpdate = onUpdate;
        onUpdate(sampleHousehold("h-100", "waiting"));
        return () => {};
      },
      subscribeActiveInvite: (_inviteId, onUpdate) => {
        onUpdate({
          id: "inv-100",
          schemaVersion: 1,
          householdId: "h-100",
          createdBy: "user-1",
          state: "active",
          createdAtMillis: 1786000000000,
          expiresAtMillis: 1787000000000,
          usedBy: null,
          usedAtMillis: null,
          reservedForUid: null,
          revision: 1,
          lastMutationId: "mut-inv",
          updatedAtMillis: 1786000000000,
        });
        return () => {};
      },
      subscribeMembers: (_hid, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeCategories: (_hid, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeMappings: (_hid, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeCategoryLabels: (_hid, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeAccountLabels: (_hid, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeMovements: (_hid, _period, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
    };

    setMplusHouseholdServicesForTesting(mockHouseholdServices);
    await useMplusHouseholdStore.getState().load("h-100", { year: 2026, month: 8 });

    assert.equal(useMplusHouseholdStore.getState().household?.status, "waiting");
    assert.ok(useMplusHouseholdStore.getState().activeInvite !== null);
    assert.equal(useMplusHouseholdStore.getState().activeInvite?.id, "inv-100");

    // La pareja ingresa desde su teléfono: push snapshot cambia el Hogar a "active" y activeInviteId pasa a null
    assert.ok(pushHouseholdUpdate);
    pushHouseholdUpdate(sampleHousehold("h-100", "active"));

    assert.equal(
      useMplusHouseholdStore.getState().household?.status,
      "active",
      "el estado del Hogar debe cambiar a 'active' reactivamente",
    );
    assert.equal(
      useMplusHouseholdStore.getState().activeInvite,
      null,
      "la invitación activa debe limpiarse automáticamente",
    );

    console.log("  ✓ Escenario 4: Sincronización en vivo de transición de estado de Hogar OK");
  }

  // ─── 5. Sincronización en vivo de integrantes, categorías y mapeos de Hogar ──

  {
    useMplusHouseholdStore.getState().reset();
    let pushMembersUpdate: ((members: MplusHouseholdMember[]) => void) | undefined;
    let pushCategoriesUpdate: ((cats: MplusHouseholdExpenseCategory[]) => void) | undefined;
    let pushMappingsUpdate: ((mappings: MplusCategoryMapping[]) => void) | undefined;

    const mockHouseholdServices: Partial<MplusHouseholdServices> = {
      subscribeHousehold: (_hid, onUpdate) => {
        onUpdate(sampleHousehold("h-100", "active"));
        return () => {};
      },
      subscribeMembers: (_hid, onUpdate) => {
        pushMembersUpdate = onUpdate;
        onUpdate([]);
        return () => {};
      },
      subscribeCategories: (_hid, onUpdate) => {
        pushCategoriesUpdate = onUpdate;
        onUpdate([]);
        return () => {};
      },
      subscribeMappings: (_hid, onUpdate) => {
        pushMappingsUpdate = onUpdate;
        onUpdate([]);
        return () => {};
      },
      subscribeCategoryLabels: (_hid, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeAccountLabels: (_hid, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeMovements: (_hid, _period, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
    };

    setMplusHouseholdServicesForTesting(mockHouseholdServices);
    await useMplusHouseholdStore.getState().load("h-100", { year: 2026, month: 8 });

    const sampleMember: MplusHouseholdMember = {
      id: "h-100__user-1",
      schemaVersion: 1,
      householdId: "h-100",
      userId: "user-1",
      state: "active",
      joinedAtMillis: 1786000000000,
      leftAtMillis: null,
      displayName: "Edgar",
      photoUrl: "",
      revision: 1,
      lastMutationId: "mut-m-1",
      updatedAtMillis: 1786000000000,
    };

    const sampleExpenseCat: MplusHouseholdExpenseCategory = {
      id: "hcat-1",
      schemaVersion: 1,
      householdId: "h-100",
      name: "Mercado",
      iconKey: "cart",
      color: "#00ff00",
      state: "active",
      seedKey: null,
      sortOrder: 0,
      createdBy: "user-1",
      revision: 1,
      lastMutationId: "mut-hcat-1",
      createdAtMillis: 1786000000000,
      updatedAtMillis: 1786000000000,
    };

    const sampleMapping: MplusCategoryMapping = {
      id: "map-1",
      schemaVersion: 1,
      householdId: "h-100",
      ownerId: "user-1",
      personalCategoryId: "cat-1",
      householdCategoryId: "hcat-1",
      updatedBy: "user-1",
      revision: 1,
      lastMutationId: "mut-map-1",
      createdAtMillis: 1786000000000,
      updatedAtMillis: 1786000000000,
    };

    assert.ok(pushMembersUpdate && pushCategoriesUpdate && pushMappingsUpdate);
    pushMembersUpdate([sampleMember]);
    pushCategoriesUpdate([sampleExpenseCat]);
    pushMappingsUpdate([sampleMapping]);

    assert.equal(useMplusHouseholdStore.getState().members.length, 1);
    assert.equal(useMplusHouseholdStore.getState().members[0].displayName, "Edgar");
    assert.equal(useMplusHouseholdStore.getState().categories.length, 1);
    assert.equal(useMplusHouseholdStore.getState().categories[0].name, "Mercado");
    assert.equal(useMplusHouseholdStore.getState().mappings.length, 1);
    assert.equal(useMplusHouseholdStore.getState().mappings[0].householdCategoryId, "hcat-1");

    console.log("  ✓ Escenario 5: Sincronización en vivo de integrantes, categorías y mapeos de Hogar OK");
  }

  // ─── 6. Sincronización en vivo de movimientos compartidos en Hogar ──────────

  {
    useMplusHouseholdStore.getState().reset();
    let pushSharedMovementsUpdate: ((movements: MplusMovement[]) => void) | undefined;

    const mockHouseholdServices: Partial<MplusHouseholdServices> = {
      subscribeHousehold: (_hid, onUpdate) => {
        onUpdate(sampleHousehold("h-100", "active"));
        return () => {};
      },
      subscribeMembers: (_hid, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeCategories: (_hid, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeMappings: (_hid, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeCategoryLabels: (_hid, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeAccountLabels: (_hid, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeMovements: (_hid, _period, onUpdate) => {
        pushSharedMovementsUpdate = onUpdate;
        onUpdate([]);
        return () => {};
      },
    };

    setMplusHouseholdServicesForTesting(mockHouseholdServices);
    await useMplusHouseholdStore.getState().load("h-100", { year: 2026, month: 8 });

    const sharedMovement: MplusMovement = {
      ...sampleMovement("m-shared-1", 85000, 1786850000000),
      householdId: "h-100",
      householdCategoryId: "hcat-1",
    };

    assert.ok(pushSharedMovementsUpdate);
    pushSharedMovementsUpdate([sharedMovement]);

    assert.equal(useMplusHouseholdStore.getState().movements.length, 1);
    assert.equal(useMplusHouseholdStore.getState().movements[0].id, "m-shared-1");
    assert.equal(useMplusHouseholdStore.getState().movements[0].householdId, "h-100");

    console.log("  ✓ Escenario 6: Sincronización en vivo de movimientos compartidos de Hogar OK");
  }

  // ─── 7. Desuscripción y limpieza correcta de subscriptionRegistry ───────────

  {
    const registry = new SubscriptionRegistry();
    const unsubsCalled: string[] = [];

    registry.register("personal", "user-profile", () => { unsubsCalled.push("profile"); });
    registry.register("personal", "accounts", () => { unsubsCalled.push("accounts"); });
    registry.register("household", "household-doc", () => { unsubsCalled.push("household-doc"); });

    assert.equal(registry.getActiveCount("personal"), 2);
    assert.equal(registry.getActiveCount("household"), 1);
    assert.equal(registry.getActiveCount(), 3);
    assert.deepEqual(registry.getActiveKeys("personal"), ["user-profile", "accounts"]);

    // Re-registrar la misma key debe desuscribir la anterior inmediatamente
    registry.register("personal", "user-profile", () => { unsubsCalled.push("profile-2"); });
    assert.deepEqual(unsubsCalled, ["profile"], "debe haber desuscrito el listener previo de user-profile");
    assert.equal(registry.getActiveCount("personal"), 2);

    // Desuscribir scope personal
    registry.unregister("personal");
    assert.equal(registry.getActiveCount("personal"), 0);
    assert.equal(registry.getActiveCount("household"), 1);
    assert.ok(unsubsCalled.includes("profile-2"));
    assert.ok(unsubsCalled.includes("accounts"));

    // Desuscribir todo
    registry.unregisterAll();
    assert.equal(registry.getActiveCount(), 0);
    assert.ok(unsubsCalled.includes("household-doc"));

    // Probar resetAllStoresForSessionBoundary
    subscriptionRegistry.register("personal", "test-key", () => { unsubsCalled.push("boundary-personal"); });
    subscriptionRegistry.register("household", "test-key", () => { unsubsCalled.push("boundary-household"); });
    resetAllStoresForSessionBoundary();
    assert.equal(subscriptionRegistry.getActiveCount(), 0, "session boundary debe desuscribir todo");

    console.log("  ✓ Escenario 7: Desuscripción y limpieza de SubscriptionRegistry OK");
  }

  // ─── 8. Descarte de callbacks obsoletos (generation) ante cambios rápidos ───

  {
    let pushDelayedMovementsUpdate: ((movements: MplusMovement[]) => void) | undefined;

    const mockServices: Partial<MplusPersonalServices> = {
      subscribeProfile: (uid, onUpdate) => {
        onUpdate(sampleProfile(uid));
        return () => {};
      },
      subscribeAccounts: (_owner, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeCategories: (_owner, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
      subscribeMonthMovements: (owner, range, onUpdate) => {
        if (owner === "user-old") {
          pushDelayedMovementsUpdate = onUpdate;
        } else {
          onUpdate([sampleMovement("m-new-1", 10000, 1786800000000)]);
        }
        return () => {};
      },
      subscribeTrashed: (_owner, onUpdate) => {
        onUpdate([]);
        return () => {};
      },
    };

    const store = createMplusPersonalStore(mockServices);

    // Usuario 1 empieza carga
    await store.getState().load("user-old", { year: 2026, month: 8 });
    const oldGeneration = store.getState().generation;

    // Cambia rápidamente a Usuario 2 antes de que responda el listener de movimientos de Usuario 1
    await store.getState().load("user-new", { year: 2026, month: 8 });
    const newGeneration = store.getState().generation;
    assert.ok(newGeneration > oldGeneration, "la generación debe incrementarse");

    assert.equal(store.getState().ownerId, "user-new");
    assert.equal(store.getState().movements.length, 1);
    assert.equal(store.getState().movements[0].id, "m-new-1");

    // Llega el callback tardío del usuario viejo
    assert.ok(pushDelayedMovementsUpdate);
    pushDelayedMovementsUpdate([sampleMovement("m-old-tardio", 99999, 1786800000000)]);

    // El estado de user-new NO debe haber sido contaminado por la respuesta tardía
    assert.equal(store.getState().ownerId, "user-new");
    assert.equal(store.getState().movements.length, 1);
    assert.equal(
      store.getState().movements[0].id,
      "m-new-1",
      "el callback obsoleto de la generación anterior debe descartarse",
    );

    console.log("  ✓ Escenario 8: Descarte de callbacks obsoletos por generation OK");
  }

  // Limpiar servicios mock de hogar
  setMplusHouseholdServicesForTesting(null);
  console.log("\nTodos los 8 escenarios de sincronización en tiempo real pasaron exitosamente.\n");
};
