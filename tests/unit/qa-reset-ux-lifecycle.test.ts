import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { usePersonalDataStore } from "../../src/stores/personal-data-store";
import { QA_RESET_SAFE_LANDING_PATH } from "../../src/features/qa-reset/hooks/use-qa-reset-data";

console.log("Running unit tests for qa-reset-ux-lifecycle.test.ts...");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

// Réplica exacta de la condición real de DashboardShell.tsx que decide si
// `children` (incluida la superficie de Ajustes y este diálogo) se reemplaza
// por `<LoadingContent />` (skeleton). No es una copia inventada: se extrae
// literalmente para razonar sobre la causa raíz sin montar React.
const wouldDashboardShellShowSkeleton = (personalDataStatus: string): boolean =>
  personalDataStatus === "loading" || personalDataStatus === "idle";

// ==========================================
// 1) RED — reproduce mecánicamente el bug ORIGINAL: si algo pone el store
// personal en `idle` mientras el diálogo todavía muestra un resultado,
// DashboardShell reemplazaría `children` por skeleton — el diálogo (montado
// dentro de `children`, vía SettingsView) desaparecería sin que el usuario
// pudiera leer el resultado. Esto prueba el mecanismo causal exacto, aunque
// ya no ocurra en el código corregido (ver bloque 2).
// ==========================================
function runReproducesSkeletonMechanismTest() {
  usePersonalDataStore.setState({ status: "success" });
  assert.equal(
    wouldDashboardShellShowSkeleton(usePersonalDataStore.getState().status),
    false,
    "con status success (dato ya cargado), el shell NO debe mostrar skeleton — así se ve el diálogo con su resultado"
  );

  // Esto es exactamente lo que hacía el `submit()` original: llamar
  // store.reset() (-> status "idle") justo después de que el remoto terminara.
  usePersonalDataStore.getState().reset();
  assert.equal(
    wouldDashboardShellShowSkeleton(usePersonalDataStore.getState().status),
    true,
    "reset() inmediato deja status='idle', y esa es EXACTAMENTE la condición que hace que DashboardShell reemplace children por skeleton"
  );

  console.log("RED (mecanismo causal reproducido: reset() inmediato -> idle -> skeleton según DashboardShell): 2/2 aserciones pasadas.");
}

// ==========================================
// 2) GREEN — contrato corregido: submit() nunca limpia stores dentro de su
// try/catch; solo `finish()` lo hace, y siempre junto con una recarga
// controlada. Verificado por inspección de fuente porque el hook usa
// useState/useRef y este proyecto no tiene un renderer de React para
// pruebas (jsdom/testing-library no instalados) — mismo límite ya
// documentado en household-double-submit-guard.test.ts.
// ==========================================
function runSubmitNeverClearsStoresStructuralTest() {
  const hookSource = readSource("features/qa-reset/hooks/use-qa-reset-data.ts");

  const submitMatch = hookSource.match(/const submit = async[\s\S]*?\n  };/);
  assert.ok(submitMatch, "debe existir la función submit");
  const submitBody = submitMatch![0];

  assert.ok(
    !submitBody.includes("clearLocalState()"),
    "submit() NUNCA debe llamar clearLocalState() — esa era la causa raíz del skeleton infinito"
  );
  assert.ok(submitBody.includes("setOutcome("), "submit() debe publicar el resultado (outcome) para que el diálogo lo muestre");

  const finishMatch = hookSource.match(/const finish = \(\) => \{[\s\S]*?\n  };/);
  assert.ok(finishMatch, "debe existir la función finish");
  const finishBody = finishMatch![0];

  assert.ok(finishBody.includes("clearLocalState()"), "finish() debe limpiar los stores locales");
  assert.ok(finishBody.includes("reloadFn("), "finish() debe ejecutar la recarga controlada inyectable");
  assert.ok(
    finishBody.includes("hasFinishedRef.current") ,
    "finish() debe ser idempotente (una sola ejecución real por resultado)"
  );

  console.log("GREEN (submit() nunca limpia stores; finish() limpia + recarga, idempotente): 5/5 aserciones pasadas.");
}

// ==========================================
// 3) Sesión Auth intacta: el hook de reset de datos jamás debe tocar el
// store/servicio de autenticación.
// ==========================================
function runNeverTouchesAuthSessionTest() {
  const hookSource = readSource("features/qa-reset/hooks/use-qa-reset-data.ts");
  assert.ok(!hookSource.includes("clearSession()"), "no debe llamar clearSession()");
  assert.ok(!hookSource.includes("signOutUser()"), "no debe llamar signOutUser()");
  assert.ok(!hookSource.includes("auth-store"), "no debe importar el store de autenticación");

  console.log("Sesión Auth nunca tocada por el hook de reset: 3/3 aserciones pasadas.");
}

