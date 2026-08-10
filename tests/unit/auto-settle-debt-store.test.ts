import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { useAutoSettleDebtStore } from "../../src/stores/auto-settle-debt-store";
import { shouldAutoCloseManualFallback, shouldAutoOpenManualFallback } from "../../src/features/household/lib/auto-settle-debt";

console.log("Running unit tests for auto-settle-debt-store.test.ts...");

const readComponent = (relativePath: string): string =>
  readFileSync(path.join(__dirname, "..", "..", "src", relativePath), "utf8");

function runAutoSettleDebtStoreTests() {
  // ==========================================
  // Ciclo de vida del store: processing -> needs_manual_account -> dismiss
  // (descarte) -> reevaluar el MISMO estado no debe reabrir -> clear (deuda
  // realmente resuelta) SÍ limpia el descarte, habilitando un futuro reabrir.
  // ==========================================

  // Test 1: processing inicial
  {
    useAutoSettleDebtStore.getState().reset();
    useAutoSettleDebtStore.getState().setProcessing("debt-1");
    assert.deepStrictEqual(useAutoSettleDebtStore.getState().entries["debt-1"], { status: "processing" });
    assert.strictEqual("debt-1" in useAutoSettleDebtStore.getState().dismissed, false);
  }

  // Test 2: needs_manual_account
  {
    useAutoSettleDebtStore.getState().setNeedsManualAccount("debt-1", "sin cuenta origen");
    assert.deepStrictEqual(useAutoSettleDebtStore.getState().entries["debt-1"], {
      status: "needs_manual_account",
      reason: "sin cuenta origen",
    });
  }

  // Test 3 (prueba de descarte): "Ahora no" marca dismissed; reevaluar el mismo
  // estado (setNeedsManualAccount de nuevo, como si el snapshot se repitiera)
  // NO debe limpiar el descarte -> no debe reabrir en bucle.
  {
    useAutoSettleDebtStore.getState().dismiss("debt-1");
    assert.strictEqual(useAutoSettleDebtStore.getState().dismissed["debt-1"], true);

    // Reevaluación del mismo snapshot (el hook llamaría esto de nuevo si el
    // observador reintenta sobre la misma deuda sin cambios reales).
    useAutoSettleDebtStore.getState().setNeedsManualAccount("debt-1", "sin cuenta origen");
    assert.strictEqual(
      useAutoSettleDebtStore.getState().dismissed["debt-1"],
      true,
      "Reevaluar el mismo estado no debe limpiar el descarte del usuario"
    );
  }

  // Test 4 (éxito manual / cambio real): clear() tras acreditar (settled) limpia
  // tanto la entry como el descarte -> un futuro needs_manual_account nuevo
  // (deuda distinta o estado realmente nuevo) sí podría reabrir.
  {
    useAutoSettleDebtStore.getState().clear("debt-1");
    const state = useAutoSettleDebtStore.getState();
    assert.strictEqual("debt-1" in state.entries, false);
    assert.strictEqual("debt-1" in state.dismissed, false);
  }

  // Test 5: reset() limpia todo (cambio de sesión)
  {
    useAutoSettleDebtStore.getState().setNeedsManualAccount("debt-2", "sin cuenta origen");
    useAutoSettleDebtStore.getState().dismiss("debt-2");
    useAutoSettleDebtStore.getState().reset();
    const state = useAutoSettleDebtStore.getState();
    assert.deepStrictEqual(state.entries, {});
    assert.deepStrictEqual(state.dismissed, {});
  }

  // ==========================================
  // P1 — bug confirmado: éxito manual debía limpiar entry+dismissed antes de
  // que el selector automático de HouseholdOverview pudiera reevaluar, o el
  // sheet se reabre con el estado needs_manual_account ya superado.
  // ==========================================

  // Test 6 (RED del escenario pedido): tras acreditar manualmente (el callback
  // onSuccess del diálogo debe llamar clear(debtId)), el selector automático
  // (`shouldAutoOpenManualFallback`) ya NO debe volver a abrir esa deuda.
  {
    useAutoSettleDebtStore.getState().reset();
    useAutoSettleDebtStore.getState().setNeedsManualAccount("debt-success", "sin cuenta origen");

    // Antes de la corrección: onSuccess no limpiaba nada -> la entry seguía
    // needs_manual_account y dismissed seguía false -> reabriría.
    const wouldReopenWithoutFix = shouldAutoOpenManualFallback({
      entry: useAutoSettleDebtStore.getState().entries["debt-success"],
      dismissed: Boolean(useAutoSettleDebtStore.getState().dismissed["debt-success"]),
    });
    assert.strictEqual(wouldReopenWithoutFix, true, "Precondición: sin limpiar, el selector reabriría");

    // Corrección: el onSuccess del diálogo limpia entry Y dismissed.
    useAutoSettleDebtStore.getState().clear("debt-success");

    const shouldReopenAfterFix = shouldAutoOpenManualFallback({
      entry: useAutoSettleDebtStore.getState().entries["debt-success"],
      dismissed: Boolean(useAutoSettleDebtStore.getState().dismissed["debt-success"]),
    });
    assert.strictEqual(
      shouldReopenAfterFix,
      false,
      "Tras clear() por éxito manual, el selector automático no debe reabrir el mismo estado"
    );
  }

  console.log("auto-settle-debt-store.test.ts: 6/6 pruebas pasadas.");
}

