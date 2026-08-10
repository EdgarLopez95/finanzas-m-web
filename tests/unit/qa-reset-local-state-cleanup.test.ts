import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { usePersonalDataStore } from "../../src/stores/personal-data-store";
import { useHouseholdDataStore } from "../../src/stores/household-data-store";
import { useAutoSettleDebtStore } from "../../src/stores/auto-settle-debt-store";

console.log("Running unit tests for qa-reset-local-state-cleanup.test.ts...");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

// ==========================================
// Contrato estructural (corregido tras el bug de skeleton infinito —
// ver qa-reset-ux-lifecycle.test.ts para la causa raíz completa): el hook
// de UI debe limpiar los 3 stores locales (personal, Hogar,
// auto-settle/fallback), pero SOLO dentro de `finish()` — nunca dentro de
// `submit()` (ni en su camino feliz/parcial ni en su catch), porque limpiar
// ahí es lo que dejaba el shell en skeleton infinito antes de que el usuario
// pudiera leer el resultado. Sigue sin cerrar sesión (no debe llamar
// clearSession/signOutUser).
// ==========================================
function runHookClearsStoresOnlyInFinishStructuralTest() {
  const hookSource = readSource("features/qa-reset/hooks/use-qa-reset-data.ts");

  assert.ok(hookSource.includes("usePersonalDataStore.getState().reset()"));
  assert.ok(hookSource.includes("useHouseholdDataStore.getState().reset()"));
  assert.ok(hookSource.includes("useAutoSettleDebtStore.getState().reset()"));

  // clearLocalState debe invocarse EXACTAMENTE una vez en todo el archivo
  // (dentro de finish()) — nunca dentro de submit().
  const clearCallSites = hookSource.match(/clearLocalState\(\)/g) ?? [];
  assert.equal(clearCallSites.length, 1, "clearLocalState() debe invocarse una única vez, dentro de finish() — nunca dentro de submit()");

  const submitBody = hookSource.match(/const submit = async[\s\S]*?\n  };/)![0];
  assert.ok(!submitBody.includes("clearLocalState()"), "submit() no debe limpiar stores — eso causaba el skeleton infinito");

  assert.ok(
    !hookSource.includes("clearSession()") && !hookSource.includes("signOutUser()"),
    "el hook de reinicio de datos NUNCA debe cerrar sesión (solo puede mencionarlo en comentarios explicando que no lo hace)"
  );

  console.log("Contrato estructural (limpieza de stores SOLO en finish(), nunca en submit()): 6/6 aserciones pasadas.");
}

// ==========================================
// Verificación real (no solo estructural): cada uno de los 3 `reset()` deja
// su store en el estado inicial limpio, sin datos residuales del usuario
// anterior — la misma garantía que el hook de UI invoca directamente.
// ==========================================
function runRealStoreResetsActuallyClearStateTest() {
  usePersonalDataStore.setState({
    status: "success",
    data: {
      ...usePersonalDataStore.getState().data,
      accounts: [{ id: "acc-1" } as never],
    },
    ownerId: "gerson",
  });
  usePersonalDataStore.getState().reset();
  const personalState = usePersonalDataStore.getState();
  assert.equal(personalState.status, "idle", "personal-data-store debe volver a 'idle' tras reset()");
  assert.equal(personalState.data.accounts.length, 0, "personal-data-store no debe conservar cuentas residuales tras reset()");
  assert.equal(personalState.ownerId, null, "personal-data-store no debe conservar el ownerId anterior tras reset()");

  useHouseholdDataStore.setState({ status: "success", uid: "gerson" });
  useHouseholdDataStore.getState().reset();
  const householdState = useHouseholdDataStore.getState();
  assert.equal(householdState.status, "idle", "household-data-store debe volver a 'idle' tras reset()");
  assert.equal(householdState.uid, null, "household-data-store no debe conservar el uid anterior tras reset()");

  useAutoSettleDebtStore.setState({
    entries: { "debt-1": { status: "processing" } },
    dismissed: { "debt-1": true },
  });
  useAutoSettleDebtStore.getState().reset();
  const autoSettleState = useAutoSettleDebtStore.getState();
  assert.deepEqual(autoSettleState.entries, {}, "auto-settle-debt-store no debe conservar entries residuales tras reset()");
  assert.deepEqual(autoSettleState.dismissed, {}, "auto-settle-debt-store no debe conservar descartes residuales tras reset()");

  console.log("Verificación real: los 3 reset() dejan sus stores sin datos residuales: 7/7 aserciones pasadas.");
}

runHookClearsStoresOnlyInFinishStructuralTest();
runRealStoreResetsActuallyClearStateTest();

console.log("OK qa-reset-local-state-cleanup");
