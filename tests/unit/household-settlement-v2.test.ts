import assert from "node:assert/strict";

console.log("Running unit tests for household-settlement-v2.test.ts...");

// Mock input types
type ShareInput = { memberUserId: string; responsibilityAmount: number };

type CreateEventInput = {
  householdId: string;
  createdByUserId: string;
  paidByUserId?: string;
  settlementMode?: "invitation" | "advancedByPayer" | "eachPaysOwn";
  title: string;
  description: string;
  totalAmount: number;
  householdCategoryId: string;
  eventDate: Date;
  memberShares: ShareInput[];
};

type MockDoc = {
  id: string;
  collectionName: string;
  data: any;
};

// Pure function simulating the writeBatch writes of createHouseholdEvent
function simulateCreateHouseholdEvent(input: CreateEventInput): MockDoc[] {
  const {
    householdId,
    createdByUserId,
    paidByUserId: rawPaidByUserId,
    settlementMode = "advancedByPayer",
    title,
    description,
    totalAmount,
    householdCategoryId,
    eventDate,
    memberShares,
  } = input;

  const paidByUserId = rawPaidByUserId || createdByUserId;

  // Validate
  if (!title.trim()) {
    throw new Error("El título del evento es obligatorio.");
  }
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error("El monto total debe ser mayor a cero.");
  }
  if (memberShares.length === 0) {
    throw new Error("Debe haber al menos una responsabilidad asignada.");
  }

  if (settlementMode !== "invitation") {
    const sharesSum = memberShares.reduce((s, m) => s + m.responsibilityAmount, 0);
    if (Math.abs(sharesSum - totalAmount) > 1) {
      throw new Error(`La suma de responsabilidades (${sharesSum}) debe ser igual al monto total (${totalAmount}).`);
    }
  }

  const writes: MockDoc[] = [];
  const eventId = "mock-event-id";

  // Event
  writes.push({
    id: eventId,
    collectionName: "household_events",
    data: {
      householdId,
      createdByUserId,
      paidByUserId,
      settlementMode,
      sourceTransactionId: null,
      householdCategoryId: householdCategoryId || null,
      title: title.trim(),
      description: description.trim() || null,
      eventDate,
      totalAmount,
      status: "active",
    },
  });

  // Shares
  if (settlementMode === "invitation" || settlementMode === "advancedByPayer") {
    writes.push({
      id: "mock-share-id",
      collectionName: "household_event_shares",
      data: {
        eventId,
        householdId,
        memberUserId: paidByUserId,
        responsibilityAmount: totalAmount,
        status: "pending_completion",
        completedAt: null,
        completedByTransactionId: null,
      },
    });
  } else if (settlementMode === "eachPaysOwn") {
    let index = 1;
    for (const share of memberShares) {
      if (share.responsibilityAmount > 0) {
        writes.push({
          id: `mock-share-id-${index++}`,
          collectionName: "household_event_shares",
          data: {
            eventId,
            householdId,
            memberUserId: share.memberUserId,
            responsibilityAmount: share.responsibilityAmount,
            status: "pending_completion",
            completedAt: null,
            completedByTransactionId: null,
          },
        });
      }
    }
  }

  // Debts
  if (settlementMode === "advancedByPayer") {
    let index = 1;
    for (const share of memberShares) {
      if (share.memberUserId !== paidByUserId && share.responsibilityAmount > 0) {
        writes.push({
          id: `mock-debt-id-${index++}`,
          collectionName: "household_debts",
          data: {
            householdId,
            eventId,
            fromUserId: share.memberUserId,
            toUserId: paidByUserId,
            amount: share.responsibilityAmount,
            status: "pending",
          },
        });
      }
    }
  }

  return writes;
}

