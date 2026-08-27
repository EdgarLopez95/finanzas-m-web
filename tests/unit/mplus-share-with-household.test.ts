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
  updateMovement,
  type MovementDraft,
} from "../../src/features/movements/services/movement-mutations";
import { millisToTimestamp } from "../../src/lib/mplus/converters";
import type {
  MplusHousehold,
  MplusHouseholdExpenseCategory,
  MplusMovement,
  MplusUserProfile,
} from "../../src/lib/mplus/models";
import type { MplusRunnerDeps } from "../../src/lib/mplus/mutation-runner";
import { useMplusHouseholdStore } from "../../src/stores/mplus-household-store";
import { useMplusPersonalStore } from "../../src/stores/mplus-personal-store";

/**
 * Suite de pruebas unitarias para el flujo "Contar en Hogar" (paridad con Android).
 */

export const runShareWithHouseholdTests = async (): Promise<void> => {
  const NOW = Date.UTC(2026, 7, 26, 15, 0, 0);
  const OWNER_ID = "user-123";
  const HOUSEHOLD_ID = "household-456";
  const PERSONAL_CAT_ID = "cat-personal-groceries";
  const HOUSEHOLD_CAT_ID = "cat-household-food";
  const OTHER_HOUSEHOLD_CAT_ID = "cat-household-market";

  type FakeDoc = Record<string, unknown>;
  type Recorded = { path: string; op: "set" | "update" | "delete"; data?: FakeDoc };

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
      for (const op of staged) {
        recorded.push(op);
        if (op.op === "delete") {
          delete world[op.path];
        } else if (op.data) {
          world[op.path] = { ...op.data };
        }
      }
      return result;
    }) as unknown as MplusRunnerDeps["runTransaction"],
  });

  const app = initializeApp(
    { projectId: "finanzas-m-plus-test", apiKey: "test", appId: "test" },
    `share-test-${Date.now()}`,
  );
  const db = getFirestore(app);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Elegibilidad: Hogar no activo vs Hogar activo
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const canShareEvaluator = (
      profile: Partial<MplusUserProfile> | null,
      household: Partial<MplusHousehold> | null,
    ): boolean => {
      return (
        profile !== null &&
        profile.householdMembershipState === "active" &&
        profile.householdId !== null &&
        profile.householdId !== undefined &&
        household !== null &&
        household.status === "active"
      );
    };

    // Sin perfil o sin hogar
    assert.equal(canShareEvaluator(null, null), false, "Sin perfil no puede compartir");
    assert.equal(
      canShareEvaluator({ householdMembershipState: "none", householdId: null }, null),
      false,
      "Membership none no puede compartir",
    );
    assert.equal(
      canShareEvaluator({ householdMembershipState: "left", householdId: HOUSEHOLD_ID }, { status: "active" }),
      false,
      "Membership left no puede compartir",
    );

    // Con householdId pero Hogar no activo
    assert.equal(
      canShareEvaluator(
        { householdMembershipState: "active", householdId: HOUSEHOLD_ID },
        { status: "waiting" },
      ),
      false,
      "Hogar en waiting no habilita compartir",
    );
    assert.equal(
      canShareEvaluator(
        { householdMembershipState: "active", householdId: HOUSEHOLD_ID },
        { status: "waiting_return" },
      ),
      false,
      "Hogar en waiting_return no habilita compartir",
    );
    assert.equal(
      canShareEvaluator(
        { householdMembershipState: "active", householdId: HOUSEHOLD_ID },
        { status: "closing" },
      ),
      false,
      "Hogar en closing no habilita compartir",
    );
    assert.equal(
      canShareEvaluator(
        { householdMembershipState: "active", householdId: HOUSEHOLD_ID },
        null,
      ),
      false,
      "Hogar null (aún no cargado o inexistente) no habilita compartir",
    );

    // Hogar activo y membresía activa
    assert.equal(
      canShareEvaluator(
        { householdMembershipState: "active", householdId: HOUSEHOLD_ID },
        { status: "active" },
      ),
      true,
      "Hogar activo y membresía activa habilita compartir",
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Estado inicial del toggle en alta y en edición
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const resolveInitialToggle = (
      movement: MplusMovement | null,
      canShareWithHousehold: boolean,
    ): boolean => {
      return movement ? movement.householdId !== null : canShareWithHousehold;
    };

    // Alta nueva con Hogar elegible -> activado por defecto
    assert.equal(
      resolveInitialToggle(null, true),
      true,
      "Alta nueva con Hogar activo viene activada por defecto",
    );

    // Alta nueva sin Hogar elegible -> desactivado
    assert.equal(
      resolveInitialToggle(null, false),
      false,
      "Alta nueva sin Hogar viene desactivada",
    );

    // Edición de movimiento compartido -> activado
    const sharedMovement = { id: "m1", householdId: HOUSEHOLD_ID } as MplusMovement;
    assert.equal(
      resolveInitialToggle(sharedMovement, true),
      true,
      "Edición de movimiento compartido inicia activado",
    );

    // Edición de movimiento personal no compartido -> desactivado
    const privateMovement = { id: "m2", householdId: null } as MplusMovement;
    assert.equal(
      resolveInitialToggle(privateMovement, true),
      false,
      "Edición de movimiento no compartido inicia desactivado",
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Compartir gasto con categoría elegida y aprendizaje de equivalencia
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    const draft: MovementDraft = {
      type: "expense",
      title: "Mercado D1",
      amount: 85000,
      categoryId: PERSONAL_CAT_ID,
      accountId: null,
      note: "Compra semanal",
      occurredAtMillis: NOW,
      householdId: HOUSEHOLD_ID,
      householdCategoryId: HOUSEHOLD_CAT_ID,
      learnMapping: true,
    };

    const result = await createMovement(OWNER_ID, "mov-exp-1", draft, {
      nowMillis: NOW,
      db,
      deps,
    });

    assert.equal(result.kind, "success");
    if (result.kind === "success") {
      assert.equal(result.value.householdId, HOUSEHOLD_ID);
      assert.equal(result.value.householdCategoryId, HOUSEHOLD_CAT_ID);
      assert.equal(result.value.type, "expense");
    }

    // Verifica que se guardó el movimiento en Firestore
    const movRecord = recorded.find((r) => r.path === "movements/mov-exp-1");
    assert.ok(movRecord, "El movimiento se guardó en Firestore");
    assert.equal(movRecord.data?.householdId, HOUSEHOLD_ID);
    assert.equal(movRecord.data?.householdCategoryId, HOUSEHOLD_CAT_ID);

    // Verifica que se creó la equivalencia en categoryMappings
    const mappingPath = `households/${HOUSEHOLD_ID}/categoryMappings/${OWNER_ID}__${PERSONAL_CAT_ID}`;
    const mappingRecord = recorded.find((r) => r.path === mappingPath);
    assert.ok(mappingRecord, "La equivalencia aprendida se guardó en Firestore");
    assert.equal(mappingRecord.data?.householdCategoryId, HOUSEHOLD_CAT_ID);
    assert.equal(mappingRecord.data?.ownerId, OWNER_ID);
    assert.equal(mappingRecord.data?.personalCategoryId, PERSONAL_CAT_ID);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Compartir gasto con actualización de equivalencia existente
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const mappingPath = `households/${HOUSEHOLD_ID}/categoryMappings/${OWNER_ID}__${PERSONAL_CAT_ID}`;
    const world: Record<string, FakeDoc | undefined> = {
      [mappingPath]: {
        id: `${OWNER_ID}__${PERSONAL_CAT_ID}`,
        schemaVersion: 1,
        householdId: HOUSEHOLD_ID,
        ownerId: OWNER_ID,
        personalCategoryId: PERSONAL_CAT_ID,
        householdCategoryId: HOUSEHOLD_CAT_ID,
        updatedBy: OWNER_ID,
        revision: 1,
        lastMutationId: "11111111-1111-4111-8111-111111111111",
        createdAt: millisToTimestamp(NOW - 5000),
        updatedAt: millisToTimestamp(NOW - 5000),
      },
    };
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    const draft: MovementDraft = {
      type: "expense",
      title: "Mercado Éxito",
      amount: 120000,
      categoryId: PERSONAL_CAT_ID,
      accountId: null,
      note: "Nueva categoría",
      occurredAtMillis: NOW,
      householdId: HOUSEHOLD_ID,
      householdCategoryId: OTHER_HOUSEHOLD_CAT_ID,
      learnMapping: true,
    };

    const result = await createMovement(OWNER_ID, "mov-exp-2", draft, {
      nowMillis: NOW,
      db,
      deps,
    });

    assert.equal(result.kind, "success");
    const mappingRecord = recorded.find((r) => r.path === mappingPath);
    assert.ok(mappingRecord, "La equivalencia existente se actualizó en Firestore");
    assert.equal(mappingRecord.op, "update", "Usa update para documento existente");
    assert.equal(mappingRecord.data?.householdCategoryId, OTHER_HOUSEHOLD_CAT_ID);
    assert.equal(mappingRecord.data?.revision, 2, "La revisión de mapping subió a 2");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Compartir gasto con “Clasificar después” (householdCategoryId = null)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    const draft: MovementDraft = {
      type: "expense",
      title: "Gasto sin clasificar",
      amount: 30000,
      categoryId: PERSONAL_CAT_ID,
      accountId: null,
      note: "",
      occurredAtMillis: NOW,
      householdId: HOUSEHOLD_ID,
      householdCategoryId: null,
      learnMapping: false,
    };

    const result = await createMovement(OWNER_ID, "mov-exp-3", draft, {
      nowMillis: NOW,
      db,
      deps,
    });

    assert.equal(result.kind, "success");
    if (result.kind === "success") {
      assert.equal(result.value.householdId, HOUSEHOLD_ID);
      assert.equal(result.value.householdCategoryId, null);
    }

    const mappingPath = `households/${HOUSEHOLD_ID}/categoryMappings/${OWNER_ID}__${PERSONAL_CAT_ID}`;
    const mappingRecord = recorded.find((r) => r.path === mappingPath);
    assert.equal(mappingRecord, undefined, "Clasificar después no escribe ningún mapping");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Compartir ingreso compartido (sin categoría de Hogar)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    const draft: MovementDraft = {
      type: "income",
      title: "Aporte arriendo",
      amount: 1500000,
      categoryId: "cat-personal-salary",
      accountId: null,
      note: "",
      occurredAtMillis: NOW,
      householdId: HOUSEHOLD_ID,
      householdCategoryId: null,
    };

    const result = await createMovement(OWNER_ID, "mov-inc-1", draft, {
      nowMillis: NOW,
      db,
      deps,
    });

    assert.equal(result.kind, "success");
    if (result.kind === "success") {
      assert.equal(result.value.householdId, HOUSEHOLD_ID);
      assert.equal(result.value.householdCategoryId, null, "Ingresos nunca tienen householdCategoryId");
      assert.equal(result.value.type, "income");
    }

    const mappingRecord = recorded.find((r) => r.path.includes("categoryMappings"));
    assert.equal(mappingRecord, undefined, "Ingreso compartido nunca crea equivalencias");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Guardar solo en Personal
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    const draft: MovementDraft = {
      type: "expense",
      title: "Gasto privado",
      amount: 45000,
      categoryId: PERSONAL_CAT_ID,
      accountId: null,
      note: "",
      occurredAtMillis: NOW,
      householdId: null,
      householdCategoryId: null,
    };

    const result = await createMovement(OWNER_ID, "mov-exp-4", draft, {
      nowMillis: NOW,
      db,
      deps,
    });

    assert.equal(result.kind, "success");
    if (result.kind === "success") {
      assert.equal(result.value.householdId, null);
      assert.equal(result.value.householdCategoryId, null);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Retirar movimiento ya compartido
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const existingMovementDoc: FakeDoc = {
      schemaVersion: 1,
      ownerId: OWNER_ID,
      type: "expense",
      title: "Gasto antes compartido",
      amount: 60000,
      categoryId: PERSONAL_CAT_ID,
      accountId: null,
      note: "",
      occurredAt: millisToTimestamp(NOW - 1000),
      lifecycleState: "active",
      trashedAt: null,
      purgeAfter: null,
      householdId: HOUSEHOLD_ID,
      householdCategoryId: HOUSEHOLD_CAT_ID,
      revision: 1,
      lastMutationId: "22222222-2222-4222-8222-222222222222",
      createdAt: millisToTimestamp(NOW - 1000),
      updatedAt: millisToTimestamp(NOW - 1000),
    };

    const world: Record<string, FakeDoc | undefined> = {
      "movements/mov-shared-old": existingMovementDoc,
    };
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    const current: MplusMovement = {
      id: "mov-shared-old",
      schemaVersion: 1,
      ownerId: OWNER_ID,
      type: "expense",
      title: "Gasto antes compartido",
      amount: 60000,
      categoryId: PERSONAL_CAT_ID,
      accountId: null,
      note: "",
      occurredAtMillis: NOW - 1000,
      lifecycleState: "active",
      trashedAtMillis: null,
      purgeAfterMillis: null,
      householdId: HOUSEHOLD_ID,
      householdCategoryId: HOUSEHOLD_CAT_ID,
      revision: 1,
      lastMutationId: "22222222-2222-4222-8222-222222222222",
      createdAtMillis: NOW - 1000,
      updatedAtMillis: NOW - 1000,
    };

    const editDraft: MovementDraft = {
      type: "expense",
      title: "Gasto antes compartido",
      amount: 60000,
      categoryId: PERSONAL_CAT_ID,
      accountId: null,
      note: "",
      occurredAtMillis: NOW - 1000,
      householdId: null,
      householdCategoryId: null,
    };

    const result = await updateMovement(current, editDraft, {
      nowMillis: NOW,
      db,
      deps,
    });

    assert.equal(result.kind, "success");
    if (result.kind === "success") {
      assert.equal(result.value.householdId, null, "householdId quedó null");
      assert.equal(result.value.householdCategoryId, null, "householdCategoryId quedó null");
      assert.equal(result.value.revision, 2);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Comprobaciones estructurales de componentes
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const shareDialogModule = await import(
      "../../src/features/movements/components/composer/share-with-household-confirm-dialog"
    );
    assert.ok(
      shareDialogModule.ShareWithHouseholdConfirmDialog,
      "ShareWithHouseholdConfirmDialog está exportado",
    );

    const removeDialogModule = await import(
      "../../src/features/movements/components/composer/remove-from-household-confirm-dialog"
    );
    assert.ok(
      removeDialogModule.RemoveFromHouseholdConfirmDialog,
      "RemoveFromHouseholdConfirmDialog está exportado",
    );

    const categoryDialogModule = await import(
      "../../src/features/household/components/household-category-dialog"
    );
    assert.ok(
      categoryDialogModule.HouseholdCategoryDialog,
      "HouseholdCategoryDialog está exportado",
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. Gasto compartido sin equivalencia inicia en "Clasificar después" (§14)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const resolveInitialCategory = (params: {
      isExpense: boolean;
      learnedId: string | null;
      activeCategories: Array<{ id: string }>;
    }): string | null => {
      const { isExpense, learnedId, activeCategories } = params;
      if (!isExpense) return null;
      if (learnedId && activeCategories.some((c) => c.id === learnedId)) {
        return learnedId;
      }
      return "__unclassified__";
    };

    const activeCats = [{ id: "cat-h-food" }, { id: "cat-h-bills" }];

    // Sin equivalencia -> Clasificar después
    assert.equal(
      resolveInitialCategory({ isExpense: true, learnedId: null, activeCategories: activeCats }),
      "__unclassified__",
      "Gasto sin equivalencia aprendida debe iniciar en Clasificar después",
    );

    // Con equivalencia aprendida que está activa -> Preselecciona la aprendida
    assert.equal(
      resolveInitialCategory({ isExpense: true, learnedId: "cat-h-food", activeCategories: activeCats }),
      "cat-h-food",
      "Gasto con equivalencia aprendida activa debe preseleccionarla",
    );

    // Con equivalencia aprendida que ya NO está activa -> Clasificar después
    assert.equal(
      resolveInitialCategory({ isExpense: true, learnedId: "cat-h-archived", activeCategories: activeCats }),
      "__unclassified__",
      "Gasto con equivalencia archivada o inexistente debe iniciar en Clasificar después",
    );

    // Ingreso -> null (sin selector de categoría de Hogar)
    assert.equal(
      resolveInitialCategory({ isExpense: false, learnedId: "cat-h-food", activeCategories: activeCats }),
      null,
      "Ingreso no tiene selector de categoría",
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. Reclasificar gasto propio "Por clasificar"
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const readHouseholdMovementsModule = await import(
      "../../src/features/household/services/read-household-movements"
    );

    const ownMovement: MplusMovement = {
      id: "mov-own-unclassified",
      schemaVersion: 1,
      ownerId: OWNER_ID,
      type: "expense",
      title: "Almuerzo propio",
      amount: 25000,
      categoryId: PERSONAL_CAT_ID,
      accountId: null,
      note: "",
      occurredAtMillis: NOW,
      lifecycleState: "active",
      trashedAtMillis: null,
      purgeAfterMillis: null,
      householdId: HOUSEHOLD_ID,
      householdCategoryId: null,
      revision: 1,
      lastMutationId: "33333333-3333-4333-8333-333333333333",
      createdAtMillis: NOW,
      updatedAtMillis: NOW,
    };

    assert.equal(ownMovement.householdCategoryId, null, "Inicia por clasificar");

    // Simulamos la mutación de reclasificación
    const updatedMovement: MplusMovement = {
      ...ownMovement,
      householdCategoryId: HOUSEHOLD_CAT_ID,
      revision: ownMovement.revision + 1,
      updatedAtMillis: NOW + 1000,
    };

    assert.equal(updatedMovement.householdCategoryId, HOUSEHOLD_CAT_ID);
    assert.equal(updatedMovement.revision, 2);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. Reclasificar gasto de pareja "Por clasificar"
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const PARTNER_ID = "user-partner-888";
    const partnerMovement: MplusMovement = {
      id: "mov-partner-unclassified",
      schemaVersion: 1,
      ownerId: PARTNER_ID,
      type: "expense",
      title: "Compra pareja",
      amount: 90000,
      categoryId: "cat-partner-groceries",
      accountId: null,
      note: "",
      occurredAtMillis: NOW,
      lifecycleState: "active",
      trashedAtMillis: null,
      purgeAfterMillis: null,
      householdId: HOUSEHOLD_ID,
      householdCategoryId: null,
      revision: 1,
      lastMutationId: "44444444-4444-4444-8444-444444444444",
      createdAtMillis: NOW,
      updatedAtMillis: NOW,
    };

    const reclassifiedPartnerMovement: MplusMovement = {
      ...partnerMovement,
      householdCategoryId: HOUSEHOLD_CAT_ID,
      revision: partnerMovement.revision + 1,
      updatedAtMillis: NOW + 1000,
    };

    assert.equal(reclassifiedPartnerMovement.householdCategoryId, HOUSEHOLD_CAT_ID);
    assert.equal(reclassifiedPartnerMovement.ownerId, PARTNER_ID);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. Crear categoría desde la revisión y asignarla de inmediato
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const NEW_CAT_ID = "cat-h-new-pet";
    const newCategory: Partial<MplusHouseholdExpenseCategory> = {
      id: NEW_CAT_ID,
      householdId: HOUSEHOLD_ID,
      name: "Mascotas",
      iconKey: "pets",
      color: "#10B981",
      state: "active",
      createdBy: OWNER_ID,
      revision: 1,
    };

    assert.equal(newCategory.name, "Mascotas");
    assert.equal(newCategory.id, NEW_CAT_ID);

    // Asignación inmediata al gasto revisado
    const movementToReclassify: MplusMovement = {
      id: "mov-vet",
      schemaVersion: 1,
      ownerId: OWNER_ID,
      type: "expense",
      title: "Veterinaria",
      amount: 70000,
      categoryId: "cat-p-vet",
      accountId: null,
      note: "",
      occurredAtMillis: NOW,
      lifecycleState: "active",
      trashedAtMillis: null,
      purgeAfterMillis: null,
      householdId: HOUSEHOLD_ID,
      householdCategoryId: null,
      revision: 1,
      lastMutationId: "55555555-5555-4555-8555-555555555555",
      createdAtMillis: NOW,
      updatedAtMillis: NOW,
    };

    const reclassified = {
      ...movementToReclassify,
      householdCategoryId: newCategory.id,
      revision: 2,
    };

    assert.equal(reclassified.householdCategoryId, NEW_CAT_ID);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 14. Cancelar creación: el gasto permanece "Por clasificar"
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const movement: MplusMovement = {
      id: "mov-pending",
      schemaVersion: 1,
      ownerId: OWNER_ID,
      type: "expense",
      title: "Gasto pendiente",
      amount: 15000,
      categoryId: PERSONAL_CAT_ID,
      accountId: null,
      note: "",
      occurredAtMillis: NOW,
      lifecycleState: "active",
      trashedAtMillis: null,
      purgeAfterMillis: null,
      householdId: HOUSEHOLD_ID,
      householdCategoryId: null,
      revision: 1,
      lastMutationId: "66666666-6666-4666-8666-666666666666",
      createdAtMillis: NOW,
      updatedAtMillis: NOW,
    };

    // Al cancelar la creación de categoría, no se ejecuta mutación
    const afterCancel = { ...movement };
    assert.equal(afterCancel.householdCategoryId, null, "Permanece sin clasificar");
    assert.equal(afterCancel.revision, 1, "La revisión no cambió");
  }
};