function runCopyContractTests() {
  const dialogContent = readComponent("features/household/components/confirm-reception-dialog.tsx");
  const overviewContent = readComponent("features/household/components/household-overview.tsx");

  // Test 6 (GREEN del escenario pedido): el sheet manual usa el copy Android
  // real ("No pudimos acreditar automático" / "Acreditar reembolso" / "Ahora no"),
  // no lenguaje de "fallback excepcional, normalmente no necesitas hacer nada".
  {
    assert.ok(
      dialogContent.includes("No pudimos acreditar automático"),
      "confirm-reception-dialog.tsx debe mostrar el copy real de Android"
    );
    assert.ok(
      dialogContent.includes("Acreditar reembolso"),
      "confirm-reception-dialog.tsx debe tener el CTA principal 'Acreditar reembolso'"
    );
    assert.ok(
      dialogContent.includes("Ahora no"),
      "confirm-reception-dialog.tsx debe tener el CTA secundario 'Ahora no'"
    );
    assert.ok(
      !dialogContent.includes("normalmente no necesitas hacer nada"),
      "No debe implicar que el auto-settle es el camino feliz habitual"
    );
    assert.ok(
      !/esto es excepcional/i.test(dialogContent),
      "No debe describirse como un caso excepcional/raro"
    );
  }

  // Test 7 (paridad Android — Paso 3: Home Hogar es libro compartido, no
  // muestra deudas "quién debe a quién"): household-overview.tsx no debe usar
  // "Acreditando" como estado feliz del acreedor NI mostrar el copy del sheet
  // de acreditación manual — esa superficie ya no vive en Home Hogar en
  // absoluto, solo en HouseholdDebtReceptionFallback (Personal/Hogar vía
  // DashboardShell).
  {
    assert.ok(
      !overviewContent.includes('"Acreditando"'),
      "household-overview.tsx no debe usar 'Acreditando' como estado feliz del acreedor"
    );
    assert.ok(
      !overviewContent.includes("No pudimos acreditar automático"),
      "household-overview.tsx (Home Hogar) ya no debe mostrar deudas ni el copy del sheet de acreditación manual"
    );
    assert.ok(
      dialogContent.includes("No pudimos acreditar automático"),
      "el copy real sigue viviendo en confirm-reception-dialog.tsx (montado por HouseholdDebtReceptionFallback)"
    );
  }

  console.log("Contrato de copy (confirm-reception-dialog.tsx + household-overview.tsx): 2/2 pruebas pasadas.");
}

function runSuccessWiringIntegrationTest() {
  const dialogContent = readComponent("features/household/components/confirm-reception-dialog.tsx");
  const fallbackContent = readComponent("features/household/components/household-debt-reception-fallback.tsx");

  // Test 8 (integración estructural, RED del bug P1): el diálogo debe llamar
  // onSuccess ANTES de onClose en su handler de envío exitoso (para que el
  // store se limpie antes de que el efecto del presentador reevalúe), y
  // HouseholdDebtReceptionFallback debe cablear ese onSuccess a clear(debtId)
  // del store de auto-settle — no solo a onDismiss/onClose, que dejarían
  // needs_manual_account intacto.
  {
    const submitBlockMatch = dialogContent.match(/const handleSubmit[\s\S]*?\n  };/);
    assert.ok(submitBlockMatch, "confirm-reception-dialog.tsx debe tener un handleSubmit reconocible");
    const submitBlock = submitBlockMatch![0];
    const onSuccessIndex = submitBlock.indexOf("onSuccess");
    const onCloseIndex = submitBlock.lastIndexOf("onClose()");
    assert.ok(onSuccessIndex !== -1 && onCloseIndex !== -1, "handleSubmit debe invocar onSuccess y onClose");
    assert.ok(
      onSuccessIndex < onCloseIndex,
      "onSuccess debe invocarse antes que onClose para limpiar el store antes de cerrar"
    );

    assert.ok(
      fallbackContent.includes("onSuccess={() => clearAutoSettleFallback(selectedDebt.id)}"),
      "household-debt-reception-fallback.tsx debe cablear onSuccess de ConfirmReceptionDialog a clearAutoSettleFallback(debtId)"
    );
  }

  console.log("Integración estructural (onSuccess limpia el store antes de cerrar): 1/1 prueba pasada.");
}

