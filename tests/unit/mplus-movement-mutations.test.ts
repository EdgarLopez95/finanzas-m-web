import assert from "node:assert/strict";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type Transaction,
} from "firebase/firestore";

import {
  createMovement,
  purgeMovement,
  restoreMovement,
  trashMovement,
  updateMovement,
  MovementPreconditionError,
  type MovementDraft,
} from "../../src/features/movements/services/movement-mutations";
import { PURGE_WINDOW_MILLIS, normalizeOccurredAtMillis } from "../../src/lib/mplus/bogota-date";
import { millisToTimestamp } from "../../src/lib/mplus/converters";
import type { MplusMovement } from "../../src/lib/mplus/models";
import type { MplusRunnerDeps } from "../../src/lib/mplus/mutation-runner";

/**
 * Mutaciones de `movements` (contrato §9, §7.3, §23).
 *
 * Lo que se verifica aqui es lo que las Rules canonicas comprueban con
 * `getAfter()` y que, si el cliente lo hace mal, se traduce en un
 * PERMISSION_DENIED en produccion:
 *
 *  - el contador de la cuenta se mueve en la MISMA transaccion y en la
 *    direccion correcta (crear +1, cambiar -1/+1, Papelera 0, purga -1);
 *  - la actualizacion del contador solo toca las 5 claves permitidas;
 *  - `revision` sube exactamente en uno y `occurredAt` se normaliza al dia
 *    bogotano;
 *  - `purgeAfter` es exactamente `trashedAt + 30 dias`.
 */