// Pure function simulating createPersonalExpenseWithHouseholdProjection
function simulateProjection(payload: {
  ownerId: string;
  amount: number;
  householdId: string;
  householdCategoryId: string;
  memberShares: ShareInput[];
}): MockDoc[] {
  const writes: MockDoc[] = [];
  const transactionId = "mock-tx-id";
  const eventId = "mock-event-id";

  // Personal Expense
  writes.push({
    id: transactionId,
    collectionName: "transactions",
    data: {
      ownerId: payload.ownerId,
      type: "expense",
      amount: payload.amount,
      status: "confirmed",
    },
  });

  // Household Event
  writes.push({
    id: eventId,
    collectionName: "household_events",
    data: {
      householdId: payload.householdId,
      createdByUserId: payload.ownerId,
      paidByUserId: payload.ownerId,
      settlementMode: "advancedByPayer",
      sourceTransactionId: transactionId,
      totalAmount: payload.amount,
      status: "active",
    },
  });

  // Payer gets 1 completed share
  writes.push({
    id: "mock-share-payer",
    collectionName: "household_event_shares",
    data: {
      eventId,
      householdId: payload.householdId,
      memberUserId: payload.ownerId,
      responsibilityAmount: payload.amount,
      status: "completed",
      completedByTransactionId: transactionId,
    },
  });

  // Debts
  let index = 1;
  for (const share of payload.memberShares) {
    if (share.memberUserId !== payload.ownerId && share.responsibilityAmount > 0) {
      writes.push({
        id: `mock-debt-id-${index++}`,
        collectionName: "household_debts",
        data: {
          householdId: payload.householdId,
          eventId,
          fromUserId: share.memberUserId,
          toUserId: payload.ownerId,
          amount: share.responsibilityAmount,
          status: "pending",
        },
      });
    }
  }

  return writes;
}

// Legacy fallback logic simulation
function mapLegacyEvent(docData: any, createdBy: string) {
  const paidByUserId = docData.paidByUserId || createdBy;
  const rawSettlementMode = docData.settlementMode;
  const settlementMode = (rawSettlementMode === "invitation" || rawSettlementMode === "eachPaysOwn" || rawSettlementMode === "advancedByPayer")
    ? rawSettlementMode
    : "advancedByPayer";
  return { paidByUserId, settlementMode };
}

// --- Test cases ---

// Test 1: Invitation Mode (T1)
{
  const writes = simulateCreateHouseholdEvent({
    householdId: "house-1",
    createdByUserId: "user-edgar",
    paidByUserId: "user-edgar",
    settlementMode: "invitation",
    title: "T1 Invitacion",
    description: "",
    totalAmount: 90000,
    householdCategoryId: "cat-1",
    eventDate: new Date(),
    memberShares: [
      { memberUserId: "user-edgar", responsibilityAmount: 90000 },
      { memberUserId: "user-valen", responsibilityAmount: 0 },
    ],
  });

  // Verify exactly 1 event and 1 share created. 0 debts.
  const events = writes.filter((w) => w.collectionName === "household_events");
  const shares = writes.filter((w) => w.collectionName === "household_event_shares");
  const debts = writes.filter((w) => w.collectionName === "household_debts");

  assert.equal(events.length, 1);
  assert.equal(events[0].data.paidByUserId, "user-edgar");
  assert.equal(events[0].data.settlementMode, "invitation");

  assert.equal(shares.length, 1);
  assert.equal(shares[0].data.memberUserId, "user-edgar");
  assert.equal(shares[0].data.responsibilityAmount, 90000);
  assert.equal(shares[0].data.status, "pending_completion");

  assert.equal(debts.length, 0);
}

// Test 2: AdvancedByPayer Mode (T2) - Valentina registers, Edgar paid
{
  const writes = simulateCreateHouseholdEvent({
    householdId: "house-1",
    createdByUserId: "user-valen",
    paidByUserId: "user-edgar",
    settlementMode: "advancedByPayer",
    title: "T2 Creeps",
    description: "",
    totalAmount: 200000,
    householdCategoryId: "cat-1",
    eventDate: new Date(),
    memberShares: [
      { memberUserId: "user-edgar", responsibilityAmount: 100000 },
      { memberUserId: "user-valen", responsibilityAmount: 100000 },
    ],
  });

  const events = writes.filter((w) => w.collectionName === "household_events");
  const shares = writes.filter((w) => w.collectionName === "household_event_shares");
  const debts = writes.filter((w) => w.collectionName === "household_debts");

  // Event paid by Edgar
  assert.equal(events.length, 1);
  assert.equal(events[0].data.createdByUserId, "user-valen");
  assert.equal(events[0].data.paidByUserId, "user-edgar");
  assert.equal(events[0].data.settlementMode, "advancedByPayer");

  // Edgar gets the single share of total amount
  assert.equal(shares.length, 1);
  assert.equal(shares[0].data.memberUserId, "user-edgar");
  assert.equal(shares[0].data.responsibilityAmount, 200000);
  assert.equal(shares[0].data.status, "pending_completion");

  // Debt from Valentina to Edgar (not to Valentina!)
  assert.equal(debts.length, 1);
  assert.equal(debts[0].data.fromUserId, "user-valen");
  assert.equal(debts[0].data.toUserId, "user-edgar");
  assert.equal(debts[0].data.amount, 100000);
}

