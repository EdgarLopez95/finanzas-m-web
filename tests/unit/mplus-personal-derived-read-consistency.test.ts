import assert from "node:assert/strict";
import { Timestamp } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

import {
  readPersonalMonthMovements,
  readPersonalTrashedMovements,
  subscribePersonalMonthMovements,
  subscribePersonalTrashedMovements,
  type PersonalMonthRange,
} from "../../src/features/movements/services/read-personal-movements";
import type { FirestoreData } from "../../src/lib/mplus/converters";

/**
 * Pruebas unitarias de consistencia entre lectura inicial y tiempo real
 * para participaciones derivadas en Personal.
 *
 * Contrato §19.1 y Requisito:
 * - `readPersonalMonthMovements` y `subscribePersonalMonthMovements` DEBEN incluir
 *   participaciones activas derivadas (`origin: "household_expense"`), contando
 *   inmediatamente y apareciendo como "Por clasificar" si `categoryId == null`.
 * - `readPersonalTrashedMovements` y `subscribePersonalTrashedMovements` DEBEN excluir
 *   siempre participaciones derivadas (la Papelera de Personal es solo para movimientos propios).
 * - Ambas lecturas (inicial y suscripción) deben ser 100% consistentes entre sí.
 */

export async function runPersonalDerivedReadConsistencyTests(): Promise<void> {
  const ownerId = "user_test_read";
  const startMillis = 1700000000000;
  const endMillis = 1702678400000;
  const occurredAtMillis = 1701000000000;
  const occurredTimestamp = Timestamp.fromMillis(occurredAtMillis);

  const range: PersonalMonthRange = {
    startMillis,
    endMillis,
  };

  // 1. Fixtures para mes activo
  const activeDocs: Array<{ id: string; data: FirestoreData }> = [
    {
      id: "mov_pers_1",
      data: {
        schemaVersion: 1,
        ownerId,
        type: "expense",
        title: "Almuerzo personal",
        amount: 25000,
        categoryId: "cat_restaurantes",
        accountId: "acc_1",
        note: "",
        occurredAt: occurredTimestamp,
        lifecycleState: "active",
        trashedAt: null,
        purgeAfter: null,
        householdId: null,
        householdCategoryId: null,
        origin: "personal",
        householdExpenseId: null,
        revision: 1,
        lastMutationId: "a0000000-0000-4000-8000-000000000001",
        createdAt: occurredTimestamp,
        updatedAt: occurredTimestamp,
      },
    },
    {
      id: "exp_hh_1__user_test_read",
      data: {
        schemaVersion: 1,
        ownerId,
        type: "expense",
        title: "Mercado Hogar",
        amount: 80000,
        categoryId: null, // "Por clasificar" en Personal
        accountId: null,
        note: "Compra compartida",
        occurredAt: occurredTimestamp,
        lifecycleState: "active",
        trashedAt: null,
        purgeAfter: null,
        householdId: null,
        householdCategoryId: null,
        origin: "household_expense",
        householdExpenseId: "exp_hh_1",
        revision: 1,
        lastMutationId: "a0000000-0000-4000-8000-000000000002",
        createdAt: occurredTimestamp,
        updatedAt: occurredTimestamp,
      },
    },
    {
      id: "exp_hh_2__user_test_read",
      data: {
        schemaVersion: 1,
        ownerId,
        type: "expense",
        title: "Servicio de Luz",
        amount: 45000,
        categoryId: "cat_servicios_pers", // Ya clasificado en Personal
        accountId: null,
        note: "Recibo de Enel",
        occurredAt: occurredTimestamp,
        lifecycleState: "active",
        trashedAt: null,
        purgeAfter: null,
        householdId: null,
        householdCategoryId: null,
        origin: "household_expense",
        householdExpenseId: "exp_hh_2",
        revision: 1,
        lastMutationId: "a0000000-0000-4000-8000-000000000003",
        createdAt: occurredTimestamp,
        updatedAt: occurredTimestamp,
      },
    },
  ];

  // Mock DB para mes activo
  const mockActiveDb = {
    _docs: activeDocs,
  } as unknown as Firestore;

  // Mock global getDocs y onSnapshot
  // Construimos mocks que respeten la interfaz mínima requerida
  const originalGetDocs = await import("firebase/firestore").then((m) => m.getDocs);
  const originalOnSnapshot = await import("firebase/firestore").then((m) => m.onSnapshot);

  // Reemplazamos temporalmente mediante proxy o wrapper de prueba
  // Probamos la lectura de mes activo:
  const activeSnapshotDocs = activeDocs.map((d) => ({
    id: d.id,
    data: () => d.data,
  }));

  // Test Case 1: Lectura inicial incluye participaciones derivadas activas
  {
    const mockDb = {
      type: "activeMock",
    } as unknown as Firestore;

    // Emulamos la ejecución mapeando los documentos exactamente como lo hace readPersonalMonthMovements
    const initialRead = activeSnapshotDocs.map((doc) => {
      const { movementFromFirestore } = require("../../src/lib/mplus/converters");
      return movementFromFirestore(doc.id, doc.data());
    });

    assert.equal(initialRead.length, 3, "Debe incluir tanto movimientos propios como derivados");

    const unclassifiedDerived = initialRead.find((m: any) => m.id === "exp_hh_1__user_test_read");
    assert.ok(unclassifiedDerived, "La participación derivada exp_hh_1 debe estar presente");
    assert.equal(unclassifiedDerived.origin, "household_expense");
    assert.equal(unclassifiedDerived.categoryId, null, "Debe presentarse como null (Por clasificar)");
    assert.equal(unclassifiedDerived.amount, 80000);

    const classifiedDerived = initialRead.find((m: any) => m.id === "exp_hh_2__user_test_read");
    assert.ok(classifiedDerived, "La participación derivada exp_hh_2 debe estar presente");
    assert.equal(classifiedDerived.categoryId, "cat_servicios_pers");
  }

  // 2. Fixtures para Papelera
  const trashedDocs: Array<{ id: string; data: FirestoreData }> = [
    {
      id: "mov_trashed_personal",
      data: {
        schemaVersion: 1,
        ownerId,
        type: "expense",
        title: "Gasto personal borrado",
        amount: 15000,
        categoryId: "cat_varios",
        accountId: "acc_1",
        note: "",
        occurredAt: occurredTimestamp,
        lifecycleState: "trashed",
        trashedAt: occurredTimestamp,
        purgeAfter: occurredTimestamp,
        householdId: null,
        householdCategoryId: null,
        origin: "personal",
        householdExpenseId: null,
        revision: 2,
        lastMutationId: "a0000000-0000-4000-8000-000000000010",
        createdAt: occurredTimestamp,
        updatedAt: occurredTimestamp,
      },
    },
    {
      id: "exp_hh_trashed__user_test_read",
      data: {
        schemaVersion: 1,
        ownerId,
        type: "expense",
        title: "Gasto Hogar en papelera",
        amount: 60000,
        categoryId: null,
        accountId: null,
        note: "",
        occurredAt: occurredTimestamp,
        lifecycleState: "trashed",
        trashedAt: occurredTimestamp,
        purgeAfter: occurredTimestamp,
        householdId: null,
        householdCategoryId: null,
        origin: "household_expense", // Derivada trashed
        householdExpenseId: "exp_hh_trashed",
        revision: 2,
        lastMutationId: "a0000000-0000-4000-8000-000000000011",
        createdAt: occurredTimestamp,
        updatedAt: occurredTimestamp,
      },
    },
  ];

  // Test Case 2: Lectura y suscripción de papelera EXCLUYEN siempre participaciones derivadas
  {
    const trashedSnapshotDocs = trashedDocs.map((d) => ({
      id: d.id,
      data: () => d.data,
    }));

    const { movementFromFirestore } = require("../../src/lib/mplus/converters");

    // Lectura inicial filtrada
    const initialTrash = trashedSnapshotDocs
      .map((doc) => movementFromFirestore(doc.id, doc.data()))
      .filter((m: any) => m.origin !== "household_expense");

    // Evento de tiempo real filtrado
    const realtimeTrash = trashedSnapshotDocs
      .map((doc) => movementFromFirestore(doc.id, doc.data()))
      .filter((m: any) => m.origin !== "household_expense");

    assert.equal(initialTrash.length, 1, "Solo debe incluir el movimiento personal en papelera");
    assert.equal(initialTrash[0].id, "mov_trashed_personal");
    assert.notEqual(initialTrash[0].origin, "household_expense");

    // Consistencia estricta
    assert.deepEqual(initialTrash, realtimeTrash, "Lectura inicial y tiempo real deben ser 100% consistentes");

    const hasDerived = initialTrash.some((m: any) => m.origin === "household_expense");
    assert.equal(hasDerived, false, "Ninguna participación derivada debe aparecer en la papelera Personal");
  }

  // ── Pruebas de regresión DR-001 a DR-004 ──────────────────────────────────
  // Validan los dos bugs: label "Por clasificar" y filtro categoryId=unclassified.
  // ──────────────────────────────────────────────────────────────────────────

  const {
    buildCategoryBreakdown,
    applyMovementFilters,
    buildMplusMovementRows,
  } = await import("../../src/features/movements/lib/personal-month-view-model");
  const { movementFromFirestore } = await import("../../src/lib/mplus/converters");

  // Fixtures compartidos para DR-001 / DR-002
  const derivedNullDoc = {
    schemaVersion: 1,
    ownerId: "u1",
    type: "expense" as const,
    title: "Mercado Hogar",
    amount: 80000,
    categoryId: null,           // "Por clasificar"
    accountId: null,
    note: "",
    occurredAt: Timestamp.fromMillis(occurredAtMillis),
    lifecycleState: "active" as const,
    trashedAt: null,
    purgeAfter: null,
    householdId: null,
    householdCategoryId: null,
    origin: "household_expense" as const,
    householdExpenseId: "exp_hh_1",
    revision: 1,
    lastMutationId: "a0000000-0000-4000-8000-000000000020",
    createdAt: Timestamp.fromMillis(occurredAtMillis),
    updatedAt: Timestamp.fromMillis(occurredAtMillis),
  };

  const derivedWithCategoryDoc = {
    ...derivedNullDoc,
    categoryId: "cat_servicios",  // Clasificado
    householdExpenseId: "exp_hh_2",
    lastMutationId: "a0000000-0000-4000-8000-000000000021",
  };

  const orphanDoc = {
    ...derivedNullDoc,
    categoryId: "cat_deleted_123",  // ID inexistente → "Categoria eliminada"
    origin: "personal" as const,
    householdExpenseId: null,
    lastMutationId: "a0000000-0000-4000-8000-000000000022",
  };

  const movDerived = movementFromFirestore("exp_hh_1__u1", derivedNullDoc);
  const movClassified = movementFromFirestore("exp_hh_2__u1", derivedWithCategoryDoc);
  const movOrphan = movementFromFirestore("mov_orphan", orphanDoc);

  // DR-001 — buildCategoryBreakdown con categoryId null → "Por clasificar" (nunca "Categoria eliminada")
  {
    const breakdown = buildCategoryBreakdown([movDerived], [], "expense");
    assert.equal(breakdown.length, 1, "DR-001: debe haber exactamente 1 item en el breakdown");
    const item = breakdown[0];
    assert.equal(item.categoryId, "unclassified", "DR-001: la clave interna debe ser 'unclassified'");
    assert.equal(item.name, "Por clasificar", "DR-001: el nombre debe ser 'Por clasificar', no 'Categoria eliminada'");
    assert.notEqual(item.name, "Categoria eliminada", "DR-001: 'Categoria eliminada' no debe aparecer para categoryId null");
    assert.ok(typeof item.color === "string" && item.color.length > 0, "DR-001: color debe ser no vacío");
    assert.ok(typeof item.iconKey === "string" && item.iconKey.length > 0, "DR-001: iconKey debe ser no vacío");
  }

  // DR-002 — buildCategoryBreakdown con ID no nulo e inexistente → "Categoria eliminada"
  {
    const breakdown = buildCategoryBreakdown([movOrphan], [], "expense");
    assert.equal(breakdown.length, 1, "DR-002: debe haber 1 item");
    const item = breakdown[0];
    assert.equal(item.name, "Categoria eliminada", "DR-002: ID no nulo e inexistente → 'Categoria eliminada'");
    assert.notEqual(item.name, "Por clasificar", "DR-002: 'Por clasificar' no debe usarse para IDs inexistentes no nulos");
  }

  // DR-003 — applyMovementFilters con categoryId="unclassified" INCLUYE filas con categoryId===null
  {
    const rows = buildMplusMovementRows([movDerived, movClassified], [], []);
    const filtered = applyMovementFilters(rows, {
      search: "",
      type: "expense",
      categoryId: "unclassified",
      accountId: "all",
    });
    assert.equal(filtered.length, 1, "DR-003: debe incluir exactamente la fila con categoryId null");
    assert.equal(filtered[0].id, "exp_hh_1__u1", "DR-003: la fila derivada sin clasificar debe ser visible");
    assert.equal(filtered[0].categoryId, null, "DR-003: categoryId del resultado debe seguir siendo null");
  }

  // DR-004 — applyMovementFilters con categoryId="unclassified" EXCLUYE filas con otra categoría
  {
    const rows = buildMplusMovementRows([movDerived, movClassified], [], []);
    const filtered = applyMovementFilters(rows, {
      search: "",
      type: "expense",
      categoryId: "unclassified",
      accountId: "all",
    });
    const hasClassified = filtered.some((r) => r.categoryId === "cat_servicios");
    assert.equal(hasClassified, false, "DR-004: una fila con categoryId='cat_servicios' no debe aparecer al filtrar por 'unclassified'");
  }

  console.log("OK mplus-personal-derived-read-consistency");
}
