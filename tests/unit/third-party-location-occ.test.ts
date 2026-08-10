/**
 * tests/unit/third-party-location-occ.test.ts
 *
 * TDD — cobertura completa del flujo OCC de dinero no propio por ubicación.
 * No usa Firebase real; usa inyección de dependencias (fakes).
 */

import assert from "node:assert/strict";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers de fake-store compartido
// ──────────────────────────────────────────────────────────────────────────────

type FakeDoc = Record<string, unknown>;

function makeFakeDb(initial: Record<string, FakeDoc> = {}) {
  const store: Record<string, FakeDoc> = { ...initial };
  const writes: Array<{ op: "set" | "update"; path: string; data: FakeDoc }> = [];

  const ref = (_db: unknown, ...path: string[]) => ({ path: path.join("/") });

  const run = async (
    _db: unknown,
    callback: (tx: {
      get: (r: { path: string }) => Promise<{ exists: () => boolean; data: () => FakeDoc }>;
      set: (r: { path: string }, d: FakeDoc) => void;
      update: (r: { path: string }, d: FakeDoc) => void;
    }) => Promise<void>,
  ) => {
    await callback({
      get: async (r) => {
        const doc = store[r.path];
        return { exists: () => doc !== undefined, data: () => doc ?? {} };
      },
      set: (r, d) => {
        store[r.path] = d;
        writes.push({ op: "set", path: r.path, data: d });
      },
      update: (r, d) => {
        store[r.path] = { ...(store[r.path] ?? {}), ...d };
        writes.push({ op: "update", path: r.path, data: d });
      },
    });
  };

  return { store, writes, ref, run, timestamp: () => "now" };
}

// ──────────────────────────────────────────────────────────────────────────────
// Import del servicio bajo prueba
// ──────────────────────────────────────────────────────────────────────────────

import { createThirdPartyLocationTransfer } from "../../src/features/transactions/services/create-third-party-location-transfer";

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures comunes
// ──────────────────────────────────────────────────────────────────────────────

const ownerId = "user-1";
const fromAccountId = "acct-a";
const toAccountId = "acct-b";
const operationId = "op-fixed-id";

const baseEntry = {
  id: "entry-1",
  ownerId,
  sourceIncomeTransactionId: "income-tx",
  originalAmount: 50_000,
  status: "open",
  createdAtMillis: 100,
};

const incomeTx = { accountId: fromAccountId, pocketId: null };

function makeBaseStore(opts: {
  ledgerVersion?: number;
  ledgerExists?: boolean;
  fromBalance?: number;
  toBalance?: number;
} = {}): Record<string, FakeDoc> {
  const {
    ledgerVersion = 0,
    ledgerExists = true,
    fromBalance = 100_000,
    toBalance = 0,
  } = opts;

  const store: Record<string, FakeDoc> = {
    [`accounts/${fromAccountId}`]: { ownerId, currentBalance: fromBalance, archivedAt: null },
    [`accounts/${toAccountId}`]: { ownerId, currentBalance: toBalance, archivedAt: null },
    "third_party_fund_entries/entry-1": baseEntry,
    "transactions/income-tx": incomeTx,
  };

  if (ledgerExists) {
    store[`third_party_fund_location_ledger/${ownerId}`] = {
      ownerId,
      version: ledgerVersion,
      lastOperationId: null,
    };
  }

  return store;
}

// ──────────────────────────────────────────────────────────────────────────────
// Caso 1 — transferencia válida: saldos, histórico, op y ledger en UNA transacción
// ──────────────────────────────────────────────────────────────────────────────

