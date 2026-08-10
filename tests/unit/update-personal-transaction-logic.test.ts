import assert from "node:assert";

console.log("Running unit tests for update-personal-transaction-logic.test.ts...");

type MockState = {
  accounts: Record<string, { id: string; currentBalance: number }>;
  pockets: Record<string, { id: string; accountId: string; balance: number }>;
};

// Pure logic function simulating updatePersonalTransaction and deletePersonalTransaction balance updates
function simulateUpdateTransaction({
  state,
  previousType,
  previousAmount,
  previousAccountId,
  previousPocketId,
  previousTargetAccountId = null,
  previousTargetPocketId = null,
  payload,
}: {
  state: MockState;
  previousType: "expense" | "income" | "transfer";
  previousAmount: number;
  previousAccountId: string;
  previousPocketId: string | null;
  previousTargetAccountId?: string | null;
  previousTargetPocketId?: string | null;
  payload: {
    type: "expense" | "income" | "transfer";
    amount: number;
    accountId: string;
    pocketId?: string | null;
    targetAccountId?: string | null;
    targetPocketId?: string | null;
  };
}) {
  const nextState = JSON.parse(JSON.stringify(state)) as MockState;

  const isSameExpenseSource = (
    left: { accountId: string; pocketId: string | null },
    right: { accountId: string; pocketId: string | null }
  ) => left.accountId === right.accountId && left.pocketId === right.pocketId;

  if (payload.type === "expense") {
    const prevSource = { accountId: previousAccountId, pocketId: previousPocketId };
    const nextSource = { accountId: payload.accountId, pocketId: payload.pocketId ?? null };

    if (isSameExpenseSource(prevSource, nextSource)) {
      const netDelta = previousAmount - payload.amount;
      applyDelta(nextState, payload.accountId, payload.pocketId ?? null, netDelta);
    } else {
      // Revert previous source
      applyDelta(nextState, previousAccountId, previousPocketId, previousAmount);
      // Apply new source
      applyDelta(nextState, payload.accountId, payload.pocketId ?? null, -payload.amount);
    }
  } else if (payload.type === "income") {
    // Revert previous income
    applyDelta(nextState, previousAccountId, null, -previousAmount);
    // Apply new income
    applyDelta(nextState, payload.accountId, null, payload.amount);
  } else if (payload.type === "transfer") {
    // Revert previous transfer
    applyDelta(nextState, previousAccountId, previousPocketId, previousAmount);
    if (previousTargetAccountId) {
      applyDelta(nextState, previousTargetAccountId, previousTargetPocketId, -previousAmount);
    }
    // Apply new transfer
    applyDelta(nextState, payload.accountId, payload.pocketId ?? null, -payload.amount);
    if (payload.targetAccountId) {
      applyDelta(nextState, payload.targetAccountId, payload.targetPocketId ?? null, payload.amount);
    }
  }

  return nextState;
}

function simulateDeleteTransaction({
  state,
  type,
  amount,
  accountId,
  pocketId,
  targetAccountId,
  targetPocketId = null,
}: {
  state: MockState;
  type: "expense" | "income" | "transfer";
  amount: number;
  accountId: string;
  pocketId: string | null;
  targetAccountId: string | null;
  targetPocketId?: string | null;
}) {
  const nextState = JSON.parse(JSON.stringify(state)) as MockState;

  if (type === "expense") {
    applyDelta(nextState, accountId, pocketId, amount);
  } else if (type === "income") {
    applyDelta(nextState, accountId, null, -amount);
  } else if (type === "transfer") {
    applyDelta(nextState, accountId, pocketId, amount);
    if (targetAccountId) {
      applyDelta(nextState, targetAccountId, targetPocketId, -amount);
    }
  }

  return nextState;
}

function applyDelta(state: MockState, accountId: string, pocketId: string | null, delta: number) {
  if (pocketId) {
    const pocket = state.pockets[pocketId];
    if (!pocket) throw new Error(`Pocket ${pocketId} not found`);
    pocket.balance += delta;
  } else {
    const account = state.accounts[accountId];
    if (!account) throw new Error(`Account ${accountId} not found`);
    account.currentBalance += delta;
  }
}

