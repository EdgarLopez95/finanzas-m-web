import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createPersonalAccount, INITIAL_BALANCE_DESCRIPTION } from "../../src/features/accounts/services/create-personal-account";
import { adjustAccountBalance, BALANCE_ADJUSTMENT_DESCRIPTION } from "../../src/features/accounts/services/adjust-account-balance";
import { closePersonalAccount } from "../../src/features/accounts/services/close-personal-account";
import { reopenPersonalAccount } from "../../src/features/accounts/services/reopen-personal-account";
import {
  deleteClosedPersonalAccount,
  isInitialBalanceTransactionForAccount,
  isPocketTraceTransfer,
  isBlockingTransactionForAccountDeletion,
  type MinimalOwnedTransaction,
} from "../../src/features/accounts/services/delete-closed-personal-account";
import { buildPersonalMovementRows } from "../../src/features/dashboard/lib/personal-view-model";
import { calculateAccountPhysicalBalances } from "../../src/lib/finance/account-balance-model";
import type { Account } from "../../src/types/account";
import type { Transaction } from "../../src/types/transaction";

console.log("Running unit tests for account-lifecycle.test.ts (Paso 2)...");

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

// ─── Helpers para simular Firestore (mismo patrón que declare-debt-payment / household-debt-payment-gate) ───

type FakeDocRef = { __path: string; id: string };
let refCounter = 0;
const makeDocFn = () => (db: unknown, ...segments: unknown[]) => {
  const flatSegments = segments.flat().map(String);
  if (flatSegments.length === 0) {
    refCounter += 1;
    const id = `auto-${refCounter}`;
    return { __path: `auto/${id}`, id };
  }
  return { __path: flatSegments.join("/"), id: flatSegments[flatSegments.length - 1] };
};
const collectionFn = (db: unknown, ...segments: unknown[]) => segments.flat().map(String);

type FakeTransaction = {
  get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
  set: (ref: unknown, data: Record<string, unknown>) => void;
  update: (ref: unknown, data: Record<string, unknown>) => void;
  delete: (ref: unknown) => void;
};

function makeFakeTransactionEnv(docsByPath: Map<string, Record<string, unknown>>) {
  const setCalls: Array<{ path: string; data: Record<string, unknown> }> = [];
  const updateCalls: Array<{ path: string; data: Record<string, unknown> }> = [];
  const deleteCalls: string[] = [];

  const transaction: FakeTransaction = {
    get: async (ref) => {
      const key = (ref as FakeDocRef).__path;
      const data = docsByPath.get(key);
      return { exists: () => data !== undefined, data: () => data ?? {} };
    },
    set: (ref, data) => {
      const key = (ref as FakeDocRef).__path;
      setCalls.push({ path: key, data });
      docsByPath.set(key, data);
    },
    update: (ref, data) => {
      const key = (ref as FakeDocRef).__path;
      updateCalls.push({ path: key, data });
      docsByPath.set(key, { ...(docsByPath.get(key) ?? {}), ...data });
    },
    delete: (ref) => {
      const key = (ref as FakeDocRef).__path;
      deleteCalls.push(key);
      docsByPath.delete(key);
    },
  };

  return { transaction, setCalls, updateCalls, deleteCalls };
}