async function testValidTransfer() {
  const fake = makeFakeDb(makeBaseStore());

  await createThirdPartyLocationTransfer(
    {
      ownerId,
      operationId,
      amount: 30_000,
      fromAccountId,
      fromPocketId: null,
      toAccountId,
      toPocketId: null,
      date: new Date("2026-01-01"),
      description: "traslado",
    },
    {
      db: {},
      ref: fake.ref,
      run: fake.run,
      timestamp: fake.timestamp,
      readSnapshot: async () => ({
        entries: [{ entryId: "entry-1", createdAtMillis: 100, originalAmount: 50_000, location: { accountId: fromAccountId, pocketId: null } }],
        moves: [],
        consumptions: [],
      }),
      readLedger: async () => ({ ownerId, version: 0, lastOperationId: null }),
    },
  );

  // Verifica escritura de saldo físico origen
  const fromSnap = fake.store[`accounts/${fromAccountId}`];
  assert.equal(fromSnap?.currentBalance, 70_000, "saldo origen debe decrecer");

  // Verifica escritura de saldo físico destino
  const toSnap = fake.store[`accounts/${toAccountId}`];
  assert.equal(toSnap?.currentBalance, 30_000, "saldo destino debe aumentar");

  // Verifica que se creó la transacción histórica
  const histTx = fake.store[`transactions/${operationId}`];
  assert.ok(histTx, "se debe crear la transacción histórica");
  assert.equal(histTx?.type, "transfer");
  assert.equal(histTx?.movesThirdPartyFunds, true);
  assert.equal(histTx?.ownerId, ownerId);

  // Verifica que se creó la operación OCC
  const op = fake.store[`third_party_fund_location_operations/${operationId}`];
  assert.ok(op, "se debe crear la operación OCC");
  assert.equal(op?.status, "active");
  assert.equal(op?.sourceTransactionId, operationId);
  assert.equal(op?.totalAmount, 30_000);

  // Verifica actualización del ledger
  const ledger = fake.store[`third_party_fund_location_ledger/${ownerId}`];
  assert.equal(ledger?.version, 1);
  assert.equal(ledger?.lastOperationId, operationId);

  // Verifica que todo ocurrió en UNA transacción (las 4 escrituras deben estar)
  const paths = fake.writes.map((w) => w.path);
  assert.ok(paths.includes(`accounts/${fromAccountId}`), "debe actualizar cuenta origen");
  assert.ok(paths.includes(`accounts/${toAccountId}`), "debe actualizar cuenta destino");
  assert.ok(paths.includes(`transactions/${operationId}`), "debe crear transacción histórica");
  assert.ok(paths.includes(`third_party_fund_location_operations/${operationId}`), "debe crear operación");
  assert.ok(paths.includes(`third_party_fund_location_ledger/${ownerId}`), "debe actualizar ledger");

  console.log("✅ Caso 1: transferencia válida OK");
}

// ──────────────────────────────────────────────────────────────────────────────
// Caso 2 — ledger versión distinta: no escribe, reproyecta
// ──────────────────────────────────────────────────────────────────────────────

async function testLedgerVersionConflict() {
  // Ledger en v1 pero readLedger devuelve v0 → conflicto detectado en runTransaction
  let snapshotReads = 0;

  const fake = makeFakeDb(makeBaseStore({ ledgerVersion: 1 }));

  let threw = false;
  try {
    await createThirdPartyLocationTransfer(
      {
        ownerId,
        operationId,
        amount: 20_000,
        fromAccountId,
        fromPocketId: null,
        toAccountId,
        toPocketId: null,
        date: new Date("2026-01-01"),
        description: "conflicto",
      },
      {
        db: {},
        ref: fake.ref,
        run: fake.run,
        timestamp: fake.timestamp,
        readSnapshot: async () => {
          snapshotReads++;
          return {
            entries: [{ entryId: "entry-1", createdAtMillis: 100, originalAmount: 50_000, location: { accountId: fromAccountId, pocketId: null } }],
            moves: [],
            consumptions: [],
          };
        },
        readLedger: async () => ({ ownerId, version: 0, lastOperationId: null }), // stale
      },
    );
  } catch (e) {
    threw = true;
    // Con 3 conflictos debe dar el mensaje exacto
    assert.ok(e instanceof Error && e.message.includes("Los datos cambiaron en otro dispositivo"), `mensaje incorrecto: ${String(e)}`);
  }
  assert.ok(threw, "debe lanzar error tras 3 conflictos");
  // Se debe haber reproyectado al menos 3 veces
  assert.ok(snapshotReads >= 3, `debe leer al menos 3 veces; leyó ${snapshotReads}`);
  // Cero escrituras efectivas
  assert.equal(fake.writes.length, 0, "no debe escribir nada tras 3 conflictos");

  console.log("✅ Caso 2: conflicto de versión → reproyecta y da mensaje recuperable OK");
}