// Helper to set up initial state
// Cuenta total: $100.000 (disponible/libre + bolsillo)
// Si bolsillo tiene $10.000, disponible libre de la cuenta es $90.000.
// Pero en nuestro modelo: account.currentBalance es el disponible libre, y pocket.balance es del bolsillo.
// Así, total = account.currentBalance + pockets sum.
// Entonces setup:
// account.currentBalance = 90.000
// pocket.balance = 10.000
// Total = 105.000 (con pocket-A2)
const getInitialState = (): MockState => ({
  accounts: {
    "acc-A": { id: "acc-A", currentBalance: 90000 },
    "acc-B": { id: "acc-B", currentBalance: 50000 },
  },
  pockets: {
    "pocket-A1": { id: "pocket-A1", accountId: "acc-A", balance: 10000 },
    "pocket-A2": { id: "pocket-A2", accountId: "acc-A", balance: 5000 },
    "pocket-B1": { id: "pocket-B1", accountId: "acc-B", balance: 15000 },
  },
});

function getGrossBalance(state: MockState, accountId: string) {
  const acc = state.accounts[accountId];
  const accPockets = Object.values(state.pockets).filter((p) => p.accountId === accountId);
  return acc.currentBalance + accPockets.reduce((sum, p) => sum + p.balance, 0);
}

// Test Case 1: Gasto de bolsillo $1.000 editado a $2.000
{
  let state = getInitialState();
  // Primero creamos el gasto:
  // - Gasto de bolsillo por $1.000
  applyDelta(state, "acc-A", "pocket-A1", -1000);
  assert.strictEqual(state.pockets["pocket-A1"].balance, 9000);
  assert.strictEqual(getGrossBalance(state, "acc-A"), 104000);

  // Ahora editamos el gasto a $2.000
  state = simulateUpdateTransaction({
    state,
    previousType: "expense",
    previousAmount: 1000,
    previousAccountId: "acc-A",
    previousPocketId: "pocket-A1",
    payload: {
      type: "expense",
      amount: 2000,
      accountId: "acc-A",
      pocketId: "pocket-A1",
    },
  });

  assert.strictEqual(state.pockets["pocket-A1"].balance, 8000, "Bolsillo debería quedar en $8.000");
  assert.strictEqual(getGrossBalance(state, "acc-A"), 103000, "Saldo bruto debería quedar en $103.000");
}

// Test Case 2: Gasto de bolsillo $2.000 editado a $1.000
{
  let state = getInitialState();
  // Creamos gasto por $2.000
  applyDelta(state, "acc-A", "pocket-A1", -2000);
  assert.strictEqual(state.pockets["pocket-A1"].balance, 8000);

  // Editamos a $1.000
  state = simulateUpdateTransaction({
    state,
    previousType: "expense",
    previousAmount: 2000,
    previousAccountId: "acc-A",
    previousPocketId: "pocket-A1",
    payload: {
      type: "expense",
      amount: 1000,
      accountId: "acc-A",
      pocketId: "pocket-A1",
    },
  });

  assert.strictEqual(state.pockets["pocket-A1"].balance, 9000, "Bolsillo debería volver a $9.000");
  assert.strictEqual(getGrossBalance(state, "acc-A"), 104000, "Saldo bruto debería ser $104.000");
}

// Test Case 3: Gasto de bolsillo A cambiado a bolsillo B
{
  let state = getInitialState();
  // Gasto bolsillo A1 por $1.000
  applyDelta(state, "acc-A", "pocket-A1", -1000);

  // Cambiar a bolsillo A2 por $2.000
  state = simulateUpdateTransaction({
    state,
    previousType: "expense",
    previousAmount: 1000,
    previousAccountId: "acc-A",
    previousPocketId: "pocket-A1",
    payload: {
      type: "expense",
      amount: 2000,
      accountId: "acc-A",
      pocketId: "pocket-A2",
    },
  });

  assert.strictEqual(state.pockets["pocket-A1"].balance, 10000, "Bolsillo origen anterior debe revertirse a $10.000");
  assert.strictEqual(state.pockets["pocket-A2"].balance, 3000, "Bolsillo destino nuevo debe descontar $2.000 (5.000 -> 3.000)");
  assert.strictEqual(getGrossBalance(state, "acc-A"), 103000, "Saldo bruto cuenta acc-A debe ser $103.000");
}

