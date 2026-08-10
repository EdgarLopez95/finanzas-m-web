import assert from "node:assert/strict";

import {
  syncHouseholdIncomeProjectionInTransaction,
} from "../../src/features/transactions/services/sync-household-income-projection";
import type { DocumentReference } from "firebase/firestore";

console.log("Running unit tests for household-income-projection.test.ts...");

function runHouseholdIncomeProjectionTests() {
  // Mock Firestore transaction
  const createMockTransaction = () => {
    const sets: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];
    const updates: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];

    const transaction = {
      set: (ref: DocumentReference, data: Record<string, unknown>) => {
        sets.push({ ref, data });
      },
      update: (ref: DocumentReference, data: Record<string, unknown>) => {
        updates.push({ ref, data });
      },
    };

    return { transaction, sets, updates };
  };

  const createMockRef = (id: string, path: string): DocumentReference =>
    ({ id, path } as unknown as DocumentReference);

  // ==========================================
  // Test 1: Creación de proyección de ingreso cuando countsAsRealIncome === true
  // ==========================================
  {
    const { transaction, sets } = createMockTransaction();
    const entryDate = new Date("2026-07-28T10:00:00Z");

    syncHouseholdIncomeProjectionInTransaction({
      db: {} as any,
      transaction: transaction as any,
      ownerId: "user-owner-1",
      sourceTransactionId: "tx-inc-1",
      amount: 1500000,
      entryDate,
      description: "  Salario   Mensual  ",
      shouldProject: true,
      existingProjection: null,
      activeHouseholdId: "hh-100",
      customProjectionRef: createMockRef("entry-new-1", "household_income_entries/entry-new-1"),
    });

    assert.strictEqual(sets.length, 1, "Debe crear exactamente 1 documento de proyección");
    const createdData = sets[0].data;

    assert.strictEqual(createdData.householdId, "hh-100");
    assert.strictEqual(createdData.sourceOwnerId, "user-owner-1");
    assert.strictEqual(createdData.sourceTransactionId, "tx-inc-1");
    assert.strictEqual(createdData.visibleDescription, "Salario Mensual");
    assert.strictEqual(createdData.amount, 1500000);
    assert.strictEqual(createdData.kind, "real_income");
    assert.strictEqual(createdData.status, "active");

    // Invariante de privacidad: 0 datos personales sensibles expuestos
    assert.strictEqual(createdData.accountId, undefined, "No debe incluir accountId personal");
    assert.strictEqual(createdData.pocketId, undefined, "No debe incluir pocketId personal");
    assert.strictEqual(createdData.categoryId, undefined, "No debe incluir categoryId personal");

    console.log("  ✓ Test 1: Creación de proyección atómica con saneamiento de descripción y privacidad");
  }

  // ==========================================
  // Test 2: Edición de monto, fecha y descripción de proyección existente
  // ==========================================
  {
    const { transaction, updates } = createMockTransaction();
    const existingRef = createMockRef("entry-1", "household_income_entries/entry-1");
    const newDate = new Date("2026-08-01T15:00:00Z");

    syncHouseholdIncomeProjectionInTransaction({
      db: {} as any,
      transaction: transaction as any,
      ownerId: "user-owner-1",
      sourceTransactionId: "tx-inc-1",
      amount: 1800000,
      entryDate: newDate,
      description: "Salario Ajustado",
      shouldProject: true,
      existingProjection: {
        ref: existingRef,
        householdId: "hh-100",
        sourceOwnerId: "user-owner-1",
        sourceTransactionId: "tx-inc-1",
        status: "active",
      },
      activeHouseholdId: "hh-100",
    });

    assert.strictEqual(updates.length, 1, "Debe actualizar la proyección existente");
    const updatedData = updates[0].data;

    assert.strictEqual(updatedData.visibleDescription, "Salario Ajustado");
    assert.strictEqual(updatedData.amount, 1800000);
    assert.strictEqual(updatedData.status, "active");

    console.log("  ✓ Test 2: Edición de projection actualiza visibleDescription, amount y status");
  }

  // ==========================================
  // Test 3: Desactivación / Cancelación al desmarcar ingreso compartido (shouldProject: false)
  // ==========================================
  {
    const { transaction, updates } = createMockTransaction();
    const existingRef = createMockRef("entry-1", "household_income_entries/entry-1");

    syncHouseholdIncomeProjectionInTransaction({
      db: {} as any,
      transaction: transaction as any,
      ownerId: "user-owner-1",
      sourceTransactionId: "tx-inc-1",
      amount: 1500000,
      entryDate: new Date(),
      shouldProject: false,
      existingProjection: {
        ref: existingRef,
        householdId: "hh-100",
        sourceOwnerId: "user-owner-1",
        sourceTransactionId: "tx-inc-1",
        status: "active",
      },
      activeHouseholdId: "hh-100",
    });

    assert.strictEqual(updates.length, 1, "Debe enviar actualización de estado a cancelled");
    assert.strictEqual(updates[0].data.status, "cancelled");

    console.log("  ✓ Test 3: Desactivar proyección actualiza status a 'cancelled'");
  }

  // ==========================================
  // Test 4: Cancelación por pérdida de activeHouseholdId (usuario ya no está en el hogar)
  // ==========================================
  {
    const { transaction, updates } = createMockTransaction();
    const existingRef = createMockRef("entry-1", "household_income_entries/entry-1");

    syncHouseholdIncomeProjectionInTransaction({
      db: {} as any,
      transaction: transaction as any,
      ownerId: "user-owner-1",
      sourceTransactionId: "tx-inc-1",
      amount: 1500000,
      entryDate: new Date(),
      shouldProject: true,
      existingProjection: {
        ref: existingRef,
        householdId: "hh-100",
        sourceOwnerId: "user-owner-1",
        sourceTransactionId: "tx-inc-1",
        status: "active",
      },
      activeHouseholdId: null,
    });

    assert.strictEqual(updates.length, 1, "Sin activeHouseholdId debe cancelar la proyección activa previa");
    assert.strictEqual(updates[0].data.status, "cancelled");

    console.log("  ✓ Test 4: activeHouseholdId null cancela la proyección previa sin dejar huérfanas");
  }

  // ==========================================
  // Test 5: Normalización de descripción vacía o demasiado larga
  // ==========================================
  {
    const { transaction, sets: setsEmpty } = createMockTransaction();
    syncHouseholdIncomeProjectionInTransaction({
      db: {} as any,
      transaction: transaction as any,
      ownerId: "user-owner-1",
      sourceTransactionId: "tx-inc-empty",
      amount: 50000,
      entryDate: new Date(),
      description: "   ",
      shouldProject: true,
      existingProjection: null,
      activeHouseholdId: "hh-100",
      customProjectionRef: createMockRef("entry-empty", "household_income_entries/entry-empty"),
    });

    assert.strictEqual(setsEmpty[0].data.visibleDescription, "Ingreso al hogar", "Descripción vacía usa fallback canónico");

    const { transaction: txLong, sets: setsLong } = createMockTransaction();
    const longDesc = "A".repeat(100);
    syncHouseholdIncomeProjectionInTransaction({
      db: {} as any,
      transaction: txLong as any,
      ownerId: "user-owner-1",
      sourceTransactionId: "tx-inc-long",
      amount: 50000,
      entryDate: new Date(),
      description: longDesc,
      shouldProject: true,
      existingProjection: null,
      activeHouseholdId: "hh-100",
      customProjectionRef: createMockRef("entry-long", "household_income_entries/entry-long"),
    });

    assert.strictEqual(setsLong[0].data.visibleDescription, "Ingreso al hogar", "Descripción > 80 caracteres usa fallback seguro");

    console.log("  ✓ Test 5: Normalización de descripciones vacías o extensas con fallback seguro");
  }

  console.log("household-income-projection.test.ts: 5/5 pruebas pasadas.");
}

runHouseholdIncomeProjectionTests();