// ──────────────────────────────────────────────────────────────────────────────
// Caso 3 — primer conflicto luego segundo intento válido
// ──────────────────────────────────────────────────────────────────────────────

async function testFirstConflictThenSuccess() {
  let attempt = 0;
  let committed = false;
  const fake = makeFakeDb(makeBaseStore());

  // Primer intento falla (ledger stale), segundo intento usa ledger fresco
  await createThirdPartyLocationTransfer(
    {
      ownerId,
      operationId,
      amount: 10_000,
      fromAccountId,
      fromPocketId: null,
      toAccountId,
      toPocketId: null,
      date: new Date("2026-01-01"),
      description: "retry",
    },
    {
      db: {},
      ref: fake.ref,
      run: async (_db, callback) => {
        attempt++;
        if (attempt === 1) {
          // Simular conflicto en primer intento
          throw new Error("La versión del ledger cambió; se requiere reproyección.");
        }
        // Segundo intento: ejecutar el fake real
        await fake.run(_db, callback);
        committed = true;
      },
      timestamp: fake.timestamp,
      readSnapshot: async () => ({
        entries: [{ entryId: "entry-1", createdAtMillis: 100, originalAmount: 50_000, location: { accountId: fromAccountId, pocketId: null } }],
        moves: [],
        consumptions: [],
      }),
      readLedger: async () => ({ ownerId, version: 0, lastOperationId: null }),
    },
  );

  assert.ok(committed, "debe comprometer en el segundo intento");
  assert.equal(attempt, 2, "deben ocurrir exactamente 2 intentos");

  console.log("✅ Caso 3: primer conflicto → segundo intento válido OK");
}

// ──────────────────────────────────────────────────────────────────────────────
// Caso 4 — saldo no propio insuficiente: cero escrituras
// ──────────────────────────────────────────────────────────────────────────────

async function testInsufficientThirdPartyBalance() {
  const fake = makeFakeDb(makeBaseStore());
  let threw = false;
  try {
    await createThirdPartyLocationTransfer(
      {
        ownerId,
        operationId,
        amount: 60_000, // más de los 50_000 disponibles no propios
        fromAccountId,
        fromPocketId: null,
        toAccountId,
        toPocketId: null,
        date: new Date("2026-01-01"),
        description: "saldo insuf",
      },
      {
        db: {},
        ref: fake.ref,
        run: fake.run,
        timestamp: fake.timestamp,
        readSnapshot: async () => ({
          entries: [{ entryId: "entry-1", createdAtMillis: 100, originalAmount: 50_000, location: { accountId: fromAccountId, pocketId: null } }],
          moves: [],
          consumptions: [],
        }),
        readLedger: async () => ({ ownerId, version: 0, lastOperationId: null }),
      },
    );
  } catch (e) {
    threw = true;
    assert.ok(e instanceof Error && /suficiente/i.test(e.message), `mensaje incorrecto: ${String(e)}`);
  }
  assert.ok(threw, "debe lanzar error");
  assert.equal(fake.writes.length, 0, "cero escrituras");
  console.log("✅ Caso 4: saldo no propio insuficiente → cero escrituras OK");
}

// ──────────────────────────────────────────────────────────────────────────────
// Caso 5 — saldo físico insuficiente: cero escrituras
// ──────────────────────────────────────────────────────────────────────────────