// Test Case 4: Gasto de bolsillo cambiado a disponible de cuenta
{
  let state = getInitialState();
  // Gasto bolsillo A1 por $1.000
  applyDelta(state, "acc-A", "pocket-A1", -1000);

  // Cambiar a disponible de cuenta (sin pocketId) por $2.000
  state = simulateUpdateTransaction({
    state,
    previousType: "expense",
    previousAmount: 1000,
    previousAccountId: "acc-A",
    previousPocketId: "pocket-A1",
    payload: {
      type: "expense",
      amount: 2000,
      accountId: "acc-A",
      pocketId: null,
    },
  });

  assert.strictEqual(state.pockets["pocket-A1"].balance, 10000, "Bolsillo debe revertirse a $10.000");
  assert.strictEqual(state.accounts["acc-A"].currentBalance, 88000, "Disponible de cuenta acc-A debe ser $88.000 (90.000 - 2.000)");
  assert.strictEqual(getGrossBalance(state, "acc-A"), 103000, "Bruto debe ser $103.000");
}

// Test Case 5: Gasto de disponible cambiado a bolsillo
{
  let state = getInitialState();
  // Gasto de disponible por $2.000
  applyDelta(state, "acc-A", null, -2000);

  // Cambiar a bolsillo A1 por $1.000
  state = simulateUpdateTransaction({
    state,
    previousType: "expense",
    previousAmount: 2000,
    previousAccountId: "acc-A",
    previousPocketId: null,
    payload: {
      type: "expense",
      amount: 1000,
      accountId: "acc-A",
      pocketId: "pocket-A1",
    },
  });

  assert.strictEqual(state.accounts["acc-A"].currentBalance, 90000, "Disponible de cuenta debe revertirse a $90.000");
  assert.strictEqual(state.pockets["pocket-A1"].balance, 9000, "Bolsillo debe descontar $1.000");
  assert.strictEqual(getGrossBalance(state, "acc-A"), 104000, "Bruto debe ser $104.000");
}

// Test Case 6: Gasto de cuenta A cambiado a cuenta B
{
  let state = getInitialState();
  // Gasto disponible cuenta A por $3.000
  applyDelta(state, "acc-A", null, -3000);

  // Cambiar a disponible cuenta B por $4.000
  state = simulateUpdateTransaction({
    state,
    previousType: "expense",
    previousAmount: 3000,
    previousAccountId: "acc-A",
    previousPocketId: null,
    payload: {
      type: "expense",
      amount: 4000,
      accountId: "acc-B",
      pocketId: null,
    },
  });

  assert.strictEqual(state.accounts["acc-A"].currentBalance, 90000, "Disponible cuenta A debe revertirse a $90.000");
  assert.strictEqual(state.accounts["acc-B"].currentBalance, 46000, "Disponible cuenta B debe descontar $4.000 (50.000 -> 46.000)");
}

// Test Case 7: eliminar gasto editado debe devolver saldo al origen correcto
{
  let state = getInitialState();
  // Creamos gasto bolsillo A1 por $1.000
  applyDelta(state, "acc-A", "pocket-A1", -1000);

  // Editamos gasto a $2.000
  state = simulateUpdateTransaction({
    state,
    previousType: "expense",
    previousAmount: 1000,
    previousAccountId: "acc-A",
    previousPocketId: "pocket-A1",
    payload: {
      type: "expense",
      amount: 2000,
      accountId: "acc-A",
      pocketId: "pocket-A1",
    },
  });

  // Ahora eliminamos el gasto de $2.000
  state = simulateDeleteTransaction({
    state,
    type: "expense",
    amount: 2000,
    accountId: "acc-A",
    pocketId: "pocket-A1",
    targetAccountId: null,
  });

  assert.strictEqual(state.pockets["pocket-A1"].balance, 10000, "Eliminar gasto debe devolver saldo completo a $10.000");
  assert.strictEqual(getGrossBalance(state, "acc-A"), 105000, "Bruto debe volver a $105.000");
}

