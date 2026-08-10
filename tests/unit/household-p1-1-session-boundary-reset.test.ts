import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for household-p1-1-session-boundary-reset.test.ts...");

/**
 * Corrección P1.1 del Paso 10 — reset del bootstrap de contexto en frontera
 * de sesión.
 *
 * Hallazgo confirmado: `initialContextBootstrapResolved` y `activeContext`
 * viven en `useAppContextStore`, pero el logout (`settings/page.tsx`) solo
 * limpiaba Auth, datos personales y datos Hogar — nunca el contexto ni el
 * bootstrap. Un segundo usuario que iniciara sesión en la misma pestaña podía
 * heredar `activeContext = "household"` e `initialContextBootstrapResolved =
 * true` de la sesión anterior.
 *
 * Corrección: `resetForSessionBoundary()` (store) vuelve todo a su estado por
 * defecto, reutilizando `applyBoundaryCleanup` para las superficies
 * efímeras. Se invoca desde el logout explícito y desde la detección de
 * cambio real de `uid` en `useAuthBootstrap` (vía la función pura
 * `shouldResetSessionForUidChange`), sin reintroducir sincronización
 * continua URL → contexto ni afectar la navegación normal del mismo usuario.
 */

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

export async function runHouseholdP1_1SessionBoundaryResetTests() {
  let checks = 0;

  const { useAppContextStore } = await import("../../src/stores/app-context-store");
  const { useHouseholdUiStore } = await import("../../src/stores/household-ui-store");
  const { useTransactionPanelStore } = await import("../../src/stores/transaction-panel-store");
  const { useUiPreferencesStore } = await import("../../src/stores/ui-preferences-store");

  // ---------------------------------------------------------------
  // Caso 1 (RED) — con activeContext="household" e
  // initialContextBootstrapResolved=true, el reset devuelve Personal y false.
  // ---------------------------------------------------------------
  useAppContextStore.setState({
    activeContext: "household",
    initialContextBootstrapResolved: true,
    contextNotice: "algún aviso previo",
    householdLossNotifiedFor: "hh-old",
    periodPickerOpen: true,
  });
  useUiPreferencesStore.getState().setEditingBoard(true);
  useTransactionPanelStore.getState().openCreate("expense");
  useHouseholdUiStore.getState().openCreateExpense();

  useAppContextStore.getState().resetForSessionBoundary();

  assert.equal(useAppContextStore.getState().activeContext, "personal", "el reset de frontera de sesión debe volver el contexto a Personal");
  assert.equal(
    useAppContextStore.getState().initialContextBootstrapResolved,
    false,
    "el reset de frontera de sesión debe volver initialContextBootstrapResolved a false"
  );
  checks += 2;

  // ---------------------------------------------------------------
  // Caso 2 (RED) — limpia aviso de contexto y UI efímera asociada,
  // reutilizando la limpieza de frontera existente.
  // ---------------------------------------------------------------
  assert.equal(useAppContextStore.getState().contextNotice, null, "el reset debe limpiar contextNotice");
  assert.equal(
    useAppContextStore.getState().householdLossNotifiedFor,
    null,
    "el reset debe limpiar householdLossNotifiedFor (no debe sobrevivir a un cambio de usuario)"
  );
  assert.equal(useAppContextStore.getState().periodPickerOpen, false, "el reset debe cerrar el selector de período (reutiliza applyBoundaryCleanup)");
  assert.equal(useUiPreferencesStore.getState().isEditingBoard, false, "el reset debe salir del modo edición de tablero");
  assert.equal(useTransactionPanelStore.getState().kind, null, "el reset debe cerrar el panel de movimiento Personal");
  assert.equal(
    useHouseholdUiStore.getState().isCreateExpenseOpen,
    false,
    "el reset debe cerrar el estado efímero de UI de Hogar (nuevo gasto)"
  );
  checks += 5;

  // Limpieza para no afectar otras suites.
  useAppContextStore.setState({
    activeContext: "personal",
    initialContextBootstrapResolved: false,
    contextNotice: null,
    householdLossNotifiedFor: null,
    periodPickerOpen: false,
  });

  // ---------------------------------------------------------------
  // Caso 5 (GREEN tras reset) — una ruta Hogar con membresía confirmada
  // puede volver a bootstrapear correctamente después del reset.
  // ---------------------------------------------------------------
  useAppContextStore.setState({ activeContext: "household", initialContextBootstrapResolved: true });
  useAppContextStore.getState().resetForSessionBoundary();
  useAppContextStore.getState().settleInitialContext("/household", { activeHouseholdId: "hh-new-user", status: "success" });
  assert.equal(
    useAppContextStore.getState().activeContext,
    "household",
    "tras el reset, un Hogar confirmado del nuevo usuario debe poder bootstrapear Hogar de nuevo"
  );
  assert.equal(useAppContextStore.getState().initialContextBootstrapResolved, true);
  checks += 2;

  // Reset final de limpieza.
  useAppContextStore.setState({
    activeContext: "personal",
    initialContextBootstrapResolved: false,
    contextNotice: null,
    householdLossNotifiedFor: null,
    periodPickerOpen: false,
  });

  // ---------------------------------------------------------------
  // Caso 4 (RED) — función pura: cambio real de uid dispara el reset;
  // navegación/re-callback del MISMO usuario no debe dispararlo.
  // ---------------------------------------------------------------
  const { shouldResetSessionForUidChange } = await import("../../src/features/auth/use-auth-bootstrap");

  assert.equal(
    shouldResetSessionForUidChange(undefined, "user-a"),
    false,
    "la primera resolución de la sesión (sin uid previo observado) no debe considerarse un cambio de usuario"
  );
  assert.equal(
    shouldResetSessionForUidChange("user-a", "user-a"),
    false,
    "un callback repetido del MISMO uid (p. ej. refresco de token) no debe disparar el reset"
  );
  assert.equal(shouldResetSessionForUidChange("user-a", "user-b"), true, "un cambio real de uid (otro usuario) debe disparar el reset");
  assert.equal(shouldResetSessionForUidChange("user-a", null), true, "pasar de un uid autenticado a null (logout) debe disparar el reset");
  assert.equal(shouldResetSessionForUidChange(null, "user-b"), true, "pasar de null a un uid autenticado (login tras logout) debe disparar el reset");
  checks += 5;

  // ---------------------------------------------------------------
  // Caso 3 (RED) — el logout existente invoca resetForSessionBoundary.
  // ---------------------------------------------------------------
  const settingsPageContent = readSrc("app/(dashboard)/settings/page.tsx");
  assert.match(
    settingsPageContent,
    /resetForSessionBoundary/,
    "settings/page.tsx (handleLogout) debe invocar resetForSessionBoundary del store de contexto"
  );
  checks++;

  // ---------------------------------------------------------------
  // Caso 4 (estructural) — use-auth-bootstrap.ts usa la función pura para
  // decidir el reset ante un cambio real de uid, no en cada callback.
  // ---------------------------------------------------------------
  const authBootstrapContent = readSrc("features/auth/use-auth-bootstrap.ts");
  const authBootstrapCode = authBootstrapContent
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");

  assert.match(authBootstrapCode, /shouldResetSessionForUidChange/, "use-auth-bootstrap.ts debe usar shouldResetSessionForUidChange para decidir el reset");
  assert.match(authBootstrapCode, /resetForSessionBoundary/, "use-auth-bootstrap.ts debe invocar resetForSessionBoundary cuando corresponda");
  assert.doesNotMatch(
    authBootstrapCode,
    /syncContextFromRoute|resolveContextSyncDecision/,
    "no debe reintroducirse sincronización continua URL → contexto"
  );
  checks += 3;

  // ---------------------------------------------------------------
  // Caso 6 — sin regresión: switch explícito, pérdida remota y bootstrap de
  // recarga directa siguen intactos (funciones puras sin cambios).
  // ---------------------------------------------------------------
  const {
    resolveContextSwitch,
    resolveHouseholdLoss,
    resolveHouseholdLossRecovery,
    resolveInitialContextBootstrap,
  } = await import("../../src/lib/navigation/app-context");

  assert.equal(
    resolveContextSwitch({ current: "personal", target: "household", pathname: "/dashboard" }).changed,
    true,
    "no-regresión: el switch explícito Personal → Hogar sigue funcionando"
  );

  const loss = resolveHouseholdLoss({
    previous: { activeHouseholdId: "hh-1", status: "success" },
    next: { activeHouseholdId: null, status: "empty" },
    notifiedForHouseholdId: null,
  });
  assert.equal(loss.lost, true, "no-regresión: la pérdida remota de Hogar sigue detectándose");
  assert.equal(
    resolveHouseholdLossRecovery({ lost: true, pathname: "/household" }).replaceHref,
    "/dashboard",
    "no-regresión: la recuperación de pérdida remota sigue devolviendo a /dashboard"
  );

  assert.deepEqual(
    resolveInitialContextBootstrap({ pathname: "/household", household: { activeHouseholdId: "hh-1", status: "success" } }),
    { kind: "use-household" },
    "no-regresión: el bootstrap de recarga directa de rutas Hogar sigue aceptando Hogar confirmado"
  );
  checks += 4;

  console.log(`  ✓ Corrección P1.1 Paso 10 — reset de frontera de sesión validado (${checks} comprobaciones).`);
}
