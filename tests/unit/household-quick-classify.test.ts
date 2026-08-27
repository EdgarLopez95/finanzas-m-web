import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type Transaction,
} from "firebase/firestore";

import type {
  MplusCategoryMapping,
  MplusHouseholdExpenseCategory,
  MplusHouseholdMember,
  MplusMemberCategoryLabel,
  MplusMovement,
  MplusPersonalCategory,
} from "../../src/lib/mplus/models";
import { categoryMappingToFirestore, movementToFirestore } from "../../src/lib/mplus/converters";
import type { MplusRunnerDeps } from "../../src/lib/mplus/mutation-runner";
import { correctPartnerMovementCategory } from "../../src/features/household/services/read-household-movements";

export const runHouseholdQuickClassifyTests = async () => {
  console.log("Running unit tests for household-quick-classify.test.ts...");
  let passed = 0;
  let failed = 0;

  const test = async (name: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(err);
      failed++;
    }
  };

  // Firestore local para construir referencias
  const db: Firestore = getFirestore(
    initializeApp({ apiKey: "dummy", projectId: "dummy" }, "mplus-quick-classify-test-" + Date.now()),
  );

  // --- Fixtures & Mocks ---
  const householdId = "house_abc";
  const userA_id = "user_felipe";
  const userB_id = "user_camila";

  const memberA: MplusHouseholdMember = {
    id: "mem_a",
    schemaVersion: 1,
    householdId,
    userId: userA_id,
    state: "active",
    displayName: "Felipe",
    photoUrl: "https://photos/felipe.png",
    joinedAtMillis: 1000,
    leftAtMillis: null,
    revision: 1,
    lastMutationId: "m1",
    updatedAtMillis: 1000,
  };

  const memberB: MplusHouseholdMember = {
    id: "mem_b",
    schemaVersion: 1,
    householdId,
    userId: userB_id,
    state: "active",
    displayName: "Camila",
    photoUrl: "https://photos/camila.png",
    joinedAtMillis: 1000,
    leftAtMillis: null,
    revision: 1,
    lastMutationId: "m1",
    updatedAtMillis: 1000,
  };

  const categories: MplusHouseholdExpenseCategory[] = [
    {
      id: "hh_mercado",
      schemaVersion: 1,
      householdId,
      name: "Mercado",
      iconKey: "groceries",
      color: "#22C55E",
      state: "active",
      seedKey: null,
      sortOrder: 1,
      createdBy: userA_id,
      createdAtMillis: 1000,
      updatedAtMillis: 1000,
      revision: 1,
      lastMutationId: "m1",
    },
    {
      id: "hh_servicios",
      schemaVersion: 1,
      householdId,
      name: "Servicios",
      iconKey: "utilities",
      color: "#3B82F6",
      state: "active",
      seedKey: null,
      sortOrder: 2,
      createdBy: userA_id,
      createdAtMillis: 1000,
      updatedAtMillis: 1000,
      revision: 1,
      lastMutationId: "m1",
    },
  ];

  const personalCategories: MplusPersonalCategory[] = [
    {
      id: "pers_supermercado",
      schemaVersion: 1,
      ownerId: userA_id,
      name: "Supermercado",
      type: "expense",
      iconKey: "groceries",
      color: "#22C55E",
      state: "active",
      seedKey: null,
      sortOrder: 1,
      createdAtMillis: 1000,
      updatedAtMillis: 1000,
      revision: 1,
      lastMutationId: "m1",
    },
  ];

  const categoryLabels: MplusMemberCategoryLabel[] = [
    {
      id: "lbl_b1",
      schemaVersion: 1,
      householdId,
      ownerId: userB_id,
      categoryId: "pers_partner_mercado",
      name: "Mercado Camila",
      iconKey: "groceries",
      color: "#F59E0B",
      type: "expense",
      revision: 1,
      lastMutationId: "m1",
      createdAtMillis: 1000,
      updatedAtMillis: 1000,
    },
  ];

  const mockMovements: MplusMovement[] = [
    {
      id: "mov_unclass_1",
      ownerId: userA_id,
      householdId,
      type: "expense",
      title: "Éxito Calle 80",
      amount: 150_000,
      categoryId: "pers_supermercado",
      accountId: "acc_1",
      note: "",
      occurredAtMillis: 1700000000000,
      householdCategoryId: null,
      lifecycleState: "active",
      trashedAtMillis: null,
      purgeAfterMillis: null,
      revision: 1,
      schemaVersion: 1,
      lastMutationId: "mut_1",
      createdAtMillis: 1700000000000,
      updatedAtMillis: 1700000000000,
    },
    {
      id: "mov_unclass_2",
      ownerId: userB_id,
      householdId,
      type: "expense",
      title: "Enel Colombia",
      amount: 80_000,
      categoryId: "pers_partner_mercado",
      accountId: "acc_2",
      note: "",
      occurredAtMillis: 1700001000000,
      householdCategoryId: null,
      lifecycleState: "active",
      trashedAtMillis: null,
      purgeAfterMillis: null,
      revision: 1,
      schemaVersion: 1,
      lastMutationId: "mut_2",
      createdAtMillis: 1700001000000,
      updatedAtMillis: 1700001000000,
    },
    {
      id: "mov_classified",
      ownerId: userA_id,
      householdId,
      type: "expense",
      title: "Gas Natural",
      amount: 50_000,
      categoryId: "pers_supermercado",
      accountId: "acc_1",
      note: "",
      occurredAtMillis: 1700002000000,
      householdCategoryId: "hh_servicios",
      lifecycleState: "active",
      trashedAtMillis: null,
      purgeAfterMillis: null,
      revision: 1,
      schemaVersion: 1,
      lastMutationId: "mut_3",
      createdAtMillis: 1700002000000,
      updatedAtMillis: 1700002000000,
    },
    {
      id: "mov_trashed",
      ownerId: userA_id,
      householdId,
      type: "expense",
      title: "Gasto borrado",
      amount: 20_000,
      categoryId: "pers_supermercado",
      accountId: "acc_1",
      note: "",
      occurredAtMillis: 1700003000000,
      householdCategoryId: null,
      lifecycleState: "trashed",
      trashedAtMillis: 1700003000000,
      purgeAfterMillis: 1700003000000 + 30 * 86400000,
      revision: 1,
      schemaVersion: 1,
      lastMutationId: "mut_4",
      createdAtMillis: 1700003000000,
      updatedAtMillis: 1700003000000,
    },
    {
      id: "mov_income",
      ownerId: userA_id,
      householdId,
      type: "income",
      title: "Salario",
      amount: 2_000_000,
      categoryId: "pers_salario",
      accountId: "acc_1",
      note: "",
      occurredAtMillis: 1700004000000,
      householdCategoryId: null,
      lifecycleState: "active",
      trashedAtMillis: null,
      purgeAfterMillis: null,
      revision: 1,
      schemaVersion: 1,
      lastMutationId: "mut_5",
      createdAtMillis: 1700004000000,
      updatedAtMillis: 1700004000000,
    },
  ];

  type FakeDoc = { revision?: number; lastMutationId?: string } & Record<string, unknown>;
  type FakeWorld = Record<string, FakeDoc | undefined>;

  const makeDeps = (
    world: FakeWorld,
    recorded: Array<{ path: string; op: "set" | "update" | "delete"; data?: unknown }>,
  ): MplusRunnerDeps => ({
    runTransaction: (async <T>(_db: Firestore, fn: (tx: Transaction) => Promise<T>) => {
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
          recorded.push({ path: ref.path, op: "set", data });
          world[ref.path] = data as FakeDoc;
          return tx;
        },
        delete: (ref: DocumentReference) => {
          recorded.push({ path: ref.path, op: "delete" });
          delete world[ref.path];
          return tx;
        },
        update: (ref: DocumentReference, data: unknown) => {
          recorded.push({ path: ref.path, op: "update", data });
          world[ref.path] = { ...world[ref.path], ...(data as object) } as FakeDoc;
          return tx;
        },
      } as unknown as Transaction;
      return fn(tx);
    }) as unknown as MplusRunnerDeps["runTransaction"],
  });

  // --- Tests ---

  await test("WA-HOU-QCLS-001: Filtra exclusivamente gastos compartidos activos sin householdCategoryId", () => {
    const unclassified = mockMovements.filter(
      (m) =>
        m.type === "expense" &&
        m.lifecycleState === "active" &&
        m.householdCategoryId === null,
    );

    assert.equal(unclassified.length, 2);
    assert.equal(unclassified[0].id, "mov_unclass_1");
    assert.equal(unclassified[1].id, "mov_unclass_2");
  });

  await test("WA-HOU-QCLS-002: Clasifica gasto y crea mapping atómico para futuros gastos", async () => {
    const movement = mockMovements[0]; // owner: userA_id, categoryId: pers_supermercado
    const world: FakeWorld = {
      [`movements/${movement.id}`]: movementToFirestore(movement),
    };
    const recorded: Array<{ path: string; op: "set" | "update" | "delete"; data?: unknown }> = [];
    const deps = makeDeps(world, recorded);

    const outcome = await correctPartnerMovementCategory(
      {
        householdId,
        movement,
        targetHouseholdCategoryId: "hh_mercado",
        updatedByUid: userA_id,
      },
      { db, deps },
    );

    assert.equal(outcome.kind, "success");
    if (outcome.kind === "success") {
      assert.equal(outcome.value.updatedMovement.householdCategoryId, "hh_mercado");
      assert.equal(outcome.value.updatedMovement.revision, 2);
      assert.equal(outcome.value.mapping.householdCategoryId, "hh_mercado");
      assert.equal(outcome.value.mapping.ownerId, userA_id);
      assert.equal(outcome.value.mapping.personalCategoryId, "pers_supermercado");
    }
  });

  await test("WA-HOU-QCLS-003: Idempotencia: no reescribe mapping si ya apunta a la misma categoría", async () => {
    const movement = mockMovements[0];
    const mappingKey = `${userA_id}__pers_supermercado`;
    const existingMapping: MplusCategoryMapping = {
      id: mappingKey,
      householdId,
      ownerId: userA_id,
      personalCategoryId: "pers_supermercado",
      householdCategoryId: "hh_mercado",
      updatedBy: userA_id,
      revision: 1,
      schemaVersion: 1,
      lastMutationId: "mut_prev",
      createdAtMillis: 1000,
      updatedAtMillis: 1000,
    };

    const world: FakeWorld = {
      [`movements/${movement.id}`]: movementToFirestore(movement),
      [`households/${householdId}/categoryMappings/${mappingKey}`]: categoryMappingToFirestore(existingMapping),
    };
    const recorded: Array<{ path: string; op: "set" | "update" | "delete"; data?: unknown }> = [];
    const deps = makeDeps(world, recorded);

    const outcome = await correctPartnerMovementCategory(
      {
        householdId,
        movement,
        targetHouseholdCategoryId: "hh_mercado", // Misma que existingMapping
        updatedByUid: userB_id,
      },
      { db, deps },
    );

    assert.equal(outcome.kind, "success");
    const mappingWrites = recorded.filter((r) => r.path.includes("categoryMappings"));
    assert.equal(mappingWrites.length, 0, "No debe reescribir un mapping idéntico");
  });

  await test("WA-HOU-QCLS-004: Pareja puede clasificar gasto ajeno de forma segura", async () => {
    const movement = mockMovements[1]; // Gasto de Camila (userB_id)
    const world: FakeWorld = {
      [`movements/${movement.id}`]: movementToFirestore(movement),
    };
    const recorded: Array<{ path: string; op: "set" | "update" | "delete"; data?: unknown }> = [];
    const deps = makeDeps(world, recorded);

    const outcome = await correctPartnerMovementCategory(
      {
        householdId,
        movement,
        targetHouseholdCategoryId: "hh_servicios",
        updatedByUid: userA_id, // Felipe clasifica el gasto de Camila
      },
      { db, deps },
    );

    assert.equal(outcome.kind, "success");
    if (outcome.kind === "success") {
      assert.equal(outcome.value.updatedMovement.householdCategoryId, "hh_servicios");
      assert.equal(outcome.value.mapping.updatedBy, userA_id);
    }
  });

  await test("WA-HOU-QCLS-005: [Estructural] Overview conecta el botón y la barra 'Por clasificar' con HouseholdQuickClassifyDialog", () => {
    const overviewSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "household", "components", "mplus-household-overview.tsx"),
      "utf8",
    );

    // 1. Importa y renderiza HouseholdQuickClassifyDialog
    assert.ok(
      overviewSource.includes("HouseholdQuickClassifyDialog"),
      "Debe importar y renderizar HouseholdQuickClassifyDialog",
    );

    // 2. Estado de apertura
    assert.ok(
      overviewSource.includes("isQuickClassifyOpen"),
      "Debe manejar el estado isQuickClassifyOpen",
    );

    // 3. Botón de banner abre el modal sin navegar
    assert.ok(
      overviewSource.includes("onClick={() => setIsQuickClassifyOpen(true)}"),
      "El botón 'Clasificar gastos' debe abrir el modal en lugar de navegar",
    );

    // 4. Clic en 'unclassified' en el gráfico abre el modal
    assert.ok(
      overviewSource.includes('categoryId === "unclassified" || item.isUnclassified'),
      "El clic sobre 'Por clasificar' debe abrir el modal",
    );
    assert.ok(
      overviewSource.includes("setIsQuickClassifyOpen(true)"),
      "onSelectCategory debe invocar setIsQuickClassifyOpen(true) para unclassified",
    );
  });

  await test("WA-HOU-QCLS-006: [Estructural] HouseholdQuickClassifyDialog renderiza detalle, contexto y selección de categorías", () => {
    const dialogSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "household", "components", "household-quick-classify-dialog.tsx"),
      "utf8",
    );

    // 1. Uso de componentes y tokens de Hogar
    assert.ok(dialogSource.includes("HouseholdDialog"), "Debe usar HouseholdDialog");
    assert.ok(dialogSource.includes("HouseholdAmount"), "Debe usar HouseholdAmount");
    assert.ok(dialogSource.includes("HouseholdButton"), "Debe usar HouseholdButton");
    assert.ok(dialogSource.includes("ProfileAvatar"), "Debe usar ProfileAvatar para responsable");
    assert.ok(dialogSource.includes("--hh-"), "Debe usar tokens CSS --hh-*");

    // 2. Progreso secuencial
    assert.ok(
      dialogSource.includes("currentIndex"),
      "Debe gestionar el índice actual de la cola",
    );
    assert.ok(
      dialogSource.includes("por clasificar"),
      "Debe mostrar indicador de progreso en el subtítulo",
    );

    // 3. Contexto personal original
    assert.ok(
      dialogSource.includes("resolvePersonalCategoryName"),
      "Debe resolver y mostrar el nombre de la categoría personal original como contexto",
    );

    // 4. Creación de categoría inline con HouseholdCategoryDialog
    assert.ok(
      dialogSource.includes("HouseholdCategoryDialog"),
      "Debe permitir crear una nueva categoría de hogar inline con HouseholdCategoryDialog",
    );
    assert.ok(
      dialogSource.includes("handleCategoryCreated"),
      "Al crear la categoría, debe clasificar inmediatamente el gasto actual",
    );

    // 5. Acción de omitir / clasificar después
    assert.ok(
      dialogSource.includes("handleSkip"),
      "Debe soportar 'Clasificar después' sin modificar datos",
    );
  });

  await test("WA-HOU-QCLS-007: Conflicto OCC por cambio remoto conserva el documento y devuelve conflict", async () => {
    const movement = mockMovements[0];
    const world: FakeWorld = {
      // Documento en Firestore con revisión superior a la base del cliente
      [`movements/${movement.id}`]: movementToFirestore({
        ...movement,
        revision: movement.revision + 1,
      }),
    };
    const recorded: Array<{ path: string; op: "set" | "update" | "delete"; data?: unknown }> = [];
    const deps = makeDeps(world, recorded);

    const outcome = await correctPartnerMovementCategory(
      {
        householdId,
        movement, // Tiene revision base = 1, pero remoto = 2
        targetHouseholdCategoryId: "hh_mercado",
        updatedByUid: userA_id,
      },
      { db, deps },
    );

    assert.equal(outcome.kind, "conflict");
    assert.equal(recorded.length, 0, "No debe escribir nada ante un conflicto OCC");
  });

  await test("WA-HOU-QCLS-008: [Estructural] Diálogo maneja estado vacío cuando no hay gastos pendientes", () => {
    const dialogSource = readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "household", "components", "household-quick-classify-dialog.tsx"),
      "utf8",
    );

    assert.ok(
      dialogSource.includes("¡Todo al día!"),
      "Debe mostrar mensaje amigable de todo al día",
    );
    assert.ok(
      dialogSource.includes("No tienes gastos compartidos pendientes por clasificar"),
      "Debe explicar que no hay gastos pendientes",
    );
  });

  console.log(`\nTests for household-quick-classify: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runHouseholdQuickClassifyTests();