// ==========================================
// 4) Recarga hacia una ruta segura, inyectable para pruebas sin navegador
// real (contrato explícito del pedido).
// ==========================================
function runReloadIsInjectableAndTargetsSafePathTest() {
  assert.equal(QA_RESET_SAFE_LANDING_PATH, "/dashboard");

  const hookSource = readSource("features/qa-reset/hooks/use-qa-reset-data.ts");
  assert.ok(hookSource.includes("reloadFn?: (path: string) => void"), "reloadFn debe ser inyectable (deps opcionales), no un window.location hardcodeado sin seam");
  assert.ok(
    hookSource.includes("reloadFn(QA_RESET_SAFE_LANDING_PATH)"),
    "finish() debe recargar exactamente hacia la ruta segura, no una ruta arbitraria"
  );

  console.log("Recarga inyectable hacia /dashboard: 3/3 aserciones pasadas.");
}

// ==========================================
// 5) Diálogo: Entendido/Cerrar deben ejecutar handleFinish (limpiar +
// recargar), NUNCA el handleClose "sin efectos" que solo cierra localmente
// sin rehidratar — así nunca queda data local presentada como confiable tras
// un reset que pudo cambiar el remoto.
// ==========================================
function runDialogWiresFinishNotBareCloseStructuralTest() {
  const dialogSource = readSource("features/qa-reset/components/qa-reset-confirm-dialog.tsx");

  // Debe existir el seam entre "cierre sin efectos" (antes de ejecutar nada)
  // y "cierre con resultado" (después de ejecutar, siempre recarga).
  assert.ok(dialogSource.includes("onClose={outcome ? handleFinish : handleClose}"));

  // 3 botones deben usar handleFinish: "Entendido" (éxito), "Cerrar" (parcial), "Cerrar" (error).
  const finishClicks = dialogSource.match(/onClick=\{handleFinish\}/g) ?? [];
  assert.equal(finishClicks.length, 3, "Entendido y los 2 'Cerrar' (parcial/error) deben usar handleFinish");

  // 2 botones "Cancelar" (pre-confirmación) deben seguir usando handleClose
  // sin efectos, porque ahí todavía no se ejecutó nada remoto.
  const closeClicks = dialogSource.match(/onClick=\{handleClose\}/g) ?? [];
  assert.equal(closeClicks.length, 2, "los 2 'Cancelar' (antes de confirmar) deben seguir usando handleClose — ahí no se ejecutó nada remoto todavía");

  // Reintentar (handleConfirm) debe seguir disponible: 1 vez en el paso de
  // confirmación inicial + 1 en parcial + 1 en error = 3.
  const confirmClicks = dialogSource.match(/onClick=\{handleConfirm\}/g) ?? [];
  assert.equal(confirmClicks.length, 3, "Reintentar debe seguir disponible tanto en el paso de confirmación como en parcial/error");

  console.log("Diálogo: Entendido/Cerrar usan handleFinish (limpiar+recargar), Reintentar disponible en parcial/error: 3/3 aserciones pasadas.");
}

// ==========================================
// 6) No debe usarse ningún timeout/sleep arbitrario para "esperar" a que la
// UI se estabilice — la corrección es de orden de estados, no de tiempo.
// ==========================================
function runNoArbitraryTimeoutStructuralTest() {
  const hookSource = readSource("features/qa-reset/hooks/use-qa-reset-data.ts");
  const dialogSource = readSource("features/qa-reset/components/qa-reset-confirm-dialog.tsx");

  for (const [label, source] of [
    ["use-qa-reset-data.ts", hookSource],
    ["qa-reset-confirm-dialog.tsx", dialogSource],
  ] as const) {
    assert.ok(!source.includes("setTimeout"), `${label} no debe usar setTimeout para enmascarar el problema de orden de estados`);
  }

  console.log("Sin timeouts arbitrarios en el hook ni en el diálogo: 2/2 aserciones pasadas.");
}

runReproducesSkeletonMechanismTest();
runSubmitNeverClearsStoresStructuralTest();
runNeverTouchesAuthSessionTest();
runReloadIsInjectableAndTargetsSafePathTest();
runDialogWiresFinishNotBareCloseStructuralTest();
runNoArbitraryTimeoutStructuralTest();

console.log("OK qa-reset-ux-lifecycle");