// Test Case 8: Transferencia de disponible a disponible (cuenta a -> cuenta b)
{
  let state = getInitialState();
  // Transferencia de $10.000: libre acc-A -> libre acc-B
  applyDelta(state, "acc-A", null, -10000);
  applyDelta(state, "acc-B", null, 10000);
  assert.strictEqual(state.accounts["acc-A"].currentBalance, 80000);
  assert.strictEqual(state.accounts["acc-B"].currentBalance, 60000);

  // Editamos la transferencia a $5.000
  state = simulateUpdateTransaction({
    state,
    previousType: "transfer",
    previousAmount: 10000,
    previousAccountId: "acc-A",
    previousPocketId: null,
    previousTargetAccountId: "acc-B",
    previousTargetPocketId: null,
    payload: {
      type: "transfer",
      amount: 5000,
      accountId: "acc-A",
      pocketId: null,
      targetAccountId: "acc-B",
      targetPocketId: null,
    },
  });

  assert.strictEqual(state.accounts["acc-A"].currentBalance, 85000, "Disponible origen debe ser 85.000 (90.000 - 5.000)");
  assert.strictEqual(state.accounts["acc-B"].currentBalance, 55000, "Disponible destino debe ser 55.000 (50.000 + 5.000)");
}

// Test Case 9: Transferencia de bolsillo a disponible misma cuenta (pocket-A1 -> disponible de acc-A)
{
  let state = getInitialState();
  // Transferimos $1.000 de pocket-A1 a disponible acc-A
  applyDelta(state, "acc-A", "pocket-A1", -1000);
  applyDelta(state, "acc-A", null, 1000);
  assert.strictEqual(state.pockets["pocket-A1"].balance, 9000);
  assert.strictEqual(state.accounts["acc-A"].currentBalance, 91000);
  assert.strictEqual(getGrossBalance(state, "acc-A"), 105000, "Saldo bruto no debe cambiar");

  // Editamos a $2.000
  state = simulateUpdateTransaction({
    state,
    previousType: "transfer",
    previousAmount: 1000,
    previousAccountId: "acc-A",
    previousPocketId: "pocket-A1",
    previousTargetAccountId: "acc-A",
    previousTargetPocketId: null,
    payload: {
      type: "transfer",
      amount: 2000,
      accountId: "acc-A",
      pocketId: "pocket-A1",
      targetAccountId: "acc-A",
      targetPocketId: null,
    },
  });

  assert.strictEqual(state.pockets["pocket-A1"].balance, 8000, "Bolsillo origen debe descontar $2.000");
  assert.strictEqual(state.accounts["acc-A"].currentBalance, 92000, "Disponible debe sumar $2.000");
  assert.strictEqual(getGrossBalance(state, "acc-A"), 105000, "Saldo bruto constante");

  // Eliminamos la transferencia
  state = simulateDeleteTransaction({
    state,
    type: "transfer",
    amount: 2000,
    accountId: "acc-A",
    pocketId: "pocket-A1",
    targetAccountId: "acc-A",
    targetPocketId: null,
  });

  assert.strictEqual(state.pockets["pocket-A1"].balance, 10000, "Bolsillo debe volver a $10.000");
  assert.strictEqual(state.accounts["acc-A"].currentBalance, 90000, "Disponible debe volver a $90.000");
}

// Test Case 10: Transferencia de disponible a bolsillo misma cuenta (disponible acc-A -> pocket-A1)
{
  let state = getInitialState();
  // Transferimos $5.000 de disponible acc-A a pocket-A1
  applyDelta(state, "acc-A", null, -5000);
  applyDelta(state, "acc-A", "pocket-A1", 5000);
  assert.strictEqual(state.accounts["acc-A"].currentBalance, 85000);
  assert.strictEqual(state.pockets["pocket-A1"].balance, 15000);

  // Editamos a $2.000
  state = simulateUpdateTransaction({
    state,
    previousType: "transfer",
    previousAmount: 5000,
    previousAccountId: "acc-A",
    previousPocketId: null,
    previousTargetAccountId: "acc-A",
    previousTargetPocketId: "pocket-A1",
    payload: {
      type: "transfer",
      amount: 2000,
      accountId: "acc-A",
      pocketId: null,
      targetAccountId: "acc-A",
      targetPocketId: "pocket-A1",
    },
  });

  assert.strictEqual(state.accounts["acc-A"].currentBalance, 88000);
  assert.strictEqual(state.pockets["pocket-A1"].balance, 12000);

  // Eliminamos
  state = simulateDeleteTransaction({
    state,
    type: "transfer",
    amount: 2000,
    accountId: "acc-A",
    pocketId: null,
    targetAccountId: "acc-A",
    targetPocketId: "pocket-A1",
  });

  assert.strictEqual(state.accounts["acc-A"].currentBalance, 90000);
  assert.strictEqual(state.pockets["pocket-A1"].balance, 10000);
}

