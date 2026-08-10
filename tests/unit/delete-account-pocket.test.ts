import assert from "node:assert/strict";
import { deleteAccountPocket } from "../../src/features/pockets/services/delete-account-pocket";

console.log("Running unit tests for delete-account-pocket.test.ts...");

type FakeDocRef = { __path: string; id: string };
const makeDocFn = () => (...args: unknown[]) => {
  const flatSegments = args.flat().filter(x => typeof x === "string");
  return { __path: flatSegments.join("/"), id: flatSegments[flatSegments.length - 1] };
};
const collectionFn = (...args: unknown[]) => args.flat().filter(x => typeof x === "string");

// G2 — snapshot vacío por defecto: ningún dinero no propio en ninguna ubicación.
const EMPTY_SNAPSHOT = async () => ({ entries: [], moves: [], consumptions: [] });

// G2.1 — la ruta única SIEMPRE pasa por el ledger OCC (ensureLedger +
// lectura de versión), incluso cuando termina resolviendo held=0. Todo
// fixture necesita el doc de ledger pre-sembrado.
const LEDGER_DOC = (ownerId: string, version = 0) => ({ ownerId, version, lastOperationId: null });

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

  return { transaction, setCalls, updateCalls, deleteCalls, getDocFn };
}

async function runTests() {
  // ══════════════════════════════════════════════════════════════════════
  // P0 (restauración) — Eliminar un bolsillo sin dinero no propio retenido
  // debe funcionar con el contrato del Paso 3, SIN escribir ninguna
  // operación de ubicación (aunque ahora pasa por el gate del ledger).
  // ══════════════════════════════════════════════════════════════════════
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/account-1", { ownerId: "user-1", archived: false, currentBalance: 50_000 });
    docsByPath.set("accounts/account-1/pockets/pocket-1", { balance: 20_000, name: "Ahorro" });
    docsByPath.set("third_party_fund_location_ledger/user-1", LEDGER_DOC("user-1"));
    const { transaction, updateCalls, setCalls, deleteCalls, getDocFn } = makeFakeTransactionEnv(docsByPath);

    await deleteAccountPocket(
      { accountId: "account-1", ownerId: "user-1", pocketId: "pocket-1" },
      {
        getFirebaseDbFn: () => ({}),
        docFn: makeDocFn(),
        collectionFn,
        getDocFn,
        readThirdPartyLocationSnapshotFn: EMPTY_SNAPSHOT,
        runTransactionFn: (_d, fn) => fn(transaction as any),
      }
    );

    // El bolsillo se elimina y su saldo vuelve al Disponible; total físico intacto.
    assert.ok(
      deleteCalls.some((d) => d.path === "accounts/account-1/pockets/pocket-1"),
      "debe eliminar el bolsillo",
    );
    const accountUpdate = updateCalls.find((u) => u.path === "accounts/account-1");
    assert.ok(accountUpdate, "debe devolver el saldo al Disponible");
    assert.equal(accountUpdate.data.currentBalance, 70_000, "50.000 + 20.000 = 70.000; el total físico no cambia");

    // Se conserva el historial técnico del Paso 3.
    const txSet = setCalls.find((s) => s.path === "transactions/pocket-delete-own:pocket-1");
    assert.ok(txSet, "debe conservarse el movimiento técnico de cierre de bolsillo");
    assert.equal(txSet.data.title, "Cierre de bolsillo");

    // CERO lecturas y escrituras de operaciones de ubicación de dinero no propio.
    const locationOpWrites = setCalls.filter((s) => s.path.startsWith("third_party_fund_location_operations"));
    assert.equal(locationOpWrites.length, 0, "no debe escribirse ninguna operación de ubicación");
    assert.equal(
      setCalls.some((s) => s.data.movesThirdPartyFunds !== undefined),
      false,
      "el movimiento técnico no debe llevar la marca movesThirdPartyFunds",
    );
    // G2.1 — held=0 bajo el gate: el check de versión ocurrió, pero como no
    // hay nada que mover, el ledger NO se toca.
    const ledgerUpdate = updateCalls.find((u) => u.path === "third_party_fund_location_ledger/user-1");
    assert.ok(!ledgerUpdate, "held=0 no debe avanzar el ledger");

    console.log("  ✓ P0: eliminar bolsillo sin held funciona bajo el gate del ledger, sin escribir operaciones de ubicación");
  }

  // Caso 1: Eliminar bolsillo con saldo 20.000 (Disponible inicial 50.000), sin held.
  // Ledger version coincide -> delete OK, sin location_op, sin bump de ledger
  // (comportamiento simple preservado, ahora bajo el gate).
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-1", archived: false, currentBalance: 50_000 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { balance: 20_000, name: "Viaje" });
    docsByPath.set("third_party_fund_location_ledger/user-1", LEDGER_DOC("user-1"));
    const { transaction, updateCalls, setCalls, deleteCalls, getDocFn } = makeFakeTransactionEnv(docsByPath);

    await deleteAccountPocket(
      {
        accountId: "acc-1",
        ownerId: "user-1",
        pocketId: "pocket-1",
      },
      {
        getFirebaseDbFn: () => ({}),
        docFn: makeDocFn(),
        collectionFn,
        getDocFn,
        readThirdPartyLocationSnapshotFn: EMPTY_SNAPSHOT,
        runTransactionFn: (_d, fn) => fn(transaction as any),
      }
    );

    // Debe eliminar el bolsillo
    const pocketDel = deleteCalls.find((d) => d.path === "accounts/acc-1/pockets/pocket-1");
    assert.ok(pocketDel);

    // Debe devolver el saldo al disponible (50k + 20k)
    const accountUpdate = updateCalls.find((u) => u.path === "accounts/acc-1");
    assert.ok(accountUpdate);
    assert.equal(accountUpdate.data.currentBalance, 70_000);

    // Debe generar traza técnica
    const txSet = setCalls.find((s) => s.path === "transactions/pocket-delete-own:pocket-1");
    assert.ok(txSet);
    assert.equal(txSet.data.amount, 20_000);
    assert.equal(txSet.data.title, "Cierre de bolsillo");

    const locationOps = setCalls.filter((s) => s.path.startsWith("third_party_fund_location_operations"));
    assert.equal(locationOps.length, 0, "held=0 estable: sin location_op");
    const ledgerUpdate = updateCalls.find((u) => u.path === "third_party_fund_location_ledger/user-1");
    assert.ok(!ledgerUpdate, "held=0 estable: sin bump de ledger");

    console.log("  ✓ Caso 1: held=0 estable (versión de ledger coincide) -> delete OK, sin location_op, sin bump");
  }

  // Caso 2: Eliminar bolsillo vacio
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-1", archived: false, currentBalance: 50_000 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { balance: 0, name: "Viaje" });
    docsByPath.set("third_party_fund_location_ledger/user-1", LEDGER_DOC("user-1"));
    const { transaction, updateCalls, setCalls, deleteCalls, getDocFn } = makeFakeTransactionEnv(docsByPath);

    await deleteAccountPocket(
      {
        accountId: "acc-1",
        ownerId: "user-1",
        pocketId: "pocket-1",
      },
      {
        getFirebaseDbFn: () => ({}),
        docFn: makeDocFn(),
        collectionFn,
        getDocFn,
        readThirdPartyLocationSnapshotFn: EMPTY_SNAPSHOT,
        runTransactionFn: (_d, fn) => fn(transaction as any),
      }
    );

    // Debe eliminar el bolsillo
    const pocketDel = deleteCalls.find((d) => d.path === "accounts/acc-1/pockets/pocket-1");
    assert.ok(pocketDel);

    // No genera transaccion de devolucion, pero si actualiza el account (updatedAt / currentBalance)
    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].data.currentBalance, 50_000);
    assert.equal(setCalls.length, 0);
  }

  // Caso 3: Cuenta archivada
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-1", archived: true, currentBalance: 50_000 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { balance: 20_000, name: "Viaje" });
    docsByPath.set("third_party_fund_location_ledger/user-1", LEDGER_DOC("user-1"));
    const { transaction, updateCalls, setCalls, deleteCalls, getDocFn } = makeFakeTransactionEnv(docsByPath);

    await assert.rejects(
      () =>
        deleteAccountPocket(
          {
            accountId: "acc-1",
            ownerId: "user-1",
            pocketId: "pocket-1",
          },
          {
            getFirebaseDbFn: () => ({}),
            docFn: makeDocFn(),
            collectionFn,
            getDocFn,
            readThirdPartyLocationSnapshotFn: EMPTY_SNAPSHOT,
            runTransactionFn: (_d, fn) => fn(transaction as any),
          }
        ),
      /cerrada/
    );

    assert.equal(updateCalls.length, 0);
    assert.equal(setCalls.length, 0);
    assert.equal(deleteCalls.length, 0);
  }

  // Caso 4: Owner distinto
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-OTHER", archived: false, currentBalance: 50_000 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { balance: 20_000, name: "Viaje" });
    docsByPath.set("third_party_fund_location_ledger/user-1", LEDGER_DOC("user-1"));
    const { transaction, updateCalls, setCalls, deleteCalls, getDocFn } = makeFakeTransactionEnv(docsByPath);

    await assert.rejects(
      () =>
        deleteAccountPocket(
          {
            accountId: "acc-1",
            ownerId: "user-1",
            pocketId: "pocket-1",
          },
          {
            getFirebaseDbFn: () => ({}),
            docFn: makeDocFn(),
            collectionFn,
            getDocFn,
            readThirdPartyLocationSnapshotFn: EMPTY_SNAPSHOT,
            runTransactionFn: (_d, fn) => fn(transaction as any),
          }
        ),
      /No tienes permiso/
    );

    assert.equal(updateCalls.length, 0);
    assert.equal(setCalls.length, 0);
    assert.equal(deleteCalls.length, 0);
  }

  // ══════════════════════════════════════════════════════════════════════
  // G2 — bolsillo con dinero no propio retenido (held) al borrarlo
  // ══════════════════════════════════════════════════════════════════════

  // Caso 5: held 0 explícito con entries en OTRA ubicación -> ruta simple
  // (own), sin op ni ledger, a pesar de haber snapshot con datos.
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-1", archived: false, currentBalance: 50_000 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { balance: 20_000, name: "Viaje" });
    docsByPath.set("third_party_fund_location_ledger/user-1", LEDGER_DOC("user-1"));
    const { transaction, updateCalls, setCalls, deleteCalls, getDocFn } = makeFakeTransactionEnv(docsByPath);
    const snapshotElsewhere = async () => ({
      entries: [{ entryId: "e1", createdAtMillis: 1, originalAmount: 5_000, location: { accountId: "acc-1", pocketId: null } }],
      moves: [],
      consumptions: [],
    });

    await deleteAccountPocket(
      { accountId: "acc-1", ownerId: "user-1", pocketId: "pocket-1" },
      {
        getFirebaseDbFn: () => ({}),
        docFn: makeDocFn(),
        collectionFn,
        getDocFn,
        readThirdPartyLocationSnapshotFn: snapshotElsewhere,
        runTransactionFn: (_d, fn) => fn(transaction as any),
      }
    );

    const locationOps = setCalls.filter((s) => s.path.startsWith("third_party_fund_location_operations"));
    assert.equal(locationOps.length, 0, "held=0 en este bolsillo no debe escribir ninguna operación de ubicación");
    const accountUpdate = updateCalls.find((u) => u.path === "accounts/acc-1");
    assert.equal(accountUpdate?.data.currentBalance, 70_000);
    console.log("  ✓ Caso 5: held=0 en el bolsillo (aunque hay no propio en Disponible) -> ruta simple sin op");
  }

  // Caso 6: held 30.000, físico del bolsillo 50.000 -> OCC atómico: op
  // pocket->available 30.000, físico completo (50.000) vuelve a Disponible,
  // bolsillo borrado, ledger version+1.
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-1", archived: false, currentBalance: 20_000 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { balance: 50_000, name: "Fondo mixto" });
    docsByPath.set("third_party_fund_location_ledger/user-1", LEDGER_DOC("user-1"));
    const { transaction, updateCalls, setCalls, deleteCalls, getDocFn } = makeFakeTransactionEnv(docsByPath);
    const snapshotHeld = async () => ({
      entries: [{ entryId: "e1", createdAtMillis: 1, originalAmount: 30_000, location: { accountId: "acc-1", pocketId: "pocket-1" } }],
      moves: [],
      consumptions: [],
    });

    await deleteAccountPocket(
      { accountId: "acc-1", ownerId: "user-1", pocketId: "pocket-1" },
      {
        getFirebaseDbFn: () => ({}),
        docFn: makeDocFn(),
        collectionFn,
        getDocFn,
        readThirdPartyLocationSnapshotFn: snapshotHeld,
        runTransactionFn: (_d, fn) => fn(transaction as any),
      }
    );

    assert.ok(deleteCalls.some((d) => d.path === "accounts/acc-1/pockets/pocket-1"), "debe eliminar el bolsillo");

    const accountUpdate = updateCalls.find((u) => u.path === "accounts/acc-1");
    assert.ok(accountUpdate);
    assert.equal(accountUpdate.data.currentBalance, 70_000, "físico completo (20.000 + 50.000) vuelve a Disponible");

    const txSet = setCalls.find((s) => s.path === "transactions/pocket-delete:pocket-1");
    assert.ok(txSet, "debe registrar la transacción de cierre OCC");
    assert.equal(txSet.data.amount, 50_000, "el monto de la tx es el físico completo devuelto");
    assert.equal(txSet.data.movesThirdPartyFunds, true);

    const opSet = setCalls.find((s) => s.path === "third_party_fund_location_operations/pocket-delete:pocket-1");
    assert.ok(opSet, "debe escribir la operación de ubicación pocket_delete");
    assert.equal(opSet.data.sourceKind, "pocket_delete");
    assert.equal(opSet.data.totalAmount, 30_000, "el location op mueve solo el held, no el físico completo");
    assert.deepEqual(opSet.data.lines, [{ entryId: "e1", amount: 30_000 }]);

    const ledgerUpdate = updateCalls.find((u) => u.path === "third_party_fund_location_ledger/user-1");
    assert.ok(ledgerUpdate, "debe avanzar la versión del ledger OCC");
    assert.equal(ledgerUpdate.data.version, 1);

    console.log("  ✓ Caso 6: held 30.000 / físico 50.000 -> OCC atómico, físico completo vuelve, op pocket_delete + ledger version+1");
  }

  // Caso 7: held 60.000 > físico del bolsillo 50.000 -> inconsistencia:
  // rechazo, el bolsillo NO se borra, ninguna escritura.
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-1", archived: false, currentBalance: 20_000 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { balance: 50_000, name: "Fondo inconsistente" });
    docsByPath.set("third_party_fund_location_ledger/user-1", LEDGER_DOC("user-1"));
    const { transaction, updateCalls, setCalls, deleteCalls, getDocFn } = makeFakeTransactionEnv(docsByPath);
    const snapshotInconsistent = async () => ({
      entries: [{ entryId: "e1", createdAtMillis: 1, originalAmount: 60_000, location: { accountId: "acc-1", pocketId: "pocket-1" } }],
      moves: [],
      consumptions: [],
    });

    await assert.rejects(
      () =>
        deleteAccountPocket(
          { accountId: "acc-1", ownerId: "user-1", pocketId: "pocket-1" },
          {
            getFirebaseDbFn: () => ({}),
            docFn: makeDocFn(),
            collectionFn,
            getDocFn,
            readThirdPartyLocationSnapshotFn: snapshotInconsistent,
            runTransactionFn: (_d, fn) => fn(transaction as any),
          }
        ),
      /inconsistente/,
    );

    assert.equal(updateCalls.length, 0);
    assert.equal(setCalls.length, 0);
    assert.equal(deleteCalls.length, 0, "el bolsillo NO debe borrarse ante una composición inconsistente");
    console.log("  ✓ Caso 7: held 60.000 > físico 50.000 -> rechazo por inconsistencia, bolsillo NO borrado, sin escrituras");
  }

  // ══════════════════════════════════════════════════════════════════════
  // G2.1 — carrera cerrada: held huérfano por delete concurrente al mismo
  // bolsillo. Simula que OTRO cliente mete dinero no propio al bolsillo
  // justo después de la pre-lectura del intento 1: el ledger avanzó ->
  // conflicto -> retry -> el intento 2 ve el held actualizado y escribe
  // pocket_delete (nunca queda huérfano).
  // ══════════════════════════════════════════════════════════════════════
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "user-1", archived: false, currentBalance: 20_000 });
    docsByPath.set("accounts/acc-1/pockets/pocket-1", { balance: 50_000, name: "Fondo mixto" });
    // El doc "real" en Firestore ya está en version:1 (otro cliente avanzó el
    // ledger); el fixture de getDocFn (pre-lectura fuera de txn) y el de
    // transaction.get (dentro de txn) se controlan por separado para poder
    // simular el momento exacto en que cada uno "ve" la nueva versión.
    const { transaction, updateCalls, setCalls, deleteCalls } = makeFakeTransactionEnv(docsByPath);

    let outerLedgerReads = 0;
    const getDocFn = async (ref: unknown) => {
      const path = (ref as FakeDocRef).__path;
      if (path === "third_party_fund_location_ledger/user-1") {
        outerLedgerReads += 1;
        // Intento 1 (pre-lectura fuera de txn): todavía ve version 0.
        // Intento 2 (pre-lectura fuera de txn): ya ve version 1 (avanzada).
        const version = outerLedgerReads === 1 ? 0 : 1;
        return { exists: () => true, data: () => ({ ownerId: "user-1", version, lastOperationId: outerLedgerReads === 1 ? null : "other-device-op" }) };
      }
      const data = docsByPath.get(path);
      return { exists: () => data !== undefined, data: () => data ?? {} };
    };

    let attemptCount = 0;
    const snapshotByAttempt = async () => {
      attemptCount += 1;
      if (attemptCount === 1) {
        // Intento 1: sin dinero no propio (según lo que veía el cliente al pre-leer).
        return { entries: [], moves: [], consumptions: [] };
      }
      // Intento 2: el "otro dispositivo" ya metió 30.000 no propios al bolsillo.
      return {
        entries: [{ entryId: "e-race", createdAtMillis: 1, originalAmount: 30_000, location: { accountId: "acc-1", pocketId: "pocket-1" } }],
        moves: [],
        consumptions: [],
      };
    };

    let innerLedgerGets = 0;
    const raceTransaction: FakeTransaction = {
      ...transaction,
      get: async (ref) => {
        const path = (ref as FakeDocRef).__path;
        if (path === "third_party_fund_location_ledger/user-1") {
          innerLedgerGets += 1;
          // Lectura #1: la del bootstrap de ensureThirdPartyLocationLedger
          // (ledger ya existe y es válido en version 0 -> no escribe nada).
          if (innerLedgerGets === 1) {
            return { exists: () => true, data: () => ({ ownerId: "user-1", version: 0, lastOperationId: null }) };
          }
          // Lectura #2: dentro del intento 1 -> ya está en version 1 (avanzó
          // por el "otro cliente"), distinto de expectedVersion=0 -> conflicto.
          // Lectura #3: dentro del intento 2 -> version 1, coincide con
          // expectedVersion=1 -> procede.
          return { exists: () => true, data: () => ({ ownerId: "user-1", version: 1, lastOperationId: "other-device-op" }) };
        }
        return transaction.get(ref);
      },
    };

    await deleteAccountPocket(
      { accountId: "acc-1", ownerId: "user-1", pocketId: "pocket-1" },
      {
        getFirebaseDbFn: () => ({}),
        docFn: makeDocFn(),
        collectionFn,
        getDocFn,
        readThirdPartyLocationSnapshotFn: snapshotByAttempt,
        runTransactionFn: (_d, fn) => fn(raceTransaction as any),
      }
    );

    assert.equal(attemptCount, 2, "debe haber reintentado exactamente una vez tras el conflicto de ledger");
    assert.ok(deleteCalls.some((d) => d.path === "accounts/acc-1/pockets/pocket-1"), "debe eliminar el bolsillo en el intento que sí comitea");

    // Nunca debe haber quedado huérfano: el resultado final SIEMPRE escribe
    // pocket_delete con el held visto en el último intento (30.000), nunca
    // se borra "en silencio" con el held viejo (0) del intento 1.
    const opSet = setCalls.find((s) => s.path === "third_party_fund_location_operations/pocket-delete:pocket-1");
    assert.ok(opSet, "debe escribir pocket_delete con el held actualizado, nunca dejarlo huérfano");
    assert.equal(opSet.data.totalAmount, 30_000);

    const ledgerUpdate = updateCalls.find((u) => u.path === "third_party_fund_location_ledger/user-1");
    assert.ok(ledgerUpdate);
    assert.equal(ledgerUpdate.data.version, 2, "avanza desde la version 1 vista en el intento que comitea");

    console.log("  ✓ G2.1: carrera NP->bolsillo entre pre-lectura y commit -> conflicto de ledger -> retry -> pocket_delete con held actualizado (sin huérfano)");
  }
}

runTests().then(() => {
  console.log("All delete-account-pocket unit tests passed successfully!");
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
