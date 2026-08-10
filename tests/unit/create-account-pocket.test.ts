import assert from "node:assert/strict";
import { createAccountPocket } from "../../src/features/pockets/services/create-account-pocket";

console.log("Running unit tests for create-account-pocket.test.ts...");

type FakeDocRef = { __path: string; id: string };
const makeDocFn = () => (...args: unknown[]) => {
  // If first arg is a db (object) and not an array, we ignore it from path if it's `{}`. But we can just filter out non-strings/arrays.
  // Actually, collectionFn returns an array. So args could be [ {}, "accounts", "acc-1", "pockets" ] or [ ["accounts", "acc-1", "pockets"] ]
  const flatSegments = args.flat().filter(x => typeof x === "string");
  if (flatSegments.length > 0 && flatSegments[flatSegments.length - 1] === "pockets") {
    flatSegments.push("pocket-new");
  }
  return { __path: flatSegments.join("/"), id: flatSegments[flatSegments.length - 1] };
};
const collectionFn = (...args: unknown[]) => args.flat().filter(x => typeof x === "string");

// G2 — snapshot vacío por defecto: ningún dinero no propio en ninguna ubicación.
const EMPTY_SNAPSHOT = async () => ({ entries: [], moves: [], consumptions: [] });

type FakeTransaction = {
  get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  set: (ref: unknown, data: Record<string, unknown>) => void;
  update: (ref: unknown, data: Record<string, unknown>) => void;
  delete: (ref: unknown) => void;
};

function makeFakeTransactionEnv(docsByPath: Map<string, Record<string, unknown>>) {
  const setCalls: Array<{ path: string; data: Record<string, unknown> }> = [];
  const updateCalls: Array<{ path: string; data: Record<string, unknown> }> = [];
  const deleteCalls: Array<{ path: string }> = [];

  const transaction: FakeTransaction = {
    get: async (ref) => {
      const key = (ref as FakeDocRef).__path;
      const data = docsByPath.get(key);
      return { exists: () => data !== undefined, data: () => data ?? {} };
    },
    set: (ref, data) => {
      setCalls.push({ path: (ref as FakeDocRef).__path, data });
    },
    update: (ref, data) => {
      updateCalls.push({ path: (ref as FakeDocRef).__path, data });
    },
    delete: (ref) => {
      deleteCalls.push({ path: (ref as FakeDocRef).__path });
    },
  };

  const getDocFn = async (ref: unknown) => {
    const key = (ref as FakeDocRef).__path;
    const data = docsByPath.get(key);
    return { exists: () => data !== undefined, data: () => data ?? {} };
  };
  const getDocsFn = async () => ({
    size: [...docsByPath.keys()].filter((k) => k.includes("/pockets/")).length,
  });

  return { transaction, setCalls, updateCalls, deleteCalls, getDocFn, getDocsFn };
}