async function testInsufficientPhysicalBalance() {
  // Saldo físico de origen solo 5_000, intenta mover 20_000
  const fake = makeFakeDb(makeBaseStore({ fromBalance: 5_000 }));
  let threw = false;
  try {
    await createThirdPartyLocationTransfer(
      {
        ownerId,
        operationId,
        amount: 20_000,
        fromAccountId,
        fromPocketId: null,
        toAccountId,
        toPocketId: null,
        date: new Date("2026-01-01"),
        description: "fisico insuf",
      },
      {
        db: {},
        ref: fake.ref,
        run: fake.run,
        timestamp: fake.timestamp,
        readSnapshot: async () => ({
          entries: [{ entryId: "entry-1", createdAtMillis: 100, originalAmount: 50_000, location: { accountId: fromAccountId, pocketId: null } }],
          moves: [],
          consumptions: [],
        }),
        readLedger: async () => ({ ownerId, version: 0, lastOperationId: null }),
      },
    );
  } catch (e) {
    threw = true;
    assert.ok(e instanceof Error && /saldo/i.test(e.message), `mensaje incorrecto: ${String(e)}`);
  }
  assert.ok(threw, "debe lanzar error por saldo físico");
  assert.equal(fake.writes.length, 0, "cero escrituras");
  console.log("✅ Caso 5: saldo físico insuficiente → cero escrituras OK");
}

// ──────────────────────────────────────────────────────────────────────────────
// Caso 6 — más de 50 líneas: cero escrituras
// ──────────────────────────────────────────────────────────────────────────────

async function testTooManyLines() {
  // 51 entries de 1 peso cada una, pedir 51
  const manyEntries = Array.from({ length: 51 }, (_, i) => ({
    entryId: `e${i}`,
    createdAtMillis: i,
    originalAmount: 1,
    location: { accountId: fromAccountId, pocketId: null },
  }));

  const fake = makeFakeDb(makeBaseStore({ fromBalance: 200_000 }));
  let threw = false;
  try {
    await createThirdPartyLocationTransfer(
      {
        ownerId,
        operationId,
        amount: 51,
        fromAccountId,
        fromPocketId: null,
        toAccountId,
        toPocketId: null,
        date: new Date("2026-01-01"),
        description: "too many",
      },
      {
        db: {},
        ref: fake.ref,
        run: fake.run,
        timestamp: fake.timestamp,
        readSnapshot: async () => ({ entries: manyEntries, moves: [], consumptions: [] }),
        readLedger: async () => ({ ownerId, version: 0, lastOperationId: null }),
      },
    );
  } catch (e) {
    threw = true;
    assert.ok(e instanceof Error && /50/i.test(e.message), `mensaje incorrecto: ${String(e)}`);
  }
  assert.ok(threw, "debe lanzar error por >50 líneas");
  assert.equal(fake.writes.length, 0, "cero escrituras");
  console.log("✅ Caso 6: >50 líneas → cero escrituras OK");
}

// ──────────────────────────────────────────────────────────────────────────────
// Caso 7 — ubicación no resoluble (entry con location null): cero escrituras
// ──────────────────────────────────────────────────────────────────────────────

async function testUnresolvableLocation() {
  const fake = makeFakeDb(makeBaseStore());
  let threw = false;
  try {
    await createThirdPartyLocationTransfer(
      {
        ownerId,
        operationId,
        amount: 10_000,
        fromAccountId,
        fromPocketId: null,
        toAccountId,
        toPocketId: null,
        date: new Date("2026-01-01"),
        description: "sin ubicacion",
      },
      {
        db: {},
        ref: fake.ref,
        run: fake.run,
        timestamp: fake.timestamp,
        readSnapshot: async () => ({
          entries: [{ entryId: "entry-1", createdAtMillis: 100, originalAmount: 50_000, location: null }],
          moves: [],
          consumptions: [],
        }),
        readLedger: async () => ({ ownerId, version: 0, lastOperationId: null }),
      },
    );
  } catch (e) {
    threw = true;
    assert.ok(e instanceof Error && /ubicaci/i.test(e.message), `mensaje incorrecto: ${String(e)}`);
  }
  assert.ok(threw, "debe lanzar error por ubicación no resoluble");
  assert.equal(fake.writes.length, 0, "cero escrituras");
  console.log("✅ Caso 7: ubicación no resoluble → cero escrituras OK");
}

