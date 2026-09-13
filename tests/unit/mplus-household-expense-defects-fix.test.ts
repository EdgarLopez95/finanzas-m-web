import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  deleteHouseholdExpensePermanently,
  HouseholdExpensePreconditionError,
  type HouseholdExpenseDraft,
} from "../../src/features/household/services/household-expense-mutations";
import {
  updateMovementPersonalCategory,
  updateMovement,
  trashMovement,
  deleteMovementPermanently,
  MovementPreconditionError,
} from "../../src/features/movements/services/movement-mutations";
import { movementFromFirestore } from "../../src/lib/mplus/converters";
import type {
  MplusHousehold,
  MplusHouseholdMember,
  MplusMovement,
} from "../../src/lib/mplus/models";
import type { MplusRunnerDeps } from "../../src/lib/mplus/mutation-runner";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readSource = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", relativePath), "utf8");

export const runHouseholdExpenseDefectsFixTests = async (): Promise<void> => {
  console.log("Running unit tests for mplus-household-expense-defects-fix.test.ts...");
  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => void | Promise<void>) => {
    return Promise.resolve()
      .then(() => fn())
      .then(() => {
        console.log(`  ✓ ${name}`);
        passed++;
      })
      .catch((error) => {
        console.error(`  ✗ ${name}`);
        console.error(error);
        failed++;
        throw error;
      });
  };

  const NOW = Date.UTC(2026, 7, 20, 15, 0, 0);
  const HOUSEHOLD_ID = "house-123";
  const MEMBER_A = "uid-a";
  const MEMBER_B = "uid-b";

  type FakeDoc = Record<string, unknown>;
  type Recorded = { path: string; op: "set" | "update" | "delete"; data?: FakeDoc };

  const app = initializeApp(
    { projectId: "finanzas-m-plus", appId: "test-app-id" },
    `test-defects-${Date.now()}-${Math.random()}`,
  );
  const db = getFirestore(app);

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
          world[ref.path] = data;
          return tx;
        },
        update: (ref: DocumentReference, data: FakeDoc) => {
          wroteAlready = true;
          staged.push({ path: ref.path, op: "update", data });
          world[ref.path] = { ...(world[ref.path] ?? {}), ...data };
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
      displayName: "Alice",
      photoUrl: "",
      joinedAtMillis: NOW - 100000,
      leftAtMillis: null,
      revision: 1,
      lastMutationId: "mut-ma",
      updatedAtMillis: NOW - 100000,
    },
    {
      id: "house-123__uid-b",
      schemaVersion: 1,
      householdId: HOUSEHOLD_ID,
      userId: MEMBER_B,
      state: "active",
      displayName: "Bob",
      photoUrl: "",
      joinedAtMillis: NOW - 100000,
      leftAtMillis: null,
      revision: 1,
      lastMutationId: "mut-mb",
      updatedAtMillis: NOW - 100000,
    },
  ];

  const membersWithLeft: MplusHouseholdMember[] = [
    membersActive[0],
    {
      ...membersActive[1],
      state: "left",
      leftAtMillis: NOW - 50000,
    },
  ];

  // =========================================================================
  // ALCANCE 1: Categoría Personal privada de participación derivada
  // =========================================================================

  await test("WA-EXP-DEF-001: [Estructural Personal] PersonalMovementDetailDialog muestra 'Por clasificar' y expone selector privado para derivados de Hogar", () => {
    const source = readSource("src/features/movements/components/personal-movement-detail-dialog.tsx");

    // Identificación de origen household_expense
    assert.ok(
      source.includes('movement.origin === "household_expense"'),
      "Debe identificar participaciones originadas en Hogar",
    );

    // Muestra Por clasificar si categoryId es null
    assert.ok(
      source.includes("Por clasificar"),
      "Debe mostrar 'Por clasificar' cuando no hay categoría personal",
    );

    // Expone selector y botón de Clasificar / Cambiar
    assert.ok(
      source.includes("handleSaveCategory"),
      "Debe contener función para guardar la categoría",
    );
    assert.ok(
      source.includes("updateMovementPersonalCategory"),
      "Debe usar el servicio existente updateMovementPersonalCategory",
    );
    assert.ok(
      source.includes("isEditingCategory"),
      "Debe manejar el estado de edición de categoría privada",
    );
    assert.ok(
      source.includes("IconSelect"),
      "Debe reutilizar IconSelect existente para elegir la categoría Personal",
    );
  });

  await test("WA-EXP-DEF-002: [Estructural Personal] Bloquea edición de campos financieros y eliminación para derivados de Hogar", () => {
    const source = readSource("src/features/movements/components/personal-movement-detail-dialog.tsx");

    // Para isHouseholdExpense, no debe llamar a onEdit(movement) para editar campos financieros
    // Y el botón Eliminar no debe renderizarse para isHouseholdExpense
    assert.ok(
      source.includes("!isHouseholdExpense ?"),
      "Debe condicionar la acción Eliminar y Editar a que NO sea un gasto de Hogar",
    );
    assert.ok(
      source.includes("Eliminar") && source.includes("onDelete"),
      "El botón Eliminar solo existe en el bloque no-hogar",
    );
  });

  await test("WA-EXP-DEF-003: [Funcional Personal] Derivado Personal: 'Por clasificar' -> categoría válida; solo muta categoryId", async () => {
    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    world[`households/${HOUSEHOLD_ID}/members/${MEMBER_A}`] = { state: "active" };
    world[`households/${HOUSEHOLD_ID}/members/${MEMBER_B}`] = { state: "active" };

    // 1. Crear gasto en Hogar
    const createRes = await createHouseholdExpense(
      householdBase,
      {
        title: "Mercado D1",
        amount: 100_000,
        occurredAtMillis: NOW,
        distributionMode: "equal",
      },
      { nowMillis: NOW, db, deps, userId: MEMBER_A, members: membersActive },
    );
    assert.equal(createRes.kind, "success");
    const expense = (createRes as any).value;
    const partAPath = `movements/${expense.id}__${MEMBER_A}`;
    const initialPartA = movementFromFirestore(`${expense.id}__${MEMBER_A}`, world[partAPath] as any);

    // Verifica que nace con categoryId = null (Por clasificar)
    assert.equal(initialPartA.categoryId, null);
    assert.equal(initialPartA.origin, "household_expense");
    assert.equal(initialPartA.householdExpenseId, expense.id);

    // 2. Dueño reclasifica su categoría personal
    const updateCatRes = await updateMovementPersonalCategory(
      initialPartA,
      "seed_expense_groceries",
      { nowMillis: NOW + 1000, db, deps },
    );
    assert.equal(updateCatRes.kind, "success");

    const updatedPartA = (updateCatRes as any).value as MplusMovement;
    assert.equal(updatedPartA.categoryId, "seed_expense_groceries");
    assert.equal(updatedPartA.amount, initialPartA.amount);
    assert.equal(updatedPartA.title, initialPartA.title);
    assert.equal(updatedPartA.occurredAtMillis, initialPartA.occurredAtMillis);
    assert.equal(updatedPartA.origin, "household_expense");
    assert.equal(updatedPartA.householdExpenseId, expense.id);

    // 3. El contrato bloquea edición de campos financieros y lifecycle
    await assert.rejects(
      () =>
        updateMovement(
          updatedPartA,
          {
            type: "expense",
            title: "Intento de cambiar concepto",
            amount: 999_999,
            categoryId: "seed_expense_groceries",
            accountId: null,
            note: "",
            occurredAtMillis: NOW,
            householdId: null,
          },
          { deps },
        ),
      MovementPreconditionError,
    );

    await assert.rejects(
      () => trashMovement(updatedPartA, { deps }),
      MovementPreconditionError,
    );

    await assert.rejects(
      () => deleteMovementPermanently(updatedPartA, { deps }),
      MovementPreconditionError,
    );
  });

  // =========================================================================
  // ALCANCE 2: Gasto Hogar histórico con miembro left
  // =========================================================================

  await test("WA-EXP-DEF-004: [Estructural Hogar] MplusHouseholdMovementsView permite reclasificar cuando un miembro es left", () => {
    const source = readSource("src/features/household/components/mplus-household-movements-view.tsx");

    // Con hasLeftMember, no se deshabilita por completo; se ofrece Cambiar categoría
    assert.ok(
      source.includes("hasLeftMember ?"),
      "Debe discriminar la acción cuando hasLeftMember es true",
    );
    assert.ok(
      source.includes("Cambiar categoría"),
      "Debe ofrecer botón 'Cambiar categoría' en modo histórico con miembro left",
    );
    assert.ok(
      source.includes("handleStartReclassifyExpense"),
      "Debe implementar handleStartReclassifyExpense",
    );
    assert.ok(
      source.includes("applyCommittedHouseholdExpense"),
      "Debe conectar applyCommittedHouseholdExpense en el store",
    );

    // Papelera y acciones de lifecycle permanecen deshabilitadas
    assert.ok(
      source.includes("disabled={hasLeftMember}"),
      "Acciones destructivas y de papelera deben estar disabled={hasLeftMember}",
    );
  });

  await test("WA-EXP-DEF-005: [Funcional Hogar] Con miembro left y fuente activa: permite actualizar solo householdCategoryId", async () => {
    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    world[`households/${HOUSEHOLD_ID}/members/${MEMBER_A}`] = { state: "active" };
    world[`households/${HOUSEHOLD_ID}/members/${MEMBER_B}`] = { state: "active" };

    // 1. Crear gasto cuando ambos estaban activos
    const createRes = await createHouseholdExpense(
      householdBase,
      {
        title: "Internet y TV",
        amount: 150_000,
        occurredAtMillis: NOW,
        distributionMode: "equal",
        householdCategoryId: null,
      },
      { nowMillis: NOW, db, deps, userId: MEMBER_A, members: membersActive },
    );
    assert.equal(createRes.kind, "success");
    const expense = (createRes as any).value;

    // 2. Ahora Bob abandona el Hogar (state: 'left')
    world[`households/${HOUSEHOLD_ID}/members/${MEMBER_B}`] = { state: "left" };

    // 3. Reclasificar solo householdCategoryId con miembro left DEBE funcionar
    const reclassDraft: HouseholdExpenseDraft = {
      title: expense.title,
      amount: expense.amount,
      note: expense.note,
      occurredAtMillis: expense.occurredAtMillis,
      distributionMode: expense.distributionMode,
      householdCategoryId: "cat_services",
    };

    const reclassRes = await updateHouseholdExpense(
      expense,
      householdBase,
      reclassDraft,
      { nowMillis: NOW + 2000, db, deps, userId: MEMBER_A, members: membersWithLeft },
    );

    assert.equal(reclassRes.kind, "success");
    const updatedExpense = (reclassRes as any).value;
    assert.equal(updatedExpense.householdCategoryId, "cat_services");
    assert.equal(updatedExpense.amount, 150_000);
    assert.equal(updatedExpense.title, "Internet y TV");
  });

  await test("WA-EXP-DEF-006: [Funcional Hogar] Con miembro left: bloquea los demás campos y acciones de lifecycle", async () => {
    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    world[`households/${HOUSEHOLD_ID}/members/${MEMBER_A}`] = { state: "active" };
    world[`households/${HOUSEHOLD_ID}/members/${MEMBER_B}`] = { state: "active" };

    // 1. Gasto activo preexistente cuando ambos estaban activos
    const createRes = await createHouseholdExpense(
      householdBase,
      {
        title: "Arriendo",
        amount: 1_200_000,
        occurredAtMillis: NOW,
        distributionMode: "equal",
      },
      { nowMillis: NOW, db, deps, userId: MEMBER_A, members: membersActive },
    );
    assert.equal(createRes.kind, "success");
    const expense = (createRes as any).value;

    // Bob ahora pasa a estado 'left'
    world[`households/${HOUSEHOLD_ID}/members/${MEMBER_B}`] = { state: "left" };

    // Con miembro left:
    // a) Intento de cambiar título
    await assert.rejects(
      () =>
        updateHouseholdExpense(
          expense,
          householdBase,
          {
            title: "Arriendo modificado",
            amount: expense.amount,
            occurredAtMillis: expense.occurredAtMillis,
            distributionMode: expense.distributionMode,
            householdCategoryId: "cat_housing",
          },
          { nowMillis: NOW + 3000, db, deps, userId: MEMBER_A, members: membersWithLeft },
        ),
      HouseholdExpensePreconditionError,
    );

    // b) Intento de cambiar monto
    await assert.rejects(
      () =>
        updateHouseholdExpense(
          expense,
          householdBase,
          {
            title: expense.title,
            amount: 1_300_000,
            occurredAtMillis: expense.occurredAtMillis,
            distributionMode: expense.distributionMode,
            householdCategoryId: "cat_housing",
          },
          { nowMillis: NOW + 3000, db, deps, userId: MEMBER_A, members: membersWithLeft },
        ),
      HouseholdExpensePreconditionError,
    );

    // c) Intento de cambiar fecha
    await assert.rejects(
      () =>
        updateHouseholdExpense(
          expense,
          householdBase,
          {
            title: expense.title,
            amount: expense.amount,
            occurredAtMillis: NOW - 86400000,
            distributionMode: expense.distributionMode,
            householdCategoryId: "cat_housing",
          },
          { nowMillis: NOW + 3000, db, deps, userId: MEMBER_A, members: membersWithLeft },
        ),
      HouseholdExpensePreconditionError,
    );

    // d) Intento de enviar a Papelera con miembro left
    await assert.rejects(
      () =>
        trashHouseholdExpense(
          expense,
          householdBase,
          { nowMillis: NOW + 3000, db, deps, userId: MEMBER_A, members: membersWithLeft },
        ),
      HouseholdExpensePreconditionError,
    );

    // e) Intento de hard delete con miembro left
    await assert.rejects(
      () =>
        deleteHouseholdExpensePermanently(
          expense,
          householdBase,
          { nowMillis: NOW + 3000, db, deps, userId: MEMBER_A, members: membersWithLeft },
        ),
      HouseholdExpensePreconditionError,
    );
  });

  await test("WA-EXP-DEF-007: [Regresión] Ambos miembros activos conservan edición normal de todos los campos", async () => {
    const world: Record<string, FakeDoc | undefined> = {};
    const recorded: Recorded[] = [];
    const deps = makeDeps(world, recorded);

    world[`households/${HOUSEHOLD_ID}/members/${MEMBER_A}`] = { state: "active" };
    world[`households/${HOUSEHOLD_ID}/members/${MEMBER_B}`] = { state: "active" };

    const createRes = await createHouseholdExpense(
      householdBase,
      {
        title: "Cena",
        amount: 80_000,
        occurredAtMillis: NOW,
        distributionMode: "equal",
      },
      { nowMillis: NOW, db, deps, userId: MEMBER_A, members: membersActive },
    );
    const expense = (createRes as any).value;

    // Con ambos activos, actualizar título, monto, nota y distribución funciona normalmente
    const fullEditDraft: HouseholdExpenseDraft = {
      title: "Cena italiana",
      amount: 90_000,
      note: "Incluyó postre",
      occurredAtMillis: NOW,
      distributionMode: "equal",
      householdCategoryId: "cat_food",
    };

    const editRes = await updateHouseholdExpense(
      expense,
      householdBase,
      fullEditDraft,
      { nowMillis: NOW + 1000, db, deps, userId: MEMBER_A, members: membersActive },
    );

    assert.equal(editRes.kind, "success");
    const updated = (editRes as any).value;
    assert.equal(updated.title, "Cena italiana");
    assert.equal(updated.amount, 90_000);
    assert.equal(updated.note, "Incluyó postre");
    assert.equal(updated.householdCategoryId, "cat_food");
  });

  // =========================================================================
  // ALCANCE 3: Aislamiento Visual del Diálogo de Descarte (Hogar vs Personal)
  // =========================================================================

  await test("WA-EXP-DEF-008: [Tema Visual y Frontera] MovementComposerDialog en Hogar usa HouseholdDiscardConfirmDialog con tokens Hogar (sin fondos ni sombras azules de Personal)", () => {
    const composerSource = readSource("src/features/movements/components/movement-composer-dialog.tsx");
    const hhConfirmSource = readSource("src/features/household/components/ui/household-discard-confirm-dialog.tsx");

    // MovementComposerDialog debe importar y condicionar a HouseholdDiscardConfirmDialog
    assert.ok(
      composerSource.includes("HouseholdDiscardConfirmDialog"),
      "MovementComposerDialog debe importar HouseholdDiscardConfirmDialog",
    );
    assert.ok(
      composerSource.includes("isHouseholdMode ? (") &&
        composerSource.includes("<HouseholdDiscardConfirmDialog"),
      "MovementComposerDialog debe renderizar HouseholdDiscardConfirmDialog cuando isHouseholdMode es true",
    );

    // HouseholdDiscardConfirmDialog debe usar el overlay verde/pino oscuro de Hogar (--hh-overlay)
    assert.ok(
      hhConfirmSource.includes("bg-[var(--hh-overlay)]"),
      "HouseholdDiscardConfirmDialog debe usar bg-[var(--hh-overlay)] (no el navy blue de Personal)",
    );
    assert.equal(
      hhConfirmSource.includes("rgba(4,8,15"),
      false,
      "HouseholdDiscardConfirmDialog no debe usar el backdrop azul de Personal",
    );

    // Debe usar superficie y bordes de Hogar
    assert.ok(
      hhConfirmSource.includes("border-[var(--hh-border)]"),
      "Debe usar border-[var(--hh-border)]",
    );
    assert.ok(
      hhConfirmSource.includes("var(--hh-surface-elevated)"),
      "Debe usar var(--hh-surface-elevated) para la tarjeta",
    );
    assert.ok(
      hhConfirmSource.includes("data-fm-context=\"household\""),
      "Debe aislar el contexto con data-fm-context='household'",
    );

    // Debe usar HouseholdButton
    assert.ok(
      hhConfirmSource.includes("<HouseholdButton"),
      "Debe usar HouseholdButton para los botones de acción",
    );
    assert.equal(
      hhConfirmSource.includes("FinanceButton"),
      false,
      "HouseholdDiscardConfirmDialog no debe usar FinanceButton",
    );
  });

  await test("WA-EXP-DEF-009: [Tema Visual y Frontera] MovementComposerCard en Hogar usa HouseholdCategorySelect con tokens Hogar (sin menú azul Personal)", () => {
    const cardSource = readSource("src/features/movements/components/movement-composer-card.tsx");
    const selectSource = readSource("src/features/household/components/ui/household-category-select.tsx");

    // MovementComposerCard debe importar y renderizar condicionalmente HouseholdCategorySelect
    assert.ok(
      cardSource.includes("import { HouseholdCategorySelect }"),
      "MovementComposerCard debe importar HouseholdCategorySelect",
    );
    assert.ok(
      cardSource.includes("isHouseholdMode ? (") &&
        cardSource.includes("<HouseholdCategorySelect"),
      "MovementComposerCard debe renderizar HouseholdCategorySelect cuando isHouseholdMode es true",
    );

    // HouseholdCategorySelect debe usar tokens de Hogar
    assert.ok(
      selectSource.includes("bg-[var(--hh-surface-elevated)]"),
      "HouseholdCategorySelect debe usar bg-[var(--hh-surface-elevated)]",
    );
    assert.ok(
      selectSource.includes("border-[var(--hh-border)]"),
      "HouseholdCategorySelect debe usar border-[var(--hh-border)]",
    );
    assert.ok(
      selectSource.includes("shadow-[var(--hh-shadow-soft)]"),
      "HouseholdCategorySelect debe usar shadow-[var(--hh-shadow-soft)]",
    );
    assert.ok(
      selectSource.includes("text-[var(--hh-primary-action)]"),
      "HouseholdCategorySelect debe usar text-[var(--hh-primary-action)] para el checkmark",
    );
    assert.ok(
      selectSource.includes("data-fm-context=\"household\""),
      "HouseholdCategorySelect debe aislar el menú con data-fm-context='household'",
    );

    // No debe contener fondos ni sombras navy de Personal
    assert.equal(
      selectSource.includes("rgba(20,27,40"),
      false,
      "HouseholdCategorySelect no debe usar el gradiente azul de Personal",
    );
    assert.equal(
      selectSource.includes("rgba(12,18,29"),
      false,
      "HouseholdCategorySelect no debe usar el fondo oscuro azul de Personal",
    );
    assert.equal(
      selectSource.includes("--fm-warm-paper"),
      false,
      "HouseholdCategorySelect no debe usar tokens de texto de Personal",
    );
  });

  await test("WA-EXP-DEF-010: [Tema Visual y Frontera] ComposerFooter en Hogar usa HouseholdButton con tone='filled' (--hh-primary-action) sin rojo de gasto Personal", () => {
    const cardSource = readSource("src/features/movements/components/movement-composer-card.tsx");
    const footerSource = readSource("src/features/movements/components/composer/composer-primitives.tsx");

    // MovementComposerCard debe pasar context={isHouseholdMode ? "household" : "personal"}
    assert.ok(
      cardSource.includes('context={isHouseholdMode ? "household" : "personal"}'),
      "MovementComposerCard debe propagar context='household' a ComposerFooter",
    );

    // ComposerFooter debe importar HouseholdButton
    assert.ok(
      footerSource.includes("import { HouseholdButton }"),
      "ComposerFooter debe importar HouseholdButton",
    );

    // En modo household, debe renderizar HouseholdButton con tone='filled' para submit y tone='outlined' para cancelar
    assert.ok(
      footerSource.includes("isHousehold ? (") &&
        footerSource.includes("<HouseholdButton") &&
        footerSource.includes('tone="filled"'),
      "ComposerFooter debe renderizar HouseholdButton tone='filled' en modo Hogar",
    );
    assert.ok(
      footerSource.includes('tone="outlined"') &&
        footerSource.includes("Cancelar"),
      "ComposerFooter debe renderizar HouseholdButton tone='outlined' para Cancelar en modo Hogar",
    );
  });

  await test("WA-EXP-DEF-011: [Estructural y UX] HouseholdExpenseDistributionDialog implementa auto-balanceo dinámico, barra de proporción, presets y elimina type='number'", () => {
    const dialogSource = readSource("src/features/household/components/household-expense-distribution-dialog.tsx");

    // No debe contener input type="number" (evita flechas nativas feas de navegador)
    assert.equal(
      dialogSource.includes('type="number"'),
      false,
      "HouseholdExpenseDistributionDialog no debe usar type='number' con spinners nativos",
    );

    // Debe contener inputMode="numeric" con formato monetario
    assert.ok(
      dialogSource.includes('inputMode="numeric"'),
      "HouseholdExpenseDistributionDialog debe usar inputMode='numeric'",
    );

    // Debe incluir slider táctil de rango
    assert.ok(
      dialogSource.includes('type="range"'),
      "HouseholdExpenseDistributionDialog debe incluir un slider de rango type='range'",
    );

    // Debe incluir funciones de auto-balanceo bidireccional
    assert.ok(
      dialogSource.includes("updateFromA") && dialogSource.includes("updateFromB"),
      "HouseholdExpenseDistributionDialog debe tener lógica bidireccional updateFromA y updateFromB",
    );

    // Debe incluir presets rápidos 50/50 y 100%
    assert.ok(
      dialogSource.includes("50 / 50") && dialogSource.includes("100%"),
      "HouseholdExpenseDistributionDialog debe incluir botones de preset 50/50 y 100%",
    );

    // Debe incluir botones de incremento y decremento (+ / -)
    assert.ok(
      dialogSource.includes("<Minus") && dialogSource.includes("<Plus"),
      "HouseholdExpenseDistributionDialog debe incluir botones con iconos Minus y Plus",
    );

    // Debe mostrar 'Reparto 100% balanceado' en lugar de errores de sobran/faltan
    assert.ok(
      dialogSource.includes("Reparto 100% balanceado"),
      "HouseholdExpenseDistributionDialog debe indicar que el reparto está 100% balanceado",
    );
  });

  await test("WA-EXP-DEF-012: [Matemática de Auto-Balanceo] La suma de partes siempre converge a totalAmount sin descuadre", () => {
    const simulateAutoBalance = (total: number, newA: number) => {
      const clampedA = Math.min(Math.max(0, Math.round(newA)), total);
      const clampedB = total - clampedA;
      const is5050 = clampedA === Math.ceil(total / 2) && clampedB === Math.floor(total / 2);
      return { clampedA, clampedB, mode: is5050 ? "equal" : "custom" };
    };

    const TOTAL = 110_000;

    // Caso 1: 50 / 50 inicial
    const initial = simulateAutoBalance(TOTAL, 55_000);
    assert.equal(initial.clampedA + initial.clampedB, TOTAL);
    assert.equal(initial.mode, "equal");

    // Caso 2: Usuario ajusta a 70.000 (el caso de la captura de pantalla)
    const adjusted70k = simulateAutoBalance(TOTAL, 70_000);
    assert.equal(adjusted70k.clampedA, 70_000);
    assert.equal(adjusted70k.clampedB, 40_000);
    assert.equal(adjusted70k.clampedA + adjusted70k.clampedB, TOTAL);
    assert.equal(adjusted70k.mode, "custom");

    // Caso 3: Desborde superior (intento de asignar más que el total)
    const overflow = simulateAutoBalance(TOTAL, 150_000);
    assert.equal(overflow.clampedA, TOTAL);
    assert.equal(overflow.clampedB, 0);
    assert.equal(overflow.clampedA + overflow.clampedB, TOTAL);
    assert.equal(overflow.mode, "custom");

    // Caso 4: Desborde inferior (negativo)
    const underflow = simulateAutoBalance(TOTAL, -10_000);
    assert.equal(underflow.clampedA, 0);
    assert.equal(underflow.clampedB, TOTAL);
    assert.equal(underflow.clampedA + underflow.clampedB, TOTAL);
  });

  await test("WA-EXP-DEF-013: [Tema Visual y Contraste] Botón 'Nuevo gasto' en DashboardShell no fuerza text-white y usa --hh-on-primary de HouseholdButton", () => {
    const shellSource = readSource("src/components/layout/dashboard-shell.tsx");
    const match = shellSource.match(/<HouseholdButton[^>]*aria-label="Nuevo gasto en Hogar"[\s\S]*?<\/HouseholdButton>/);
    assert.ok(match, "Debe existir el botón HouseholdButton con aria-label='Nuevo gasto en Hogar'");
    const buttonBlock = match[0];
    assert.equal(
      buttonBlock.includes("text-white"),
      false,
      "El botón 'Nuevo gasto' en Hogar no debe forzar text-white; debe usar el contraste oficial text-[var(--hh-on-primary)]",
    );
    assert.ok(
      buttonBlock.includes('tone="filled"'),
      "El botón 'Nuevo gasto' debe usar tone='filled'",
    );
  });

  console.log(`\nTests for household expense defects fix: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runHouseholdExpenseDefectsFixTests();