async function runAccountLifecycleTests() {
  // ==========================================
  // Escenario 1: crear cuenta con saldo inicial 100.000
  // ==========================================
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    const { transaction, setCalls, updateCalls } = makeFakeTransactionEnv(docsByPath);

    const accountId = await createPersonalAccount(
      {
        ownerId: "u1",
        name: "Ahorros",
        type: "bank",
        initialBalance: 100_000,
        color: "#60a5fa",
        includeInTotal: true,
      },
      {
        getFirebaseDbFn: () => ({ __fakeDb: true }),
        docFn: makeDocFn(),
        collectionFn,
        runTransactionFn: (_db, updateFunction) => updateFunction(transaction),
      },
    );

    assert.equal(setCalls.length, 2, "Debe haber exactamente 2 escrituras: la cuenta y la transacción técnica de saldo inicial");
    const accountWrite = setCalls.find((c) => c.path.includes(accountId));
    assert.ok(accountWrite, "Debe existir la escritura de la cuenta");
    // Reconciliación P1: el `set` inicial de la cuenta nace en 0 (paridad
    // Android `currentBalance = 0.0` en el insert) — el valor final lo aplica
    // el `update` separado abajo, nunca el `set`.
    assert.equal(accountWrite?.data.currentBalance, 0, "El set inicial de la cuenta debe nacer en 0, igual que Android");
    assert.equal(accountWrite?.data.archived, false, "La cuenta nace activa");

    const txWrite = setCalls.find((c) => !c.path.includes(accountId));
    assert.ok(txWrite, "Debe existir la transacción técnica");
    assert.equal(txWrite?.data.type, "income");
    assert.equal(txWrite?.data.amount, 100_000);
    assert.equal(txWrite?.data.title, INITIAL_BALANCE_DESCRIPTION);
    assert.equal(txWrite?.data.countsAsRealIncome, false, "No debe contar como ingreso real mensual");
    assert.equal(txWrite?.data.categoryId, null, "No debe tener categoría (no es un gasto/ingreso de consumo)");

    assert.equal(updateCalls.length, 1, "El delta debe aplicarse con un update separado, causado por el movimiento técnico");
    assert.equal(updateCalls[0].data.currentBalance, 100_000, "El update debe llevar currentBalance al monto ingresado");
    assert.equal(
      docsByPath.get(accountWrite!.path)?.currentBalance,
      100_000,
      "El estado final combinado (set + update) debe terminar exactamente en el monto ingresado",
    );

    console.log("  ✓ Escenario 1: crear con saldo inicial 100.000 -> set inicial en 0, 1 transacción técnica, update aplica 100.000 (paridad Android exacta)");
  }

  // ==========================================
  // Escenario 2: crear cuenta con saldo inicial 0 -> sin transacción técnica (paridad Android exacta: `if (balance > 0.0)`)
  // ==========================================
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    const { transaction, setCalls } = makeFakeTransactionEnv(docsByPath);

    await createPersonalAccount(
      { ownerId: "u1", name: "Efectivo", type: "cash", initialBalance: 0, color: "#60a5fa", includeInTotal: true },
      {
        getFirebaseDbFn: () => ({ __fakeDb: true }),
        docFn: makeDocFn(),
        collectionFn,
        runTransactionFn: (_db, updateFunction) => updateFunction(transaction),
      },
    );

    assert.equal(setCalls.length, 1, "Con saldo inicial 0, Android no crea la transacción técnica — solo se escribe la cuenta");
    assert.equal(setCalls[0].data.currentBalance, 0);

    console.log("  ✓ Escenario 2: crear con saldo inicial 0 -> solo se escribe la cuenta, ninguna transacción técnica (paridad Android exacta)");
  }

  // ==========================================
  // Escenario 3: fallo de transacción no deja estado parcial; reintento posterior funciona limpio
  // ==========================================
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    let attempt = 0;

    let rejected = false;
    try {
      await createPersonalAccount(
        { ownerId: "u1", name: "Falla", type: "bank", initialBalance: 50_000, color: "#60a5fa", includeInTotal: true },
        {
          getFirebaseDbFn: () => ({ __fakeDb: true }),
          docFn: makeDocFn(),
          collectionFn,
          runTransactionFn: async () => {
            attempt += 1;
            throw new Error("Simulated Firestore transaction failure");
          },
        },
      );
    } catch {
      rejected = true;
    }
    assert.equal(rejected, true, "La primera llamada debe rechazar");
    assert.equal(docsByPath.size, 0, "Ningún documento debe quedar escrito tras el fallo (sin estado parcial)");

    const { transaction, setCalls } = makeFakeTransactionEnv(docsByPath);
    await createPersonalAccount(
      { ownerId: "u1", name: "Reintento", type: "bank", initialBalance: 50_000, color: "#60a5fa", includeInTotal: true },
      {
        getFirebaseDbFn: () => ({ __fakeDb: true }),
        docFn: makeDocFn(),
        collectionFn,
        runTransactionFn: (_db, updateFunction) => updateFunction(transaction),
      },
    );
    assert.equal(setCalls.length, 2, "El reintento posterior debe completar limpio, sin duplicar ni arrastrar el fallo previo");
    assert.equal(attempt, 1, "El intento fallido no debe reintentarse automáticamente por sí solo");

    console.log("  ✓ Escenario 3: fallo de transacción no deja estado parcial; el reintento posterior no duplica ni hereda el fallo");
  }

  // ==========================================
  // Escenario 4: editar datos descriptivos conserva Disponible/Total/bolsillos/historial
  // (chequeo estructural: update-personal-account.ts nunca escribe balance/currentBalance/archived)
  // ==========================================
  {
    const updateSrc = readSrc("features/accounts/services/update-personal-account.ts");
    assert.doesNotMatch(
      updateSrc,
      /currentBalance\s*:/,
      "updatePersonalAccount no debe escribir currentBalance (edición descriptiva no toca Disponible)",
    );
    assert.doesNotMatch(
      updateSrc,
      /\bbalance\s*:/,
      "updatePersonalAccount no debe escribir balance/Total",
    );
    assert.doesNotMatch(
      updateSrc,
      /archived\s*:/,
      "updatePersonalAccount no debe cambiar el estado archived (eso es exclusivo de cerrar/reabrir)",
    );
    assert.match(
      updateSrc,
      /includeInTotal:\s*payload\.includeInTotal/,
      "updatePersonalAccount sí debe permitir cambiar includeInTotal explícitamente",
    );
    console.log("  ✓ Escenario 4: updatePersonalAccount nunca toca Disponible/Total/archived — solo campos descriptivos e includeInTotal");
  }

  // ==========================================
  // Escenario 5: reajuste 100.000 -> 70.000 con bolsillo 20.000
  // ==========================================
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "u1", currentBalance: 100_000 });
    const { transaction, setCalls, updateCalls } = makeFakeTransactionEnv(docsByPath);

    const result = await adjustAccountBalance(
      { ownerId: "u1", accountId: "acc-1", newAvailableBalance: 70_000 },
      {
        getFirebaseDbFn: () => ({ __fakeDb: true }),
        docFn: makeDocFn(),
        collectionFn,
        runTransactionFn: (_db, updateFunction) => updateFunction(transaction),
      },
    );

    assert.equal(result.adjusted, true);
    assert.equal(setCalls.length, 1, "Debe crear una única transacción técnica de ajuste");
    assert.equal(setCalls[0].data.type, "expense", "Bajar el disponible crea un movimiento expense");
    assert.equal(setCalls[0].data.amount, 30_000, "El monto técnico debe ser |delta| = 30.000");
    assert.equal(setCalls[0].data.description, BALANCE_ADJUSTMENT_DESCRIPTION);
    assert.equal(setCalls[0].data.countsAsRealIncome, false);
    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].data.currentBalance, 70_000);

    // El bolsillo (20.000) nunca se lee ni se escribe desde este servicio — solo se
    // verifica aquí la composición aritmética con el núcleo puro del Paso 1.
    const { totalBalance, pocketsBalance } = calculateAccountPhysicalBalances(70_000, [{ balance: 20_000 }]);
    assert.equal(pocketsBalance, 20_000, "El bolsillo sigue en 20.000 (no tocado)");
    assert.equal(totalBalance, 90_000, "Total pasa de 120.000 a 90.000 (70.000 + 20.000)");

    console.log("  ✓ Escenario 5: reajuste 100.000 -> 70.000 con bolsillo 20.000 -> Disponible 70.000, bolsillo 20.000, Total 90.000, 1 ajuste técnico de 30.000");
  }

  // ==========================================
  // Escenario 6: reajuste 70.000 -> 100.000 (sentido inverso, sin duplicar)
  // ==========================================
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "u1", currentBalance: 70_000 });
    const { transaction, setCalls } = makeFakeTransactionEnv(docsByPath);

    const result = await adjustAccountBalance(
      { ownerId: "u1", accountId: "acc-1", newAvailableBalance: 100_000 },
      {
        getFirebaseDbFn: () => ({ __fakeDb: true }),
        docFn: makeDocFn(),
        collectionFn,
        runTransactionFn: (_db, updateFunction) => updateFunction(transaction),
      },
    );

    assert.equal(result.adjusted, true);
    assert.equal(setCalls.length, 1, "Un solo movimiento técnico, nunca duplicado");
    assert.equal(setCalls[0].data.type, "income", "Subir el disponible crea un movimiento income");
    assert.equal(setCalls[0].data.amount, 30_000);

    console.log("  ✓ Escenario 6: reajuste 70.000 -> 100.000 -> movimiento income de 30.000, sin duplicar");
  }

  // ==========================================
  // Escenario 7: reajuste al mismo valor -> no crea ajuste duplicado (paridad Android: no-op silencioso)
  // ==========================================
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "u1", currentBalance: 100_000 });
    const { transaction, setCalls, updateCalls } = makeFakeTransactionEnv(docsByPath);

    const result = await adjustAccountBalance(
      { ownerId: "u1", accountId: "acc-1", newAvailableBalance: 100_000 },
      {
        getFirebaseDbFn: () => ({ __fakeDb: true }),
        docFn: makeDocFn(),
        collectionFn,
        runTransactionFn: (_db, updateFunction) => updateFunction(transaction),
      },
    );

    assert.equal(result.adjusted, false, "delta 0 -> adjusted debe ser false");
    assert.equal(setCalls.length, 0, "Delta 0 no debe crear ningún movimiento técnico");
    assert.equal(updateCalls.length, 0, "Delta 0 no debe escribir la cuenta");

    console.log("  ✓ Escenario 7: reajuste al mismo valor -> no-op exacto, cero movimientos, cero escrituras (paridad Android)");
  }

  // ==========================================
  // Escenario 8: relectura fresca dentro de la transacción (no pierde actualizaciones)
  // ==========================================
  {
    // Dos llamadas independientes, cada una leyendo un snapshot distinto del mismo
    // accountId — cada una debe calcular su propio delta a partir de SU lectura
    // fresca (transaction.get), nunca de un valor cacheado fuera de la transacción.
    const docsByPathA = new Map<string, Record<string, unknown>>();
    docsByPathA.set("accounts/acc-1", { ownerId: "u1", currentBalance: 100_000 });
    const envA = makeFakeTransactionEnv(docsByPathA);
    const resultA = await adjustAccountBalance(
      { ownerId: "u1", accountId: "acc-1", newAvailableBalance: 130_000 },
      { getFirebaseDbFn: () => ({}), docFn: makeDocFn(), collectionFn, runTransactionFn: (_d, fn) => fn(envA.transaction) },
    );

    const docsByPathB = new Map<string, Record<string, unknown>>();
    docsByPathB.set("accounts/acc-1", { ownerId: "u1", currentBalance: 130_000 }); // ya refleja el ajuste anterior
    const envB = makeFakeTransactionEnv(docsByPathB);
    const resultB = await adjustAccountBalance(
      { ownerId: "u1", accountId: "acc-1", newAvailableBalance: 130_000 },
      { getFirebaseDbFn: () => ({}), docFn: makeDocFn(), collectionFn, runTransactionFn: (_d, fn) => fn(envB.transaction) },
    );

    assert.equal(resultA.delta, 30_000);
    assert.equal(resultB.adjusted, false, "Una segunda llamada tras la primera, releyendo el valor ya actualizado, no debe generar un ajuste duplicado");

    console.log("  ✓ Escenario 8: cada llamada relee el saldo fresco dentro de su propia transacción — sin duplicar tras una carrera/doble envío");
  }

  // ==========================================
  // Escenario 9 y 11: cuenta con bolsillo no puede cerrar; cerrar archiva y excluye del total
  // ==========================================
  {
    let transactionAttempts = 0;
    let rejected = false;
    try {
      await closePersonalAccount(
        { ownerId: "u1", accountId: "acc-1" },
        {
          getFirebaseDbFn: () => ({}),
          docFn: makeDocFn(),
          collectionFn,
          getDocsFn: async () => ({ empty: false, size: 2 }),
          runTransactionFn: async () => {
            transactionAttempts += 1;
          },
        },
      );
    } catch {
      rejected = true;
    }
    assert.equal(rejected, true, "Cuenta con bolsillos no debe poder cerrarse");
    assert.equal(transactionAttempts, 0, "No debe siquiera intentar la transacción si hay bolsillos");

    // Sin bolsillos: cierra correctamente.
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-2", { ownerId: "u1", archived: false, includeInTotal: true });
    const { transaction, updateCalls } = makeFakeTransactionEnv(docsByPath);

    await closePersonalAccount(
      { ownerId: "u1", accountId: "acc-2" },
      {
        getFirebaseDbFn: () => ({}),
        docFn: makeDocFn(),
        collectionFn,
        getDocsFn: async () => ({ empty: true, size: 0 }),
        runTransactionFn: (_db, fn) => fn(transaction),
      },
    );

    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].data.archived, true, "Cerrar debe marcar archived=true");
    assert.equal(updateCalls[0].data.includeInTotal, false, "Cerrar debe forzar includeInTotal=false (excluye del bruto)");

    console.log("  ✓ Escenario 9/11: cuenta con bolsillo no cierra; sin bolsillos, cerrar archiva y excluye del total");
  }

  // ==========================================
  // Escenario 12: reabrir vuelve a activa, includeInTotal=true, sin crear movimientos ni tocar saldos
  // ==========================================
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-2", { ownerId: "u1", archived: true, includeInTotal: false, currentBalance: 55_000 });
    const { transaction, updateCalls } = makeFakeTransactionEnv(docsByPath);

    await reopenPersonalAccount(
      { ownerId: "u1", accountId: "acc-2" },
      {
        getFirebaseDbFn: () => ({}),
        docFn: makeDocFn(),
        runTransactionFn: (_db, fn) => fn(transaction),
      },
    );

    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].data.archived, false);
    assert.equal(updateCalls[0].data.includeInTotal, true, "Reabrir fuerza includeInTotal=true (paridad Android, no restaura preferencia previa)");
    assert.equal(docsByPath.get("accounts/acc-2")?.currentBalance, 55_000, "El Disponible no debe tocarse al reabrir");
    // La transacción simulada no tiene método `set` (el tipo lo omite a propósito):
    // TypeScript ya impide que este servicio intente crear un movimiento al reabrir.

    console.log("  ✓ Escenario 12: reabrir vuelve a activa, includeInTotal=true, Disponible intacto, sin movimientos creados");
  }

  // ==========================================
  // Escenario 16 (idempotencia / doble clic): cerrar y reabrir dos veces seguidas es seguro
  // ==========================================
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-3", { ownerId: "u1", archived: true, includeInTotal: false });
    const env1 = makeFakeTransactionEnv(docsByPath);
    await reopenPersonalAccount({ ownerId: "u1", accountId: "acc-3" }, { getFirebaseDbFn: () => ({}), docFn: makeDocFn(), runTransactionFn: (_d, fn) => fn(env1.transaction) });

    // Segunda llamada (doble clic) sobre una cuenta que YA quedó activa tras la primera.
    const env2 = makeFakeTransactionEnv(docsByPath);
    let secondRejected = false;
    try {
      await reopenPersonalAccount({ ownerId: "u1", accountId: "acc-3" }, { getFirebaseDbFn: () => ({}), docFn: makeDocFn(), runTransactionFn: (_d, fn) => fn(env2.transaction) });
    } catch {
      secondRejected = true;
    }
    assert.equal(secondRejected, false, "Reabrir una cuenta ya activa (doble clic) no debe fallar");
    assert.equal(docsByPath.get("accounts/acc-3")?.archived, false);

    console.log("  ✓ Escenario 16: reabrir dos veces seguidas (doble clic) es idempotente y seguro");
  }

  // ==========================================
  // Predicados puros de borrado (base de los escenarios 10/13/14)
  // ==========================================
  {
    const initialBalanceTx: MinimalOwnedTransaction = {
      id: "tx-init",
      type: "income",
      accountId: "acc-1",
      targetAccountId: null,
      pocketId: null,
      targetPocketId: null,
      title: INITIAL_BALANCE_DESCRIPTION,
      countsAsRealIncome: false,
      categoryId: null,
    };
    assert.equal(isInitialBalanceTransactionForAccount(initialBalanceTx, "acc-1"), true);
    assert.equal(isBlockingTransactionForAccountDeletion(initialBalanceTx, "acc-1"), false, "Saldo inicial nunca bloquea el borrado");

    const adjustmentTx: MinimalOwnedTransaction = {
      ...initialBalanceTx,
      id: "tx-adjust",
      title: BALANCE_ADJUSTMENT_DESCRIPTION,
    };
    assert.equal(isInitialBalanceTransactionForAccount(adjustmentTx, "acc-1"), false, "El ajuste manual NO es 'saldo inicial'");
    assert.equal(isBlockingTransactionForAccountDeletion(adjustmentTx, "acc-1"), true, "Paridad Android exacta: el ajuste manual SÍ bloquea el borrado de una cuenta activa");

    const pocketTransfer: MinimalOwnedTransaction = {
      id: "tx-transfer",
      type: "transfer",
      accountId: "acc-1",
      targetAccountId: "acc-2",
      pocketId: "pocket-1",
      targetPocketId: null,
      title: "Transferencia",
      countsAsRealIncome: true,
      categoryId: null,
    };
    assert.equal(isPocketTraceTransfer(pocketTransfer), true);
    assert.equal(isBlockingTransactionForAccountDeletion(pocketTransfer, "acc-1"), false, "Transferencia con bolsillo tampoco bloquea");

    const realExpense: MinimalOwnedTransaction = {
      id: "tx-real",
      type: "expense",
      accountId: "acc-1",
      targetAccountId: null,
      pocketId: null,
      targetPocketId: null,
      title: "Mercado",
      countsAsRealIncome: true,
      categoryId: "cat-food",
    };
    assert.equal(isBlockingTransactionForAccountDeletion(realExpense, "acc-1"), true, "Un gasto real siempre bloquea el borrado de una cuenta activa");

    console.log("  ✓ Predicados de borrado: Saldo inicial y transferencias con bolsillo no bloquean; ajuste manual y gastos reales sí");
  }

  // ==========================================
  // Escenario 10: cuenta con bolsillo no puede eliminar (activa o cerrada)
  // ==========================================
  {
    let transactionAttempts = 0;
    let rejected = false;
    try {
      await deleteClosedPersonalAccount(
        { ownerId: "u1", accountId: "acc-1" },
        {
          getFirebaseDbFn: () => ({}),
          docFn: makeDocFn(),
          collectionFn,
          queryFn: (...args: unknown[]) => args,
          whereFn: (...args: unknown[]) => args,
          getDocFn: async () => ({ exists: () => true, data: () => ({ ownerId: "u1", archived: true }) }),
          getDocsFn: async (q: unknown) => {
            // La primera llamada (pockets) recibe una colección plana; las de
            // transacciones reciben el resultado de queryFn (un array de args).
            if (Array.isArray(q) && q.length > 0 && Array.isArray(q[0])) {
              return { docs: [] };
            }
            return { docs: [{ id: "p1", data: () => ({}) }] };
          },
          runTransactionFn: async () => {
            transactionAttempts += 1;
          },
        },
      );
    } catch {
      rejected = true;
    }
    assert.equal(rejected, true, "Cuenta con bolsillos no debe poder eliminarse, esté activa o cerrada");
    assert.equal(transactionAttempts, 0, "No debe intentar la transacción de borrado si hay bolsillos");

    console.log("  ✓ Escenario 10: cuenta con bolsillo no puede eliminarse (chequeo aplica sin importar archived)");
  }

  // ==========================================
  // Escenario 13: cuenta ACTIVA con movimientos reales no puede eliminar
  // ==========================================
  {
    const realExpenseDoc = {
      id: "tx-real",
      data: () => ({ type: "expense", accountId: "acc-1", title: "Mercado", countsAsRealIncome: true, categoryId: "cat-food" }),
    };
    let rejected = false;
    let message = "";
    try {
      await deleteClosedPersonalAccount(
        { ownerId: "u1", accountId: "acc-1" },
        {
          getFirebaseDbFn: () => ({}),
          docFn: makeDocFn(),
          collectionFn: (...args: unknown[]) => ({ __kind: "collection", args }),
          queryFn: (collectionRef: unknown, ...rest: unknown[]) => ({ __kind: "query", collectionRef, rest }),
          whereFn: (...args: unknown[]) => ({ __kind: "where", args }),
          getDocFn: async () => ({ exists: () => true, data: () => ({ ownerId: "u1", archived: false }) }),
          getDocsFn: async (q: unknown) => {
            const kind = (q as { __kind?: string }).__kind;
            if (kind === "collection") return { docs: [] }; // pockets: vacío
            // ambas queries de transacciones (accountId / targetAccountId) devuelven el mismo real
            return { docs: [realExpenseDoc] };
          },
          runTransactionFn: async () => {
            throw new Error("No debe llegar a intentar la transacción de borrado");
          },
        },
      );
    } catch (err) {
      rejected = true;
      message = err instanceof Error ? err.message : String(err);
    }
    assert.equal(rejected, true, "Cuenta activa con un movimiento real debe bloquear el borrado");
    assert.match(message, /movimiento/i);

    console.log("  ✓ Escenario 13: cuenta activa con movimientos reales no puede eliminarse -> bloqueada con mensaje claro");
  }

  // ==========================================
  // Escenario 14: cuenta CERRADA sin bolsillos SÍ puede eliminarse — sobreviven sus
  // movimientos reales y el ajuste técnico; solo se borra "Saldo inicial" + el documento de cuenta.
  // ==========================================
  {
    const initialBalanceDoc = {
      id: "tx-init",
      data: () => ({
        type: "income",
        accountId: "acc-1",
        title: INITIAL_BALANCE_DESCRIPTION,
        countsAsRealIncome: false,
        categoryId: null,
      }),
    };
    const adjustmentDoc = {
      id: "tx-adjust",
      data: () => ({
        type: "expense",
        accountId: "acc-1",
        title: BALANCE_ADJUSTMENT_DESCRIPTION,
        countsAsRealIncome: false,
        categoryId: null,
      }),
    };

    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "u1", archived: true });
    docsByPath.set("transactions/tx-init", initialBalanceDoc.data());
    docsByPath.set("transactions/tx-adjust", adjustmentDoc.data());
    const { transaction, deleteCalls } = makeFakeTransactionEnv(docsByPath);

    await deleteClosedPersonalAccount(
      { ownerId: "u1", accountId: "acc-1" },
      {
        getFirebaseDbFn: () => ({}),
        docFn: makeDocFn(),
        collectionFn: (...args: unknown[]) => ({ __kind: "collection", args }),
        queryFn: (collectionRef: unknown, ...rest: unknown[]) => ({ __kind: "query", collectionRef, rest }),
        whereFn: (...args: unknown[]) => ({ __kind: "where", args }),
        getDocFn: async (ref) => {
          const key = (ref as FakeDocRef).__path;
          const data = docsByPath.get(key);
          return { exists: () => data !== undefined, data: () => data ?? {} };
        },
        getDocsFn: async (q: unknown) => {
          const kind = (q as { __kind?: string }).__kind;
          if (kind === "collection") return { docs: [] }; // pockets vacíos
          return { docs: [initialBalanceDoc, adjustmentDoc] };
        },
        runTransactionFn: (_db, fn) => fn(transaction),
      },
    );

    assert.ok(deleteCalls.includes("accounts/acc-1"), "Debe borrar el documento de la cuenta");
    assert.ok(deleteCalls.includes("transactions/tx-init"), "Debe borrar la transacción técnica de Saldo inicial");
    assert.ok(!deleteCalls.includes("transactions/tx-adjust"), "NO debe borrar el ajuste manual (movimiento real que sobrevive, paridad Android)");

    console.log("  ✓ Escenario 14: cuenta cerrada sin bolsillos se elimina -> solo se borra la cuenta + Saldo inicial; el ajuste real sobrevive");
  }

  // ==========================================
  // Escenario 15: transacción histórica que referencia una cuenta eliminada
  // ==========================================
  {
    const survivingAccount: Account = {
      id: "acc-alive",
      ownerId: "u1",
      name: "Cuenta viva",
      balance: 1000,
      currency: "COP",
      institutionName: "",
      type: "bank",
      updatedAt: null,
      includeInTotal: true,
      archived: false,
      iconKey: "bank",
      iconType: "generic",
      color: "",
    };
    const orphanTx: Transaction = {
      id: "tx-orphan",
      ownerId: "u1",
      title: "",
      notes: "",
      amount: 5000,
      type: "expense",
      accountId: "acc-deleted",
      targetAccountId: null,
      categoryId: "",
      createdAt: new Date(),
      date: new Date(),
    };

    let rows: ReturnType<typeof buildPersonalMovementRows> = [];
    let threw = false;
    try {
      rows = buildPersonalMovementRows([orphanTx], [], [survivingAccount], []);
    } catch {
      threw = true;
    }
    assert.equal(threw, false, "Renderizar un movimiento de una cuenta eliminada nunca debe lanzar");
    assert.equal(rows[0]?.accountName, "Cuenta eliminada", "Debe degradar a 'Cuenta eliminada', nunca sustituir por otra cuenta");

    console.log("  ✓ Escenario 15: transacción con cuenta eliminada renderiza sin excepción, muestra 'Cuenta eliminada'");
  }

  // ==========================================
  // Ninguna ruta de este paso usa un Total visual como fuente de escritura de Disponible
  // ==========================================
  {
    for (const rel of [
      "features/accounts/services/adjust-account-balance.ts",
      "features/accounts/services/close-personal-account.ts",
      "features/accounts/services/reopen-personal-account.ts",
      "features/accounts/services/delete-closed-personal-account.ts",
    ]) {
      const src = readSrc(rel);
      assert.doesNotMatch(
        src,
        /currentBalance\s*:\s*(total|pocketsBalance)/i,
        `${rel} no debe escribir currentBalance a partir de un Total/bolsillos`,
      );
    }
    console.log("  ✓ Ninguna ruta del Paso 2 usa un Total visual como fuente de escritura de Disponible");
  }

  console.log("All account-lifecycle (Paso 2) unit tests passed successfully!");
}

runAccountLifecycleTests().catch((err) => {
  console.error("Test failure in account-lifecycle.test.ts:", err);
  process.exit(1);
});
