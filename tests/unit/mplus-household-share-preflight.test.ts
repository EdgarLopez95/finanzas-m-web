import assert from "node:assert/strict";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
} from "firebase/firestore";

import {
  createMovement,
  updateMovement,
  MovementPreconditionError,
  type MovementDraft,
} from "../../src/features/movements/services/movement-mutations";
import {
  verifyHouseholdSharePreflight,
  type HouseholdSharePreflightDeps,
} from "../../src/features/movements/services/verify-household-share-preflight";
import { describeOutcomeFailure } from "../../src/features/movements/hooks/use-movement-mutations";
import { checkHouseholdSharingEligibility } from "../../src/features/movements/hooks/use-mplus-personal";
import type {
  MplusHousehold,
  MplusHouseholdExpenseCategory,
  MplusHouseholdMember,
  MplusMovement,
  MplusUserProfile,
} from "../../src/lib/mplus/models";

/**
 * Suite TDD: Verificación remota previa a compartir con Hogar y protección contra PERMISSION_DENIED.
 */
export const runHouseholdSharePreflightTests = async (): Promise<void> => {
  const NOW = Date.UTC(2026, 8, 12, 12, 0, 0);
  const UID = "user-alice";
  const HOUSEHOLD_ID = "hh-valid-123";
  const PERSONAL_CAT_ID = "cat-p-food";
  const HH_CAT_ID = "cat-h-groceries";

  type FakeDoc = Record<string, unknown>;
  type Recorded = { path: string; op: "set" | "update" | "delete"; data?: FakeDoc };

  const makeTestWorld = () => {
    const world: Record<string, FakeDoc | undefined> = {
      [`users/${UID}`]: {
        schemaVersion: 1,
        status: "ready",
        householdId: HOUSEHOLD_ID,
        householdMembershipState: "active",
        personalCatalogVersion: 1,
        revision: 1,
        lastMutationId: "11111111-1111-4111-8111-111111111111",
        createdAt: new Date(NOW - 10000),
        updatedAt: new Date(NOW - 10000),
      },
      [`households/${HOUSEHOLD_ID}`]: {
        schemaVersion: 1,
        status: "active",
        memberAId: UID,
        memberBId: "user-bob",
        activeInviteId: null,
        catalogVersion: 1,
        cleanupPhase: "none",
        revision: 1,
        lastMutationId: "22222222-2222-4222-8222-222222222222",
        name: "Casa Alice y Bob",
        createdAt: new Date(NOW - 10000),
        updatedAt: new Date(NOW - 10000),
      },
      [`households/${HOUSEHOLD_ID}/members/${UID}`]: {
        schemaVersion: 1,
        householdId: HOUSEHOLD_ID,
        userId: UID,
        state: "active",
        displayName: "Alice",
        photoUrl: "",
        joinedAt: new Date(NOW - 10000),
        leftAt: null,
        revision: 1,
        lastMutationId: "33333333-3333-4333-8333-333333333333",
        updatedAt: new Date(NOW - 10000),
      },
      [`households/${HOUSEHOLD_ID}/expenseCategories/${HH_CAT_ID}`]: {
        schemaVersion: 1,
        householdId: HOUSEHOLD_ID,
        name: "Mercado",
        iconKey: "shopping_cart",
        color: "#10B981",
        state: "active",
        seedKey: null,
        sortOrder: 1,
        createdBy: UID,
        revision: 1,
        lastMutationId: "44444444-4444-4444-8444-444444444444",
        createdAt: new Date(NOW - 10000),
        updatedAt: new Date(NOW - 10000),
      },
    };
    return world;
  };

  const makeMockDeps = (world: Record<string, FakeDoc | undefined>, recordedReads: string[] = []) => {
    const deps: HouseholdSharePreflightDeps = {
      getDoc: async (ref: DocumentReference) => {
        recordedReads.push(ref.path);
        const data = world[ref.path];
        return {
          exists: () => data !== undefined,
          data: () => data,
          id: ref.id,
          ref,
        } as unknown as DocumentSnapshot;
      },
    };
    return deps;
  };

  const app = initializeApp(
    { projectId: "finanzas-m-plus-test", apiKey: "test", appId: "test" },
    `preflight-test-${Date.now()}`,
  );
  const db = getFirestore(app);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Preflight remoto: Casos de rechazo
  // ─────────────────────────────────────────────────────────────────────────────
  {
    // A. Usuario no existe o no está ready (ej. resetting)
    const world1 = makeTestWorld();
    world1[`users/${UID}`] = { ...world1[`users/${UID}`], status: "resetting" };
    const res1 = await verifyHouseholdSharePreflight(
      { uid: UID, householdId: HOUSEHOLD_ID, householdCategoryId: HH_CAT_ID },
      { db, deps: makeMockDeps(world1) },
    );
    assert.equal(res1.ok, false);
    assert.equal(res1.code, "user_not_ready");

    // B. Usuario con householdId que no coincide
    const world2 = makeTestWorld();
    world2[`users/${UID}`] = { ...world2[`users/${UID}`], householdId: "hh-other" };
    const res2 = await verifyHouseholdSharePreflight(
      { uid: UID, householdId: HOUSEHOLD_ID, householdCategoryId: HH_CAT_ID },
      { db, deps: makeMockDeps(world2) },
    );
    assert.equal(res2.ok, false);
    assert.equal(res2.code, "user_household_mismatch");

    // C. Usuario con membershipState !== "active"
    const world3 = makeTestWorld();
    world3[`users/${UID}`] = { ...world3[`users/${UID}`], householdMembershipState: "left" };
    const res3 = await verifyHouseholdSharePreflight(
      { uid: UID, householdId: HOUSEHOLD_ID, householdCategoryId: HH_CAT_ID },
      { db, deps: makeMockDeps(world3) },
    );
    assert.equal(res3.ok, false);
    assert.equal(res3.code, "user_membership_not_active");

    // D. Hogar inexistente o no activo
    const world4 = makeTestWorld();
    world4[`households/${HOUSEHOLD_ID}`] = {
      ...world4[`households/${HOUSEHOLD_ID}`],
      status: "waiting",
    };
    const res4 = await verifyHouseholdSharePreflight(
      { uid: UID, householdId: HOUSEHOLD_ID, householdCategoryId: HH_CAT_ID },
      { db, deps: makeMockDeps(world4) },
    );
    assert.equal(res4.ok, false);
    assert.equal(res4.code, "household_not_active");

    // E. Usuario no es miembro canónico de Hogar (ni memberA ni memberB)
    const world5 = makeTestWorld();
    world5[`households/${HOUSEHOLD_ID}`] = {
      ...world5[`households/${HOUSEHOLD_ID}`],
      memberAId: "user-charlie",
      memberBId: "user-bob",
    };
    const res5 = await verifyHouseholdSharePreflight(
      { uid: UID, householdId: HOUSEHOLD_ID, householdCategoryId: HH_CAT_ID },
      { db, deps: makeMockDeps(world5) },
    );
    assert.equal(res5.ok, false);
    assert.equal(res5.code, "not_canonical_member");

    // F. Documento de miembro no existe o estado no active
    const world6 = makeTestWorld();
    world6[`households/${HOUSEHOLD_ID}/members/${UID}`] = {
      ...world6[`households/${HOUSEHOLD_ID}/members/${UID}`],
      state: "left",
    };
    const res6 = await verifyHouseholdSharePreflight(
      { uid: UID, householdId: HOUSEHOLD_ID, householdCategoryId: HH_CAT_ID },
      { db, deps: makeMockDeps(world6) },
    );
    assert.equal(res6.ok, false);
    assert.equal(res6.code, "member_not_active");

    // G. Categoría de Hogar enviada no existe o no está activa
    const world7 = makeTestWorld();
    world7[`households/${HOUSEHOLD_ID}/expenseCategories/${HH_CAT_ID}`] = {
      ...world7[`households/${HOUSEHOLD_ID}/expenseCategories/${HH_CAT_ID}`],
      state: "archived",
    };
    const res7 = await verifyHouseholdSharePreflight(
      { uid: UID, householdId: HOUSEHOLD_ID, householdCategoryId: HH_CAT_ID },
      { db, deps: makeMockDeps(world7) },
    );
    assert.equal(res7.ok, false);
    assert.equal(res7.code, "category_not_active");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Preflight remoto válido: permite continuar
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const world = makeTestWorld();
    const recordedReads: string[] = [];
    const res = await verifyHouseholdSharePreflight(
      { uid: UID, householdId: HOUSEHOLD_ID, householdCategoryId: HH_CAT_ID },
      { db, deps: makeMockDeps(world, recordedReads) },
    );
    assert.equal(res.ok, true, "Preflight válido debe tener ok === true");
    assert.ok(recordedReads.includes(`users/${UID}`));
    assert.ok(recordedReads.includes(`households/${HOUSEHOLD_ID}`));
    assert.ok(recordedReads.includes(`households/${HOUSEHOLD_ID}/members/${UID}`));
    assert.ok(
      recordedReads.includes(`households/${HOUSEHOLD_ID}/expenseCategories/${HH_CAT_ID}`),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. createMovement / updateMovement con preflight inválido: CERO WRITES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const world = makeTestWorld();
    // Hogar en waiting -> no se puede compartir
    world[`households/${HOUSEHOLD_ID}`] = {
      ...world[`households/${HOUSEHOLD_ID}`],
      status: "waiting",
    };

    const recordedWrites: Recorded[] = [];
    const fakeMutationDeps = {
      runTransaction: async () => {
        assert.fail("NO debe abrir transacción si el preflight remoto falla");
      },
    };

    const draft: MovementDraft = {
      type: "expense",
      title: "Cena",
      amount: 50000,
      categoryId: PERSONAL_CAT_ID,
      accountId: null,
      note: "",
      occurredAtMillis: NOW,
      householdId: HOUSEHOLD_ID,
      householdCategoryId: HH_CAT_ID,
    };

    // createMovement debe lanzar MovementPreconditionError y realizar CERO escrituras
    await assert.rejects(
      async () => {
        await createMovement(UID, "mov-fail-1", draft, {
          nowMillis: NOW,
          db,
          deps: fakeMutationDeps as any,
          preflightDeps: makeMockDeps(world),
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof MovementPreconditionError);
        assert.ok(
          err.message.includes("activo"),
          "El mensaje de error debe explicar claramente la causa",
        );
        return true;
      },
    );
    assert.equal(recordedWrites.length, 0, "Debe haber CERO escrituras");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. "Solo en Personal": CERO lecturas/escrituras de Hogar
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const world: Record<string, FakeDoc | undefined> = {};
    const recordedWrites: Recorded[] = [];
    const recordedReads: string[] = [];

    const mockPreflightDeps: HouseholdSharePreflightDeps = {
      getDoc: async (ref: DocumentReference) => {
        recordedReads.push(ref.path);
        return { exists: () => false, data: () => ({}), id: ref.id } as any;
      },
    };

    const mutationDeps = {
      runTransaction: (async (_db: Firestore, fn: any) => {
        const tx = {
          get: async (ref: DocumentReference) => {
            recordedReads.push(ref.path);
            return { exists: () => false, data: () => ({}), id: ref.id };
          },
          set: (ref: DocumentReference, data: FakeDoc) => {
            recordedWrites.push({ path: ref.path, op: "set", data });
            return tx;
          },
        };
        return await fn(tx);
      }) as any,
    };

    const personalDraft: MovementDraft = {
      type: "expense",
      title: "Gasto privado",
      amount: 15000,
      categoryId: PERSONAL_CAT_ID,
      accountId: null,
      note: "Solo para mí",
      occurredAtMillis: NOW,
      householdId: null,
      householdCategoryId: null,
    };

    const result = await createMovement(UID, "mov-personal-safe", personalDraft, {
      nowMillis: NOW,
      db,
      deps: mutationDeps,
      preflightDeps: mockPreflightDeps,
    });

    assert.equal(result.kind, "success");
    // Verificar que CERO lecturas o escrituras tocan la colección 'households'
    const touchedHouseholdReads = recordedReads.filter((p) => p.startsWith("households"));
    const touchedHouseholdWrites = recordedWrites.filter((w) => w.path.startsWith("households"));
    assert.equal(
      touchedHouseholdReads.length,
      0,
      "'Solo en Personal' no debe leer documentos de Hogar",
    );
    assert.equal(
      touchedHouseholdWrites.length,
      0,
      "'Solo en Personal' no debe escribir documentos de Hogar",
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Error remoto posterior al preflight: copy seguro en español
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const failureFeedback = describeOutcomeFailure(
      {
        kind: "rejected",
        code: "permission-denied",
        message: "Missing or insufficient permissions.",
      },
      { isShared: true },
    );

    assert.equal(failureFeedback.kind, "error");
    assert.ok(
      !failureFeedback.message.includes("Missing or insufficient permissions"),
      "No debe exponer el error crudo genérico en inglés",
    );
    assert.ok(
      failureFeedback.message.includes("No fue posible compartir") ||
        failureFeedback.message.includes("Solo en Personal") ||
        failureFeedback.message.includes("permiso"),
      "Debe ofrecer una explicación en español y mantener 'Solo en Personal' como opción",
    );
    assert.ok(
      !failureFeedback.message.includes("quedó compartido"),
      "No debe afirmar erróneamente que el movimiento quedó compartido",
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Helper UI checkHouseholdSharingEligibility
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const profileReady: MplusUserProfile = {
      uid: UID,
      schemaVersion: 1,
      status: "ready",
      householdId: HOUSEHOLD_ID,
      householdMembershipState: "active",
      personalCatalogVersion: 1,
      revision: 1,
      lastMutationId: "mut-p",
      createdAtMillis: NOW,
      updatedAtMillis: NOW,
      resetRequestedAtMillis: null,
    };

    const householdActive: MplusHousehold = {
      id: HOUSEHOLD_ID,
      schemaVersion: 1,
      status: "active",
      memberAId: UID,
      memberBId: "user-bob",
      activeInviteId: null,
      catalogVersion: 1,
      cleanupPhase: "none",
      revision: 1,
      lastMutationId: "mut-h",
      name: "Casa",
      createdAtMillis: NOW,
      updatedAtMillis: NOW,
    };

    const membersActive: MplusHouseholdMember[] = [
      {
        id: "mem-1",
        schemaVersion: 1,
        householdId: HOUSEHOLD_ID,
        userId: UID,
        state: "active",
        displayName: "Alice",
        photoUrl: "",
        joinedAtMillis: NOW,
        leftAtMillis: null,
        revision: 1,
        lastMutationId: "mut-m",
        updatedAtMillis: NOW,
      },
    ];

    // Totalmente coherente -> true
    assert.equal(
      checkHouseholdSharingEligibility({
        authUid: UID,
        profile: profileReady,
        household: householdActive,
        members: membersActive,
      }).canShare,
      true,
    );

    // UID no coincide con miembro canónico -> false
    assert.equal(
      checkHouseholdSharingEligibility({
        authUid: "user-unknown",
        profile: profileReady,
        household: householdActive,
        members: membersActive,
      }).canShare,
      false,
    );

    // Membresía en subcolección state !== "active" -> false
    assert.equal(
      checkHouseholdSharingEligibility({
        authUid: UID,
        profile: profileReady,
        household: householdActive,
        members: [{ ...membersActive[0], state: "left" }],
      }).canShare,
      false,
    );

    // Profile status !== "ready" -> false
    assert.equal(
      checkHouseholdSharingEligibility({
        authUid: UID,
        profile: { ...profileReady, status: "resetting" },
        household: householdActive,
        members: membersActive,
      }).canShare,
      false,
    );
  }
};
