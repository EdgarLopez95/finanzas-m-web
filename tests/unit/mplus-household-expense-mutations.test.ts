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
  createHouseholdExpense,
  updateHouseholdExpense,
  trashHouseholdExpense,
  restoreHouseholdExpense,
  deleteHouseholdExpensePermanently,
  purgeHouseholdExpense,
  calculateHouseholdExpenseDistribution,
  HouseholdExpensePreconditionError,
  type HouseholdExpenseDraft,
} from "../../src/features/household/services/household-expense-mutations";
import {
  updateMovementPersonalCategory,
  updateMovement,
  trashMovement,
  restoreMovement,
  deleteMovementPermanently,
  purgeMovement,
  MovementPreconditionError,
} from "../../src/features/movements/services/movement-mutations";
import { PURGE_WINDOW_MILLIS } from "../../src/lib/mplus/bogota-date";
import { millisToTimestamp, movementFromFirestore } from "../../src/lib/mplus/converters";
import type { MplusHousehold, MplusHouseholdExpense, MplusHouseholdMember, MplusMovement } from "../../src/lib/mplus/models";
import type { MplusRunnerDeps } from "../../src/lib/mplus/mutation-runner";

export const runMplusHouseholdExpenseMutationsTests = async (): Promise<void> => {
  const NOW = Date.UTC(2026, 8, 3, 15, 0, 0); // 2026-09-03
  const HOUSEHOLD_ID = "house-123";
  const MEMBER_A = "uid-a";
  const MEMBER_B = "uid-b";

  const db: Firestore = getFirestore(
    initializeApp({ apiKey: "dummy", projectId: "dummy" }, "mplus-household-expense-mutations-test"),
  );

  type FakeDoc = Record<string, unknown>;
  type Recorded = { path: string; op: "set" | "update" | "delete"; data?: FakeDoc };

  const refFor = (path: string): DocumentReference =>
    ({ path, id: path.split("/").pop() ?? path }) as unknown as DocumentReference;

  const makeDeps = (
    world: Record<string, FakeDoc | undefined>,
    recorded: Recorded[],
    currentUserId?: string,
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
          // Guardrail de privacidad canónica: un usuario NO puede leer la derivada personal ajena
          if (ref.path.startsWith("movements/") && ref.path.includes("__")) {
            const ownerId = ref.path.split("__").pop();
            if (currentUserId && ownerId && ownerId !== currentUserId) {
              const error = new Error("Missing or insufficient permissions");
              (error as any).code = "permission-denied";
              throw error;
            }
          }
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
          world[ref.path] = data;
          return tx;
        },
        update: (ref: DocumentReference, data: FakeDoc) => {
          wroteAlready = true;
          staged.push({ path: ref.path, op: "update", data });
          const prev = world[ref.path] ?? {};
          const next: FakeDoc = { ...prev };
          for (const [k, v] of Object.entries(data)) {
            if (v && typeof v === "object" && "_methodName" in v && (v as any)._methodName === "increment") {
              const prevNum = (prev[k] as number) ?? 0;
              next[k] = prevNum + ((v as any)._operand ?? 1);
            } else {
              next[k] = v;
            }
          }
          world[ref.path] = next;
          return tx;
        },
        delete: (ref: DocumentReference) => {
          wroteAlready = true;
          staged.push({ path: ref.path, op: "delete" });
          delete world[ref.path];
          return tx;
        },
      } as unknown as Transaction;

      const result = await fn(tx);
      recorded.push(...staged);
      return result;
    }) as unknown as MplusRunnerDeps["runTransaction"],
  });

  const householdBase: MplusHousehold = {
    id: HOUSEHOLD_ID,
    schemaVersion: 1,
    status: "active",
    memberAId: MEMBER_A,
    memberBId: MEMBER_B,
    activeInviteId: null,
    catalogVersion: 1,
    cleanupPhase: "none",
    revision: 1,
    lastMutationId: "mut-h1",
    createdAtMillis: NOW - 100000,
    updatedAtMillis: NOW - 100000,
    name: "Nuestro Hogar",
  };

  const membersActive: MplusHouseholdMember[] = [
    {
      id: "house-123__uid-a",
      schemaVersion: 1,
      householdId: HOUSEHOLD_ID,
      userId: MEMBER_A,
      state: "active",
      displayName: "Member A",
      photoUrl: "",
      joinedAtMillis: NOW - 100000,
      leftAtMillis: null,
      revision: 1,
      lastMutationId: "mut-m1",
      updatedAtMillis: NOW - 100000,
    },
    {
      id: "house-123__uid-b",
      schemaVersion: 1,
      householdId: HOUSEHOLD_ID,
      userId: MEMBER_B,
      state: "active",
      displayName: "Member B",
      photoUrl: "",
      joinedAtMillis: NOW - 100000,
      leftAtMillis: null,
      revision: 1,
      lastMutationId: "mut-m2",
      updatedAtMillis: NOW - 100000,
    },
  ];

  // --- 1. calculateHouseholdExpenseDistribution ---
  {
    // Equal division odd
    const dist101 = calculateHouseholdExpenseDistribution(101, "equal");
    assert.equal(dist101.memberAAmount, 51, "Ceil para miembro A");
    assert.equal(dist101.memberBAmount, 50, "Floor para miembro B");
    assert.equal(dist101.memberAAmount + dist101.memberBAmount, 101);

    // Equal division even
    const dist100 = calculateHouseholdExpenseDistribution(100, "equal");
    assert.equal(dist100.memberAAmount, 50);
    assert.equal(dist100.memberBAmount, 50);

    // Custom division valid
    const custom = calculateHouseholdExpenseDistribution(100, "custom", { memberAAmount: 70, memberBAmount: 30 });
    assert.equal(custom.memberAAmount, 70);
    assert.equal(custom.memberBAmount, 30);

    // Custom division invalid sum
    assert.throws(
      () => calculateHouseholdExpenseDistribution(100, "custom", { memberAAmount: 70, memberBAmount: 40 }),
      HouseholdExpensePreconditionError,
    );
  }

  // --- 2. createHouseholdExpense: atomic creation of source and participations ---
  {
    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    const draft: HouseholdExpenseDraft = {
      title: "Mercado D1",
      amount: 101,
      note: "Compra quincenal",
      occurredAtMillis: NOW,
      householdCategoryId: "cat_food",
      distributionMode: "equal",
    };

    const res = await createHouseholdExpense(householdBase, draft, {
      nowMillis: NOW,
      db, deps,
      userId: MEMBER_A,
      members: membersActive,
    });

    assert.equal(res.kind, "success");
    if (res.kind === "success") {
      const expense = res.value;
      assert.equal(expense.householdId, HOUSEHOLD_ID);
      assert.equal(expense.amount, 101);
      assert.equal(expense.memberAAmount, 51);
      assert.equal(expense.memberBAmount, 50);
      assert.equal(expense.lifecycleState, "active");

      // Verify written documents in world
      const expensePath = `households/${HOUSEHOLD_ID}/expenses/${expense.id}`;
      const partAPath = `movements/${expense.id}__${MEMBER_A}`;
      const partBPath = `movements/${expense.id}__${MEMBER_B}`;

      assert.ok(world[expensePath], "Fuente debe estar escrita");
      assert.ok(world[partAPath], "Participación A debe estar escrita");
      assert.ok(world[partBPath], "Participación B debe estar escrita");

      const partA = movementFromFirestore(`${expense.id}__${MEMBER_A}`, world[partAPath] as any);
      assert.equal(partA.origin, "household_expense");
      assert.equal(partA.householdExpenseId, expense.id);
      assert.equal(partA.amount, 51);
      assert.equal(partA.categoryId, null, "categoryId es null inicialmente");
      assert.equal(partA.accountId, null);
      assert.equal(partA.householdId, null);
      assert.equal(partA.householdCategoryId, null);

      const partB = movementFromFirestore(`${expense.id}__${MEMBER_B}`, world[partBPath] as any);
      assert.equal(partB.origin, "household_expense");
      assert.equal(partB.amount, 50);
      assert.equal(partB.categoryId, null);
    }
  }

  // --- 3. createHouseholdExpense with 0 participation for member B ---
  {
    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    const draft: HouseholdExpenseDraft = {
      title: "Gasto solo de A",
      amount: 50,
      occurredAtMillis: NOW,
      distributionMode: "custom",
      customDistribution: { memberAAmount: 50, memberBAmount: 0 },
    };

    const res = await createHouseholdExpense(householdBase, draft, {
      nowMillis: NOW,
      db, deps,
      userId: MEMBER_A,
      members: membersActive,
    });

    assert.equal(res.kind, "success");
    if (res.kind === "success") {
      const expense = res.value;
      const partAPath = `movements/${expense.id}__${MEMBER_A}`;
      const partBPath = `movements/${expense.id}__${MEMBER_B}`;

      assert.ok(world[partAPath], "Participación A escrita");
      assert.equal(world[partBPath], undefined, "Participación B NO debe existir cuando amount == 0");
    }
  }

  // --- 4. updateHouseholdExpense: preserve personal category and handle 0 transitions ---
  {
    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded, MEMBER_A);

    // Initial creation: 100 equal (50 / 50)
    const draft: HouseholdExpenseDraft = {
      title: "Cena",
      amount: 100,
      occurredAtMillis: NOW,
      distributionMode: "equal",
    };
    const createRes = await createHouseholdExpense(householdBase, draft, {
      nowMillis: NOW,
      db, deps,
      userId: MEMBER_A,
      members: membersActive,
    });
    assert.equal(createRes.kind, "success");
    const expense = (createRes as { value: MplusHouseholdExpense }).value;
    const partAPath = `movements/${expense.id}__${MEMBER_A}`;
    const partBPath = `movements/${expense.id}__${MEMBER_B}`;

    // Simulate Member A categorizing their participation in Personal
    (world[partAPath] as any).categoryId = "personal_cat_restaurantes";

    // Update 1: Change total to 200 (100 / 100). Personal category must be preserved!
    const updateDraft: HouseholdExpenseDraft = {
      title: "Cena de lujo",
      amount: 200,
      occurredAtMillis: NOW,
      distributionMode: "equal",
    };
    const updateRes = await updateHouseholdExpense(expense, householdBase, updateDraft, {
      nowMillis: NOW + 1000,
      db, deps,
      userId: MEMBER_A,
      members: membersActive,
    });
    assert.equal(updateRes.kind, "success");
    const updatedExpense = (updateRes as { value: MplusHouseholdExpense }).value;

    const partAAfter = world[partAPath] as any;
    assert.equal(partAAfter.amount, 100);
    assert.equal(partAAfter.categoryId, "personal_cat_restaurantes", "Preserva categoría personal");

    // Update 2: Transition B to 0 (A=200, B=0). Positivo -> 0 borra derivada B!
    const toZeroDraft: HouseholdExpenseDraft = {
      title: "Cena asumida por A",
      amount: 200,
      occurredAtMillis: NOW,
      distributionMode: "custom",
      customDistribution: { memberAAmount: 200, memberBAmount: 0 },
    };
    const toZeroRes = await updateHouseholdExpense(updatedExpense, householdBase, toZeroDraft, {
      nowMillis: NOW + 2000,
      db, deps,
      userId: MEMBER_A,
      members: membersActive,
    });
    assert.equal(toZeroRes.kind, "success");
    assert.equal(world[partBPath], undefined, "Derivada B debe ser eliminada al pasar a 0");

    // Update 3: Transition B from 0 -> 50. 0 -> positivo recrea derivada con categoryId = null!
    const fromZeroDraft: HouseholdExpenseDraft = {
      title: "Cena compartida de nuevo",
      amount: 200,
      occurredAtMillis: NOW,
      distributionMode: "custom",
      customDistribution: { memberAAmount: 150, memberBAmount: 50 },
    };
    const fromZeroRes = await updateHouseholdExpense((toZeroRes as any).value, householdBase, fromZeroDraft, {
      nowMillis: NOW + 3000,
      db, deps,
      userId: MEMBER_A,
      members: membersActive,
    });
    assert.equal(fromZeroRes.kind, "success");
    assert.ok(world[partBPath], "Derivada B debe ser recreada");
    assert.equal((world[partBPath] as any).categoryId, null, "Recreada con categoryId = null");
  }

  // --- 5. Member LEFT rules ---
  {
    const membersWithLeft: MplusHouseholdMember[] = [
      { ...membersActive[0], state: "active" },
      { ...membersActive[1], state: "left", leftAtMillis: NOW },
    ];

    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    // Initial creation while both active
    const draft: HouseholdExpenseDraft = {
      title: "Arriendo",
      amount: 1000,
      occurredAtMillis: NOW,
      distributionMode: "equal",
    };
    const createRes = await createHouseholdExpense(householdBase, draft, {
      nowMillis: NOW,
      db, deps,
      userId: MEMBER_A,
      members: membersActive,
    });
    const expense = (createRes as any).value;

    // Rule: Con participante left y fuente active, solo se puede modificar householdCategoryId
    // Trying to change title should FAIL:
    await assert.rejects(
      () =>
        updateHouseholdExpense(expense, householdBase, { ...draft, title: "Nuevo Arriendo" }, {
          nowMillis: NOW + 1000,
          db, deps,
          userId: MEMBER_A,
          members: membersWithLeft,
        }),
      HouseholdExpensePreconditionError,
    );

    // Changing ONLY householdCategoryId should SUCCEED:
    const reclassRes = await updateHouseholdExpense(
      expense,
      householdBase,
      { ...draft, householdCategoryId: "cat_vivienda" },
      {
        nowMillis: NOW + 1000,
        db, deps,
        userId: MEMBER_A,
        members: membersWithLeft,
      },
    );
    assert.equal(reclassRes.kind, "success");
    assert.equal((reclassRes as any).value.householdCategoryId, "cat_vivienda");

    // Rule: Trash is blocked if a member is left
    await assert.rejects(
      () =>
        trashHouseholdExpense(expense, householdBase, {
          nowMillis: NOW + 2000,
          db, deps,
          userId: MEMBER_A,
          members: membersWithLeft,
        }),
      HouseholdExpensePreconditionError,
    );
  }

  // --- 6. Trash, Restore and Permanent Delete lifecycle ---
  {
    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    const draft: HouseholdExpenseDraft = {
      title: "Servicios",
      amount: 200,
      occurredAtMillis: NOW,
      distributionMode: "equal",
    };
    const createRes = await createHouseholdExpense(householdBase, draft, {
      nowMillis: NOW,
      db, deps,
      userId: MEMBER_A,
      members: membersActive,
    });
    const expense = (createRes as any).value;
    const partAPath = `movements/${expense.id}__${MEMBER_A}`;
    const partBPath = `movements/${expense.id}__${MEMBER_B}`;

    // Categorize member A
    (world[partAPath] as any).categoryId = "personal_servicios";

    // Trash
    const trashRes = await trashHouseholdExpense(expense, householdBase, {
      nowMillis: NOW + 1000,
      db, deps,
      userId: MEMBER_A,
      members: membersActive,
    });
    assert.equal(trashRes.kind, "success");
    const trashedExp = (trashRes as any).value;
    assert.equal(trashedExp.lifecycleState, "trashed");
    assert.equal((world[partAPath] as any).lifecycleState, "trashed");
    assert.equal((world[partBPath] as any).lifecycleState, "trashed");

    // Restore: restores source and derivatives, PRESERVING personal category
    const restoreRes = await restoreHouseholdExpense(trashedExp, householdBase, {
      nowMillis: NOW + 2000,
      db, deps,
      userId: MEMBER_A,
      members: membersActive,
    });
    assert.equal(restoreRes.kind, "success");
    const restoredExp = (restoreRes as any).value;
    assert.equal(restoredExp.lifecycleState, "active");
    assert.equal((world[partAPath] as any).lifecycleState, "active");
    assert.equal((world[partAPath] as any).categoryId, "personal_servicios", "Categoría preservada al restaurar");

    // Trash again for permanent delete
    const trashAgain = await trashHouseholdExpense(restoredExp, householdBase, {
      nowMillis: NOW + 3000,
      db, deps,
      userId: MEMBER_A,
      members: membersActive,
    });
    const trashedAgain = (trashAgain as any).value;

    // Hard delete deletes source + both participations atomically
    const delRes = await deleteHouseholdExpensePermanently(trashedAgain, householdBase, {
      nowMillis: NOW + 4000,
      db, deps,
      userId: MEMBER_A,
      members: membersActive,
    });
    assert.equal(delRes.kind, "success");
    assert.equal(world[`households/${HOUSEHOLD_ID}/expenses/${expense.id}`], undefined);
    assert.equal(world[partAPath], undefined);
    assert.equal(world[partBPath], undefined);
  }

  // --- 7. Purge after 30 days works even if a participant is left ---
  {
    const membersWithLeft: MplusHouseholdMember[] = [
      { ...membersActive[0], state: "active" },
      { ...membersActive[1], state: "left", leftAtMillis: NOW },
    ];

    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    const draft: HouseholdExpenseDraft = {
      title: "Gasto Antiguo",
      amount: 150,
      occurredAtMillis: NOW - 40 * 24 * 60 * 60 * 1000,
      distributionMode: "equal",
    };
    const createRes = await createHouseholdExpense(householdBase, draft, {
      nowMillis: NOW - 40 * 24 * 60 * 60 * 1000,
      db, deps,
      userId: MEMBER_A,
      members: membersActive,
    });
    const expense = (createRes as any).value;
    const trashRes = await trashHouseholdExpense(expense, householdBase, {
      nowMillis: NOW - 35 * 24 * 60 * 60 * 1000,
      db, deps,
      userId: MEMBER_A,
      members: membersActive,
    });
    const trashedExp = (trashRes as any).value;

    // Purge at NOW (> trashedAt + 30 days) with left member SUCCEEDS
    const purgeRes = await purgeHouseholdExpense(trashedExp, householdBase, {
      nowMillis: NOW,
      db, deps,
      members: membersWithLeft,
    });
    assert.equal(purgeRes.kind, "success");
    assert.equal(world[`households/${HOUSEHOLD_ID}/expenses/${expense.id}`], undefined);
  }

  // --- 8. Personal Participation constraints ---
  {
    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    const draft: HouseholdExpenseDraft = {
      title: "Mercado",
      amount: 100,
      occurredAtMillis: NOW,
      distributionMode: "equal",
    };
    const createRes = await createHouseholdExpense(householdBase, draft, {
      nowMillis: NOW,
      db, deps,
      userId: MEMBER_A,
      members: membersActive,
    });
    const expense = (createRes as any).value;
    const partAPath = `movements/${expense.id}__${MEMBER_A}`;
    const partA = movementFromFirestore(`${expense.id}__${MEMBER_A}`, world[partAPath] as any);

    // updateMovementPersonalCategory updates only categoryId
    const catRes = await updateMovementPersonalCategory(partA, "cat_personal_1", {
      nowMillis: NOW + 1000,
      db, deps,
    });
    assert.equal(catRes.kind, "success");
    assert.equal((world[partAPath] as any).categoryId, "cat_personal_1");

    // updateMovement rejects editing household_expense derivative
    await assert.rejects(
      () =>
        updateMovement(partA, {
          type: "expense",
          title: "Nuevo título",
          amount: 50,
          categoryId: "cat_personal_1",
          accountId: null,
          note: "",
          occurredAtMillis: NOW,
          householdId: null,
        }, { deps }),
      MovementPreconditionError,
    );

    // trashMovement rejects trashing household_expense derivative from Personal
    await assert.rejects(
      () => trashMovement(partA, { deps }),
      MovementPreconditionError,
    );

    // deleteMovementPermanently rejects hard delete from Personal
    await assert.rejects(
      () => deleteMovementPermanently(partA, { deps }),
      MovementPreconditionError,
    );
  }

  // --- 9. ORQ-048: Regresiones obligatorias de edición de gastos en Hogar ---
  {
    // Escenario QA confirmado: Hogar activo con dos miembros activos.
    // Gasto fuente: "Bateria moto", $120.000, categoría Vehículo.
    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];

    const initialDraft: HouseholdExpenseDraft = {
      title: "Bateria moto",
      amount: 120000,
      note: "",
      occurredAtMillis: NOW,
      householdCategoryId: "cat_vehiculo",
      distributionMode: "equal",
    };

    // Creación por Member A:
    const depsA = makeDeps(world, recorded, MEMBER_A);
    const createRes = await createHouseholdExpense(householdBase, initialDraft, {
      nowMillis: NOW,
      db,
      deps: depsA,
      userId: MEMBER_A,
      members: membersActive,
    });
    assert.equal(createRes.kind, "success");
    const expense = (createRes as { value: MplusHouseholdExpense }).value;
    const partAPath = `movements/${expense.id}__${MEMBER_A}`;
    const partBPath = `movements/${expense.id}__${MEMBER_B}`;

    assert.equal((world[partAPath] as any).amount, 60000);
    assert.equal((world[partBPath] as any).amount, 60000);

    // Asignar categorías personales privadas distintas a cada derivada
    (world[partAPath] as any).categoryId = "cat_privada_a";
    (world[partBPath] as any).categoryId = "cat_privada_b";

    // 9.1: Edición de monto ($120.000 -> $150.000) + nota por quien creó el gasto (Member A).
    // El guardrail de makeDeps VERIFICA que Member A NO intente tx.get(partBPath).
    const editDraftA: HouseholdExpenseDraft = {
      title: "Bateria moto",
      amount: 150000,
      note: "Comprada en taller oficial",
      occurredAtMillis: NOW,
      householdCategoryId: "cat_vehiculo",
      distributionMode: "equal",
    };

    const editResA = await updateHouseholdExpense(expense, householdBase, editDraftA, {
      nowMillis: NOW + 1000,
      db,
      deps: depsA,
      userId: MEMBER_A,
      members: membersActive,
    });
    assert.equal(editResA.kind, "success", "Edición por Member A debe tener éxito");
    const updatedExpA = (editResA as { value: MplusHouseholdExpense }).value;
    assert.equal(updatedExpA.amount, 150000);
    assert.equal(updatedExpA.note, "Comprada en taller oficial");
    assert.equal(updatedExpA.memberAAmount, 75000);
    assert.equal(updatedExpA.memberBAmount, 75000);

    // Ambas derivadas deben haberse actualizado y conservado su categoría privada
    const partAAfterEditA = world[partAPath] as any;
    const partBAfterEditA = world[partBPath] as any;
    assert.equal(partAAfterEditA.amount, 75000);
    assert.equal(partAAfterEditA.note, "Comprada en taller oficial");
    assert.equal(partAAfterEditA.categoryId, "cat_privada_a", "Preserva categoría privada de A");
    assert.equal(partBAfterEditA.amount, 75000);
    assert.equal(partBAfterEditA.note, "Comprada en taller oficial");
    assert.equal(partBAfterEditA.categoryId, "cat_privada_b", "Preserva categoría privada de B");

    // 9.2: Edición por el otro integrante activo (Member B).
    // El guardrail de makeDeps VERIFICA que Member B NO intente tx.get(partAPath).
    const depsB = makeDeps(world, recorded, MEMBER_B);
    const editDraftB: HouseholdExpenseDraft = {
      title: "Bateria moto + instalacion",
      amount: 170000,
      note: "Incluye mano de obra",
      occurredAtMillis: NOW,
      householdCategoryId: "cat_vehiculo",
      distributionMode: "equal",
    };

    const editResB = await updateHouseholdExpense(updatedExpA, householdBase, editDraftB, {
      nowMillis: NOW + 2000,
      db,
      deps: depsB,
      userId: MEMBER_B,
      members: membersActive,
    });
    assert.equal(editResB.kind, "success", "Edición por Member B debe tener éxito");
    const updatedExpB = (editResB as { value: MplusHouseholdExpense }).value;
    assert.equal(updatedExpB.amount, 170000);
    assert.equal(updatedExpB.note, "Incluye mano de obra");
    assert.equal(updatedExpB.memberAAmount, 85000);
    assert.equal(updatedExpB.memberBAmount, 85000);

    const partAAfterEditB = world[partAPath] as any;
    const partBAfterEditB = world[partBPath] as any;
    assert.equal(partAAfterEditB.amount, 85000);
    assert.equal(partAAfterEditB.categoryId, "cat_privada_a", "Preserva categoría privada de A");
    assert.equal(partBAfterEditB.amount, 85000);
    assert.equal(partBAfterEditB.categoryId, "cat_privada_b", "Preserva categoría privada de B");

    // 9.3: Edición con distribución personalizada (Member A: 120.000, Member B: 50.000).
    const customDraft: HouseholdExpenseDraft = {
      title: "Bateria moto + instalacion",
      amount: 170000,
      note: "A paga más",
      occurredAtMillis: NOW,
      householdCategoryId: "cat_vehiculo",
      distributionMode: "custom",
      customDistribution: { memberAAmount: 120000, memberBAmount: 50000 },
    };

    const customRes = await updateHouseholdExpense(updatedExpB, householdBase, customDraft, {
      nowMillis: NOW + 3000,
      db,
      deps: depsA,
      userId: MEMBER_A,
      members: membersActive,
    });
    assert.equal(customRes.kind, "success");
    assert.equal((world[partAPath] as any).amount, 120000);
    assert.equal((world[partBPath] as any).amount, 50000);
    assert.equal((world[partAPath] as any).categoryId, "cat_privada_a");
    assert.equal((world[partBPath] as any).categoryId, "cat_privada_b");

    // 9.4: Papelera y restauración con guardrail de privacidad para ambos miembros
    const trashRes = await trashHouseholdExpense((customRes as any).value, householdBase, {
      nowMillis: NOW + 4000,
      db,
      deps: depsB, // ejecutado por Member B
      userId: MEMBER_B,
      members: membersActive,
    });
    assert.equal(trashRes.kind, "success");
    assert.equal((world[partAPath] as any).lifecycleState, "trashed");
    assert.equal((world[partBPath] as any).lifecycleState, "trashed");

    const restoreRes = await restoreHouseholdExpense((trashRes as any).value, householdBase, {
      nowMillis: NOW + 5000,
      db,
      deps: depsA, // restaurado por Member A
      userId: MEMBER_A,
      members: membersActive,
    });
    assert.equal(restoreRes.kind, "success");
    assert.equal((world[partAPath] as any).lifecycleState, "active");
    assert.equal((world[partBPath] as any).lifecycleState, "active");
    assert.equal((world[partAPath] as any).categoryId, "cat_privada_a");
    assert.equal((world[partBPath] as any).categoryId, "cat_privada_b");
  }

  console.log("OK mplus-household-expense-mutations");
};
