
import assert from "node:assert/strict";

import {
  assertSufficientOwnFunds,
  resolveOwnFundsCompositionFeedback,
  resolveInsufficientFundsMessage,
} from "../../src/lib/finance/own-funds-gate";

console.log("Running unit tests for own-funds-gate.test.ts...");

// ══════════════════════════════════════════════════════════════
// Barrera dura de los servicios (assertSufficientOwnFunds)
// ══════════════════════════════════════════════════════════════

{
  assert.doesNotThrow(() =>
    assertSufficientOwnFunds({ physicalBalance: 100_000, thirdPartyHeld: 40_000, amount: 60_000 }),
  );
  console.log("  ✓ permite exactamente Mi dinero");
}

{
  // G4 — el texto ahora es el canónico compartido con el panel de composición.
  assert.throws(
    () => assertSufficientOwnFunds({ physicalBalance: 100_000, thirdPartyHeld: 40_000, amount: 60_001 }),
    /pero solo .* es tu dinero/i,
  );
  console.log("  ✓ rechaza Mi dinero + 1 con el copy canónico de propiedad");
}

{
  assert.throws(
    () => assertSufficientOwnFunds({ physicalBalance: 50_000, thirdPartyHeld: 60_000, amount: 1 }),
    /composición de dinero propio.*inconsistente/i,
  );
  console.log("  ✓ rechaza composición inconsistente sin clamp");
}

{
  assert.throws(
    () => assertSufficientOwnFunds({ physicalBalance: 100_000, thirdPartyHeld: Number.NaN, amount: 1 }),
    /composición de dinero propio.*inconsistente/i,
  );
  console.log("  ✓ rechaza heldAtLocation no finito");
}

{
  // G4 — sin saldo físico el motivo YA NO se confunde con el de propiedad.
  assert.throws(
    () => assertSufficientOwnFunds({ physicalBalance: 100_000, thirdPartyHeld: 40_000, amount: 150_000 }),
    /Saldo insuficiente/i,
  );
  console.log("  ✓ rechaza por saldo físico con un motivo distinto al de propiedad");
}

// ══════════════════════════════════════════════════════════════
// G4 — feedback de composición para los formularios
// ══════════════════════════════════════════════════════════════

{
  const feedback = resolveOwnFundsCompositionFeedback({ physical: 100_000, held: 40_000, amount: 60_000 });
  assert.equal(feedback.kind, "ok");
  assert.equal(feedback.message, null);
  assert.equal(feedback.physical, 100_000);
  assert.equal(feedback.held, 40_000);
  assert.equal(feedback.own, 60_000);
  console.log("  ✓ G4.1 amount ≤ own -> ok, sin mensaje, con los tres montos expuestos");
}

{
  const feedback = resolveOwnFundsCompositionFeedback({ physical: 100_000, held: 40_000, amount: 60_001 });
  assert.equal(feedback.kind, "insufficient_own", "físico alcanza pero Mi dinero no");
  assert.equal(feedback.own, 60_000);
  assert.ok(feedback.message);
  assert.match(feedback.message, /no propio/i, "debe explicar que el exceso es dinero no propio");
  assert.match(feedback.message, /60/, "debe indicar cuánto es realmente suyo");
  console.log("  ✓ G4.2 own < amount ≤ physical -> insufficient_own y el mensaje nombra el dinero no propio");
}

{
  const feedback = resolveOwnFundsCompositionFeedback({ physical: 100_000, held: 40_000, amount: 150_000 });
  assert.equal(feedback.kind, "insufficient_physical");
  assert.ok(feedback.message);
  assert.doesNotMatch(feedback.message, /no propio/i, "sin saldo físico el motivo no es la propiedad");
  console.log("  ✓ G4.3 amount > physical -> insufficient_physical con motivo de saldo, no de propiedad");
}

{
  const feedback = resolveOwnFundsCompositionFeedback({ physical: 50_000, held: 60_000, amount: 1 });
  assert.equal(feedback.kind, "inconsistent");
  assert.equal(feedback.own, -10_000, "Mi dinero negativo se reporta tal cual, SIN clamp");
  assert.match(String(feedback.message), /inconsistente/i);
  console.log("  ✓ G4.4 held > physical -> inconsistent y own negativo se expone sin clamp");
}

{
  // La inconsistencia manda sobre cualquier otra evaluación.
  const zero = resolveOwnFundsCompositionFeedback({ physical: 50_000, held: 60_000, amount: 0 });
  assert.equal(zero.kind, "inconsistent", "una composición imposible no se vuelve 'ok' con monto 0");

  const okZero = resolveOwnFundsCompositionFeedback({ physical: 100_000, held: 40_000, amount: 0 });
  assert.equal(okZero.kind, "ok", "monto 0 sobre composición sana no es un error de composición");
  console.log("  ✓ G4.5 precedencia: inconsistente manda sobre monto 0; monto 0 sano es ok");
}

{
  // La barrera y el panel comparten literalmente el mismo texto.
  const feedback = resolveOwnFundsCompositionFeedback({ physical: 100_000, held: 40_000, amount: 80_000 });
  const direct = resolveInsufficientFundsMessage({ requested: 80_000, physical: 100_000, own: 60_000 });
  assert.equal(feedback.message, direct, "el panel no puede inventar un copy distinto al canónico");

  let thrown = "";
  try {
    assertSufficientOwnFunds({ physicalBalance: 100_000, thirdPartyHeld: 40_000, amount: 80_000 });
  } catch (error) {
    thrown = error instanceof Error ? error.message : String(error);
  }
  assert.equal(thrown, feedback.message, "el servicio debe lanzar el mismo texto que ya mostró el formulario");
  console.log("  ✓ G4.6 formulario y servicio comparten exactamente el mismo copy de rechazo");
}

console.log("All own-funds-gate unit tests passed successfully!");
