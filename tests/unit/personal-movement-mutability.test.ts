/**
 * tests/unit/personal-movement-mutability.test.ts
 *
 * G3 — Inmutabilidad de movimientos que tocan el ledger de dinero no propio.
 *
 * Cubre el helper puro (fuente única de la UI) y la causa raíz que lo hacía
 * inoperante: `mapTransactionDoc` no copiaba `consumesThirdPartyFunds` ni
 * `movesThirdPartyFunds` desde Firestore, así que la UI nunca veía las
 * banderas y ofrecía Editar/Eliminar sobre movimientos que el servicio
 * rechaza.
 */

import assert from "node:assert/strict";

import {
  isPersonalMovementEditable,
  isPersonalMovementDeletable,
  getPersonalMovementEditBlockReason,
  getPersonalMovementDeleteBlockReason,
  IMMUTABLE_CONSUMES_MESSAGE,
  IMMUTABLE_MOVES_MESSAGE,
  IMMUTABLE_TECHNICAL_EDIT_MESSAGE,
  IMMUTABLE_TYPE_MESSAGE,
} from "../../src/features/transactions/lib/personal-movement-mutability";
import { mapTransactionDoc } from "../../src/features/transactions/services/read-personal-transactions";

console.log("Running unit tests for personal-movement-mutability.test.ts...");

// Simula un QueryDocumentSnapshot<DocumentData>: mapTransactionDoc solo usa
// `id` y `data()`.
const fakeDoc = (id: string, data: Record<string, unknown>) =>
  ({ id, data: () => data }) as unknown as Parameters<typeof mapTransactionDoc>[0];

