import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for household-p1-context-bootstrap.test.ts...");

/**
 * Corrección P1 del Paso 10 — bootstrap seguro de contexto en la carga
 * inicial de una ruta Hogar.
 *
 * Hallazgo confirmado (ver docs/11_WEB_DEV_LOG.md, entrada Paso 10): el store
 * de contexto inicia siempre en "personal" y nada lo pone en "household"
 * salvo el clic del switch. Al recargar/abrir directamente `/household*`,
 * `resolveContextRedirection` interpretaba "ruta Hogar + contexto Personal"
 * como una navegación errónea y expulsaba a `/dashboard`, aunque el usuario
 * tuviera un Hogar activo confirmado.
 *
 * Corrección: `resolveInitialContextBootstrap` es una decisión pura que solo
 * se evalúa en el arranque de la sesión (gateada por
 * `initialContextBootstrapResolved` en el store, para que se aplique una
 * única vez). No reintroduce sincronización continua: una vez resuelto, el
 * store vuelve a ser la única autoridad y ninguna navegación posterior lo
 * puede cambiar automáticamente.
 */

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

export async function runHouseholdP1ContextBootstrapTests() {
  let checks = 0;

  const {
    resolveInitialContextBootstrap,
  } = await import("../../src/lib/navigation/app-context");

  // ---------------------------------------------------------------
  // Casos 1-2 — Hogar confirmado en las 4 rutas Hogar: bootstrap acepta
  // Hogar, sin pedir redirección.
  // ---------------------------------------------------------------
  for (const pathname of ["/household", "/household/movements", "/household/settings", "/household/categories"]) {
    const decision = resolveInitialContextBootstrap({
      pathname,
      household: { activeHouseholdId: "hh-1", status: "success" },
    });
    assert.deepEqual(decision, { kind: "use-household" }, `${pathname}: con Hogar confirmado debe aceptar Hogar en el bootstrap`);
    checks++;
  }

  // ---------------------------------------------------------------
  // Caso 3 — URL inicial Hogar + usuario sin Hogar (empty/dissolved/error):
  // Personal, con redirección segura a /dashboard (decidido por el llamador
  // vía resolveContextRedirection, ya existente).
  // ---------------------------------------------------------------
  for (const status of ["empty", "dissolved", "error"]) {
    const decision = resolveInitialContextBootstrap({
      pathname: "/household",
      household: { activeHouseholdId: status === "dissolved" ? "hh-1" : null, status },
    });
    assert.deepEqual(decision, { kind: "use-personal" }, `status=${status}: sin Hogar confirmado, el bootstrap debe resolver a Personal`);
    checks++;
  }

  // ---------------------------------------------------------------
  // Caso 4 — mientras la verificación de Hogar aún carga (idle/loading), no
  // debe decidirse nada todavía (ni Hogar ni redirección a Personal).
  // ---------------------------------------------------------------
  for (const status of ["idle", "loading"]) {
    const decision = resolveInitialContextBootstrap({
      pathname: "/household/settings",
      household: { activeHouseholdId: null, status },
    });
    assert.deepEqual(decision, { kind: "pending" }, `status=${status}: no debe resolverse mientras la verificación de Hogar está en curso`);
    checks++;
  }

  // ---------------------------------------------------------------
  // Caso 5 — URL inicial Personal: el bootstrap de Hogar no aplica, sin
  // importar el estado de la suscripción de Hogar.
  // ---------------------------------------------------------------
  for (const pathname of ["/dashboard", "/movements", "/accounts", "/categories", "/settings"]) {
    const decision = resolveInitialContextBootstrap({
      pathname,
      household: { activeHouseholdId: "hh-1", status: "success" },
    });
    assert.deepEqual(decision, { kind: "not-applicable" }, `${pathname}: ruta Personal, el bootstrap de Hogar no debe aplicar`);
    checks++;
  }

  // ---------------------------------------------------------------
  // Caso 6 — tras resolver el bootstrap una vez, una navegación posterior a
  // una URL Hogar NO debe cambiar el store de Personal a Hogar. Se prueba a
  // nivel de store (settleInitialContext), no de componente.
  // ---------------------------------------------------------------
  const { useAppContextStore } = await import("../../src/stores/app-context-store");

  useAppContextStore.setState({
    activeContext: "personal",
    initialContextBootstrapResolved: false,
    householdLossNotifiedFor: null,
    contextNotice: null,
  });

  // Primera resolución: Hogar aún no confirmado (pending) -> no debe marcarse resuelto.
  useAppContextStore.getState().settleInitialContext("/household", { activeHouseholdId: null, status: "loading" });
  assert.equal(useAppContextStore.getState().initialContextBootstrapResolved, false, "mientras está pending, el bootstrap no debe marcarse resuelto");
  assert.equal(useAppContextStore.getState().activeContext, "personal", "mientras está pending, el contexto no debe cambiar");
  checks += 2;

  // Sin Hogar confirmado (empty) -> se resuelve a Personal, marcado como resuelto.
  useAppContextStore.getState().settleInitialContext("/household", { activeHouseholdId: null, status: "empty" });
  assert.equal(useAppContextStore.getState().initialContextBootstrapResolved, true, "sin Hogar confirmado, el bootstrap debe marcarse resuelto (a Personal)");
  assert.equal(useAppContextStore.getState().activeContext, "personal", "sin Hogar confirmado, el contexto debe seguir en Personal");
  checks += 2;

  // Bootstrap ya resuelto: aunque ahora SÍ exista un Hogar confirmado y la URL
  // sea Hogar, una llamada posterior (equivalente a navegar después) no debe
  // cambiar el contexto automáticamente -- el bootstrap ya se resolvió una vez.
  useAppContextStore.getState().settleInitialContext("/household", { activeHouseholdId: "hh-2", status: "success" });
  assert.equal(useAppContextStore.getState().activeContext, "personal", "tras resolver el bootstrap, una llamada posterior no debe cambiar el contexto automáticamente");
  checks++;

  // Caso positivo de bootstrap real (sesión nueva): Hogar confirmado desde el
  // primer intento -> setActiveContext("household") se aplica una sola vez.
  useAppContextStore.setState({ activeContext: "personal", initialContextBootstrapResolved: false });
  useAppContextStore.getState().settleInitialContext("/household/categories", { activeHouseholdId: "hh-3", status: "success" });
  assert.equal(useAppContextStore.getState().activeContext, "household", "con Hogar confirmado desde el inicio, el bootstrap debe aplicar el contexto Hogar");
  assert.equal(useAppContextStore.getState().initialContextBootstrapResolved, true, "debe marcarse resuelto tras aplicar Hogar");
  checks += 2;

  // Reset del store a su estado por defecto para no afectar otras suites.
  useAppContextStore.setState({
    activeContext: "personal",
    initialContextBootstrapResolved: false,
    householdLossNotifiedFor: null,
    contextNotice: null,
  });

  // ---------------------------------------------------------------
  // Verificación estructural — DashboardShell debe llamar a
  // settleInitialContext y gatear la redirección existente con
  // initialContextBootstrapResolved, sin usar resolveContextForPath para
  // calcular activeContext en cada render (eso sigue prohibido, corrección
  // P0 de Paso 9).
  // ---------------------------------------------------------------
  const shellContent = readSrc("components/layout/dashboard-shell.tsx");
  const shellCode = shellContent
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");

  assert.match(shellCode, /settleInitialContext/, "DashboardShell debe invocar settleInitialContext en el bootstrap");
  assert.match(
    shellCode,
    /initialContextBootstrapResolved/,
    "DashboardShell debe leer initialContextBootstrapResolved para gatear la redirección de ruta compartida"
  );
  assert.doesNotMatch(
    shellCode,
    /resolveContextForPath/,
    "DashboardShell no debe usar resolveContextForPath para calcular activeContext en renders normales (solo el bootstrap puro puede consumirlo internamente)"
  );
  assert.match(shellCode, /const activeContext = storeContext;/, "activeContext debe seguir siendo storeContext directamente");
  checks += 4;

  console.log(`  ✓ Corrección P1 Paso 10 — bootstrap seguro de contexto Hogar validado (${checks} comprobaciones).`);
}