function runSinglePresenterSurfaceTests() {
  const overviewContent = readComponent("features/household/components/household-overview.tsx");
  const fallbackContent = readComponent("features/household/components/household-debt-reception-fallback.tsx");
  const shellContent = readComponent("components/layout/dashboard-shell.tsx");

  // Test 9 (RED/GREEN): HouseholdOverview ya no importa ni monta
  // ConfirmReceptionDialog ni el efecto de apertura automática — ambos viven
  // únicamente en HouseholdDebtReceptionFallback (superficie única del sheet).
  {
    assert.ok(
      !overviewContent.includes("ConfirmReceptionDialog"),
      "household-overview.tsx no debe importar ni montar ConfirmReceptionDialog"
    );
    assert.ok(
      !overviewContent.includes("shouldAutoOpenManualFallback"),
      "household-overview.tsx no debe duplicar el efecto de apertura automática"
    );
  }

  // Test 10: HouseholdDebtReceptionFallback sí es la única superficie que
  // monta ConfirmReceptionDialog y usa shouldAutoOpenManualFallback.
  {
    assert.ok(
      fallbackContent.includes("<ConfirmReceptionDialog"),
      "household-debt-reception-fallback.tsx debe montar ConfirmReceptionDialog"
    );
    assert.ok(
      fallbackContent.includes("shouldAutoOpenManualFallback"),
      "household-debt-reception-fallback.tsx debe usar shouldAutoOpenManualFallback"
    );
  }

  // Test 11 (RED/GREEN estructural pedido): DashboardShell monta el
  // presentador único, gateado por shouldMountHouseholdDebtReceptionFallback(view)
  // — no incondicionalmente ni solo dentro de la página de Hogar.
  {
    assert.ok(
      shellContent.includes("import { HouseholdDebtReceptionFallback }"),
      "dashboard-shell.tsx debe importar HouseholdDebtReceptionFallback"
    );
    assert.ok(
      shellContent.includes("shouldMountHouseholdDebtReceptionFallback(view) && <HouseholdDebtReceptionFallback />"),
      "dashboard-shell.tsx debe montar el presentador gateado por shouldMountHouseholdDebtReceptionFallback(view)"
    );
  }

  console.log("Superficie única del sheet (household-overview sin duplicar, DashboardShell gateado por vista): 3/3 pruebas pasadas.");
}