async function run() {
  // ══════════════════════════════════════════════════════════════
  // 1. Gasto normal -> mutable
  // ══════════════════════════════════════════════════════════════
  {
    const tx = { type: "expense", title: "Mercado" };
    assert.equal(isPersonalMovementEditable(tx), true);
    assert.equal(isPersonalMovementDeletable(tx), true);
    assert.equal(getPersonalMovementEditBlockReason(tx), null);
    assert.equal(getPersonalMovementDeleteBlockReason(tx), null);
    console.log("  ✓ 1. Gasto normal -> mutable, sin motivo de bloqueo");
  }

  // ══════════════════════════════════════════════════════════════
  // 2. Gasto que consumió dinero no propio -> inmutable
  // ══════════════════════════════════════════════════════════════
  {
    const tx = { type: "expense", title: "Mercado", consumesThirdPartyFunds: true };
    assert.equal(isPersonalMovementEditable(tx), false);
    assert.equal(isPersonalMovementDeletable(tx), false);
    assert.equal(getPersonalMovementEditBlockReason(tx), IMMUTABLE_CONSUMES_MESSAGE);
    assert.equal(getPersonalMovementDeleteBlockReason(tx), IMMUTABLE_CONSUMES_MESSAGE);
    console.log("  ✓ 2. Gasto con consumesThirdPartyFunds -> inmutable con el motivo de consumo");
  }

  // ══════════════════════════════════════════════════════════════
  // 3. Transfer que movió dinero no propio -> inmutable
  // ══════════════════════════════════════════════════════════════
  {
    const tx = { type: "transfer", title: "Traslado", movesThirdPartyFunds: true };
    assert.equal(isPersonalMovementEditable(tx), false);
    assert.equal(isPersonalMovementDeletable(tx), false);
    assert.equal(getPersonalMovementEditBlockReason(tx), IMMUTABLE_MOVES_MESSAGE);
    assert.equal(getPersonalMovementDeleteBlockReason(tx), IMMUTABLE_MOVES_MESSAGE);
    console.log("  ✓ 3. Transfer con movesThirdPartyFunds -> inmutable con el motivo de movimiento");
  }

  // ══════════════════════════════════════════════════════════════
  // 4. Movimiento técnico -> no editable pero SÍ eliminable
  // ══════════════════════════════════════════════════════════════
  {
    const tx = { type: "transfer", title: "Saldo inicial" };
    assert.equal(isPersonalMovementEditable(tx), false);
    assert.equal(isPersonalMovementDeletable(tx), true);
    assert.equal(getPersonalMovementEditBlockReason(tx), IMMUTABLE_TECHNICAL_EDIT_MESSAGE);
    assert.equal(getPersonalMovementDeleteBlockReason(tx), null);
    console.log("  ✓ 4. Título técnico 'Saldo inicial' -> no editable, pero sí eliminable");
  }

  // ══════════════════════════════════════════════════════════════
  // 5. Reembolso (tipo no accionable) -> inmutable
  // ══════════════════════════════════════════════════════════════
  {
    const tx = { type: "reimbursement", title: "Pago de deuda" };
    assert.equal(isPersonalMovementEditable(tx), false);
    assert.equal(isPersonalMovementDeletable(tx), false);
    assert.equal(getPersonalMovementEditBlockReason(tx), IMMUTABLE_TYPE_MESSAGE);
    assert.equal(getPersonalMovementDeleteBlockReason(tx), IMMUTABLE_TYPE_MESSAGE);
    console.log("  ✓ 5. Reembolso -> inmutable por tipo no accionable");
  }

  // ══════════════════════════════════════════════════════════════
  // 6. CAUSA RAÍZ: mapTransactionDoc debe copiar AMBAS banderas
  // ══════════════════════════════════════════════════════════════
  {
    const mapped = mapTransactionDoc(
      fakeDoc("tx-1", {
        type: "expense",
        title: "Gasto de otro",
        amount: 10_000,
        accountId: "acc-1",
        consumesThirdPartyFunds: true,
        movesThirdPartyFunds: true,
      }),
      "gerson",
    );
    assert.equal(mapped.consumesThirdPartyFunds, true, "mapTransactionDoc debe copiar consumesThirdPartyFunds");
    assert.equal(mapped.movesThirdPartyFunds, true, "mapTransactionDoc debe copiar movesThirdPartyFunds");

    // Y el helper debe verlas sobre el objeto ya mapeado (el camino real de la UI).
    assert.equal(isPersonalMovementEditable(mapped), false, "el movimiento mapeado debe quedar ineditable");
    assert.equal(isPersonalMovementDeletable(mapped), false, "el movimiento mapeado debe quedar ineliminable");
    console.log("  ✓ 6. mapTransactionDoc copia ambas banderas y el helper las ve sobre el Transaction mapeado");
  }

  // ══════════════════════════════════════════════════════════════
  // 7. Ausencia / truthy raro -> false estricto (nunca inmutabiliza de más)
  // ══════════════════════════════════════════════════════════════
  {
    const missing = mapTransactionDoc(
      fakeDoc("tx-2", { type: "expense", title: "Mercado", amount: 10_000, accountId: "acc-1" }),
      "gerson",
    );
    assert.equal(missing.consumesThirdPartyFunds, false, "sin campo remoto -> false, no undefined");
    assert.equal(missing.movesThirdPartyFunds, false, "sin campo remoto -> false, no undefined");
    assert.equal(isPersonalMovementEditable(missing), true, "un gasto normal sigue siendo editable");

    const truthy = mapTransactionDoc(
      fakeDoc("tx-3", {
        type: "expense",
        title: "Mercado",
        amount: 10_000,
        accountId: "acc-1",
        consumesThirdPartyFunds: "sí",
        movesThirdPartyFunds: 1,
      }),
      "gerson",
    );
    assert.equal(truthy.consumesThirdPartyFunds, false, "solo === true cuenta, no un truthy cualquiera");
    assert.equal(truthy.movesThirdPartyFunds, false, "solo === true cuenta, no un truthy cualquiera");
    console.log("  ✓ 7. Banderas ausentes o con truthy raro -> false estricto (solo === true bloquea)");
  }

  // ══════════════════════════════════════════════════════════════
  // 8. Ingreso Tránsito sigue editable (fuera de alcance de G3)
  // ══════════════════════════════════════════════════════════════
  {
    const transito = mapTransactionDoc(
      fakeDoc("tx-4", {
        type: "income",
        title: "Me prestaron",
        amount: 40_000,
        accountId: "acc-1",
        countsAsRealIncome: false,
      }),
      "gerson",
    );
    assert.equal(transito.countsAsRealIncome, false);
    assert.equal(
      isPersonalMovementEditable(transito),
      true,
      "G3 no bloquea ingresos Tránsito: su regla, si aplica, vive aparte",
    );
    console.log("  ✓ 8. Ingreso Tránsito (countsAsRealIncome=false) NO queda bloqueado por G3");
  }

  console.log("All personal-movement-mutability unit tests passed successfully!");
}

run().catch((err) => {
  console.error("Test failure in personal-movement-mutability.test.ts:", err);
  process.exitCode = 1;
});
