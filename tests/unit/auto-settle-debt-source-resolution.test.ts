import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { createHouseholdDataStore } from "../../src/stores/household-data-store";

console.log("Running unit tests for auto-settle-debt-source-resolution.test.ts...");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

function runServiceStructuralTests() {
  const serviceContent = readSource("features/household/services/auto-settle-debt-reception.ts");

  // Test 1: la resolución de fuente usa el helper puro compartido con el resto
  // del contrato (no reimplementa el orden evento->share inline).
  {
    assert.ok(
      serviceContent.includes("resolveDebtSourceTransactionId"),
      "auto-settle-debt-reception.ts debe delegar el orden de resolución a resolveDebtSourceTransactionId"
    );
  }

  // Test 2 (requisito 5 del contrato): la share del pagador se lee por su ID
  // determinista `${eventId}_${resolvedPayerId}` (resolvedPayerId viene de
  // resolvePayerUserId, no directamente de eventData.paidByUserId) con una
  // lectura puntual dentro de la misma transacción — no una query amplia
  // (`collection`/`query`/`where` sobre household_event_shares) ni una
  // escritura extra sobre esa colección.
  {
    assert.ok(
      serviceContent.includes('doc(db, "household_event_shares", `${eventId}_${resolvedPayerId}`)'),
      "debe leer la share del pagador por su ID determinista ${eventId}_${resolvedPayerId}"
    );
    assert.ok(
      serviceContent.includes("resolvePayerUserId"),
      "debe resolver el pagador con resolvePayerUserId (paidByUserId con fallback a createdByUserId), no leer paidByUserId directo"
    );
    assert.ok(
      !/household_event_shares[\s\S]{0,80}(collection|query|where)/.test(serviceContent),
      "no debe hacer una consulta amplia sobre household_event_shares"
    );
    assert.ok(
      !serviceContent.includes('transaction.set') || !serviceContent.match(/transaction\.set[\s\S]{0,40}household_event_shares/),
      "no debe escribir en household_event_shares (solo lectura puntual)"
    );
  }

  // Test 3 (requisito 4 del contrato, "cuenta borrada"): la resolución de la
  // cuenta destino está envuelta en try/catch que degrada a needs_manual_account
  // en vez de tratar una cuenta borrada/inexistente como fallo inesperado.
  {
    const loadExpenseSourceIndex = serviceContent.indexOf("await loadExpenseSourceState(");
    assert.ok(loadExpenseSourceIndex !== -1, "debe llamar loadExpenseSourceState para la cuenta destino");
    const before = serviceContent.slice(0, loadExpenseSourceIndex);
    const lastTryIndex = before.lastIndexOf("try {");
    assert.ok(lastTryIndex !== -1, "loadExpenseSourceState debe estar dentro de un try");
    const after = serviceContent.slice(loadExpenseSourceIndex);
    const catchBlockMatch = after.match(/}\s*catch[\s\S]{0,200}/);
    assert.ok(catchBlockMatch, "debe existir un catch inmediatamente después de loadExpenseSourceState");
    assert.ok(
      catchBlockMatch![0].includes("needs_manual_account"),
      "el catch de la cuenta destino debe degradar a needs_manual_account, no a failed"
    );
  }

  // Test 4: la resolución de fuente por evento sigue teniendo prioridad sobre
  // la share en el orden de lectura del servicio (evento primero).
  {
    const eventReadIndex = serviceContent.indexOf('doc(db, "household_events"');
    const shareReadIndex = serviceContent.indexOf('doc(db, "household_event_shares"');
    assert.ok(eventReadIndex !== -1 && shareReadIndex !== -1, "debe leer tanto el evento como la share");
    assert.ok(eventReadIndex < shareReadIndex, "debe leer el evento antes que la share del pagador");
  }

  console.log("Estructura del servicio (orden Android, share puntual, cuenta borrada): 4/4 pruebas pasadas.");
}

function runShareChangeReevaluationTest() {
  // Test 5 (contrato punto 6): un cambio que solo toca eventShares (no debts)
  // dispara igualmente el listener de household-data-store. El observador
  // (`use-auto-settle-debts.ts`) usa exactamente `useHouseholdDataStore.subscribe(evaluate)`
  // sin selector, así que cualquier `set()` -incluido uno que solo cambie
  // eventShares- debe invocar el listener. Se prueba aquí contra una instancia
  // aislada del store (misma factory `createHouseholdDataStore` que usa la app)
  // para no depender de un montaje real de React.
  const store = createHouseholdDataStore();
  store.setState({
    status: "success",
    uid: "user-creditor",
    data: {
      ...store.getState().data,
      activeHouseholdId: "hh-1",
      debts: [
        {
          id: "debt-1",
          householdId: "hh-1",
          eventId: "event-1",
          title: "Deuda",
          fromUserId: "user-debtor",
          toUserId: "user-creditor",
          amount: 60000,
          status: "payment_declared",
          outgoingTransactionId: "tx-outgoing-1",
          incomingTransactionId: null,
          createdAt: null,
        },
      ],
    },
  });

  let notifications = 0;
  const unsubscribe = store.subscribe(() => {
    notifications++;
  });

  // Cambio que SOLO toca eventShares (los debts siguen siendo la misma referencia).
  store.getState().applyHouseholdSnapshot(
    {
      eventShares: [
        {
          id: "event-1_user-debtor",
          householdId: "hh-1",
          eventId: "event-1",
          memberUserId: "user-debtor",
          amount: 60000,
          percentage: null,
          status: "completed",
          isPaid: true,
          completedByTransactionId: "tx-from-share",
          createdAt: null,
        },
      ],
    },
    "user-creditor"
  );

  unsubscribe();

  assert.ok(
    notifications >= 1,
    "un cambio que solo actualiza eventShares debe notificar a los suscriptores de household-data-store (y por lo tanto disparar una nueva evaluación del observador de auto-settle)"
  );

  console.log("Reevaluación por cambio de share (contrato punto 6): 1/1 prueba pasada.");
}

runServiceStructuralTests();
runShareChangeReevaluationTest();