// Test Case 11: Transferencia de bolsillo a bolsillo misma cuenta (pocket-A1 -> pocket-A2)
{
  let state = getInitialState();
  // Transferimos $3.000 de pocket-A1 a pocket-A2
  applyDelta(state, "acc-A", "pocket-A1", -3000);
  applyDelta(state, "acc-A", "pocket-A2", 3000);

  assert.strictEqual(state.pockets["pocket-A1"].balance, 7000);
  assert.strictEqual(state.pockets["pocket-A2"].balance, 8000);

  // Editamos a $1.000
  state = simulateUpdateTransaction({
    state,
    previousType: "transfer",
    previousAmount: 3000,
    previousAccountId: "acc-A",
    previousPocketId: "pocket-A1",
    previousTargetAccountId: "acc-A",
    previousTargetPocketId: "pocket-A2",
    payload: {
      type: "transfer",
      amount: 1000,
      accountId: "acc-A",
      pocketId: "pocket-A1",
      targetAccountId: "acc-A",
      targetPocketId: "pocket-A2",
    },
  });

  assert.strictEqual(state.pockets["pocket-A1"].balance, 9000);
  assert.strictEqual(state.pockets["pocket-A2"].balance, 6000);

  // Eliminamos
  state = simulateDeleteTransaction({
    state,
    type: "transfer",
    amount: 1000,
    accountId: "acc-A",
    pocketId: "pocket-A1",
    targetAccountId: "acc-A",
    targetPocketId: "pocket-A2",
  });

  assert.strictEqual(state.pockets["pocket-A1"].balance, 10000);
  assert.strictEqual(state.pockets["pocket-A2"].balance, 5000);
}

// Test Case 12: Transferencia bolsillo de cuenta A a bolsillo de cuenta B (pocket-A1 -> pocket-B1)
{
  let state = getInitialState();
  // Transferimos $4.000 de pocket-A1 a pocket-B1
  applyDelta(state, "acc-A", "pocket-A1", -4000);
  applyDelta(state, "acc-B", "pocket-B1", 4000);

  assert.strictEqual(state.pockets["pocket-A1"].balance, 6000);
  assert.strictEqual(state.pockets["pocket-B1"].balance, 19000);

  // Editamos a $2.000
  state = simulateUpdateTransaction({
    state,
    previousType: "transfer",
    previousAmount: 4000,
    previousAccountId: "acc-A",
    previousPocketId: "pocket-A1",
    previousTargetAccountId: "acc-B",
    previousTargetPocketId: "pocket-B1",
    payload: {
      type: "transfer",
      amount: 2000,
      accountId: "acc-A",
      pocketId: "pocket-A1",
      targetAccountId: "acc-B",
      targetPocketId: "pocket-B1",
    },
  });

  assert.strictEqual(state.pockets["pocket-A1"].balance, 8000);
  assert.strictEqual(state.pockets["pocket-B1"].balance, 17000);

  // Eliminamos
  state = simulateDeleteTransaction({
    state,
    type: "transfer",
    amount: 2000,
    accountId: "acc-A",
    pocketId: "pocket-A1",
    targetAccountId: "acc-B",
    targetPocketId: "pocket-B1",
  });

  assert.strictEqual(state.pockets["pocket-A1"].balance, 10000);
  assert.strictEqual(state.pockets["pocket-B1"].balance, 15000);
}

console.log("All update-personal-transaction-logic unit tests passed successfully!");
