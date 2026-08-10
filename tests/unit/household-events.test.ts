import assert from "node:assert/strict";

import {
  createHouseholdEvent,
  buildHouseholdEventWritePlan,
  type CreateHouseholdEventInput,
  type HouseholdEventWritePlan,
} from "../../src/features/household/services/create-household-event";
import type { HouseholdCategory } from "../../src/types/household";

console.log("Running unit tests for household-events.test.ts...");

async function runHouseholdEventsTests() {
  const sampleCategories: HouseholdCategory[] = [
    { id: "cat-active-1", householdId: "hh-1", name: "Mercado", iconKey: "shopping-bag", color: "#EF4444", archived: false },
    { id: "cat-archived-1", householdId: "hh-1", name: "Luz Vieja", iconKey: "flame", color: "#9CA3AF", archived: true },
    { id: "cat-other-hh", householdId: "hh-other", name: "Ropa Otro Hogar", iconKey: "shirt", color: "#3B82F6", archived: false },
  ];

  const householdMembers = ["user-owner", "user-member-2", "user-member-3"];

  // Test 1: Plan de Escritura Productivo Canónico para cada settlementMode
  {
    // 1a. Modo Invitation
    const inputInvitation: CreateHouseholdEventInput = {
      householdId: "hh-1",
      createdByUserId: "user-owner",
      paidByUserId: "user-owner",
      settlementMode: "invitation",
      title: "Cena de Bienvenida",
      description: "Invitación especial",
      totalAmount: 150000,
      householdCategoryId: "cat-active-1",
      eventDate: new Date("2026-07-28T12:00:00Z"),
      memberShares: [
        { memberUserId: "user-owner", responsibilityAmount: 150000 },
        { memberUserId: "user-member-2", responsibilityAmount: 0 },
      ],
      householdMemberIds: householdMembers,
      availableCategories: sampleCategories,
    };

    const planInvitation = buildHouseholdEventWritePlan(inputInvitation, "evt-inv-1");

    assert.strictEqual(planInvitation.eventId, "evt-inv-1");
    assert.strictEqual(planInvitation.eventDoc.data.status, "active");
    assert.strictEqual(planInvitation.eventDoc.data.settlementMode, "invitation");
    assert.strictEqual(planInvitation.shareDocs.length, 1, "Invitation produces 1 share for payer");
    assert.strictEqual(planInvitation.shareDocs[0].id, "evt-inv-1_user-owner", "Share ID must be deterministic ${eventId}_${memberUserId}");
    assert.strictEqual(planInvitation.shareDocs[0].data.status, "pending_completion");
    assert.strictEqual(planInvitation.debtDocs.length, 0, "Invitation produces 0 debts");

    // 1b. Modo AdvancedByPayer
    const inputAdvanced: CreateHouseholdEventInput = {
      householdId: "hh-1",
      createdByUserId: "user-owner",
      paidByUserId: "user-owner",
      settlementMode: "advancedByPayer",
      title: "Mercado Mensual",
      description: "50/50",
      totalAmount: 200000,
      householdCategoryId: "cat-active-1",
      eventDate: new Date("2026-07-28T12:00:00Z"),
      memberShares: [
        { memberUserId: "user-owner", responsibilityAmount: 100000 },
        { memberUserId: "user-member-2", responsibilityAmount: 100000 },
      ],
      householdMemberIds: householdMembers,
      availableCategories: sampleCategories,
    };

    const planAdvanced = buildHouseholdEventWritePlan(inputAdvanced, "evt-adv-1", () => "uuid-debt-random-123");

    assert.strictEqual(planAdvanced.eventDoc.data.settlementMode, "advancedByPayer");
    assert.strictEqual(planAdvanced.shareDocs.length, 1, "AdvancedByPayer produces 1 share for payer");
    assert.strictEqual(planAdvanced.shareDocs[0].id, "evt-adv-1_user-owner", "Shares maintain deterministic ID ${eventId}_${memberUserId}");
    assert.strictEqual(planAdvanced.debtDocs.length, 1, "AdvancedByPayer produces debts for non-payers with positive responsibility");
    assert.strictEqual(planAdvanced.debtDocs[0].id, "uuid-debt-random-123", "Debt ID is a standalone UUID generated independently");
    assert.strictEqual(planAdvanced.debtDocs[0].data.eventId, "evt-adv-1", "Debt document maintains eventId field relationship");
    assert.strictEqual(planAdvanced.debtDocs[0].data.fromUserId, "user-member-2");
    assert.strictEqual(planAdvanced.debtDocs[0].data.toUserId, "user-owner");
    assert.strictEqual(planAdvanced.debtDocs[0].data.amount, 100000);
    assert.strictEqual(planAdvanced.debtDocs[0].data.status, "pending");

    // 1c. Modo EachPaysOwn
    const inputEachPaysOwn: CreateHouseholdEventInput = {
      householdId: "hh-1",
      createdByUserId: "user-owner",
      paidByUserId: "user-owner",
      settlementMode: "eachPaysOwn",
      title: "Salida al Cine",
      totalAmount: 60000,
      householdCategoryId: "cat-active-1",
      eventDate: new Date("2026-07-28T12:00:00Z"),
      memberShares: [
        { memberUserId: "user-owner", responsibilityAmount: 20000 },
        { memberUserId: "user-member-2", responsibilityAmount: 40000 },
        { memberUserId: "user-member-3", responsibilityAmount: 0 }, // 0 se excluye
      ],
      householdMemberIds: householdMembers,
      availableCategories: sampleCategories,
    };

    const planEachPaysOwn = buildHouseholdEventWritePlan(inputEachPaysOwn, "evt-epo-1");

    assert.strictEqual(planEachPaysOwn.eventDoc.data.settlementMode, "eachPaysOwn");
    assert.strictEqual(planEachPaysOwn.shareDocs.length, 2, "EachPaysOwn produces shares ONLY for members with responsibility > 0");
    assert.strictEqual(planEachPaysOwn.shareDocs[0].id, "evt-epo-1_user-owner");
    assert.strictEqual(planEachPaysOwn.shareDocs[1].id, "evt-epo-1_user-member-2");
    assert.strictEqual(planEachPaysOwn.debtDocs.length, 0, "EachPaysOwn produces 0 debts");

    console.log("  ✓ Test 1: Plan de escritura productivo genera artefactos y IDs deterministas canónicos de Android para los 3 modos");
  }

  // Test 2: Rechazos de Entrada en Tiempo de Ejecución (Pre-Plan)
  {
    const validBase: CreateHouseholdEventInput = {
      householdId: "hh-1",
      createdByUserId: "user-owner",
      paidByUserId: "user-owner",
      settlementMode: "advancedByPayer",
      title: "Gasto Válido",
      totalAmount: 100000,
      householdCategoryId: "cat-active-1",
      eventDate: new Date(),
      memberShares: [
        { memberUserId: "user-owner", responsibilityAmount: 50000 },
        { memberUserId: "user-member-2", responsibilityAmount: 50000 },
      ],
      householdMemberIds: householdMembers,
      availableCategories: sampleCategories,
    };

    // 2a. Runtime validation de settlementMode inválido
    assert.throws(
      () => buildHouseholdEventWritePlan({ ...validBase, settlementMode: "modo_inventado" as any }, "evt-err"),
      /Modo de liquidación 'modo_inventado' no es válido/
    );

    // 2b. Rechazo de creador externo
    assert.throws(
      () => buildHouseholdEventWritePlan({ ...validBase, createdByUserId: "user-external" }, "evt-err"),
      /El creador del evento debe pertenecer al hogar activo/
    );

    // 2c. Rechazo de pagador externo
    assert.throws(
      () => buildHouseholdEventWritePlan({ ...validBase, paidByUserId: "user-external" }, "evt-err"),
      /El pagador debe pertenecer al hogar activo/
    );

    // 2d. Rechazo de miembro de share externo
    assert.throws(
      () =>
        buildHouseholdEventWritePlan(
          {
            ...validBase,
            memberShares: [
              { memberUserId: "user-owner", responsibilityAmount: 50000 },
              { memberUserId: "user-external", responsibilityAmount: 50000 },
            ],
          },
          "evt-err"
        ),
      /La responsabilidad asignada debe pertenecer a un miembro del hogar activo/
    );

    // 2e. Rechazo de miembros duplicados en shares
    assert.throws(
      () =>
        buildHouseholdEventWritePlan(
          {
            ...validBase,
            memberShares: [
              { memberUserId: "user-member-2", responsibilityAmount: 50000 },
              { memberUserId: "user-member-2", responsibilityAmount: 50000 },
            ],
          },
          "evt-err"
        ),
      /No puede haber responsabilidades duplicadas/
    );

    // 2f. Rechazo de categoría de otro Hogar o archivada
    assert.throws(
      () => buildHouseholdEventWritePlan({ ...validBase, householdCategoryId: "cat-other-hh" }, "evt-err"),
      /La categoría no pertenece al hogar activo/
    );

    assert.throws(
      () => buildHouseholdEventWritePlan({ ...validBase, householdCategoryId: "cat-archived-1" }, "evt-err"),
      /La categoría seleccionada está archivada/
    );

    // 2g. Rechazo de monto inválido
    assert.throws(
      () => buildHouseholdEventWritePlan({ ...validBase, totalAmount: 0 }, "evt-err"),
      /monto debe ser un número finito mayor a cero/
    );

    console.log("  ✓ Test 2: Validación previa estricta rechaza settlementMode inválido, externos, duplicados y categorías no válidas");
  }

  // Test 3: Aislamiento Absoluto de Datos Personales
  {
    const input: CreateHouseholdEventInput = {
      householdId: "hh-1",
      createdByUserId: "user-owner",
      paidByUserId: "user-owner",
      settlementMode: "advancedByPayer",
      title: "Mercado Compartido",
      totalAmount: 100000,
      householdCategoryId: "cat-active-1",
      eventDate: new Date(),
      memberShares: [
        { memberUserId: "user-owner", responsibilityAmount: 50000 },
        { memberUserId: "user-member-2", responsibilityAmount: 50000 },
      ],
      householdMemberIds: householdMembers,
      availableCategories: sampleCategories,
    };

    const plan = buildHouseholdEventWritePlan(input, "evt-isolation");

    const eventKeys = Object.keys(plan.eventDoc.data);
    assert.strictEqual(eventKeys.includes("accountId"), false);
    assert.strictEqual(eventKeys.includes("pocketId"), false);
    assert.strictEqual(eventKeys.includes("personalCategoryId"), false);

    const shareKeys = Object.keys(plan.shareDocs[0].data);
    assert.strictEqual(shareKeys.includes("accountId"), false);

    console.log("  ✓ Test 3: Aislamiento verificado (0 datos de cuentas, bolsillos o categorías personales en el plan de escritura)");
  }

  // Test 4: Verificación de Atomicidad mediante la costura productiva del Servicio
  {
    let receivedPlan: HouseholdEventWritePlan | null = null;

    const mockBatchRunner = async (plan: HouseholdEventWritePlan) => {
      receivedPlan = plan;
    };

    const input: CreateHouseholdEventInput = {
      householdId: "hh-1",
      createdByUserId: "user-owner",
      paidByUserId: "user-owner",
      settlementMode: "advancedByPayer",
      title: "Prueba Atomicidad",
      totalAmount: 80000,
      householdCategoryId: "cat-active-1",
      eventDate: new Date(),
      memberShares: [
        { memberUserId: "user-owner", responsibilityAmount: 40000 },
        { memberUserId: "user-member-2", responsibilityAmount: 40000 },
      ],
      householdMemberIds: householdMembers,
      availableCategories: sampleCategories,
    };

    const createdEventId = await createHouseholdEvent(input, mockBatchRunner);

    assert.ok(receivedPlan !== null, "El servicio createHouseholdEvent debe ejecutar el runner del batch");
    assert.strictEqual((receivedPlan as HouseholdEventWritePlan).eventId, createdEventId);
    assert.strictEqual((receivedPlan as HouseholdEventWritePlan).eventDoc.path, `household_events/${createdEventId}`);
    assert.strictEqual((receivedPlan as HouseholdEventWritePlan).shareDocs.length, 1);
    assert.strictEqual((receivedPlan as HouseholdEventWritePlan).debtDocs.length, 1);

    console.log("  ✓ Test 4: Atomicidad verificada — createHouseholdEvent ejecuta un único commit de batch unificado");
  }

  console.log("All household-events unit tests passed successfully!");
}

runHouseholdEventsTests().catch((err) => {
  console.error("Test failure in household-events.test.ts:", err);
  process.exit(1);
});
