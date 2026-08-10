import assert from "node:assert/strict";

import { assertAccountNotArchived, CLOSED_ACCOUNT_MUTATION_MESSAGE } from "../../src/features/accounts/services/account-lifecycle-guard";
import { adjustAccountBalance } from "../../src/features/accounts/services/adjust-account-balance";
import { createAccountPocket } from "../../src/features/pockets/services/create-account-pocket";
import { updateAccountPocket } from "../../src/features/pockets/services/update-account-pocket";
import { deleteClosedPersonalAccount } from "../../src/features/accounts/services/delete-closed-personal-account";

console.log("Running unit tests for account-lifecycle-guard.test.ts (Corrección P1 — Paso 2)...");

// ─── Helpers (mismo patrón que account-lifecycle.test.ts) ───

type FakeDocRef = { __path: string; id: string };
const makeDocFn = () => (db: unknown, ...segments: unknown[]) => {
  const flatSegments = segments.flat().map(String);
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
      setCalls.push({ path: (ref as FakeDocRef).__path, data });
    },
    update: (ref, data) => {
      updateCalls.push({ path: (ref as FakeDocRef).__path, data });
    },
    delete: (ref) => {
      deleteCalls.push((ref as FakeDocRef).__path);
    },
  };

  return {
    transaction,
    setCalls,
    updateCalls,
    deleteCalls,
    getDocFn: async (ref: unknown) => {
      const key = (ref as FakeDocRef).__path;
      const data = docsByPath.get(key);
      return { exists: () => data !== undefined, data: () => data ?? {} };
    },
    getDocsFn: async () => ({
      size: [...docsByPath.keys()].filter((k) => k.includes("/pockets/")).length,
    }),
  };
}

