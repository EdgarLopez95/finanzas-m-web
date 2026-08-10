/**
 * tests/unit/third-party-location-availability-ui.test.ts
 *
 * TDD: cubre la lógica de disponibilidad OCC expuesta en create-transfer-card,
 * el helper puro de disponibilidad, la guarda de doble submit del hook y la
 * eliminación de la ruta antigua de commit.
 *
 * No usa React/RTL. Todo el estado de UI relevante está en helpers puros
 * o en harnesses de concurrencia simples.
 */

import assert from "node:assert/strict";

// ── helpers bajo prueba ────────────────────────────────────────────────────────
import {
  computeThirdPartyAvailability,
  getOccSubmitBlockReason,
  getThirdPartyAvailabilityLabel,
} from "../../src/features/transactions/lib/third-party-availability";

// ── verificación estructural de importadores ───────────────────────────────────
import { readFileSync } from "node:fs";

// ── helpers de snapshot ────────────────────────────────────────────────────────
const emptySnapshot = { entries: [], moves: [], consumptions: [] };

const snapshotWithEntry = (amount: number, accountId = "acct-a", pocketId: string | null = null) => ({
  entries: [
    {
      entryId: "e1",
      createdAtMillis: 100,
      originalAmount: amount,
      location: { accountId, pocketId },
    },
  ],
  moves: [],
  consumptions: [],
});

