import assert from "node:assert/strict";

import { subscriptionRegistry } from "../../src/lib/firestore/subscription-registry";

console.log("Running unit tests for subscription-registry.test.ts...");

// Reset registry to ensure clean state
subscriptionRegistry.unregisterAll();

// Test 1: Registrar 2 keys -> getActiveCount("personal") === 2
{
  let unsub1Called = 0;
  let unsub2Called = 0;

  subscriptionRegistry.register("personal", "accounts", () => {
    unsub1Called++;
  });
  subscriptionRegistry.register("personal", "transactions", () => {
    unsub2Called++;
  });

  assert.equal(subscriptionRegistry.getActiveCount("personal"), 2, "Debe registrar 2 suscripciones en el scope personal");
  assert.equal(subscriptionRegistry.getActiveCount("household"), 0, "No debe haber suscripciones en el scope household");
  assert.equal(subscriptionRegistry.getActiveCount(), 2, "El conteo total debe ser 2");

  assert.equal(unsub1Called, 0);
  assert.equal(unsub2Called, 0);
}

// Test 2: Re-registrar misma key -> la función unsubscribe anterior se ejecutó (mock/spy)
{
  let unsubOldCalled = 0;
  let unsubNewCalled = 0;

  subscriptionRegistry.register("personal", "accounts", () => {
    unsubOldCalled++;
  });

  // Re-register same key
  subscriptionRegistry.register("personal", "accounts", () => {
    unsubNewCalled++;
  });

  assert.equal(unsubOldCalled, 1, "La desuscripción anterior debe ejecutarse al re-registrar la misma key");
  assert.equal(unsubNewCalled, 0, "La nueva desuscripción no debe llamarse aún");
  assert.equal(subscriptionRegistry.getActiveCount("personal"), 2, "El conteo del scope debe seguir siendo 2");
}

// Test 3: unregister("household") no toca "personal"
{
  let unsubHouseCalled = 0;
  subscriptionRegistry.register("household", "events", () => {
    unsubHouseCalled++;
  });

  assert.equal(subscriptionRegistry.getActiveCount("household"), 1);
  assert.equal(subscriptionRegistry.getActiveCount("personal"), 2);
  assert.equal(subscriptionRegistry.getActiveCount(), 3);

  // Unregister household scope
  subscriptionRegistry.unregister("household");

  assert.equal(unsubHouseCalled, 1, "La desuscripción del household debe ejecutarse");
  assert.equal(subscriptionRegistry.getActiveCount("household"), 0, "El conteo del household debe ser 0");
  assert.equal(subscriptionRegistry.getActiveCount("personal"), 2, "El conteo del personal debe seguir siendo 2");
  assert.equal(subscriptionRegistry.getActiveCount(), 2);
}

// Test 4: unregisterAll() -> count 0
{
  subscriptionRegistry.unregisterAll();
  assert.equal(subscriptionRegistry.getActiveCount(), 0, "El conteo total debe ser 0 después de unregisterAll()");
}

console.log("All subscription-registry unit tests passed successfully!");
