import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  calculateAccountPhysicalBalances,
  resolveLocationPhysicalBalance,
  calculateLocationOwnershipComposition,
  moneyLocationKey,
  type PocketBalanceLike,
  type AccountDisplayBalances,
} from "../../src/lib/finance/account-balance-model";

// Patrón prohibido: reconstruir Disponible restando bolsillos de un Total ya enriquecido.
// Ningún archivo de consumo visual debe volver a usar esta forma.
const FORBIDDEN_SUBTRACTION_PATTERN = /\.balance\s*-\s*(pocketsSum|pSum|pocketsTotal|pocketsBalance)\b/;

console.log("Running unit tests for account-balance-model.test.ts...");

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

async function runAccountBalanceModelTests() {
  // Test 1: cuenta sin bolsillos -> Disponible = Total.
  {
    const result = calculateAccountPhysicalBalances(120_000, []);
    assert.strictEqual(result.availableBalance, 120_000);
    assert.strictEqual(result.pocketsBalance, 0);
    assert.strictEqual(result.totalBalance, 120_000, "Sin bolsillos, Total debe ser igual a Disponible");
    console.log("  ✓ Test 1: cuenta sin bolsillos -> Disponible = Total");
  }

  // Test 2: cuenta con varios bolsillos -> Total = Disponible + Σ bolsillos.
  {
    const pockets: PocketBalanceLike[] = [{ balance: 50_000 }, { balance: 20_000 }];
    const result = calculateAccountPhysicalBalances(120_000, pockets);
    assert.strictEqual(result.pocketsBalance, 70_000);
    assert.strictEqual(result.totalBalance, 190_000);
    console.log("  ✓ Test 2: Total suma Disponible + varios bolsillos (120.000 + 50.000 + 20.000 = 190.000)");
  }

  // Test 3: Disponible nunca se descuenta una segunda vez por los bolsillos.
  {
    const pockets: PocketBalanceLike[] = [{ balance: 30_000 }];
    const result = calculateAccountPhysicalBalances(100_000, pockets);
    assert.strictEqual(result.availableBalance, 100_000, "El disponible devuelto debe ser el mismo valor de entrada, sin restarle nada");
    console.log("  ✓ Test 3: Disponible nunca se reduce otra vez por los bolsillos");
  }

  // Test 4: un bolsillo resuelve su propio saldo físico (no el de la cuenta).
  {
    const balanceFromPocket = resolveLocationPhysicalBalance({ availableBalance: 999_999, pocket: { balance: 20_000 } });
    assert.strictEqual(balanceFromPocket, 20_000, "El físico de un bolsillo es su propio balance, nunca el Disponible de la cuenta");

    const balanceFromAvailable = resolveLocationPhysicalBalance({ availableBalance: 120_000, pocket: null });
    assert.strictEqual(balanceFromAvailable, 120_000, "El físico de Disponible (pocket null) es currentBalance de la cuenta");
    console.log("  ✓ Test 4: resolveLocationPhysicalBalance distingue bolsillo vs Disponible correctamente");
  }

  // Test 5: composición normal de propio/no propio.
  {
    const composition = calculateLocationOwnershipComposition({ physicalBalance: 100_000, thirdPartyBalance: 40_000 });
    assert.strictEqual(composition.ownBalance, 60_000);
    assert.strictEqual(composition.isInconsistent, false);
    console.log("  ✓ Test 5: composición normal -> físico 100.000, no propio 40.000 => propio 60.000, sin inconsistencia");
  }

  // Test 6: inconsistencia SIN clamp -> propio negativo permanece negativo.
  {
    const composition = calculateLocationOwnershipComposition({ physicalBalance: 100_000, thirdPartyBalance: 120_000 });
    assert.strictEqual(composition.ownBalance, -20_000, "El propio negativo NO debe clampearse a 0");
    assert.strictEqual(composition.isInconsistent, true);

    const smallCase = calculateLocationOwnershipComposition({ physicalBalance: 10_000, thirdPartyBalance: 15_000 });
    assert.strictEqual(smallCase.ownBalance, -5_000);
    assert.strictEqual(smallCase.isInconsistent, true);
    console.log("  ✓ Test 6: inconsistencia sin clamp -> propio negativo permanece negativo (100.000/120.000 y 10.000/15.000)");
  }

  // Test 7: NaN, Infinity y montos inválidos son rechazados con errores claros.
  {
    assert.throws(() => calculateAccountPhysicalBalances(Number.NaN, []), /número finito/);
    assert.throws(() => calculateAccountPhysicalBalances(Infinity, []), /número finito/);
    assert.throws(() => calculateAccountPhysicalBalances(-Infinity, []), /número finito/);
    assert.throws(() => calculateAccountPhysicalBalances(100, [{ balance: Number.NaN }]), /número finito/);

    assert.throws(
      () => resolveLocationPhysicalBalance({ availableBalance: Number.NaN, pocket: null }),
      /número finito/
    );
    assert.throws(
      () => resolveLocationPhysicalBalance({ availableBalance: 100, pocket: { balance: Infinity } }),
      /número finito/
    );

    assert.throws(
      () => calculateLocationOwnershipComposition({ physicalBalance: Number.NaN, thirdPartyBalance: 0 }),
      /número finito/
    );
    assert.throws(
      () => calculateLocationOwnershipComposition({ physicalBalance: 100, thirdPartyBalance: Infinity }),
      /número finito/
    );

    console.log("  ✓ Test 7: NaN/Infinity rechazados con errores claros en los tres helpers");
  }

  // Test 8: contrato estructural — read-personal-accounts.ts mantiene compatibilidad currentBalance ?? balance.
  {
    const readerSrc = readSrc("features/accounts/services/read-personal-accounts.ts");
    assert.match(
      readerSrc,
      /data\.currentBalance\s*\?\?\s*data\.balance/,
      "read-personal-accounts.ts debe conservar la lectura legacy currentBalance ?? balance"
    );
    console.log("  ✓ Test 8: read-personal-accounts.ts conserva compatibilidad currentBalance ?? balance");
  }

  // Test 9: ningún servicio mutador tocado en este paso usa el total enriquecido como fuente de Disponible.
  {
    // adjust-account-balance.ts es el servicio directamente relevante a la corrección de copy de este paso
    // (EditAccountDialog -> "Reajustar saldo"): debe leer currentBalance FRESCO de Firestore dentro de la
    // transacción, nunca aceptar un "saldo actual" enriquecido pasado por el caller.
    const adjustSrc = readSrc("features/accounts/services/adjust-account-balance.ts");
    assert.match(
      adjustSrc,
      /accountData\.currentBalance\s*\?\?\s*accountData\.balance/,
      "adjustAccountBalance debe leer currentBalance ?? balance desde el snapshot de Firestore dentro de la transacción"
    );
    assert.doesNotMatch(
      adjustSrc,
      /currentBalance\s*:\s*payload\./,
      "adjustAccountBalance no debe escribir currentBalance directamente desde un campo del payload del caller"
    );
    // El input tipado no expone ningún campo que sugiera un total enriquecido (p. ej. "totalBalance").
    assert.doesNotMatch(
      adjustSrc,
      /totalBalance/,
      "adjustAccountBalance no debe recibir ni usar un totalBalance enriquecido"
    );

    console.log("  ✓ Test 9: adjustAccountBalance (servicio mutador relevante a este paso) nunca usa un total enriquecido como Disponible");
  }

  // Test adicional: moneyLocationKey produce una clave estable y distinta para Disponible vs bolsillo.
  {
    const availableKey = moneyLocationKey({ accountId: "acc-1", pocketId: null });
    const pocketKey = moneyLocationKey({ accountId: "acc-1", pocketId: "pocket-1" });
    assert.notStrictEqual(availableKey, pocketKey);
    assert.strictEqual(moneyLocationKey({ accountId: "acc-1", pocketId: null }), availableKey, "misma ubicación -> misma clave");
    console.log("  ✓ Test adicional: moneyLocationKey distingue Disponible de un bolsillo puntual, de forma estable");
  }

  // Test 10 (corrección Paso 1 - cierre, escenario a): cuenta con Disponible 120.000 y
  // bolsillos 50.000/20.000 expone los tres valores por separado, usando el alias
  // `AccountDisplayBalances` orientado a consumidores visuales.
  {
    const pockets: PocketBalanceLike[] = [{ balance: 50_000 }, { balance: 20_000 }];
    const display: AccountDisplayBalances = calculateAccountPhysicalBalances(120_000, pockets);
    assert.strictEqual(display.availableBalance, 120_000);
    assert.strictEqual(display.pocketsBalance, 70_000);
    assert.strictEqual(display.totalBalance, 190_000);
    console.log("  ✓ Test 10: AccountDisplayBalances (120.000 disponible, bolsillos 50.000/20.000) -> availableBalance=120000, pocketsBalance=70000, totalBalance=190000");
  }

  // Test 11 (escenario b): el patrón prohibido `balance - pocketsSum/pSum/...` (reconstrucción
  // de Disponible restando bolsillos de un Total) no debe aparecer en ninguno de los
  // consumidores visuales corregidos en este cierre del Paso 1.
  {
    // Prueba de discriminación de la propia regex: debe SÍ capturar el patrón viejo (buggy)...
    const buggyFixture = "const disponibleBalance = account.balance - pocketsBalance;";
    assert.match(
      buggyFixture,
      FORBIDDEN_SUBTRACTION_PATTERN,
      "la regex de detección debe capturar el patrón de reconstrucción histórico (RED esperado sobre el código viejo)"
    );

    const fixedConsumers = [
      "components/finance/account-pocket-card.tsx",
      "features/dashboard/components/personal-views.tsx",
      "features/accounts/components/account-detail-view.tsx",
      "features/pockets/components/pocket-detail-dialog.tsx",
      "features/transactions/components/create-transfer-card.tsx",
      "features/household/components/complete-share-dialog.tsx",
      "features/household/components/confirm-reception-dialog.tsx",
      "features/household/components/declare-payment-dialog.tsx",
    ];
    for (const rel of fixedConsumers) {
      const src = readSrc(rel);
      assert.doesNotMatch(
        src,
        FORBIDDEN_SUBTRACTION_PATTERN,
        `${rel} no debe reconstruir Disponible restando bolsillos de un Total (patrón prohibido)`
      );
    }
    console.log("  ✓ Test 11: ningún consumidor visual corregido reconstruye Disponible restando bolsillos de un Total");
  }

  // Test 12 (escenario c): AccountPocketCard usa explícitamente totalBalance para el
  // encabezado y availableBalance (vía calculateAccountPhysicalBalances) para "Libre".
  {
    const src = readSrc("components/finance/account-pocket-card.tsx");
    assert.match(
      src,
      /import\s*\{\s*calculateAccountPhysicalBalances\s*\}\s*from\s*"@\/lib\/finance\/account-balance-model"/,
      "AccountPocketCard debe importar calculateAccountPhysicalBalances"
    );
    assert.match(
      src,
      /const\s*\{\s*availableBalance,\s*totalBalance\s*\}\s*=\s*calculateAccountPhysicalBalances\(account\.balance,\s*pockets\)/,
      "AccountPocketCard debe derivar availableBalance/totalBalance explícitamente con el núcleo puro"
    );
    assert.match(
      src,
      /value=\{totalBalance\}/,
      "el encabezado (monto principal) de AccountPocketCard debe usar totalBalance explícitamente"
    );
    console.log("  ✓ Test 12: AccountPocketCard usa totalBalance en el encabezado y availableBalance para Disponible/Libre");
  }

  // Test 13 (escenario d): el detalle de cuenta deriva totalBalance explícito y
  // EditAccountDialog recibe un prop availableBalance explícito (nunca account.balance directo).
  // El detalle dejó de ser un modal dentro de `personal-views` y vive ahora en
  // `features/accounts/components/account-detail-view.tsx` (pantalla
  // `/accounts/[accountId]`); `EditAccountDialog` sigue en `personal-views`.
  {
    const detail = readSrc("features/accounts/components/account-detail-view.tsx");
    const views = readSrc("features/dashboard/components/personal-views.tsx");
    assert.match(
      detail,
      /const\s*\{\s*availableBalance,\s*pocketsBalance,\s*totalBalance\s*\}\s*=\s*calculateAccountPhysicalBalances\(account\.balance,\s*pockets\)/,
      "AccountDetailView debe derivar availableBalance/pocketsBalance/totalBalance explícitamente"
    );
    assert.match(
      detail,
      /size="display"\s*value=\{totalBalance\}/,
      "el encabezado de AccountDetailView debe mostrar totalBalance explícito, no account.balance directo"
    );
    assert.match(
      views,
      /availableBalance:\s*number;/,
      "EditAccountDialog debe declarar un prop availableBalance explícito"
    );
    assert.match(
      detail,
      /availableBalance=\{disponibleBalance\}/,
      "el call site de EditAccountDialog debe pasar availableBalance explícitamente (nunca account.balance)"
    );
    console.log("  ✓ Test 13: AccountDetailView y EditAccountDialog usan campos explícitos (totalBalance/availableBalance), nunca account.balance ambiguo");
  }

  // Test 14: el store ya no sobrescribe Account.balance con el Total enriquecido —
  // ninguna página puede volver a heredar la ambigüedad desde el store base.
  {
    const storeSrc = readSrc("stores/personal-data-store.ts");
    assert.doesNotMatch(
      storeSrc,
      /balance:\s*(totalBalance|calculateAccountTotalBalance\()/,
      "personal-data-store.ts no debe sobrescribir account.balance con un Total enriquecido"
    );
    console.log("  ✓ Test 14: personal-data-store.ts ya no enriquece Account.balance con el Total (queda como Disponible crudo)");
  }

  // Test 15 (corrección P1 — hallazgo computeGrossBalance): use-personal-dashboard-data.ts
  // no debe volver a construir un `Account` enriquecido cuyo `.balance` termine
  // significando el Total (ni siquiera de forma efímera para alimentar el bruto).
  {
    const hookSrc = readSrc("features/dashboard/hooks/use-personal-dashboard-data.ts");
    assert.doesNotMatch(
      hookSrc,
      /balance:\s*totalBalance/,
      "use-personal-dashboard-data.ts no debe contener 'balance: totalBalance' — computeGrossBalance ya no recibe Account[] enriquecidos"
    );
    assert.doesNotMatch(
      hookSrc,
      /\.\.\.\w+,\s*balance:\s*total/,
      "use-personal-dashboard-data.ts no debe reconstruir un objeto tipo Account con balance=total (patrón { ...acc, balance: total... })"
    );
    assert.match(
      hookSrc,
      /includeInTotal:\s*acc\.includeInTotal\s*!==\s*false,\s*totalBalance/,
      "use-personal-dashboard-data.ts debe construir entradas explícitas { includeInTotal, totalBalance } para computeGrossBalance"
    );
    console.log("  ✓ Test 15: use-personal-dashboard-data.ts ya no construye un Account enriquecido con balance=Total para el cálculo bruto");
  }

  console.log("All account-balance-model unit tests passed successfully!");
}

runAccountBalanceModelTests().catch((err) => {
  console.error("Test failure in account-balance-model.test.ts:", err);
  process.exit(1);
});