// ──────────────────────────────────────────────────────────────────────────────
// Caso 8 — 3 conflictos: mensaje recuperable exacto
// ──────────────────────────────────────────────────────────────────────────────

async function testThreeConflictsExactMessage() {
  const fake = makeFakeDb(makeBaseStore());
  let threw = false;
  try {
    await createThirdPartyLocationTransfer(
      {
        ownerId,
        operationId,
        amount: 10_000,
        fromAccountId,
        fromPocketId: null,
        toAccountId,
        toPocketId: null,
        date: new Date("2026-01-01"),
        description: "tres conflictos",
      },
      {
        db: {},
        ref: fake.ref,
        run: async () => { throw new Error("La versión del ledger cambió; se requiere reproyección."); },
        timestamp: fake.timestamp,
        readSnapshot: async () => ({
          entries: [{ entryId: "entry-1", createdAtMillis: 100, originalAmount: 50_000, location: { accountId: fromAccountId, pocketId: null } }],
          moves: [],
          consumptions: [],
        }),
        readLedger: async () => ({ ownerId, version: 0, lastOperationId: null }),
      },
    );
  } catch (e) {
    threw = true;
    assert.ok(
      e instanceof Error && e.message === "Los datos cambiaron en otro dispositivo. Intenta nuevamente.",
      `mensaje incorrecto: ${String(e)}`,
    );
  }
  assert.ok(threw);
  assert.equal(fake.writes.length, 0, "cero escrituras tras 3 conflictos");
  console.log("✅ Caso 8: 3 conflictos → mensaje exacto OK");
}

// ──────────────────────────────────────────────────────────────────────────────
// Caso 9 — FIFO usa fecha y entryId (orden correcto)
// ──────────────────────────────────────────────────────────────────────────────

async function testFifoOrder() {
  // Dos entries: "later" (ms=20) y "first" (ms=10). Monto=70.
  // Debe tomar 70 de "first" (70 disponibles) y 0 de "later" (solo necesita 70).
  const fake = makeFakeDb(makeBaseStore({ fromBalance: 200_000 }));

  // Registrar las líneas escritas en la operación
  let capturedLines: Array<{ entryId: string; amount: number }> = [];

  await createThirdPartyLocationTransfer(
    {
      ownerId,
      operationId,
      amount: 70,
      fromAccountId,
      fromPocketId: null,
      toAccountId,
      toPocketId: null,
      date: new Date("2026-01-01"),
      description: "fifo orden",
    },
    {
      db: {},
      ref: fake.ref,
      run: async (_db, callback) => {
        await fake.run(_db, callback);
        const op = fake.store[`third_party_fund_location_operations/${operationId}`];
        capturedLines = (op?.lines ?? []) as typeof capturedLines;
      },
      timestamp: fake.timestamp,
      readSnapshot: async () => ({
        entries: [
          { entryId: "later", createdAtMillis: 20, originalAmount: 60, location: { accountId: fromAccountId, pocketId: null } },
          { entryId: "first", createdAtMillis: 10, originalAmount: 70, location: { accountId: fromAccountId, pocketId: null } },
        ],
        moves: [],
        consumptions: [],
      }),
      readLedger: async () => ({ ownerId, version: 0, lastOperationId: null }),
    },
  );

  assert.equal(capturedLines[0]?.entryId, "first", "primera línea debe ser 'first'");
  assert.equal(capturedLines[0]?.amount, 70);
  assert.equal(capturedLines.length, 1, "solo una línea necesaria");
  console.log("✅ Caso 9: FIFO por fecha y entryId OK");
}