function runAutoCloseFallbackTests() {
  const fallbackContent = readComponent("features/household/components/household-debt-reception-fallback.tsx");

  // Test 12 (RED/GREEN estructural pedido): el presentador debe tener un
  // efecto de cierre automático que usa shouldAutoCloseManualFallback sobre
  // la entry de la deuda ACTUALMENTE seleccionada (selectedDebt.id), no sobre
  // cualquier deuda -- así un cambio en otra deuda nunca lo cierra.
  {
    assert.ok(
      fallbackContent.includes("shouldAutoCloseManualFallback"),
      "household-debt-reception-fallback.tsx debe usar shouldAutoCloseManualFallback"
    );
    assert.ok(
      fallbackContent.includes("shouldAutoCloseManualFallback(autoSettleEntries[selectedDebt.id])"),
      "el cierre automático debe evaluar únicamente la entry de selectedDebt.id, no la de otra deuda"
    );
  }

  // Test 13 (escenario obligatorio): sheet abierto para debt-1 con entry
  // needs_manual_account -> shouldAutoCloseManualFallback dice que sigue abierto.
  {
    useAutoSettleDebtStore.getState().reset();
    useAutoSettleDebtStore.getState().setNeedsManualAccount("debt-1", "sin cuenta origen");
    const entry = useAutoSettleDebtStore.getState().entries["debt-1"];
    assert.strictEqual(shouldAutoCloseManualFallback(entry), false, "No debe cerrarse mientras siga needs_manual_account");
  }

  // Test 14 (escenario obligatorio): la entry de debt-1 pasa a processing (el
  // observador reintenta) -> debe cerrarse.
  {
    useAutoSettleDebtStore.getState().setProcessing("debt-1");
    const entry = useAutoSettleDebtStore.getState().entries["debt-1"];
    assert.strictEqual(shouldAutoCloseManualFallback(entry), true, "processing debe cerrar el sheet abierto para esa deuda");
  }

  // Test 15 (escenario obligatorio, "orden tardío" completo): fallback abierto
  // para debt-1 (needs_manual_account) -> aparece una share válida del
  // pagador -> el observador auto-acredita y llama clear("debt-1") -> el store
  // queda limpio y shouldAutoCloseManualFallback confirma que debe cerrarse.
  {
    useAutoSettleDebtStore.getState().reset();
    useAutoSettleDebtStore.getState().setNeedsManualAccount("debt-1", "sin cuenta origen");
    assert.strictEqual(
      shouldAutoCloseManualFallback(useAutoSettleDebtStore.getState().entries["debt-1"]),
      false,
      "Precondición: con needs_manual_account el sheet sigue abierto"
    );

    // El observador auto-acredita (settled) tras resolver la share del pagador.
    useAutoSettleDebtStore.getState().clear("debt-1");

    const state = useAutoSettleDebtStore.getState();
    assert.strictEqual("debt-1" in state.entries, false, "El store debe quedar limpio tras settled");
    assert.strictEqual("debt-1" in state.dismissed, false, "El descarte también debe limpiarse tras settled");
    assert.strictEqual(
      shouldAutoCloseManualFallback(state.entries["debt-1"]),
      true,
      "Sin entry (settled), el sheet abierto para debt-1 debe cerrarse"
    );
  }

  // Test 16 (escenario obligatorio): un cambio en la entry de debt-2 nunca
  // debe cerrar un sheet abierto para debt-1 -- el llamador solo evalúa la
  // entry de la deuda seleccionada (aquí: debt-1), la de debt-2 es irrelevante.
  {
    useAutoSettleDebtStore.getState().reset();
    useAutoSettleDebtStore.getState().setNeedsManualAccount("debt-1", "sin cuenta origen");
    useAutoSettleDebtStore.getState().setNeedsManualAccount("debt-2", "sin cuenta origen");

    // debt-2 pasa a processing y luego se limpia -- debt-1 no se toca.
    useAutoSettleDebtStore.getState().setProcessing("debt-2");
    useAutoSettleDebtStore.getState().clear("debt-2");

    const state = useAutoSettleDebtStore.getState();
    assert.strictEqual(
      shouldAutoCloseManualFallback(state.entries["debt-1"]),
      false,
      "Un cambio en la entry de debt-2 no debe afectar el sheet abierto para debt-1"
    );
    assert.deepStrictEqual(state.entries["debt-1"], { status: "needs_manual_account", reason: "sin cuenta origen" });
  }

  // Test 17 (no regresión): "Ahora no" (dismiss), reapertura explícita
  // (undismiss) y éxito manual (clear) siguen funcionando junto con el nuevo
  // cierre automático -- shouldAutoCloseManualFallback no interfiere con
  // shouldAutoOpenManualFallback ni con el ciclo de descarte ya probado.
  {
    useAutoSettleDebtStore.getState().reset();
    useAutoSettleDebtStore.getState().setNeedsManualAccount("debt-1", "sin cuenta origen");

    // "Ahora no": se descarta, no debe reabrirse automáticamente.
    useAutoSettleDebtStore.getState().dismiss("debt-1");
    assert.strictEqual(
      shouldAutoOpenManualFallback({
        entry: useAutoSettleDebtStore.getState().entries["debt-1"],
        dismissed: true,
      }),
      false,
      "Descartado no debe reabrirse"
    );
    // Pero sigue sin cerrarse solo por estar descartado (needs_manual_account persiste).
    assert.strictEqual(shouldAutoCloseManualFallback(useAutoSettleDebtStore.getState().entries["debt-1"]), false);

    // Reapertura explícita (botón inline "Acreditar reembolso" -> undismiss).
    useAutoSettleDebtStore.getState().undismiss("debt-1");
    assert.strictEqual(
      shouldAutoOpenManualFallback({
        entry: useAutoSettleDebtStore.getState().entries["debt-1"],
        dismissed: Boolean(useAutoSettleDebtStore.getState().dismissed["debt-1"]),
      }),
      true,
      "Tras undismiss debe poder reabrirse"
    );

    // Éxito manual: clear() limpia todo y el sheet debe cerrarse.
    useAutoSettleDebtStore.getState().clear("debt-1");
    assert.strictEqual(shouldAutoCloseManualFallback(useAutoSettleDebtStore.getState().entries["debt-1"]), true);
  }

  console.log("Cierre automático del sheet (corrección P1, orden tardío, no-regresión): 6/6 pruebas pasadas.");
}

runAutoSettleDebtStoreTests();
runCopyContractTests();
runSuccessWiringIntegrationTest();
runSinglePresenterSurfaceTests();
runAutoCloseFallbackTests();
