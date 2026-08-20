import assert from "node:assert/strict";
import type { DocumentReference, DocumentSnapshot, Firestore, Transaction } from "firebase/firestore";

import {
  MplusMutationFailure,
  nextRevision,
  runMplusMutation,
  unwrapMplusOutcome,
  type MplusMutationOutcome,
  type MplusRunnerDeps,
} from "../../src/lib/mplus/mutation-runner";
import { MplusContractValidationError } from "../../src/lib/mplus/schemas";

/**
 * Ejecutor centralizado de mutaciones (contrato §4.3, §22, §23).
 *
 * Verifica la MISMA clasificacion de resultado que Android
 * (`MplusRemoteApplyResult`): exito, conflicto por revision, reintento
 * idempotente, rechazo no recuperable y error recuperable (que en Web, sin
 * cola local, es un fallo visible `unavailable`). Y verifica lo mas
 * importante: ante un conflicto NO se escribe nada.
 */

export const runMplusMutationRunnerTests = async (): Promise<void> => {
  type FakeDoc = { revision?: number; lastMutationId?: string } & Record<string, unknown>;

  type FakeWorld = Record<string, FakeDoc | undefined>;

  const refFor = (path: string): DocumentReference =>
    ({ path, id: path.split("/").pop() ?? path }) as unknown as DocumentReference;

  type Recorded = { path: string; op: "set" | "delete"; data?: unknown };

  /** `runTransaction` de mentira: aplica las escrituras solo si `fn` no lanza. */
  const makeDeps = (world: FakeWorld, recorded: Recorded[]): MplusRunnerDeps => ({
    runTransaction: (async (_db: Firestore, fn: (tx: Transaction) => Promise<unknown>) => {
      const staged: Recorded[] = [];
      const tx = {
        get: async (ref: DocumentReference) => {
          const data = world[ref.path];
          return {
            exists: () => data !== undefined,
            data: () => data,
            id: ref.id,
          } as unknown as DocumentSnapshot;
        },
        set: (ref: DocumentReference, data: unknown) => {
          staged.push({ path: ref.path, op: "set", data });
          return tx;
        },
        delete: (ref: DocumentReference) => {
          staged.push({ path: ref.path, op: "delete" });
          return tx;
        },
        update: (ref: DocumentReference, data: unknown) => {
          staged.push({ path: ref.path, op: "set", data });
          return tx;
        },
      } as unknown as Transaction;

      const result = await fn(tx);
      // Commit: solo aqui las escrituras se hacen reales.
      staged.forEach((entry) => recorded.push(entry));
      return result;
    }) as unknown as MplusRunnerDeps["runTransaction"],
  });

  const db = {} as Firestore;
  const MUTATION = "11111111-1111-4111-8111-111111111111";
  const OTHER_MUTATION = "22222222-2222-4222-8222-222222222222";

  const run = async (
    world: FakeWorld,
    occ: { path: string; baseRevision: number | null }[],
    options?: { mutationId?: string; work?: () => unknown },
  ): Promise<{ outcome: MplusMutationOutcome<string>; recorded: Recorded[] }> => {
    const recorded: Recorded[] = [];
    const outcome = await runMplusMutation<string>(
      db,
      {
        mutationId: options?.mutationId ?? MUTATION,
        occ: occ.map((entry) => ({
          resource: entry.path.split("/")[0],
          id: entry.path.split("/").pop() ?? entry.path,
          ref: refFor(entry.path),
          baseRevision: entry.baseRevision,
        })),
        work: (tx) => {
          if (options?.work) options.work();
          tx.set(refFor(occ[0].path), { escrito: true });
          return "aplicado";
        },
      },
      makeDeps(world, recorded),
    );
    return { outcome, recorded };
  };

  // --- creacion sobre documento ausente: exito ---
  {
    const { outcome, recorded } = await run({}, [{ path: "movements/mov-1", baseRevision: null }]);
    assert.equal(outcome.kind, "success");
    assert.equal(outcome.kind === "success" && outcome.value, "aplicado");
    assert.equal(outcome.kind === "success" && outcome.replayed, false);
    assert.equal(recorded.length, 1);
  }

  // --- creacion sobre documento existente ajeno: conflicto y CERO escrituras ---
  {
    let workRan = false;
    const { outcome, recorded } = await run(
      { "movements/mov-1": { revision: 4, lastMutationId: OTHER_MUTATION, title: "remoto" } },
      [{ path: "movements/mov-1", baseRevision: null }],
      { work: () => { workRan = true; } },
    );
    assert.equal(outcome.kind, "conflict");
    assert.equal(workRan, false, "el trabajo no debe ejecutarse ante un conflicto");
    assert.deepEqual(recorded, [], "un conflicto no puede dejar escrituras");
    if (outcome.kind === "conflict") {
      assert.equal(outcome.conflict.resource, "movements");
      assert.equal(outcome.conflict.id, "mov-1");
      assert.equal(outcome.conflict.baseRevision, null);
      assert.equal(outcome.conflict.remoteRevision, 4);
      assert.deepEqual(outcome.conflict.remoteSnapshot?.title, "remoto");
    }
  }

  // --- creacion repetida con el MISMO mutationId: reintento idempotente ---
  {
    const { outcome, recorded } = await run(
      { "movements/mov-1": { revision: 1, lastMutationId: MUTATION } },
      [{ path: "movements/mov-1", baseRevision: null }],
    );
    assert.equal(outcome.kind, "success");
    assert.equal(outcome.kind === "success" && outcome.replayed, true);
    assert.deepEqual(recorded, [], "un reintento ya aplicado no reescribe");
  }

  // --- actualizacion con revision coincidente: exito ---
  {
    const { outcome, recorded } = await run(
      { "movements/mov-1": { revision: 3, lastMutationId: OTHER_MUTATION } },
      [{ path: "movements/mov-1", baseRevision: 3 }],
    );
    assert.equal(outcome.kind, "success");
    assert.equal(recorded.length, 1);
  }

  // --- actualizacion con revision desfasada: conflicto, sin last-write-wins ---
  {
    const { outcome, recorded } = await run(
      { "movements/mov-1": { revision: 5, lastMutationId: OTHER_MUTATION } },
      [{ path: "movements/mov-1", baseRevision: 3 }],
    );
    assert.equal(outcome.kind, "conflict");
    assert.deepEqual(recorded, []);
    if (outcome.kind === "conflict") {
      assert.equal(outcome.conflict.baseRevision, 3);
      assert.equal(outcome.conflict.remoteRevision, 5);
    }
  }

  // --- revision desfasada pero es NUESTRA propia mutacion ya aplicada ---
  {
    const { outcome } = await run(
      { "movements/mov-1": { revision: 4, lastMutationId: MUTATION } },
      [{ path: "movements/mov-1", baseRevision: 3 }],
    );
    assert.equal(outcome.kind, "success");
    assert.equal(outcome.kind === "success" && outcome.replayed, true);
  }

  // --- actualizacion sobre documento inexistente: conflicto (como Android) ---
  {
    const { outcome } = await run({}, [{ path: "movements/mov-1", baseRevision: 3 }]);
    assert.equal(outcome.kind, "conflict");
    if (outcome.kind === "conflict") {
      assert.equal(outcome.conflict.remoteRevision, null);
      assert.equal(outcome.conflict.remoteSnapshot, null);
    }
  }

  // --- operacion atomica multi-documento (contrato §23): falla la segunda ---
  {
    const { outcome, recorded } = await run(
      {
        "movements/mov-1": { revision: 3, lastMutationId: OTHER_MUTATION },
        "users/uid-1/accounts/acc-1": { revision: 9, lastMutationId: OTHER_MUTATION },
      },
      [
        { path: "movements/mov-1", baseRevision: 3 },
        { path: "users/uid-1/accounts/acc-1", baseRevision: 7 },
      ],
    );
    assert.equal(outcome.kind, "conflict");
    assert.deepEqual(recorded, [], "ninguna parte de una operacion atomica se aplica a medias");
    if (outcome.kind === "conflict") {
      assert.equal(outcome.conflict.id, "acc-1");
    }
  }

  // --- clasificacion de errores, misma que Android ---
  const failingDeps = (error: unknown): MplusRunnerDeps => ({
    runTransaction: (async () => {
      throw error;
    }) as unknown as MplusRunnerDeps["runTransaction"],
  });

  const classify = async (error: unknown) =>
    runMplusMutation<string>(
      db,
      {
        mutationId: MUTATION,
        occ: [
          {
            resource: "movements",
            id: "mov-1",
            ref: refFor("movements/mov-1"),
            baseRevision: 1,
          },
        ],
        work: () => "no importa",
      },
      failingDeps(error),
    );

  for (const code of ["unavailable", "deadline-exceeded", "aborted", "cancelled"]) {
    const outcome = await classify(Object.assign(new Error(`fallo ${code}`), { code }));
    assert.equal(outcome.kind, "unavailable", `${code} debe ser un fallo visible, no un rechazo`);
  }

  for (const code of ["permission-denied", "invalid-argument", "failed-precondition"]) {
    const outcome = await classify(Object.assign(new Error(`fallo ${code}`), { code }));
    assert.equal(outcome.kind, "rejected", `${code} debe ser un rechazo no recuperable`);
  }

  {
    // Sin conexion: el navegador aborta el fetch sin codigo Firestore.
    const outcome = await classify(new TypeError("Failed to fetch"));
    assert.equal(outcome.kind, "unavailable");
    assert.equal(outcome.kind === "unavailable" && outcome.code, "unknown");
  }

  {
    // Validacion de contrato dentro del trabajo: rechazo determinista.
    const outcome = await classify(new MplusContractValidationError("movements", ["amount: minimo 1"]));
    assert.equal(outcome.kind, "rejected");
    assert.equal(outcome.kind === "rejected" && outcome.code, "contract-validation");
  }

  // --- helpers ---
  assert.equal(nextRevision(1), 2);
  assert.equal(nextRevision(41), 42);

  {
    const conflict: MplusMutationOutcome<string> = {
      kind: "conflict",
      conflict: {
        resource: "movements",
        id: "mov-1",
        baseRevision: 1,
        remoteRevision: 2,
        remoteSnapshot: null,
      },
    };
    assert.throws(() => unwrapMplusOutcome(conflict), MplusMutationFailure);
    assert.equal(unwrapMplusOutcome({ kind: "success", value: "ok", replayed: false }), "ok");
  }

  console.log("OK mplus-mutation-runner");
};

runMplusMutationRunnerTests().catch((err) => {
  console.error("Test failure in mplus-mutation-runner.test.ts:", err);
  process.exit(1);
});