async function runTests() {
  // ══════════════════════════════════════════════════════════════════════
  // P0 (restauración) — Crear un bolsillo NORMAL con monto positivo debe
  // funcionar con el contrato del Paso 3, SIN `initialOwnership` y sin
  // consultar ni escribir operaciones de ubicación de dinero no propio.
  // ══════════════════════════════════════════════════════════════════════
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/account-1", { ownerId: "user-1", archived: false, currentBalance: 50_000 });
    const { transaction, updateCalls, setCalls, getDocFn, getDocsFn } = makeFakeTransactionEnv(docsByPath);

    await createAccountPocket(
      {
        accountId: "account-1",
        ownerId: "user-1",
        name: "Ahorro",
        balance: 20_000,
      },
      {
        getFirebaseDbFn: () => ({}),
        docFn: makeDocFn(),
        collectionFn,
        getDocFn,
        getDocsFn,
        readThirdPartyLocationSnapshotFn: EMPTY_SNAPSHOT,
        runTransactionFn: (_d, fn) => fn(transaction as any),
      }
    );

    // Disponible disminuye; el bolsillo recibe el monto; el total físico no cambia.
    const accountUpdate = updateCalls.find((u) => u.path === "accounts/account-1");
    assert.ok(accountUpdate, "debe actualizar el Disponible de la cuenta");
    assert.equal(accountUpdate.data.currentBalance, 30_000, "Disponible 50.000 - 20.000 = 30.000");

    const pocketSet = setCalls.find((s) => s.path === "accounts/account-1/pockets/pocket-new");
    assert.ok(pocketSet, "debe crear el bolsillo");
    assert.equal(pocketSet.data.balance, 20_000);
    assert.equal(pocketSet.data.name, "Ahorro");
    assert.equal(
      Number(accountUpdate.data.currentBalance) + Number(pocketSet.data.balance),
      50_000,
      "el total físico no cambia",
    );

    // Se conserva la transacción técnica del Paso 3.
    const txSet = setCalls.find((s) => s.path === "transactions/pocket-initial:pocket-new");
    assert.ok(txSet, "debe conservarse el movimiento técnico del Paso 3");
    assert.equal(txSet.data.amount, 20_000);
    assert.equal(txSet.data.title, "Saldo inicial");

    // CERO escrituras de operaciones de ubicación de dinero no propio.
    const locationOps = setCalls.filter((s) => s.path.startsWith("third_party_fund_location_operations"));
    assert.equal(locationOps.length, 0, "no debe escribirse ninguna operación de ubicación");

    console.log("  ✓ P0: crear bolsillo con monto positivo funciona sin initialOwnership y sin operaciones de ubicación");
  }

  // Caso 1: Crear bolsillo con saldo (20.000) de cuenta con (50.000)
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-1", archived: false, currentBalance: 50_000 });
    const { transaction, updateCalls, setCalls, getDocFn, getDocsFn } = makeFakeTransactionEnv(docsByPath);

    await createAccountPocket(
      {
        accountId: "acc-1",
        ownerId: "user-1",
        name: "Ahorros",
        balance: 20_000,
      },
      {
        getFirebaseDbFn: () => ({}),
        docFn: makeDocFn(),
        collectionFn,
        getDocFn,
        getDocsFn,
        readThirdPartyLocationSnapshotFn: EMPTY_SNAPSHOT,
        runTransactionFn: (_d, fn) => fn(transaction as any),
      }
    );



    // Debe escribir el nuevo bolsillo
    const pocketSet = setCalls.find((s) => s.path === "accounts/acc-1/pockets/pocket-new");
    assert.ok(pocketSet);
    assert.equal(pocketSet.data.balance, 20_000);
    assert.equal(pocketSet.data.name, "Ahorros");

    // Debe descontar del balance
    const accountUpdate = updateCalls.find((u) => u.path === "accounts/acc-1");
    assert.ok(accountUpdate);
    assert.equal(accountUpdate.data.currentBalance, 30_000);



    // Debe haber traza tecnica
    const txSet = setCalls.find((s) => s.path === "transactions/pocket-initial:pocket-new");
    assert.ok(txSet);
    assert.equal(txSet.data.amount, 20_000);
    assert.equal(txSet.data.title, "Saldo inicial");
  }

  // Caso 2: Crear bolsillo con saldo 0
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-1", archived: false, currentBalance: 50_000 });
    const { transaction, updateCalls, setCalls, getDocFn, getDocsFn } = makeFakeTransactionEnv(docsByPath);

    await createAccountPocket(
      {
        accountId: "acc-1",
        ownerId: "user-1",
        name: "Cero",
        balance: 0,
      },
      {
        getFirebaseDbFn: () => ({}),
        docFn: makeDocFn(),
        collectionFn,
        getDocFn,
        getDocsFn,
        runTransactionFn: (_d, fn) => fn(transaction as any),
      }
    );

    const pocketSet = setCalls.find((s) => s.path === "accounts/acc-1/pockets/pocket-new");
    assert.ok(pocketSet);
    assert.equal(pocketSet.data.balance, 0);

    // No hay update ni transaction set
    assert.equal(updateCalls.length, 1); // Only updatedAt / currentBalance stays the same
    assert.equal(updateCalls[0].data.currentBalance, 50_000);

    const txSet = setCalls.find((s) => s.path.startsWith("transactions/"));
    assert.ok(!txSet);

    // balance 0 -> sin op de ubicación, sin importar `initialOwnership` (ignorado).
    const locationOps = setCalls.filter((s) => s.path.startsWith("third_party_fund_location_operations"));
    assert.equal(locationOps.length, 0, "balance 0 no debe escribir ninguna operación de ubicación");
  }

  // Caso 3: Saldo mayor al disponible (Rechazo)
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-1", archived: false, currentBalance: 10_000 });
    const { transaction, updateCalls, setCalls, getDocFn, getDocsFn } = makeFakeTransactionEnv(docsByPath);

    await assert.rejects(
      () =>
        createAccountPocket(
          {
            accountId: "acc-1",
            ownerId: "user-1",
            name: "Caro",
            balance: 20_000,
          },
          {
            getFirebaseDbFn: () => ({}),
            docFn: makeDocFn(),
            collectionFn,
            getDocFn,
            getDocsFn,
            readThirdPartyLocationSnapshotFn: EMPTY_SNAPSHOT,
            runTransactionFn: (_d, fn) => fn(transaction as any),
          }
        ),
      // G4 — sin dinero no propio retenido, el motivo es de saldo físico, no
      // de propiedad: el copy ahora los distingue.
      /Saldo insuficiente/
    );

    assert.equal(updateCalls.length, 0);
    assert.equal(setCalls.length, 0);
  }

  // Caso 4: Cuenta archived=true
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-1", archived: true, currentBalance: 50_000 });
    const { transaction, updateCalls, setCalls, getDocFn, getDocsFn } = makeFakeTransactionEnv(docsByPath);

    await assert.rejects(
      () =>
        createAccountPocket(
          {
            accountId: "acc-1",
            ownerId: "user-1",
            name: "Caro",
            balance: 10_000,
          },
          {
            getFirebaseDbFn: () => ({}),
            docFn: makeDocFn(),
            collectionFn,
            getDocFn,
            getDocsFn,
            readThirdPartyLocationSnapshotFn: EMPTY_SNAPSHOT,
            runTransactionFn: (_d, fn) => fn(transaction as any),
          }
        ),
      /cerrada/
    );

    assert.equal(updateCalls.length, 0);
    assert.equal(setCalls.length, 0);
  }

  // Caso 5: Owner distinto
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-OTHER", archived: false, currentBalance: 50_000 });
    const { transaction, updateCalls, setCalls, getDocFn, getDocsFn } = makeFakeTransactionEnv(docsByPath);

    await assert.rejects(
      () =>
        createAccountPocket(
          {
            accountId: "acc-1",
            ownerId: "user-1",
            name: "Caro",
            balance: 10_000,
          },
          {
            getFirebaseDbFn: () => ({}),
            docFn: makeDocFn(),
            collectionFn,
            getDocFn,
            getDocsFn,
            readThirdPartyLocationSnapshotFn: EMPTY_SNAPSHOT,
            runTransactionFn: (_d, fn) => fn(transaction as any),
          }
        ),
      /No tienes permiso/
    );

    assert.equal(updateCalls.length, 0);
    assert.equal(setCalls.length, 0);
  }

  // ══════════════════════════════════════════════════════════════════════
  // G2 — atribución del monto inicial ("own" default vs "third_party" OCC)
  // ══════════════════════════════════════════════════════════════════════

  // Caso 6: own 20.000 con físico 50.000 y 10.000 retenidos no propios en
  // Disponible → OK (propio disponible = 40.000 ≥ 20.000); sin location op.
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-1", archived: false, currentBalance: 50_000 });
    const { transaction, updateCalls, setCalls, getDocFn, getDocsFn } = makeFakeTransactionEnv(docsByPath);
    const snapshotWithHeld = async () => ({
      entries: [{ entryId: "e1", createdAtMillis: 1, originalAmount: 10_000, location: { accountId: "acc-1", pocketId: null } }],
      moves: [],
      consumptions: [],
    });

    await createAccountPocket(
      {
        accountId: "acc-1",
        ownerId: "user-1",
        name: "Ahorros",
        balance: 20_000,
        initialOwnership: "own",
      },
      {
        getFirebaseDbFn: () => ({}),
        docFn: makeDocFn(),
        collectionFn,
        getDocFn,
        getDocsFn,
        readThirdPartyLocationSnapshotFn: snapshotWithHeld,
        runTransactionFn: (_d, fn) => fn(transaction as any),
      }
    );

    const accountUpdate = updateCalls.find((u) => u.path === "accounts/acc-1");
    assert.ok(accountUpdate);
    assert.equal(accountUpdate.data.currentBalance, 30_000, "50.000 - 20.000 = 30.000");

    const pocketSet = setCalls.find((s) => s.path === "accounts/acc-1/pockets/pocket-new");
    assert.ok(pocketSet);
    assert.equal(pocketSet.data.balance, 20_000);

    const locationOps = setCalls.filter((s) => s.path.startsWith("third_party_fund_location_operations"));
    assert.equal(locationOps.length, 0, "own no debe escribir ninguna operación de ubicación");

    const txSet = setCalls.find((s) => s.path === "transactions/pocket-initial:pocket-new");
    assert.ok(txSet);
    assert.equal(txSet.data.movesThirdPartyFunds, undefined, "own no lleva la marca movesThirdPartyFunds");

    console.log("  ✓ Caso 6: own 20.000 con held 10.000 en Disponible (propio 40.000) -> OK, sin location op");
  }

  // Caso 7: own 45.000 con físico 50.000 y 10.000 retenidos -> propio
  // disponible es 40.000: rechazo por barrera de fondos propios (no solo físico).
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-1", archived: false, currentBalance: 50_000 });
    const { transaction, updateCalls, setCalls, getDocFn, getDocsFn } = makeFakeTransactionEnv(docsByPath);
    const snapshotWithHeld = async () => ({
      entries: [{ entryId: "e1", createdAtMillis: 1, originalAmount: 10_000, location: { accountId: "acc-1", pocketId: null } }],
      moves: [],
      consumptions: [],
    });

    await assert.rejects(
      () =>
        createAccountPocket(
          {
            accountId: "acc-1",
            ownerId: "user-1",
            name: "Caro",
            balance: 45_000,
            initialOwnership: "own",
          },
          {
            getFirebaseDbFn: () => ({}),
            docFn: makeDocFn(),
            collectionFn,
            getDocFn,
            getDocsFn,
            readThirdPartyLocationSnapshotFn: snapshotWithHeld,
            runTransactionFn: (_d, fn) => fn(transaction as any),
          }
        ),
      // G4 — copy canónico: el físico alcanza (50.000), lo que no alcanza es Mi dinero (40.000).
      /pero solo .* es tu dinero/i,
    );

    assert.equal(updateCalls.length, 0);
    assert.equal(setCalls.length, 0);
    console.log("  ✓ Caso 7: own 45.000 con propio disponible 40.000 -> rechazo por barrera propia (físico solo no basta)");
  }

  // Caso 8: third_party 10.000 con 10.000 retenidos en Disponible -> OCC
  // atómico: escribe third_party_fund_location_operations + ledger version+1
  // + movesThirdPartyFunds:true.
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-1", archived: false, currentBalance: 50_000 });
    docsByPath.set("third_party_fund_location_ledger/user-1", { ownerId: "user-1", version: 0, lastOperationId: null });
    const { transaction, updateCalls, setCalls, getDocFn, getDocsFn } = makeFakeTransactionEnv(docsByPath);
    const snapshotWithHeld = async () => ({
      entries: [{ entryId: "e1", createdAtMillis: 1, originalAmount: 10_000, location: { accountId: "acc-1", pocketId: null } }],
      moves: [],
      consumptions: [],
    });

    await createAccountPocket(
      {
        accountId: "acc-1",
        ownerId: "user-1",
        name: "Fondo ajeno",
        balance: 10_000,
        initialOwnership: "third_party",
      },
      {
        getFirebaseDbFn: () => ({}),
        docFn: makeDocFn(),
        collectionFn,
        getDocFn,
        getDocsFn,
        readThirdPartyLocationSnapshotFn: snapshotWithHeld,
        runTransactionFn: (_d, fn) => fn(transaction as any),
      }
    );

    const accountUpdate = updateCalls.find((u) => u.path === "accounts/acc-1");
    assert.ok(accountUpdate);
    assert.equal(accountUpdate.data.currentBalance, 40_000, "50.000 - 10.000 = 40.000");

    const pocketSet = setCalls.find((s) => s.path === "accounts/acc-1/pockets/pocket-new");
    assert.ok(pocketSet);
    assert.equal(pocketSet.data.balance, 10_000);

    const txSet = setCalls.find((s) => s.path === "transactions/pocket-initial:pocket-new");
    assert.ok(txSet);
    assert.equal(txSet.data.movesThirdPartyFunds, true);
    assert.equal(txSet.data.amount, 10_000);

    const opSet = setCalls.find((s) => s.path === "third_party_fund_location_operations/pocket-initial:pocket-new");
    assert.ok(opSet, "debe escribir la operación de ubicación pocket_initial");
    assert.equal(opSet.data.sourceKind, "pocket_initial");
    assert.equal(opSet.data.totalAmount, 10_000);
    assert.deepEqual(opSet.data.lines, [{ entryId: "e1", amount: 10_000 }]);

    const ledgerUpdate = updateCalls.find((u) => u.path === "third_party_fund_location_ledger/user-1");
    assert.ok(ledgerUpdate, "debe avanzar la versión del ledger OCC");
    assert.equal(ledgerUpdate.data.version, 1);

    console.log("  ✓ Caso 8: third_party 10.000 con held 10.000 -> OCC atómico, op pocket_initial + ledger version+1");
  }

  // Caso 9: third_party 11.000 con solo 10.000 retenidos -> rechazo (FIFO
  // insuficiente), sin ninguna escritura.
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-1", archived: false, currentBalance: 50_000 });
    docsByPath.set("third_party_fund_location_ledger/user-1", { ownerId: "user-1", version: 0, lastOperationId: null });
    const { transaction, updateCalls, setCalls, getDocFn, getDocsFn } = makeFakeTransactionEnv(docsByPath);
    const snapshotWithHeld = async () => ({
      entries: [{ entryId: "e1", createdAtMillis: 1, originalAmount: 10_000, location: { accountId: "acc-1", pocketId: null } }],
      moves: [],
      consumptions: [],
    });

    await assert.rejects(
      () =>
        createAccountPocket(
          {
            accountId: "acc-1",
            ownerId: "user-1",
            name: "Fondo ajeno",
            balance: 11_000,
            initialOwnership: "third_party",
          },
          {
            getFirebaseDbFn: () => ({}),
            docFn: makeDocFn(),
            collectionFn,
            getDocFn,
            getDocsFn,
            readThirdPartyLocationSnapshotFn: snapshotWithHeld,
            runTransactionFn: (_d, fn) => fn(transaction as any),
          }
        ),
      /No hay dinero no propio suficiente/,
    );

    assert.equal(updateCalls.length, 0);
    assert.equal(setCalls.length, 0);
    console.log("  ✓ Caso 9: third_party 11.000 con held 10.000 -> rechazo por FIFO insuficiente, sin escrituras");
  }
}

runTests().then(() => {
  console.log("All create-account-pocket unit tests passed successfully!");
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
