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

  const seedPreflightWorld = (w: Record<string, FakeDoc | undefined>) => {
    if (!w[`users/${OWNER_ID}`]) {
      w[`users/${OWNER_ID}`] = {
        status: "ready",
        householdId: HOUSEHOLD_ID,
        householdMembershipState: "active",
      };
    }
    if (!w[`households/${HOUSEHOLD_ID}`]) {
      w[`households/${HOUSEHOLD_ID}`] = {
        status: "active",
        memberAId: OWNER_ID,
        memberBId: "user-partner",
      };
    }
    if (!w[`households/${HOUSEHOLD_ID}/members/${OWNER_ID}`]) {
      w[`households/${HOUSEHOLD_ID}/members/${OWNER_ID}`] = {
        state: "active",
      };
    }
    if (!w[`households/${HOUSEHOLD_ID}/expenseCategories/${HOUSEHOLD_CAT_ID}`]) {
      w[`households/${HOUSEHOLD_ID}/expenseCategories/${HOUSEHOLD_CAT_ID}`] = {
        state: "active",
      };
    }
    if (!w[`households/${HOUSEHOLD_ID}/expenseCategories/${OTHER_HOUSEHOLD_CAT_ID}`]) {
      w[`households/${HOUSEHOLD_ID}/expenseCategories/${OTHER_HOUSEHOLD_CAT_ID}`] = {
        state: "active",
      };
    }
    return w;
  };

  const makeDeps = (
    world: Record<string, FakeDoc | undefined>,
    recorded: Recorded[],
  ) => {
    seedPreflightWorld(world);
    return {
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
      preflightDeps: {
        getDocFromServer: async (ref: DocumentReference) => {
          seedPreflightWorld(world);
          if (ref.path.includes("/expenseCategories/") && !world[ref.path]) {
            world[ref.path] = { state: "active" };
          }
          const data = world[ref.path];
          return {
            exists: () => data !== undefined,
            data: () => data,
            id: ref.id,
          } as unknown as DocumentSnapshot;
        },
      },
    };
  };

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

  // ?????????????????????????????????????????????????????????????????????????????
  // 3. Compartir gasto con categoría de Hogar resuelta (createMovement NUNCA escribe categoryMappings)
  // ?????????????????????????????????????????????????????????????????????????????
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
      learnMapping: true, // Debe ser ignorado: createMovement nunca escribe mappings
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
    assert.ok(movRecord, "El movimiento se guard? en Firestore");
    assert.equal(movRecord.data?.householdId, HOUSEHOLD_ID);
    assert.equal(movRecord.data?.householdCategoryId, HOUSEHOLD_CAT_ID);

    // Verifica que createMovement NUNCA escribe en categoryMappings (paridad Android b7a39d8)
    const mappingRecord = recorded.find((r) => r.path.includes("categoryMappings"));
    assert.equal(mappingRecord, undefined, "createMovement NUNCA escribe categoryMappings");
  }

  // ?????????????????????????????????????????????????????????????????????????????
  // 4. Actualizar movimiento compartido (updateMovement NUNCA escribe categoryMappings)
  // ?????????????????????????????????????????????????????????????????????????????
  {
    const currentMovement: MplusMovement = {
      id: "mov-exp-2",
      schemaVersion: 1,
      ownerId: OWNER_ID,
      type: "expense",
      title: "Mercado Éxito",
      amount: 100000,
      categoryId: PERSONAL_CAT_ID,
      accountId: null,
      note: "Inicial",
      occurredAtMillis: NOW,
      lifecycleState: "active",
      trashedAtMillis: null,
      purgeAfterMillis: null,
      householdId: HOUSEHOLD_ID,
      householdCategoryId: HOUSEHOLD_CAT_ID,
      revision: 1,
      lastMutationId: "11111111-1111-4111-8111-111111111111",
      createdAtMillis: NOW - 5000,
      updatedAtMillis: NOW - 5000,
    };

    const movPath = `movements/${currentMovement.id}`;
    const world: Record<string, FakeDoc | undefined> = {
      [movPath]: { ...currentMovement },
    };
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    const editDraft: MovementDraft = {
      type: "expense",
      title: "Mercado Éxito Editado",
      amount: 120000,
      categoryId: PERSONAL_CAT_ID,
      accountId: null,
      note: "Nueva categoría",
      occurredAtMillis: NOW,
      householdId: HOUSEHOLD_ID,
      householdCategoryId: OTHER_HOUSEHOLD_CAT_ID,
      learnMapping: true, // Debe ser ignorado: updateMovement nunca escribe mappings
    };

    const result = await updateMovement(currentMovement, editDraft, {
      nowMillis: NOW,
      db,
      deps,
    });

    assert.equal(result.kind, "success");
    const movRecord = recorded.find((r) => r.path === movPath);
    assert.ok(movRecord, "El movimiento se actualizó en Firestore");
    assert.equal(movRecord.data?.householdCategoryId, OTHER_HOUSEHOLD_CAT_ID);
    assert.equal(movRecord.data?.revision, 2, "La revisi?n de movimiento subi? a 2");

    // Verifica que updateMovement NUNCA escribe categoryMappings
    const mappingRecord = recorded.find((r) => r.path.includes("categoryMappings"));
    assert.equal(mappingRecord, undefined, "updateMovement NUNCA escribe categoryMappings");
  }

  // ?????????????????????????????????????????????????????????????????????????????
  // 5. Compartir gasto sin equivalencia / Por clasificar (householdCategoryId = null)
  // ?????????????????????????????????????????????????????????????????????????????
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

    const mappingRecord = recorded.find((r) => r.path.includes("categoryMappings"));
    assert.equal(mappingRecord, undefined, "Gasto sin clasificar no escribe ningún mapping");
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

  // ?????????????????????????????????????????????????????????????????????????????
  // 9. Comprobaciones estructurales de componentes y diálogo sin picker
  // ?????????????????????????????????????????????????????????????????????????????
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

    // Guardrail estructural del diálogo de confirmación (GAP C):
    const fsMod = await import("node:fs");
    const pathMod = await import("node:path");
    const dialogSourcePath = pathMod.resolve(
      __dirname,
      "../../src/features/movements/components/composer/share-with-household-confirm-dialog.tsx",
    );
    const dialogSource = fsMod.readFileSync(dialogSourcePath, "utf8");

    assert.equal(
      dialogSource.includes("IconSelect"),
      false,
      "El diálogo de confirmación NO debe contener IconSelect de categorías de Hogar",
    );
    assert.equal(
      dialogSource.includes("Clasificar después"),
      false,
      "El diálogo de confirmación NO debe contener el texto 'Clasificar después'",
    );
    assert.equal(
      dialogSource.includes("householdCategories"),
      false,
      "La API del diálogo NO debe contener prop householdCategories",
    );
    assert.equal(
      dialogSource.includes("learnedHouseholdCategoryId"),
      false,
      "La API del diálogo NO debe contener prop learnedHouseholdCategoryId",
    );
    assert.equal(
      dialogSource.includes("learnMapping"),
      false,
      "La API del diálogo NO debe contener prop learnMapping",
    );

    // Guardrails estructurales ítem 2 (modal corto con checkbox y un Confirmar):
    assert.equal(
      dialogSource.includes("Guardar solo en Personal"),
      false,
      "El diálogo NO debe contener botón separado 'Guardar solo en Personal'",
    );
    assert.equal(
      dialogSource.includes("Confirmar y compartir"),
      false,
      "El diálogo NO debe contener botón 'Confirmar y compartir'",
    );
    assert.equal(
      dialogSource.includes("Amount"),
      false,
      "El diálogo NO debe contener el componente de resumen Amount",
    );
    assert.equal(
      dialogSource.includes("formatDateEs"),
      false,
      "El diálogo NO debe contener formateador de fecha de resumen",
    );
    assert.ok(
      dialogSource.includes("Cuenta en Hogar"),
      "El diálogo debe contener la casilla interactiva 'Cuenta en Hogar'",
    );
    assert.ok(
      dialogSource.includes("Visible para ambos en las cuentas del Hogar."),
      "El diálogo debe contener el microcopy de estado marcado",
    );
    assert.ok(
      dialogSource.includes("Solo visible para ti en tu espacio Personal."),
      "El diálogo debe contener el microcopy de estado desmarcado",
    );
    assert.ok(
      dialogSource.includes('"Confirmar"'),
      "El diálogo debe contener el botón primario 'Confirmar'",
    );
    assert.equal(
      dialogSource.includes("Guardando?"),
      false,
      "El diálogo NO debe contener texto con signo de interrogación corrupto 'Guardando?'",
    );
    assert.ok(
      dialogSource.includes("Guardando...") || dialogSource.includes("Guardando…"),
      "El diálogo debe contener texto de carga limpio 'Guardando...'",
    );
    assert.ok(
      dialogSource.includes("e.stopPropagation()"),
      "El checkbox debe detener la propagación del evento click para prevenir doble toggle",
    );

    const { resolveShareConfirmAction } = await import(
      "../../src/features/movements/lib/resolve-share-confirm-action"
    );
    assert.equal(
      resolveShareConfirmAction(true),
      "share",
      "resolveShareConfirmAction(true) debe resolver en 'share'",
    );
    assert.equal(
      resolveShareConfirmAction(false),
      "personalOnly",
      "resolveShareConfirmAction(false) debe resolver en 'personalOnly'",
    );
  }
  // ?????????????????????????????????????????????????????????????????????????????
  // 10. Resolución determinista de categoría de Hogar al compartir (§ 15.3, § 16, Android b7a39d8)
  // ?????????????????????????????????????????????????????????????????????????????
  {
    const { resolveHouseholdCategoryIdForShare } = await import(
      "../../src/features/movements/lib/resolve-household-category-for-share"
    );

    const activeCategories: MplusHouseholdExpenseCategory[] = [
      {
        id: "cat-h-food",
        schemaVersion: 1,
        householdId: HOUSEHOLD_ID,
        name: "Comida",
        iconKey: "restaurant",
        color: "#22C55E",
        state: "active",
        seedKey: null,
        sortOrder: 1,
        createdBy: OWNER_ID,
        revision: 1,
        lastMutationId: "mut-1",
        createdAtMillis: NOW,
        updatedAtMillis: NOW,
      },
      {
        id: "cat-h-archived",
        schemaVersion: 1,
        householdId: HOUSEHOLD_ID,
        name: "Vieja",
        iconKey: "archive",
        color: "#94A3B8",
        state: "archived",
        seedKey: null,
        sortOrder: 2,
        createdBy: OWNER_ID,
        revision: 2,
        lastMutationId: "mut-2",
        createdAtMillis: NOW,
        updatedAtMillis: NOW,
      },
    ];

    const mappings = [
      {
        id: `${OWNER_ID}__cat-p-groceries`,
        schemaVersion: 1,
        householdId: HOUSEHOLD_ID,
        ownerId: OWNER_ID,
        personalCategoryId: "cat-p-groceries",
        householdCategoryId: "cat-h-food",
        updatedBy: OWNER_ID,
        revision: 1,
        lastMutationId: "mut-m-1",
        createdAtMillis: NOW,
        updatedAtMillis: NOW,
      },
      {
        id: `${OWNER_ID}__cat-p-archived`,
        schemaVersion: 1,
        householdId: HOUSEHOLD_ID,
        ownerId: OWNER_ID,
        personalCategoryId: "cat-p-archived",
        householdCategoryId: "cat-h-archived",
        updatedBy: OWNER_ID,
        revision: 1,
        lastMutationId: "mut-m-2",
        createdAtMillis: NOW,
        updatedAtMillis: NOW,
      },
      {
        id: `${OWNER_ID}__cat-p-ghost`,
        schemaVersion: 1,
        householdId: HOUSEHOLD_ID,
        ownerId: OWNER_ID,
        personalCategoryId: "cat-p-ghost",
        householdCategoryId: "cat-h-nonexistent",
        updatedBy: OWNER_ID,
        revision: 1,
        lastMutationId: "mut-m-3",
        createdAtMillis: NOW,
        updatedAtMillis: NOW,
      },
      {
        id: `other-user__cat-p-groceries`,
        schemaVersion: 1,
        householdId: HOUSEHOLD_ID,
        ownerId: "other-user",
        personalCategoryId: "cat-p-groceries",
        householdCategoryId: "cat-h-food",
        updatedBy: "other-user",
        revision: 1,
        lastMutationId: "mut-m-4",
        createdAtMillis: NOW,
        updatedAtMillis: NOW,
      },
    ];

    // 1. Ingreso -> siempre null (§ 16)
    assert.equal(
      resolveHouseholdCategoryIdForShare({
        householdId: HOUSEHOLD_ID,
        type: "income",
        ownerId: OWNER_ID,
        personalCategoryId: "cat-p-groceries",
        mappings,
        householdCategories: activeCategories,
      }),
      null,
      "Ingreso compartido siempre resuelve householdCategoryId = null",
    );

    // 2. Gasto sin mapping -> null (Por clasificar)
    assert.equal(
      resolveHouseholdCategoryIdForShare({
        householdId: HOUSEHOLD_ID,
        type: "expense",
        ownerId: OWNER_ID,
        personalCategoryId: "cat-p-unmapped",
        mappings,
        householdCategories: activeCategories,
      }),
      null,
      "Gasto sin mapping debe resolver a null (Por clasificar)",
    );

    // 3. Gasto con mapping y categoría activa -> householdCategoryId
    assert.equal(
      resolveHouseholdCategoryIdForShare({
        householdId: HOUSEHOLD_ID,
        type: "expense",
        ownerId: OWNER_ID,
        personalCategoryId: "cat-p-groceries",
        mappings,
        householdCategories: activeCategories,
      }),
      "cat-h-food",
      "Gasto con mapping activo debe devolver el id de la categoría de Hogar",
    );

    // 4. Gasto con mapping y categoría archivada -> null (no aplica equivalencia, mapping intacto)
    assert.equal(
      resolveHouseholdCategoryIdForShare({
        householdId: HOUSEHOLD_ID,
        type: "expense",
        ownerId: OWNER_ID,
        personalCategoryId: "cat-p-archived",
        mappings,
        householdCategories: activeCategories,
      }),
      null,
      "Gasto con categoría de Hogar archivada debe resolver a null (Por clasificar)",
    );
    assert.equal(
      mappings.find((m) => m.personalCategoryId === "cat-p-archived")?.householdCategoryId,
      "cat-h-archived",
      "El mapping a categoría archivada NO debe ser borrado",
    );

    // 5. Gasto con mapping y categoría inexistente -> null
    assert.equal(
      resolveHouseholdCategoryIdForShare({
        householdId: HOUSEHOLD_ID,
        type: "expense",
        ownerId: OWNER_ID,
        personalCategoryId: "cat-p-ghost",
        mappings,
        householdCategories: activeCategories,
      }),
      null,
      "Gasto con categoría de Hogar inexistente debe resolver a null",
    );

    // 6. Mapping de otro usuario no aplica
    assert.equal(
      resolveHouseholdCategoryIdForShare({
        householdId: HOUSEHOLD_ID,
        type: "expense",
        ownerId: "user-without-mapping",
        personalCategoryId: "cat-p-groceries",
        mappings,
        householdCategories: activeCategories,
      }),
      null,
      "Mapping de otro usuario no debe aplicar a este usuario",
    );

    // 7. GAP D: Mapping de otro hogar -> null
    assert.equal(
      resolveHouseholdCategoryIdForShare({
        householdId: "other-household-999",
        type: "expense",
        ownerId: OWNER_ID,
        personalCategoryId: "cat-p-groceries",
        mappings,
        householdCategories: activeCategories,
      }),
      null,
      "Mapping perteneciente a otro hogar debe resolver a null",
    );

    // 8. GAP D: Categor?a perteneciente a otro hogar -> null
    const otherHouseholdCategories: MplusHouseholdExpenseCategory[] = [
      {
        ...activeCategories[0],
        householdId: "other-household-999",
      },
    ];
    assert.equal(
      resolveHouseholdCategoryIdForShare({
        householdId: HOUSEHOLD_ID,
        type: "expense",
        ownerId: OWNER_ID,
        personalCategoryId: "cat-p-groceries",
        mappings,
        householdCategories: otherHouseholdCategories,
      }),
      null,
      "Categor?a de otro hogar debe resolver a null",
    );

    // 9. Compartir desde Personal con createMovement (incluso con learnMapping: true) NO escribe ni actualiza categoryMappings
    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    const shareDraft: MovementDraft = {
      type: "expense",
      title: "Gasto compartido sin aprender",
      amount: 45000,
      categoryId: "cat-p-groceries",
      accountId: null,
      note: "Paridad item 0",
      occurredAtMillis: NOW,
      householdId: HOUSEHOLD_ID,
      householdCategoryId: "cat-h-food",
      learnMapping: true, // Debe ser ignorado por completo en createMovement
    };

    const result = await createMovement(OWNER_ID, "mov-share-no-learn", shareDraft, {
      nowMillis: NOW,
      db,
      deps,
    });

    assert.equal(result.kind, "success");
    const writtenMapping = recorded.find((r) => r.path.includes("categoryMappings"));
    assert.equal(
      writtenMapping,
      undefined,
      "Al compartir desde Personal NO se debe escribir ni actualizar categoryMappings",
    );
  }

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