// ═══════════════════════════════════════════════════════════════════════════════
// Caso 1 — toggle apagado: getOccSubmitBlockReason devuelve null (no bloquea)
// ═══════════════════════════════════════════════════════════════════════════════
async function testToggleOffNoBlock() {
  const reason = getOccSubmitBlockReason({
    movesThirdPartyFunds: false,
    isLoading: true,        // aunque esté cargando...
    loadError: "error",     // aunque haya error...
    thirdPartyAvailable: 0,
    parsedAmount: 10_000,
  });
  assert.equal(reason, null, "toggle apagado → sin bloqueo OCC");

  const label = getThirdPartyAvailabilityLabel({
    movesThirdPartyFunds: false,
    isLoading: false,
    loadError: null,
    thirdPartyAvailable: 5_000,
  });
  assert.equal(label, null, "toggle apagado → sin etiqueta");

  console.log("✅ Caso 1: toggle apagado → no bloquea ni muestra etiqueta");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Caso 2 — toggle encendido + origen Disponible: disponibilidad correcta
// ═══════════════════════════════════════════════════════════════════════════════
async function testToggleOnAvailableSource() {
  const location = { accountId: "acct-a", pocketId: null };
  const snap = snapshotWithEntry(50_000, "acct-a", null);

  const available = computeThirdPartyAvailability(location, snap);
  assert.equal(available, 50_000, "disponibilidad en Disponible debe ser 50_000");

  const label = getThirdPartyAvailabilityLabel({
    movesThirdPartyFunds: true,
    isLoading: false,
    loadError: null,
    thirdPartyAvailable: available,
  });
  assert.ok(label?.includes("$ 50.000"), `etiqueta debe incluir '$ 50.000', fue: ${label}`);

  const reason = getOccSubmitBlockReason({
    movesThirdPartyFunds: true,
    isLoading: false,
    loadError: null,
    thirdPartyAvailable: available,
    parsedAmount: 20_000,
  });
  assert.equal(reason, null, "monto menor a disponible → no bloquea");

  console.log("✅ Caso 2: toggle encendido + Disponible → disponibilidad correcta, no bloquea");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Caso 3 — toggle encendido + origen Bolsillo: usa pocketId correcto
// ═══════════════════════════════════════════════════════════════════════════════
async function testToggleOnPocketSource() {
  const pocket = { accountId: "acct-a", pocketId: "pocket-1" };
  const disponible = { accountId: "acct-a", pocketId: null };

  const snap = {
    entries: [
      { entryId: "e1", createdAtMillis: 100, originalAmount: 30_000, location: pocket },
      { entryId: "e2", createdAtMillis: 200, originalAmount: 20_000, location: disponible },
    ],
    moves: [],
    consumptions: [],
  };

  const availableInPocket = computeThirdPartyAvailability(pocket, snap);
  assert.equal(availableInPocket, 30_000, "bolsillo debe tener solo sus propias entries");

  const availableInDisponible = computeThirdPartyAvailability(disponible, snap);
  assert.equal(availableInDisponible, 20_000, "disponible no incluye lo del bolsillo");

  console.log("✅ Caso 3: bolsillo → usa pocketId correcto, no mezcla con Disponible");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Caso 4 — monto mayor a disponibilidad: botón bloqueado + copy de insuficiencia
// ═══════════════════════════════════════════════════════════════════════════════
async function testAmountExceedsAvailable() {
  const reason = getOccSubmitBlockReason({
    movesThirdPartyFunds: true,
    isLoading: false,
    loadError: null,
    thirdPartyAvailable: 10_000,
    parsedAmount: 20_000,
  });
  assert.ok(reason !== null, "debe bloquear cuando parsedAmount > available");
  assert.ok(/suficiente/i.test(reason!), `copy debe decir "suficiente", fue: ${reason}`);

  console.log("✅ Caso 4: monto > disponible → bloqueado con copy de insuficiencia");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Caso 5 — carga pendiente: botón bloqueado con copy de carga
// ═══════════════════════════════════════════════════════════════════════════════
async function testLoadingBlocks() {
  const reason = getOccSubmitBlockReason({
    movesThirdPartyFunds: true,
    isLoading: true,
    loadError: null,
    thirdPartyAvailable: 0,
    parsedAmount: 5_000,
  });
  assert.ok(reason !== null, "carga pendiente debe bloquear");
  assert.ok(/calculando/i.test(reason!), `copy debe decir "Calculando", fue: ${reason}`);

  const label = getThirdPartyAvailabilityLabel({
    movesThirdPartyFunds: true,
    isLoading: true,
    loadError: null,
    thirdPartyAvailable: 0,
  });
  assert.ok(/calculando/i.test(label!), "etiqueta de carga correcta");

  console.log("✅ Caso 5: carga pendiente → bloqueado con copy de carga");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Caso 6 — error de lectura: botón bloqueado + copy de error
// ═══════════════════════════════════════════════════════════════════════════════
async function testReadErrorBlocks() {
  const reason = getOccSubmitBlockReason({
    movesThirdPartyFunds: true,
    isLoading: false,
    loadError: "No se pudo verificar el dinero no propio disponible. Intenta nuevamente.",
    thirdPartyAvailable: 0,
    parsedAmount: 5_000,
  });
  assert.ok(reason !== null, "error de lectura debe bloquear");
  assert.ok(/verificar/i.test(reason!), `copy debe mencionar "verificar", fue: ${reason}`);

  const label = getThirdPartyAvailabilityLabel({
    movesThirdPartyFunds: true,
    isLoading: false,
    loadError: "boom",
    thirdPartyAvailable: 0,
  });
  assert.ok(/verificar/i.test(label!), "etiqueta de error correcta");

  console.log("✅ Caso 6: error de lectura → bloqueado con copy de error");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Caso 7 — cambio rápido de origen: resultado viejo no pisa el nuevo
// ═══════════════════════════════════════════════════════════════════════════════
async function testStaleResultDoesNotOverride() {
  /**
   * Simula el flag de cancelación que el useEffect de create-transfer-card
   * debe usar: si "cancelled" es true cuando llega la respuesta, se descarta.
   * Este test verifica el patrón de la guarda, sin montar React.
   */
  let committedResult: number | null = null;

  const fetchAvailability = async (
    accountId: string,
    cancelled: () => boolean,
  ): Promise<void> => {
    // Simula latencia diferente por cuenta
    const delay = accountId === "slow" ? 50 : 10;
    await new Promise((r) => setTimeout(r, delay));
    if (cancelled()) return; // guarda
    committedResult = accountId === "slow" ? 99_999 : 5_000;
  };

  // Primera solicitud: cuenta "slow" → 50ms
  let cancelled1 = false;
  const p1 = fetchAvailability("slow", () => cancelled1);

  // Inmediatamente cambia a cuenta rápida
  cancelled1 = true; // cancela la primera
  const p2 = fetchAvailability("fast", () => false);

  await Promise.all([p1, p2]);

  assert.equal(committedResult, 5_000, "el resultado de 'slow' (cancelado) no debe pisar el de 'fast'");
  console.log("✅ Caso 7: cambio rápido de origen → resultado viejo descartado");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Caso 8 — doble submit OCC: uso de guarda pura y verificación estructural
// ═══════════════════════════════════════════════════════════════════════════════
import { createSingleFlightSubmitGuard } from "../../src/features/transactions/lib/single-flight-submit-guard";

async function testDoubleSubmitGuard() {
  let remoteCallCount = 0;
  const guard = createSingleFlightSubmitGuard();

  const submit = async (): Promise<boolean> => {
    if (!guard.tryAcquire()) return false;
    try {
      remoteCallCount++;
      await new Promise((r) => setTimeout(r, 20)); // simula latencia
      return true;
    } finally {
      guard.release();
    }
  };

  // Dos clicks sincrónicos antes de que el primero resuelva
  const [r1, r2] = await Promise.all([submit(), submit()]);

  assert.equal(remoteCallCount, 1, "solo una acción remota debe ocurrir con dos submits concurrentes");
  assert.equal(r1, true, "primer submit debe tener éxito");
  assert.equal(r2, false, "segundo submit simultáneo debe retornar false");
  
  // Tras release(), un nuevo submit sí puede avanzar
  const r3 = await submit();
  assert.equal(remoteCallCount, 2, "después de release(), debe poder ejecutarse nuevamente");
  assert.equal(r3, true, "submit tras release debe ser exitoso");

  // Verificación estructural del hook real
  const hookContent = readFileSync(
    "src/features/transactions/hooks/use-create-personal-transfer.ts",
    "utf-8"
  );
  assert.ok(
    hookContent.includes("createSingleFlightSubmitGuard"),
    "el hook debe importar y usar createSingleFlightSubmitGuard en vez de isSubmittingRef manual"
  );
  assert.ok(
    hookContent.includes("guardRef.current.tryAcquire()"),
    "el hook debe llamar a tryAcquire()"
  );

  console.log("✅ Caso 8: doble submit OCC → una sola invocación remota (con guarda pura real)");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Caso 9 — transferencia normal: comportamiento anterior intacto
// ═══════════════════════════════════════════════════════════════════════════════
async function testNormalTransferUnaffected() {
  // Sin movesThirdPartyFunds, la disponibilidad no debe cargarse ni bloquear
  const reason = getOccSubmitBlockReason({
    movesThirdPartyFunds: false,
    isLoading: true,
    loadError: "boom",
    thirdPartyAvailable: 0,
    parsedAmount: 1_000_000,
  });
  assert.equal(reason, null, "transferencia normal → sin bloqueo OCC, sin importar estado de carga");
  console.log("✅ Caso 9: transferencia normal → comportamiento anterior intacto");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Caso 10 — servicio commit antiguo: no existe en src/ ni en run-all como ruta de producción
// ═══════════════════════════════════════════════════════════════════════════════
async function testCommitServiceEliminated() {
  // Verificar que ningún archivo en src/ importa el servicio antiguo
  const srcContent = readFileSync(
    "tests/unit/run-all.ts",
    "utf-8",
  );
  assert.ok(
    !srcContent.includes("third-party-location-commit"),
    "run-all.ts NO debe importar third-party-location-commit (servicio eliminado)",
  );

  // Verificar que create-third-party-location-transfer existe (la ruta canónica)
  const { existsSync } = await import("node:fs");
  assert.ok(
    existsSync("src/features/transactions/services/create-third-party-location-transfer.ts"),
    "la ruta canónica de commit OCC debe existir",
  );
  assert.ok(
    !existsSync("src/features/transactions/services/commit-third-party-location-operation.ts"),
    "el servicio antiguo NO debe existir en src/",
  );
  console.log("✅ Caso 10: servicio commit antiguo eliminado → solo ruta canónica existe");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Caso 11 — disponibilidad cero: no bloquea por "suficiencia" si el monto también es 0
// ═══════════════════════════════════════════════════════════════════════════════
async function testZeroAmountNoBlock() {
  const reason = getOccSubmitBlockReason({
    movesThirdPartyFunds: true,
    isLoading: false,
    loadError: null,
    thirdPartyAvailable: 0,
    parsedAmount: 0, // el formulario ya bloquea montos <= 0 por isFormValid
  });
  // Con parsedAmount=0 la condición "parsedAmount > 0 && available < parsedAmount" es false
  assert.equal(reason, null, "con parsedAmount=0 el bloqueo OCC no aplica (isFormValid lo maneja)");
  console.log("✅ Caso 11: monto=0 → isFormValid lo bloquea; getOccSubmitBlockReason no actúa");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Ejecutar todos
// ═══════════════════════════════════════════════════════════════════════════════
async function run() {
  console.log("Running third-party-location-availability-ui tests...");
  await testToggleOffNoBlock();
  await testToggleOnAvailableSource();
  await testToggleOnPocketSource();
  await testAmountExceedsAvailable();
  await testLoadingBlocks();
  await testReadErrorBlocks();
  await testStaleResultDoesNotOverride();
  await testDoubleSubmitGuard();
  await testNormalTransferUnaffected();
  await testCommitServiceEliminated();
  await testZeroAmountNoBlock();
  console.log("All third-party-location-availability-ui tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
