/**
 * tests/unit/ownership-distribution-view-model.test.ts
 *
 * G1 — Panel "Distribución de dinero" (mapa de ownership). Cubre el módulo
 * puro `buildOwnershipDistribution` con fixtures inline (sin Firestore).
 */

import assert from "node:assert/strict";

import {
  buildOwnershipDistribution,
  resolveOwnershipPanelEmptyState,
} from "../../src/features/dashboard/lib/ownership-distribution-view-model";
import { evaluateThirdPartyLegacy } from "../../src/lib/finance/third-party-legacy-evaluation";
import type { MoneyLocation } from "../../src/lib/finance/third-party-location";

console.log("Running unit tests for ownership-distribution-view-model.test.ts...");

const AVAILABLE = (accountId: string): MoneyLocation => ({ accountId, pocketId: null });
const POCKET = (accountId: string, pocketId: string): MoneyLocation => ({ accountId, pocketId });

const entryAt = (entryId: string, amount: number, location: MoneyLocation | null, createdAtMillis = 1) => ({
  entryId,
  createdAtMillis,
  originalAmount: amount,
  location,
});

async function run() {
  // ══════════════════════════════════════════════════════════════
  // 1. mode "not_mine": held solo en Disponible -> 1 fila; bolsillo en 0 se oculta
  // ══════════════════════════════════════════════════════════════
  {
    const result = buildOwnershipDistribution({
      mode: "not_mine",
      accounts: [{ id: "acc-1", name: "Cuenta A", balance: 100_000 }],
      pockets: [{ id: "p1", accountId: "acc-1", name: "Ahorros", balance: 20_000 }],
      entries: [entryAt("e1", 40_000, AVAILABLE("acc-1"))],
      moves: [],
      consumptions: [],
    });

    assert.equal(result.groups.length, 1);
    assert.equal(result.groups[0].rows.length, 1, "el bolsillo sin no propio no debe aparecer");
    assert.equal(result.groups[0].rows[0].kind, "available");
    assert.equal(result.groups[0].rows[0].displayAmount, 40_000);
    assert.equal(result.grandTotal, 40_000);
    assert.equal(result.hasInconsistency, false);
    console.log("  ✓ 1. not_mine: held solo en Disponible -> 1 fila, bolsillo en 0 oculto");
  }

  // ══════════════════════════════════════════════════════════════
  // 2. mode "not_mine": move Disponible -> bolsillo mueve el held, no lo duplica
  // ══════════════════════════════════════════════════════════════
  {
    const result = buildOwnershipDistribution({
      mode: "not_mine",
      accounts: [{ id: "acc-1", name: "Cuenta A", balance: 100_000 }],
      pockets: [{ id: "p1", accountId: "acc-1", name: "Ahorros", balance: 20_000 }],
      entries: [entryAt("e1", 40_000, AVAILABLE("acc-1"))],
      moves: [{ entryId: "e1", amount: 40_000, from: AVAILABLE("acc-1"), to: POCKET("acc-1", "p1") }],
      consumptions: [],
    });

    assert.equal(result.groups.length, 1);
    assert.equal(result.groups[0].rows.length, 1, "solo debe quedar la fila del bolsillo");
    assert.equal(result.groups[0].rows[0].kind, "pocket");
    assert.equal(result.groups[0].rows[0].pocketId, "p1");
    assert.equal(result.groups[0].rows[0].displayAmount, 40_000);
    assert.equal(result.grandTotal, 40_000);
    console.log("  ✓ 2. not_mine: move Disponible->bolsillo reubica el held sin duplicarlo");
  }

  // ══════════════════════════════════════════════════════════════
  // 3. mode "mine": muestra own, oculta own=0
  // ══════════════════════════════════════════════════════════════
  {
    const result = buildOwnershipDistribution({
      mode: "mine",
      accounts: [{ id: "acc-1", name: "Cuenta A", balance: 100_000 }],
      pockets: [{ id: "p1", accountId: "acc-1", name: "Ahorros", balance: 20_000 }],
      entries: [entryAt("e1", 100_000, AVAILABLE("acc-1"))],
      moves: [],
      consumptions: [],
    });

    // Disponible: physical 100k, thirdParty 100k -> own 0 -> oculto.
    // Bolsillo: physical 20k, thirdParty 0 -> own 20k -> visible.
    assert.equal(result.groups.length, 1);
    assert.equal(result.groups[0].rows.length, 1);
    assert.equal(result.groups[0].rows[0].kind, "pocket");
    assert.equal(result.groups[0].rows[0].displayAmount, 20_000);
    console.log("  ✓ 3. mine: muestra own, oculta la ubicación con own=0");
  }

  // ══════════════════════════════════════════════════════════════
  // 4. Inconsistencia (thirdParty > physical): fila visible aunque displayAmount sea 0/negativo
  // ══════════════════════════════════════════════════════════════
  {
    const result = buildOwnershipDistribution({
      mode: "mine",
      accounts: [{ id: "acc-1", name: "Cuenta A", balance: 10_000 }],
      pockets: [],
      entries: [entryAt("e1", 50_000, AVAILABLE("acc-1"))],
      moves: [],
      consumptions: [],
    });

    assert.equal(result.groups.length, 1, "la cuenta inconsistente debe seguir visible");
    assert.equal(result.groups[0].rows.length, 1);
    assert.equal(result.groups[0].rows[0].isInconsistent, true);
    assert.equal(result.groups[0].rows[0].displayAmount, -40_000, "own negativo, sin clamp");
    assert.equal(result.hasInconsistency, true);
    console.log("  ✓ 4. Inconsistencia thirdParty>physical: fila visible + hasInconsistency=true, sin clamp");
  }

  // ══════════════════════════════════════════════════════════════
  // 5. Cuenta sin filas visibles no aparece en groups
  // ══════════════════════════════════════════════════════════════
  {
    const result = buildOwnershipDistribution({
      mode: "not_mine",
      accounts: [
        { id: "acc-1", name: "Cuenta A", balance: 100_000 },
        { id: "acc-2", name: "Cuenta B", balance: 50_000 },
      ],
      pockets: [],
      entries: [entryAt("e1", 40_000, AVAILABLE("acc-1"))],
      moves: [],
      consumptions: [],
    });

    assert.equal(result.groups.length, 1, "acc-2 sin no propio no debe aparecer");
    assert.equal(result.groups[0].accountId, "acc-1");
    console.log("  ✓ 5. Cuenta sin filas visibles (sin no propio) no aparece en groups");
  }

  // ══════════════════════════════════════════════════════════════
  // 6. G1.1 — entry sin ubicación (legado): no aparece en groups, pero
  //    evaluateThirdPartyLegacy reporta el monto pendiente (integración de
  //    los dos puros, tal como los usa el panel).
  // ══════════════════════════════════════════════════════════════
  {
    const entries = [entryAt("e-legacy", 40_000, null)];

    const result = buildOwnershipDistribution({
      mode: "not_mine",
      accounts: [{ id: "acc-1", name: "Cuenta A", balance: 100_000 }],
      pockets: [],
      entries,
      moves: [],
      consumptions: [],
    });
    assert.equal(result.groups.length, 0, "un legado sin ubicación no debe imputarse a ninguna cuenta");

    const legacy = evaluateThirdPartyLegacy({ entries });
    assert.equal(legacy.unlocatedAmount, 40_000, "el panel debe poder mostrar el monto pendiente sin ubicarlo");
    assert.equal(legacy.requiresReview, true);
    console.log("  ✓ 6. Legado sin ubicación: groups vacío + unlocatedAmount>0 (integración de los dos puros)");
  }

  // ══════════════════════════════════════════════════════════════
  // 7. G1.1 — resolveOwnershipPanelEmptyState: legacy / empty / list
  // ══════════════════════════════════════════════════════════════
  {
    assert.equal(
      resolveOwnershipPanelEmptyState({ groupsLength: 0, unlocatedAmount: 40_000, mode: "not_mine" }),
      "legacy",
      "sin filas pero con pendiente sin ubicar -> estado legacy",
    );
    assert.equal(
      resolveOwnershipPanelEmptyState({ groupsLength: 0, unlocatedAmount: 0, mode: "not_mine" }),
      "empty",
      "sin filas y sin pendiente -> vacío de verdad",
    );
    assert.equal(
      resolveOwnershipPanelEmptyState({ groupsLength: 2, unlocatedAmount: 40_000, mode: "not_mine" }),
      "list",
      "con filas visibles siempre es lista, aunque también haya legado (el banner se muestra aparte)",
    );
    console.log("  ✓ 7. resolveOwnershipPanelEmptyState distingue legacy / empty / list");
  }

  console.log("All ownership-distribution-view-model unit tests passed successfully!");
}

run().catch((err) => {
  console.error("Test failure in ownership-distribution-view-model.test.ts:", err);
  process.exitCode = 1;
});