async function runAccountLifecycleGuardTests() {
  // ==========================================
  // assertAccountNotArchived — comportamiento puro base
  // ==========================================
  {
    assert.doesNotThrow(() => assertAccountNotArchived({ archived: false }));
    assert.doesNotThrow(() => assertAccountNotArchived({}));
    assert.throws(() => assertAccountNotArchived({ archived: true }), new RegExp(CLOSED_ACCOUNT_MUTATION_MESSAGE.replace(/[.]/g, "\\.")));
    console.log("  ✓ assertAccountNotArchived: pasa con archived=false/ausente, rechaza con archived=true, mensaje canónico");
  }

  // ==========================================
  // P1-A.1: reajuste sobre cuenta archivada -> rechaza, cero escrituras
  // ==========================================
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-closed", { ownerId: "u1", archived: true, currentBalance: 100_000 });
    const { transaction, setCalls, updateCalls } = makeFakeTransactionEnv(docsByPath);

    let rejected = false;
    let message = "";
    try {
      await adjustAccountBalance(
        { ownerId: "u1", accountId: "acc-closed", newAvailableBalance: 50_000 },
        { getFirebaseDbFn: () => ({}), docFn: makeDocFn(), collectionFn, runTransactionFn: (_d, fn) => fn(transaction) },
      );
    } catch (err) {
      rejected = true;
      message = err instanceof Error ? err.message : String(err);
    }
    assert.equal(rejected, true, "Reajustar una cuenta cerrada debe rechazar");
    assert.equal(message, CLOSED_ACCOUNT_MUTATION_MESSAGE);
    assert.equal(setCalls.length, 0, "Cero escrituras de movimiento técnico");
    assert.equal(updateCalls.length, 0, "Cero escrituras de saldo de cuenta");

    console.log("  ✓ P1-A.1: reajuste sobre cuenta archivada -> rechaza con mensaje canónico, cero escrituras");
  }

  // ==========================================
  // P1-A.2: crear bolsillo sobre cuenta archivada -> rechaza, cero escrituras
  // ==========================================
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-closed", { ownerId: "u1", archived: true, currentBalance: 100_000 });
    const { transaction, setCalls, updateCalls, getDocFn, getDocsFn } = makeFakeTransactionEnv(docsByPath);

    let rejected = false;
    let message = "";
    try {
      await createAccountPocket(
        { ownerId: "u1", accountId: "acc-closed", name: "Ahorro", balance: 10_000 },
        {
          getFirebaseDbFn: () => ({}),
          docFn: makeDocFn(),
          collectionFn,
          getDocFn,
          getDocsFn,
          // G2 — barrera propia lee el snapshot de ubicación antes de la
          // transacción; sin no propio en este fixture.
          readThirdPartyLocationSnapshotFn: async () => ({ entries: [], moves: [], consumptions: [] }),
          runTransactionFn: (_d, fn) => fn(transaction),
        },
      );
    } catch (err) {
      rejected = true;
      message = err instanceof Error ? err.message : String(err);
    }
    assert.equal(rejected, true, "Crear un bolsillo en una cuenta cerrada debe rechazar");
    assert.equal(message, CLOSED_ACCOUNT_MUTATION_MESSAGE);
    assert.equal(setCalls.length, 0, "Cero escrituras de bolsillo");
    assert.equal(updateCalls.length, 0, "Cero escrituras de saldo de cuenta");

    console.log("  ✓ P1-A.2: crear bolsillo sobre cuenta archivada -> rechaza con mensaje canónico, cero escrituras");
  }

  // ==========================================
  // P1-A.3: actualizar bolsillo sobre cuenta archivada -> rechaza, cero escrituras
  // ==========================================
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-closed", { ownerId: "u1", archived: true, currentBalance: 100_000 });
    docsByPath.set("accounts/acc-closed/pockets/pocket-1", { balance: 10_000, name: "Ahorro" });
    const { transaction, updateCalls } = makeFakeTransactionEnv(docsByPath);

    let rejected = false;
    let message = "";
    try {
      await updateAccountPocket(
        { ownerId: "u1", accountId: "acc-closed", pocketId: "pocket-1", name: "Ahorro 2" },
        { getFirebaseDbFn: () => ({}), docFn: makeDocFn(), runTransactionFn: (_d, fn) => fn(transaction) },
      );
    } catch (err) {
      rejected = true;
      message = err instanceof Error ? err.message : String(err);
    }
    assert.equal(rejected, true, "Actualizar un bolsillo de una cuenta cerrada debe rechazar");
    assert.equal(message, CLOSED_ACCOUNT_MUTATION_MESSAGE);
    assert.equal(updateCalls.length, 0, "Cero escrituras (ni bolsillo ni cuenta)");

    console.log("  ✓ P1-A.3: actualizar bolsillo sobre cuenta archivada -> rechaza con mensaje canónico, cero escrituras");
  }

  // ==========================================
  // P1-A.4: cuenta reabierta vuelve a permitir la acción (regresión)
  // ==========================================
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-reopened", { ownerId: "u1", archived: false, currentBalance: 100_000 });
    const { transaction, updateCalls } = makeFakeTransactionEnv(docsByPath);

    const result = await adjustAccountBalance(
      { ownerId: "u1", accountId: "acc-reopened", newAvailableBalance: 70_000 },
      { getFirebaseDbFn: () => ({}), docFn: makeDocFn(), collectionFn, runTransactionFn: (_d, fn) => fn(transaction) },
    );
    assert.equal(result.adjusted, true);
    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].data.currentBalance, 70_000);

    console.log("  ✓ P1-A.4: una cuenta activa (reabierta) vuelve a permitir el reajuste normalmente");
  }

  // ==========================================
  // P1-A.5: usuario que no es propietario sigue rechazado (no-regresión)
  // ==========================================
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-1", { ownerId: "u1", archived: false, currentBalance: 100_000 });
    const { transaction } = makeFakeTransactionEnv(docsByPath);

    let rejected = false;
    let message = "";
    try {
      await adjustAccountBalance(
        { ownerId: "otro-usuario", accountId: "acc-1", newAvailableBalance: 50_000 },
        { getFirebaseDbFn: () => ({}), docFn: makeDocFn(), collectionFn, runTransactionFn: (_d, fn) => fn(transaction) },
      );
    } catch (err) {
      rejected = true;
      message = err instanceof Error ? err.message : String(err);
    }
    assert.equal(rejected, true);
    assert.match(message, /permiso/);

    console.log("  ✓ P1-A.5: un usuario que no es propietario sigue rechazado (sin cambios)");
  }

  // ==========================================
  // P1-B: borrado que recibe archived=true antes de empezar, pero
  // archived=false en la lectura transaccional -> rechaza, cero borrados.
  // Simula exactamente la carrera: T1 lee "cerrada", T2 la reabre, T1 confirma
  // su transacción con el snapshot fresco (ya activo) — debe rechazar.
  // ==========================================
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    // Pre-lectura (fuera de transacción): la cuenta aparece archivada.
    let preReadCount = 0;
    const { transaction, deleteCalls } = makeFakeTransactionEnv(docsByPath);
    // El snapshot DENTRO de la transacción ya refleja la reapertura (T2).
    docsByPath.set("accounts/acc-race", { ownerId: "u1", archived: false });

    let rejected = false;
    let message = "";
    try {
      await deleteClosedPersonalAccount(
        { ownerId: "u1", accountId: "acc-race" },
        {
          getFirebaseDbFn: () => ({}),
          docFn: makeDocFn(),
          collectionFn: (...args: unknown[]) => ({ __kind: "collection", args }),
          queryFn: (collectionRef: unknown, ...rest: unknown[]) => ({ __kind: "query", collectionRef, rest }),
          whereFn: (...args: unknown[]) => ({ __kind: "where", args }),
          // La PRE-lectura (getDocFn, fuera de transacción) todavía ve archived=true —
          // es el estado "viejo" que T1 observó antes de que T2 reabriera la cuenta.
          getDocFn: async () => {
            preReadCount += 1;
            return { exists: () => true, data: () => ({ ownerId: "u1", archived: true }) };
          },
          getDocsFn: async (q: unknown) => {
            const kind = (q as { __kind?: string }).__kind;
            if (kind === "collection") return { docs: [] }; // pockets vacíos
            return { docs: [] }; // sin transacciones bloqueantes (irrelevante, ya archivada en la pre-lectura)
          },
          runTransactionFn: (_db, fn) => fn(transaction),
        },
      );
    } catch (err) {
      rejected = true;
      message = err instanceof Error ? err.message : String(err);
    }

    assert.equal(preReadCount, 1, "La pre-lectura debe haber ocurrido (así es como T1 'vio' archived=true)");
    assert.equal(rejected, true, "Si el snapshot TRANSACCIONAL ya no está archivado, debe rechazar aunque la pre-lectura dijera lo contrario");
    assert.match(message, /cerrada/i);
    assert.equal(deleteCalls.length, 0, "Cero borrados: ni la cuenta ni ninguna transacción técnica");

    console.log("  ✓ P1-B: pre-lectura decía archived=true, snapshot transaccional dice archived=false -> rechaza, cero delete()");
  }

  // ==========================================
  // P1-C — BLOQUEO DOCUMENTADO, no una solución falsa.
  //
  // Investigación (evidencia concreta):
  // - `node_modules/@firebase/firestore/dist/firestore/src/api/transaction.d.ts`
  //   (y su equivalente `lite-api/transaction.d.ts`) declaran la ÚNICA firma de
  //   lectura disponible en `Transaction`:
  //     get<AppModelType, DbModelType>(documentRef: DocumentReference<...>): Promise<DocumentSnapshot<...>>
  //   No existe ninguna sobrecarga que acepte una `Query` ni una referencia de
  //   colección/subcolección. El SDK Web instalado (firebase ^12.14.0) NO
  //   permite que una consulta de subcolección participe en el control de
  //   concurrencia de una transacción — confirmado por tipos, no supuesto.
  // - `tests/emulator/firestore.rules` (accounts/{accountId}/pockets/{pocketId}):
  //   `allow read, write: if isOwner(get(.../accounts/$(accountId)).data.ownerId)`
  //   — no hay ningún mecanismo de invariante (contador, `size()` en una regla
  //   de creación, etc.) que impida crear un bolsillo mientras otra operación
  //   cierra/elimina la cuenta en paralelo.
  // - Búsqueda en todo el repo (`grep -rn "pocketCount|pocket_count|pocketsCount"`):
  //   0 resultados. No existe ningún contador/índice/campo canónico de
  //   bolsillos en `accounts/{id}` hoy. No se inventa uno aquí.
  //
  // Esta prueba DEMUESTRA la carrera reproduciéndola con el mismo patrón de
  // dos fases (getDocs previo + runTransaction) que usan `close-personal-account.ts`
  // y `delete-closed-personal-account.ts` hoy: la precuenta de bolsillos ve
  // cero, pero un bolsillo "aparece" antes del commit de la transacción — y la
  // cuenta se cierra/elimina de todas formas, porque NINGUNA lectura dentro de
  // la transacción vuelve a verificar bolsillos (no puede: ver evidencia SDK
  // arriba). Este test se deja en verde a propósito, documentando el hallazgo
  // como bloqueo formal — no se debe interpretar como "la carrera está
  // resuelta". Ver docs/11_WEB_DEV_LOG.md (entrada de esta corrección) para el
  // contrato adicional mínimo propuesto (`pocketCount` transaccional) que
  // requeriría autorización separada de cambio de modelo/Rules.
  // ==========================================
  {
    const docsByPath = new Map<string, Record<string, unknown>>();
    docsByPath.set("accounts/acc-race-pocket", { ownerId: "u1", archived: false });
    const { transaction, updateCalls } = makeFakeTransactionEnv(docsByPath);

    // La pre-consulta de bolsillos ve CERO (getDocsFn de close-personal-account.ts).
    let preCheckSawEmpty = false;
    // Simula: "otra pestaña" crea un bolsillo DESPUÉS de la pre-consulta pero
    // ANTES del commit — imposible de detectar con el enfoque actual porque
    // `transaction.get()` solo acepta DocumentReference, nunca una Query.
    await closePersonalAccountForP1CDemo();

    async function closePersonalAccountForP1CDemo() {
      const { closePersonalAccount } = await import("../../src/features/accounts/services/close-personal-account");
      await closePersonalAccount(
        { ownerId: "u1", accountId: "acc-race-pocket" },
        {
          getFirebaseDbFn: () => ({}),
          docFn: makeDocFn(),
          collectionFn,
          getDocsFn: async () => {
            preCheckSawEmpty = true;
            // Refleja fielmente lo que el SDK real haría: la consulta de
            // subcolección corrió ANTES del bolsillo "aparecer" en otra
            // pestaña, y no hay forma de que la transacción se entere.
            return { empty: true, size: 0 };
          },
          runTransactionFn: (_d, fn) => fn(transaction),
        },
      );
    }

    assert.equal(preCheckSawEmpty, true, "La pre-consulta de bolsillos efectivamente vio cero (ese es exactamente el problema)");
    assert.equal(updateCalls.length, 1, "La cuenta SÍ se cierra a pesar de que 'debería' bloquear si tuviera un bolsillo recién creado");
    assert.equal(updateCalls[0].data.archived, true);
    console.log("  ⚠ P1-C: carrera reproducida y documentada como BLOQUEO — la precondición 'sin bolsillos' no es atómica con el SDK/Rules actuales; requiere autorización separada (ver dev log).");
  }

  console.log("All account-lifecycle-guard (Corrección P1) unit tests passed successfully!");
}

runAccountLifecycleGuardTests().catch((err) => {
  console.error("Test failure in account-lifecycle-guard.test.ts:", err);
  process.exit(1);
});