// Test 3: EachPaysOwn Mode (T3)
{
  const writes = simulateCreateHouseholdEvent({
    householdId: "house-1",
    createdByUserId: "user-edgar",
    paidByUserId: "user-edgar",
    settlementMode: "eachPaysOwn",
    title: "T3 Cada uno",
    description: "",
    totalAmount: 200000,
    householdCategoryId: "cat-1",
    eventDate: new Date(),
    memberShares: [
      { memberUserId: "user-edgar", responsibilityAmount: 100000 },
      { memberUserId: "user-valen", responsibilityAmount: 100000 },
    ],
  });

  const events = writes.filter((w) => w.collectionName === "household_events");
  const shares = writes.filter((w) => w.collectionName === "household_event_shares");
  const debts = writes.filter((w) => w.collectionName === "household_debts");

  assert.equal(events.length, 1);
  assert.equal(events[0].data.settlementMode, "eachPaysOwn");

  // Shares for each member with amount > 0
  assert.equal(shares.length, 2);
  assert.equal(shares[0].data.memberUserId, "user-edgar");
  assert.equal(shares[0].data.responsibilityAmount, 100000);
  assert.equal(shares[0].data.status, "pending_completion");
  
  assert.equal(shares[1].data.memberUserId, "user-valen");
  assert.equal(shares[1].data.responsibilityAmount, 100000);
  assert.equal(shares[1].data.status, "pending_completion");

  assert.equal(debts.length, 0);
}

// Test 4: Legacy Fallbacks mapping
{
  const legacyDoc1 = { amount: 50000 }; // no settlementMode, no paidByUserId
  const mapped1 = mapLegacyEvent(legacyDoc1, "user-valen");
  assert.equal(mapped1.paidByUserId, "user-valen");
  assert.equal(mapped1.settlementMode, "advancedByPayer");

  const legacyDoc2 = { paidByUserId: "user-edgar", settlementMode: "eachPaysOwn" };
  const mapped2 = mapLegacyEvent(legacyDoc2, "user-valen");
  assert.equal(mapped2.paidByUserId, "user-edgar");
  assert.equal(mapped2.settlementMode, "eachPaysOwn");
}

// Test 5: Personal Projection
{
  const writes = simulateProjection({
    ownerId: "user-edgar",
    amount: 150000,
    householdId: "house-1",
    householdCategoryId: "cat-1",
    memberShares: [
      { memberUserId: "user-edgar", responsibilityAmount: 75000 },
      { memberUserId: "user-valen", responsibilityAmount: 75000 },
    ],
  });

  const transactions = writes.filter((w) => w.collectionName === "transactions");
  const events = writes.filter((w) => w.collectionName === "household_events");
  const shares = writes.filter((w) => w.collectionName === "household_event_shares");
  const debts = writes.filter((w) => w.collectionName === "household_debts");

  assert.equal(transactions.length, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].data.paidByUserId, "user-edgar");
  assert.equal(events[0].data.settlementMode, "advancedByPayer");
  assert.equal(events[0].data.sourceTransactionId, "mock-tx-id");

  // Exactly 1 share (completed) for Edgar
  assert.equal(shares.length, 1);
  assert.equal(shares[0].data.memberUserId, "user-edgar");
  assert.equal(shares[0].data.responsibilityAmount, 150000);
  assert.equal(shares[0].data.status, "completed");
  assert.equal(shares[0].data.completedByTransactionId, "mock-tx-id");

  // Exactly 1 debt from Valentina to Edgar
  assert.equal(debts.length, 1);
  assert.equal(debts[0].data.fromUserId, "user-valen");
  assert.equal(debts[0].data.toUserId, "user-edgar");
  assert.equal(debts[0].data.amount, 75000);
}

console.log("All household-settlement-v2 unit tests passed successfully!");