// ──────────────────────────────────────────────────────────────────────────────
// Caso 10 — bolsillo como destino (toPocketId no null)
// ──────────────────────────────────────────────────────────────────────────────

async function testPocketDestination() {
  const pocketId = "pocket-1";
  const store = makeBaseStore();
  store[`accounts/${toAccountId}/pockets/${pocketId}`] = { balance: 0 };
  const fake = makeFakeDb(store);

  await createThirdPartyLocationTransfer(
    {
      ownerId,
      operationId,
      amount: 10_000,
      fromAccountId,
      fromPocketId: null,
      toAccountId,
      toPocketId: pocketId,
      date: new Date("2026-01-01"),
      description: "a bolsillo",
    },
    {
      db: {},
      ref: fake.ref,
      run: fake.run,
      timestamp: fake.timestamp,
      readSnapshot: async () => ({
        entries: [{ entryId: "entry-1", createdAtMillis: 100, originalAmount: 50_000, location: { accountId: fromAccountId, pocketId: null } }],
        moves: [],
        consumptions: [],
      }),
      readLedger: async () => ({ ownerId, version: 0, lastOperationId: null }),
    },
  );

  const pocketSnap = fake.store[`accounts/${toAccountId}/pockets/${pocketId}`];
  assert.equal(pocketSnap?.balance, 10_000, "bolsillo destino debe aumentar");

  const op = fake.store[`third_party_fund_location_operations/${operationId}`];
  assert.equal(op?.toPocketId, pocketId, "op debe registrar toPocketId");
  console.log("✅ Caso 10: bolsillo como destino OK");
}

// ──────────────────────────────────────────────────────────────────────────────
// Caso 11 — operación activa mueve fondos entre ubicaciones (proyección correcta)
// ──────────────────────────────────────────────────────────────────────────────

async function testOperationMovesLocationCorrectly() {
  const fake = makeFakeDb(makeBaseStore());

  await createThirdPartyLocationTransfer(
    {
      ownerId,
      operationId: "op-move",
      amount: 20_000,
      fromAccountId,
      fromPocketId: null,
      toAccountId,
      toPocketId: null,
      date: new Date("2026-01-01"),
      description: "movimiento ubicación",
    },
    {
      db: {},
      ref: fake.ref,
      run: fake.run,
      timestamp: fake.timestamp,
      readSnapshot: async () => ({
        entries: [{ entryId: "entry-1", createdAtMillis: 100, originalAmount: 50_000, location: { accountId: fromAccountId, pocketId: null } }],
        moves: [],
        consumptions: [],
      }),
      readLedger: async () => ({ ownerId, version: 0, lastOperationId: null }),
    },
  );

  const op = fake.store["third_party_fund_location_operations/op-move"];
  assert.equal(op?.fromAccountId, fromAccountId);
  assert.equal(op?.fromPocketId, null);
  assert.equal(op?.toAccountId, toAccountId);
  assert.equal(op?.toPocketId, null);
  assert.equal(op?.totalAmount, 20_000);
  assert.deepEqual(op?.lines, [{ entryId: "entry-1", amount: 20_000 }]);
  console.log("✅ Caso 11: operación activa proyecta ubicaciones correctas OK");
}

// ──────────────────────────────────────────────────────────────────────────────
// Ejecutar todos los casos
// ──────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log("Running third-party-location-occ tests...");
  await testValidTransfer();
  await testLedgerVersionConflict();
  await testFirstConflictThenSuccess();
  await testInsufficientThirdPartyBalance();
  await testInsufficientPhysicalBalance();
  await testTooManyLines();
  await testUnresolvableLocation();
  await testThreeConflictsExactMessage();
  await testFifoOrder();
  await testPocketDestination();
  await testOperationMovesLocationCorrectly();
  console.log("All third-party-location-occ tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
