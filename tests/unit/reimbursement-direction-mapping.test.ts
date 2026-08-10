import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { mapTransactionDoc } from "../../src/features/transactions/services/read-personal-transactions";
import { computeNetPersonalExpenses } from "../../src/features/dashboard/lib/personal-view-model";
import type { Transaction } from "../../src/types/transaction";

console.log("Running unit tests for reimbursement-direction-mapping.test.ts...");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

// Simula un QueryDocumentSnapshot<DocumentData> real: mapTransactionDoc solo
// usa .id y .data(), así que un doble mínimo basta sin conectar a Firestore.
const fakeDoc = (id: string, data: Record<string, unknown>) =>
  ({ id, data: () => data }) as unknown as Parameters<typeof mapTransactionDoc>[0];

function runFieldMappingTest() {
  const doc = fakeDoc("tx-reimbursement", {
    type: "reimbursement",
    amount: 60000,
    accountId: "acc-1",
    categoryId: "cat-hogar",
    relatedDebtId: "debt-1",
    relatedEventId: "event-1",
    reimbursementDirection: "incoming",
    isHousehold: false,
    createdAt: null,
    date: null,
  });

  const mapped = mapTransactionDoc(doc, "gerson");

  assert.equal(mapped.type, "reimbursement");
  assert.equal(mapped.reimbursementDirection, "incoming", "mapTransactionDoc debe copiar reimbursementDirection desde Firestore");
  assert.equal(mapped.relatedDebtId, "debt-1", "relatedDebtId debe seguir mapeándose de forma independiente");
  assert.equal(mapped.amount, 60000);

  console.log("Mapeo de campos desde Firestore simulado: 4/4 aserciones pasadas.");
}

function runIntegrationWithNetExpenseFormulaTest() {
  const expense: Transaction = {
    id: "tx-expense",
    ownerId: "gerson",
    title: "Adelanto Hogar",
    notes: "",
    amount: 120000,
    type: "expense",
    accountId: "acc-1",
    targetAccountId: null,
    categoryId: "cat-hogar",
    createdAt: new Date("2026-07-05"),
    date: new Date("2026-07-05"),
  };

  const reimbursementDoc = fakeDoc("tx-reimbursement", {
    type: "reimbursement",
    amount: 60000,
    accountId: "acc-1",
    categoryId: "cat-hogar",
    relatedDebtId: "debt-1",
    reimbursementDirection: "incoming",
    createdAt: null,
    date: null,
  });
  const reimbursement = mapTransactionDoc(reimbursementDoc, "gerson");

  const net = computeNetPersonalExpenses([expense, reimbursement]);
  assert.equal(net, 60000, "el reembolso mapeado desde Firestore debe reducir el gasto de 120.000 a 60.000");

  console.log("Integración mapTransactionDoc -> computeNetPersonalExpenses: 1/1 aserción pasada.");
}

function runNonReducingCasesTest() {
  const outgoingDoc = fakeDoc("tx-outgoing", {
    type: "reimbursement",
    amount: 60000,
    accountId: "acc-1",
    relatedDebtId: "debt-2",
    reimbursementDirection: "outgoing",
    createdAt: null,
    date: null,
  });
  assert.equal(mapTransactionDoc(outgoingDoc, "familia").reimbursementDirection, "outgoing");

  const missingDirectionDoc = fakeDoc("tx-missing", {
    type: "reimbursement",
    amount: 60000,
    accountId: "acc-1",
    relatedDebtId: "debt-3",
    createdAt: null,
    date: null,
  });
  assert.equal(
    mapTransactionDoc(missingDirectionDoc, "gerson").reimbursementDirection,
    null,
    "campo ausente debe mapearse a null, nunca inferido"
  );

  const invalidDirectionDoc = fakeDoc("tx-invalid", {
    type: "reimbursement",
    amount: 60000,
    accountId: "acc-1",
    relatedDebtId: "debt-4",
    reimbursementDirection: "sideways",
    createdAt: null,
    date: null,
  });
  assert.equal(
    mapTransactionDoc(invalidDirectionDoc, "gerson").reimbursementDirection,
    null,
    "un valor desconocido/no-string debe mapearse a null, nunca aceptarse tal cual"
  );

  const numericDirectionDoc = fakeDoc("tx-numeric", {
    type: "reimbursement",
    amount: 60000,
    accountId: "acc-1",
    relatedDebtId: "debt-5",
    reimbursementDirection: 1,
    createdAt: null,
    date: null,
  });
  assert.equal(
    mapTransactionDoc(numericDirectionDoc, "gerson").reimbursementDirection,
    null,
    "un valor no-string (number) debe mapearse a null"
  );

  const expense: Transaction = {
    id: "tx-expense",
    ownerId: "gerson",
    title: "",
    notes: "",
    amount: 120000,
    type: "expense",
    accountId: "acc-1",
    targetAccountId: null,
    categoryId: "cat-hogar",
    createdAt: new Date("2026-07-05"),
    date: new Date("2026-07-05"),
  };

  for (const doc of [outgoingDoc, missingDirectionDoc, invalidDirectionDoc, numericDirectionDoc]) {
    const mapped = mapTransactionDoc(doc, "gerson");
    const net = computeNetPersonalExpenses([expense, mapped]);
    assert.equal(net, 120000, `${doc.id}: no debe reducir el gasto del período`);
  }

  console.log("Casos que no deben reducir el gasto (outgoing/ausente/inválido): 8/8 aserciones pasadas.");
}

function runSameMapperUsedByInitialLoadAndLiveListenerTest() {
  const readServiceSource = readSource("features/transactions/services/read-personal-transactions.ts");
  const subscriptionsSource = readSource("features/dashboard/hooks/use-personal-data-subscriptions.ts");

  assert.ok(
    readServiceSource.includes("readAllPersonalTransactions") &&
      readServiceSource.match(/mapTransactionDoc\(docItem, ownerId\)/),
    "la carga inicial (readAllPersonalTransactions) debe mapear con mapTransactionDoc"
  );
  assert.ok(
    subscriptionsSource.includes("mapTransactionDoc"),
    "el listener en vivo debe reutilizar el mismo mapTransactionDoc ya corregido, no una copia propia"
  );
  assert.ok(
    readServiceSource.includes("safeReimbursementDirection(data.reimbursementDirection)"),
    "mapTransactionDoc debe mapear reimbursementDirection con la función de validación estricta"
  );

  console.log("Contrato: carga inicial y listener en vivo comparten el mismo mapTransactionDoc corregido: 3/3 aserciones pasadas.");
}

runFieldMappingTest();
runIntegrationWithNetExpenseFormulaTest();
runNonReducingCasesTest();
runSameMapperUsedByInitialLoadAndLiveListenerTest();

console.log("OK reimbursement-direction-mapping");