export const runMplusMovementMutationTests = async (): Promise<void> => {
  const NOW = Date.UTC(2026, 7, 20, 15, 0, 0);
  const OWNER = "uid-1";
  const ACCOUNT_ID = "acc-1";
  const OTHER_ACCOUNT_ID = "acc-2";
  const CATEGORY_ID = "seed_expense_groceries";

  type FakeDoc = Record<string, unknown>;
  type Recorded = { path: string; op: "set" | "update" | "delete"; data?: FakeDoc };

  const refFor = (path: string): DocumentReference =>
    ({ path, id: path.split("/").pop() ?? path }) as unknown as DocumentReference;

  const accountDoc = (id: string, referenceCount: number, revision = 1): FakeDoc => ({
    schemaVersion: 1,
    ownerId: OWNER,
    name: id === ACCOUNT_ID ? "Bancolombia" : "Nequi",
    type: id === ACCOUNT_ID ? "bank" : "digital_wallet",
    iconType: id === ACCOUNT_ID ? "bank_logo" : "bank_logo",
    iconKey: id === ACCOUNT_ID ? "bancolombia" : "nequi",
    color: "#2563EB",
    state: "active",
    referenceCount,
    lastReferenceMovementId: null,
    revision,
    lastMutationId: "99999999-9999-4999-8999-999999999999",
    createdAt: millisToTimestamp(NOW - 1000),
    updatedAt: millisToTimestamp(NOW - 1000),
  });

  const makeDeps = (
    world: Record<string, FakeDoc | undefined>,
    recorded: Recorded[],
  ): MplusRunnerDeps => ({
    runTransaction: (async (_db: Firestore, fn: (tx: Transaction) => Promise<unknown>) => {
      const staged: Recorded[] = [];
      let wroteAlready = false;
      const tx = {
        get: async (ref: DocumentReference) => {
          assert.equal(
            wroteAlready,
            false,
            "Firestore exige todas las lecturas antes de cualquier escritura",
          );
          const data = world[ref.path];
          return {
            exists: () => data !== undefined,
            data: () => data,
            id: ref.id,
          } as unknown as DocumentSnapshot;
        },
        set: (ref: DocumentReference, data: FakeDoc) => {
          wroteAlready = true;
          staged.push({ path: ref.path, op: "set", data });
          return tx;
        },
        update: (ref: DocumentReference, data: FakeDoc) => {
          wroteAlready = true;
          staged.push({ path: ref.path, op: "update", data });
          return tx;
        },
        delete: (ref: DocumentReference) => {
          wroteAlready = true;
          staged.push({ path: ref.path, op: "delete" });
          return tx;
        },
      } as unknown as Transaction;

      const result = await fn(tx);
      staged.forEach((entry) => recorded.push(entry));
      return result;
    }) as unknown as MplusRunnerDeps["runTransaction"],
  });

  // Firestore real solo para construir referencias (`doc()` es local). Ninguna
  // operacion sale a la red: `deps.runTransaction` intercepta toda escritura.
  const db: Firestore = getFirestore(
    initializeApp({ apiKey: "dummy", projectId: "dummy" }, "mplus-movement-mutations-test"),
  );

  const draft = (overrides: Partial<MovementDraft> = {}): MovementDraft => ({
    type: "expense",
    title: "Mercado semanal",
    amount: 85_000,
    categoryId: CATEGORY_ID,
    accountId: ACCOUNT_ID,
    note: "",
    occurredAtMillis: NOW,
    householdId: null,
    ...overrides,
  });

  const baseMovement = (overrides: Partial<MplusMovement> = {}): MplusMovement => ({
    id: "mov-1",
    schemaVersion: 1,
    ownerId: OWNER,
    type: "expense",
    title: "Mercado semanal",
    amount: 85_000,
    categoryId: CATEGORY_ID,
    accountId: ACCOUNT_ID,
    note: "",
    occurredAtMillis: normalizeOccurredAtMillis(NOW),
    lifecycleState: "active",
    trashedAtMillis: null,
    purgeAfterMillis: null,
    householdId: null,
    householdCategoryId: null,
    revision: 3,
    lastMutationId: "44444444-4444-4444-8444-444444444444",
    createdAtMillis: NOW - 10_000,
    updatedAtMillis: NOW - 10_000,
    ...overrides,
  });

  const accountPath = (id: string) => `users/${OWNER}/accounts/${id}`;

  // --- crear con cuenta: +1 en el contador, en la misma transaccion ---
  {
    const recorded: Recorded[] = [];
    const world = { [accountPath(ACCOUNT_ID)]: accountDoc(ACCOUNT_ID, 4, 7) };
    const outcome = await createMovement(OWNER, "mov-new", draft(), {
      nowMillis: NOW,
      db,
      deps: makeDeps(world, recorded),
    });

    assert.equal(outcome.kind, "success");
    assert.equal(recorded.length, 2, "movimiento + cuenta en la misma transaccion");

    const counter = recorded.find((entry) => entry.path === accountPath(ACCOUNT_ID));
    assert.ok(counter, "debe tocarse la cuenta");
    assert.equal(counter.op, "update");
    assert.deepEqual(
      Object.keys(counter.data ?? {}).sort(),
      ["lastMutationId", "lastReferenceMovementId", "referenceCount", "revision", "updatedAt"],
      "validAccountUpdate solo admite estas 5 claves en un cambio de contador",
    );
    assert.equal(counter.data?.referenceCount, 5);
    assert.equal(counter.data?.lastReferenceMovementId, "mov-new");
    assert.equal(counter.data?.revision, 8, "la cuenta sube revision exactamente en uno");

    const movement = recorded.find((entry) => entry.path === "movements/mov-new");
    assert.ok(movement);
    assert.equal(movement.data?.revision, 1);
    assert.equal(movement.data?.lifecycleState, "active");
    assert.equal(movement.data?.trashedAt, null);
    assert.equal(movement.data?.purgeAfter, null);
    assert.equal(movement.data?.householdCategoryId, null);
    // La fecha se normaliza al inicio del dia bogotano (contrato §4.6).
    assert.equal(
      (movement.data?.occurredAt as { seconds: number }).seconds * 1000,
      normalizeOccurredAtMillis(NOW),
    );
    // El mismo lastMutationId identifica la operacion en los dos documentos.
    assert.equal(movement.data?.lastMutationId, counter.data?.lastMutationId);
  }

  // --- crear sin cuenta: no se toca ninguna cuenta ---
  {
    const recorded: Recorded[] = [];
    const outcome = await createMovement(OWNER, "mov-sin-cuenta", draft({ accountId: null }), {
      nowMillis: NOW,
      db,
      deps: makeDeps({}, recorded),
    });
    assert.equal(outcome.kind, "success");
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].path, "movements/mov-sin-cuenta");
  }

  // --- fecha futura: se rechaza ANTES de abrir la transaccion ---
  {
    const recorded: Recorded[] = [];
    await assert.rejects(
      () =>
        createMovement(OWNER, "mov-futuro", draft({ occurredAtMillis: NOW + 3 * 86_400_000 }), {
          nowMillis: NOW,
          db,
          deps: makeDeps({}, recorded),
        }),
      MovementPreconditionError,
    );
    assert.equal(recorded.length, 0, "un rechazo local no debe gastar un viaje remoto");
  }

  // --- editar cambiando de cuenta: -1 en la anterior, +1 en la nueva ---
  {
    const recorded: Recorded[] = [];
    const world = {
      "movements/mov-1": { revision: 3, lastMutationId: "otro" },
      [accountPath(ACCOUNT_ID)]: accountDoc(ACCOUNT_ID, 2, 5),
      [accountPath(OTHER_ACCOUNT_ID)]: accountDoc(OTHER_ACCOUNT_ID, 0, 1),
    };
    const outcome = await updateMovement(
      baseMovement(),
      draft({ accountId: OTHER_ACCOUNT_ID, amount: 90_000 }),
      { nowMillis: NOW, db, deps: makeDeps(world, recorded) },
    );

    assert.equal(outcome.kind, "success");
    const decrement = recorded.find((entry) => entry.path === accountPath(ACCOUNT_ID));
    const increment = recorded.find((entry) => entry.path === accountPath(OTHER_ACCOUNT_ID));
    assert.equal(decrement?.data?.referenceCount, 1, "la cuenta anterior pierde una referencia");
    assert.equal(increment?.data?.referenceCount, 1, "la nueva cuenta la gana");
    assert.equal(decrement?.data?.lastReferenceMovementId, "mov-1");
    assert.equal(increment?.data?.lastReferenceMovementId, "mov-1");

    const movement = recorded.find((entry) => entry.path === "movements/mov-1");
    assert.equal(movement?.data?.revision, 4, "revision sube exactamente en uno");
    assert.equal(movement?.data?.amount, 90_000);
  }

  // --- editar sin cambiar de cuenta: el contador NO se toca ---
  {
    const recorded: Recorded[] = [];
    const world = {
      "movements/mov-1": { revision: 3, lastMutationId: "otro" },
      [accountPath(ACCOUNT_ID)]: accountDoc(ACCOUNT_ID, 2, 5),
    };
    const outcome = await updateMovement(baseMovement(), draft({ title: "Mercado quincenal" }), {
      nowMillis: NOW,
      db,
      deps: makeDeps(world, recorded),
    });
    assert.equal(outcome.kind, "success");
    assert.equal(recorded.length, 1, "solo se escribe el movimiento");
    assert.equal(recorded[0].path, "movements/mov-1");
  }

  // --- dejar de compartir limpia la categoria de Hogar (contrato §9.1) ---
  {
    const recorded: Recorded[] = [];
    const world = {
      "movements/mov-1": { revision: 3, lastMutationId: "otro" },
      [accountPath(ACCOUNT_ID)]: accountDoc(ACCOUNT_ID, 2, 5),
    };
    await updateMovement(
      baseMovement({ householdId: "h-1", householdCategoryId: "seed_expense_groceries" }),
      draft({ householdId: null }),
      { nowMillis: NOW, db, deps: makeDeps(world, recorded) },
    );
    const movement = recorded.find((entry) => entry.path === "movements/mov-1");
    assert.equal(movement?.data?.householdId, null);
    assert.equal(movement?.data?.householdCategoryId, null);
  }

  // --- Papelera: fija fechas, NO toca el contador (contrato §7.3) ---
  {
    const recorded: Recorded[] = [];
    const world = {
      "movements/mov-1": { revision: 3, lastMutationId: "otro" },
      [accountPath(ACCOUNT_ID)]: accountDoc(ACCOUNT_ID, 2, 5),
    };
    const outcome = await trashMovement(baseMovement(), {
      nowMillis: NOW,
      db,
      deps: makeDeps(world, recorded),
    });
    assert.equal(outcome.kind, "success");
    assert.equal(recorded.length, 1, "enviar a la Papelera no mueve contadores");

    const data = recorded[0].data ?? {};
    assert.equal(data.lifecycleState, "trashed");
    const trashedAt = (data.trashedAt as { seconds: number }).seconds * 1000;
    const purgeAfter = (data.purgeAfter as { seconds: number }).seconds * 1000;
    assert.equal(trashedAt, NOW);
    assert.equal(purgeAfter - trashedAt, PURGE_WINDOW_MILLIS, "purgeAfter = trashedAt + 30 dias");
  }

  // --- restaurar: limpia fechas, tampoco toca contadores ---
  {
    const recorded: Recorded[] = [];
    const world = { "movements/mov-1": { revision: 4, lastMutationId: "otro" } };
    const trashedMovement = baseMovement({
      lifecycleState: "trashed",
      trashedAtMillis: NOW - 86_400_000,
      purgeAfterMillis: NOW - 86_400_000 + PURGE_WINDOW_MILLIS,
      revision: 4,
    });
    const outcome = await restoreMovement(trashedMovement, {
      nowMillis: NOW,
      db,
      deps: makeDeps(world, recorded),
    });
    assert.equal(outcome.kind, "success");
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].data?.lifecycleState, "active");
    assert.equal(recorded[0].data?.trashedAt, null);
    assert.equal(recorded[0].data?.purgeAfter, null);
  }

  // --- restaurar un vencido se rechaza localmente ---
  {
    const expired = baseMovement({
      lifecycleState: "trashed",
      trashedAtMillis: NOW - PURGE_WINDOW_MILLIS - 1000,
      purgeAfterMillis: NOW - 1000,
      revision: 4,
    });
    await assert.rejects(
      () => restoreMovement(expired, { nowMillis: NOW, db, deps: makeDeps({}, []) }),
      MovementPreconditionError,
    );
  }

  // --- purga: borra el documento y decrementa el contador ---
  {
    const recorded: Recorded[] = [];
    const world = {
      "movements/mov-1": { revision: 4, lastMutationId: "otro" },
      [accountPath(ACCOUNT_ID)]: accountDoc(ACCOUNT_ID, 3, 9),
    };
    const expired = baseMovement({
      lifecycleState: "trashed",
      trashedAtMillis: NOW - PURGE_WINDOW_MILLIS - 1000,
      purgeAfterMillis: NOW - 1000,
      revision: 4,
    });
    const outcome = await purgeMovement(expired, {
      nowMillis: NOW,
      db,
      deps: makeDeps(world, recorded),
    });
    assert.equal(outcome.kind, "success");

    const counter = recorded.find((entry) => entry.path === accountPath(ACCOUNT_ID));
    assert.equal(counter?.data?.referenceCount, 2, "la eliminacion fisica si decrementa");
    const deletion = recorded.find((entry) => entry.op === "delete");
    assert.equal(deletion?.path, "movements/mov-1");
  }

  // --- purgar antes de vencer se rechaza ---
  {
    const notDue = baseMovement({
      lifecycleState: "trashed",
      trashedAtMillis: NOW,
      purgeAfterMillis: NOW + PURGE_WINDOW_MILLIS,
      revision: 4,
    });
    await assert.rejects(
      () => purgeMovement(notDue, { nowMillis: NOW, db, deps: makeDeps({}, []) }),
      MovementPreconditionError,
    );
  }

  // --- conflicto de revision: cero escrituras, ni en el movimiento ni en la cuenta ---
  {
    const recorded: Recorded[] = [];
    const world = {
      "movements/mov-1": { revision: 99, lastMutationId: "de-otro-dispositivo" },
      [accountPath(ACCOUNT_ID)]: accountDoc(ACCOUNT_ID, 2, 5),
      [accountPath(OTHER_ACCOUNT_ID)]: accountDoc(OTHER_ACCOUNT_ID, 0, 1),
    };
    const outcome = await updateMovement(
      baseMovement(),
      draft({ accountId: OTHER_ACCOUNT_ID }),
      { nowMillis: NOW, db, deps: makeDeps(world, recorded) },
    );

    assert.equal(outcome.kind, "conflict");
    assert.equal(recorded.length, 0, "un conflicto no puede dejar contadores movidos");
    if (outcome.kind === "conflict") {
      assert.equal(outcome.conflict.baseRevision, 3);
      assert.equal(outcome.conflict.remoteRevision, 99);
    }
  }

  // --- editar algo que ya esta en la Papelera se rechaza ---
  {
    await assert.rejects(
      () =>
        updateMovement(
          baseMovement({ lifecycleState: "trashed", trashedAtMillis: NOW, purgeAfterMillis: NOW + PURGE_WINDOW_MILLIS }),
          draft(),
          { nowMillis: NOW, db, deps: makeDeps({}, []) },
        ),
      MovementPreconditionError,
    );
  }

  console.log("OK mplus-movement-mutations");
};

void runMplusMovementMutationTests().catch((error) => {
  console.error("Test failure in mplus-movement-mutations.test.ts:", error);
  process.exit(1);
});
