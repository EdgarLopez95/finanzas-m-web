/**
 * tests/unit/step6-p1-fixes.test.ts
 *
 * Correcciones P1 del Paso 6:
 *   H1 — seguridad de UX durante carga y cambio de cuenta (fail-closed).
 *   H2 — el gate de disponibilidad gobierna TODOS los disparadores sensibles.
 *   H3 — accesibilidad del modal y composición localizada por bolsillo.
 *
 * Lógica real en helpers puros. Lo estructural se limita al render de React,
 * que este repositorio no puede ejecutar (sin jsdom ni RTL).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  resolveOwnershipViewState,
  isOwnershipReady,
  runIfAllowed,
  OWNERSHIP_LOADING_ACTION_MESSAGE,
  OWNERSHIP_ERROR_ACTION_MESSAGE,
} from "../../src/features/accounts/lib/account-ownership-view-state";
import {
  resolveAccountActionAvailability,
  CLOSED_ACCOUNT_ACTION_MESSAGE,
} from "../../src/features/accounts/lib/account-action-availability";
import {
  resolveAccountComposition,
  buildPocketCompositionRows,
} from "../../src/lib/finance/account-ownership-composition";
import { evaluateThirdPartyLegacy } from "../../src/lib/finance/third-party-legacy-evaluation";
import { getFocusableElements } from "../../src/lib/a11y/dialog-focus";
import type { MoneyLocation } from "../../src/lib/finance/third-party-location";

console.log("Running unit tests for step6-p1-fixes.test.ts...");

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string) => readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

const AVAILABLE = (accountId: string): MoneyLocation => ({ accountId, pocketId: null });
const entryAt = (entryId: string, amount: number, location: MoneyLocation | null) => ({
  entryId,
  createdAtMillis: 1,
  originalAmount: amount,
  location,
});

const emptyComposition = (accountId: string) =>
  resolveAccountComposition({ accountId, availableBalance: 100_000, pockets: [] });
const noLegacy = () => evaluateThirdPartyLegacy({ entries: [] });

async function run() {
  // ══════════════════════════════════════════════════════════════
  // H1.1 — Snapshot de OTRA cuenta nunca se considera listo
  // ══════════════════════════════════════════════════════════════
  {
    const snapshotOfA = { accountId: "acc-A", entries: [], moves: [], consumptions: [] };

    const viewingB = resolveOwnershipViewState({
      accountId: "acc-B",
      loading: false,
      error: null,
      snapshot: snapshotOfA,
    });
    assert.equal(viewingB.status, "loading", "el snapshot de la cuenta anterior NUNCA puede darse por válido en la nueva");
    assert.equal(isOwnershipReady(viewingB), false);

    const viewingA = resolveOwnershipViewState({
      accountId: "acc-A",
      loading: false,
      error: null,
      snapshot: snapshotOfA,
    });
    assert.equal(viewingA.status, "ready");
    assert.equal(isOwnershipReady(viewingA), true);
    console.log("  ✓ H1.1: el snapshot de la cuenta A no se usa ni se muestra al abrir la cuenta B");
  }

  // ══════════════════════════════════════════════════════════════
  // H1.2 — Estados loading y error
  // ══════════════════════════════════════════════════════════════
  {
    const loading = resolveOwnershipViewState({ accountId: "acc-A", loading: true, error: null, snapshot: null });
    assert.equal(loading.status, "loading");
    assert.equal(isOwnershipReady(loading), false);

    // Aunque llegue un snapshot, si sigue cargando no se adelanta el resultado.
    const stillLoading = resolveOwnershipViewState({
      accountId: "acc-A",
      loading: true,
      error: null,
      snapshot: { accountId: "acc-A", entries: [], moves: [], consumptions: [] },
    });
    assert.equal(stillLoading.status, "loading");

    const failed = resolveOwnershipViewState({ accountId: "acc-A", loading: false, error: "boom", snapshot: null });
    assert.equal(failed.status, "error");
    assert.equal(isOwnershipReady(failed), false);

    const noSnapshotYet = resolveOwnershipViewState({ accountId: "acc-A", loading: false, error: null, snapshot: null });
    assert.equal(noSnapshotYet.status, "loading", "sin snapshot no se deriva composición desde arrays vacíos");
    console.log("  ✓ H1.2: loading, error y 'sin snapshot' nunca se tratan como datos reales");
  }

  // ══════════════════════════════════════════════════════════════
  // H1.3 — Fail-closed: acciones de dinero bloqueadas si no hay snapshot válido
  // ══════════════════════════════════════════════════════════════
  {
    for (const [label, status, expected] of [
      ["loading", "loading", OWNERSHIP_LOADING_ACTION_MESSAGE],
      ["error", "error", OWNERSHIP_ERROR_ACTION_MESSAGE],
    ] as const) {
      const actions = resolveAccountActionAvailability({
        archived: false,
        composition: emptyComposition("acc-A"),
        legacy: noLegacy(),
        pocketCount: 0,
        ownershipStatus: status,
      });
      for (const key of ["moveThirdParty", "adjustAvailable", "createPocket", "deletePocket"] as const) {
        assert.equal(actions[key].enabled, false, `${key} debe fallar cerrada con ownership=${label}`);
        assert.equal(actions[key].reason, expected);
      }
      // Ciclo de vida (no mueve dinero) conserva su comportamiento.
      assert.equal(actions.closeAccount.enabled, true, `cerrar cuenta no depende de ownership (${label})`);
    }

    const ready = resolveAccountActionAvailability({
      archived: false,
      composition: emptyComposition("acc-A"),
      legacy: noLegacy(),
      pocketCount: 0,
      ownershipStatus: "ready",
    });
    assert.equal(ready.moveThirdParty.enabled, true);
    console.log("  ✓ H1.3: fail-closed en mover/atribuir/reajustar/eliminar-bolsillo; ciclo de vida intacto");
  }

  // ══════════════════════════════════════════════════════════════
  // H1.4 — Cuenta cerrada manda sobre el estado de carga
  // ══════════════════════════════════════════════════════════════
  {
    const actions = resolveAccountActionAvailability({
      archived: true,
      composition: emptyComposition("acc-A"),
      legacy: noLegacy(),
      pocketCount: 0,
      ownershipStatus: "loading",
    });
    assert.equal(actions.moveThirdParty.reason, CLOSED_ACCOUNT_ACTION_MESSAGE, "el motivo más específico para el usuario es que está cerrada");
    assert.equal(actions.reopenAccount.enabled, true, "reabrir sigue disponible aunque el ownership esté cargando");
    console.log("  ✓ H1.4: cuenta cerrada tiene precedencia sobre loading; reabrir sigue disponible");
  }

  // ══════════════════════════════════════════════════════════════
  // H2.1 — runIfAllowed: un disparador bloqueado no ejecuta nada
  // ══════════════════════════════════════════════════════════════
  {
    let ran = 0;
    runIfAllowed({ enabled: false, reason: "bloqueado" }, () => { ran += 1; });
    assert.equal(ran, 0, "una acción bloqueada NO puede abrir el diálogo ni ejecutarse");

    runIfAllowed({ enabled: true, reason: null }, () => { ran += 1; });
    assert.equal(ran, 1, "una acción permitida sí se ejecuta");
    console.log("  ✓ H2.1: runIfAllowed impide ejecutar/abrir cuando el gate bloquea");
  }

  // ══════════════════════════════════════════════════════════════
  // H2.2 — Cada disparador sensible está realmente cableado al gate
  // ══════════════════════════════════════════════════════════════
  {
    // Los disparadores sensibles se repartieron entre tres superficies al
    // separar detalle de cuenta (pantalla) y detalle de bolsillo (modal):
    //   · createPocket        → account-detail-view
    //   · adjustAvailable     → EditAccountDialog, en personal-views
    //   · moveThirdParty      → pocket-detail-dialog
    //   · deletePocket        → pocket-detail-dialog
    // El contrato se verifica sobre la UNIÓN: ningún disparador puede perder su
    // gate al cruzar de archivo. El objeto de disponibilidad se llama
    // `accountActions` o `actions` según el archivo; ambos nombres valen.
    const ui = [
      readSrc("features/accounts/components/account-detail-view.tsx"),
      readSrc("features/pockets/components/pocket-detail-dialog.tsx"),
      readSrc("features/dashboard/components/personal-views.tsx"),
    ].join("\n");

    // Los 4 disparadores sensibles pasan por el guard, no solo por `disabled`.
    const guardedCalls = ui.match(/runIfAllowed\(/g) ?? [];
    assert.ok(
      guardedCalls.length >= 4,
      `los disparadores sensibles deben pasar por runIfAllowed (encontrados: ${guardedCalls.length})`,
    );

    for (const action of ["createPocket", "adjustAvailable", "deletePocket", "moveThirdParty"] as const) {
      assert.match(
        ui,
        new RegExp(`(accountActions|actions)\\.${action}\\b`),
        `el disparador de ${action} debe consultar la disponibilidad resuelta para ${action}`,
      );
    }
    console.log("  ✓ H2.2: crear bolsillo, reajustar, eliminar bolsillo y mover dinero consultan el gate");
  }

  // ══════════════════════════════════════════════════════════════
  // H2.3 — El motivo del bloqueo es visible/asociado, no solo `title`
  // ══════════════════════════════════════════════════════════════
  {
    const ui = readSrc("features/dashboard/components/personal-views.tsx");
    assert.ok(
      ui.includes("aria-describedby") || ui.includes("ActionBlockedNote"),
      "el motivo debe exponerse con texto visible o asociado accesiblemente, no solo con title",
    );
    // Renombrar un bolsillo no mueve saldo: no debe quedar bloqueado por ownership.
    assert.doesNotMatch(
      ui,
      /accountActions\.(moveThirdParty|createPocket|deletePocket|adjustAvailable)[^\n]*setPocketPendingEdit/,
      "renombrar un bolsillo no puede quedar bloqueado por el gate de dinero",
    );
    console.log("  ✓ H2.3: motivo accesible asociado y renombrar bolsillo permanece disponible");
  }

  // ══════════════════════════════════════════════════════════════
  // H3.1 — Composición localizada por bolsillo (no el total global)
  // ══════════════════════════════════════════════════════════════
  {
    const composition = resolveAccountComposition({
      accountId: "acc-1",
      availableBalance: 70_000,
      pockets: [{ id: "p1", balance: 30_000 }, { id: "p2", balance: 10_000 }],
      entries: [entryAt("e1", 20_000, AVAILABLE("acc-1")), entryAt("e2", 30_000, { accountId: "acc-1", pocketId: "p1" })],
      moves: [],
      consumptions: [],
    });

    const rows = buildPocketCompositionRows(composition, [
      { id: "p1", name: "Viaje" },
      { id: "p2", name: "Ahorro" },
    ]);
    assert.equal(rows.length, 2);

    const p1 = rows.find((r) => r.pocketId === "p1");
    assert.ok(p1);
    assert.equal(p1.physical, 30_000);
    assert.equal(p1.thirdParty, 30_000, "el bolsillo muestra SU no propio");
    assert.equal(p1.own, 0);
    assert.notEqual(p1.thirdParty, composition.thirdParty, "no puede repetir el no propio global de la cuenta");

    const p2 = rows.find((r) => r.pocketId === "p2");
    assert.ok(p2);
    assert.equal(p2.thirdParty, 0);
    assert.equal(p2.own, 10_000);
    console.log("  ✓ H3.1: cada bolsillo expone su físico, su dinero propio y su no propio (no el global)");
  }

  // ══════════════════════════════════════════════════════════════
  // H3.2 — Foco: `getFocusableElements` sigue vivo porque `FinanceDialog` lo
  // usa para elegir el primer control útil al abrir. El ciclado por Tab
  // (`resolveDialogFocusTarget`) y el ciclo de vida por fase se eliminaron
  // junto con el modal de detalle de cuenta, hoy convertido en pantalla.
  // ══════════════════════════════════════════════════════════════
  {
    const makeEl = (disabled = false, hidden = false) =>
      ({
        tagName: "BUTTON",
        disabled,
        hasAttribute: (n: string) => (n === "hidden" ? hidden : false),
        getAttribute: () => null,
      }) as unknown as HTMLElement;

    const a = makeEl();
    const b = makeEl();
    const disabled = makeEl(true);
    const container = {
      querySelectorAll: () => [a, disabled, b],
    } as unknown as HTMLElement;

    const focusables = getFocusableElements(container);
    assert.deepEqual(focusables, [a, b], "los controles deshabilitados no participan del foco inicial");
    console.log("  ✓ H3.2: getFocusableElements ignora controles deshabilitados (foco inicial de FinanceDialog)");
  }

  // ══════════════════════════════════════════════════════════════
  // H3.3 — El detalle de cuenta ya NO es un modal: es la pantalla
  // `/accounts/[accountId]`. La trampa de foco, el retorno del foco al
  // disparador y la cesión de Escape al hijo eran obligaciones DE UN MODAL y
  // dejan de aplicar: una pantalla no debe atrapar el foco ni bloquear el
  // scroll. Los primitivos puros siguen probados arriba (H3.1/H3.2/H3.4) y los
  // diálogos pequeños conservan su propio manejo vía `FinanceDialog`.
  // ══════════════════════════════════════════════════════════════
  {
    const detail = readSrc("features/accounts/components/account-detail-view.tsx");
    assert.doesNotMatch(detail, /aria-modal/, "el detalle de cuenta no puede declararse modal");
    assert.doesNotMatch(detail, /role="dialog"/, "el detalle de cuenta no puede declararse role=dialog");
    assert.doesNotMatch(
      detail,
      /document\.body\.style\.overflow/,
      "una pantalla no puede bloquear el scroll del body",
    );
    assert.doesNotMatch(detail, /resolveDialogFocusTarget/, "una pantalla no debe atrapar el foco");
    // Sigue siendo alcanzable y con salida explícita.
    assert.match(detail, /href="\/accounts"/, "el detalle debe ofrecer vuelta a la lista (breadcrumb)");
    assert.match(detail, /aria-current="page"/, "el breadcrumb debe marcar el segmento actual");
    console.log("  ✓ H3.3: el detalle de cuenta es pantalla con breadcrumb, sin semántica ni chrome de modal");
  }

  // ══════════════════════════════════════════════════════════════
  // H3.4 — El ciclo de vida de foco por fase se ELIMINÓ junto con el modal
  //
  // `dialog-focus-lifecycle.ts` existía solo para el modal de detalle de
  // cuenta. Convertido en pantalla, el módulo quedó sin ningún consumidor y se
  // borró en vez de dejarse como código muerto. Lo que se protege aquí es que
  // ningún consumidor vuelva a atar el foco al patrón booleano que la
  // corrección original eliminó.
  // ══════════════════════════════════════════════════════════════
  {
    const consumers = [
      "features/dashboard/components/personal-views.tsx",
      "features/accounts/components/account-detail-view.tsx",
      "components/finance/finance-dialog.tsx",
    ];
    for (const rel of consumers) {
      const ui = readSrc(rel);
      // El cleanup del efecto de teclado nunca puede restaurar foco.
      assert.doesNotMatch(
        ui,
        /removeEventListener\("keydown", onKey\);\s*previouslyFocusedRef/,
        `${rel}: el cleanup del listener de teclado no puede devolver el foco al disparador`,
      );
      assert.doesNotMatch(
        ui,
        /dialog-focus-lifecycle/,
        `${rel}: el ciclo de vida de foco por fase se eliminó; no puede reintroducirse sin revisar el contrato`,
      );
    }
    console.log("  ✓ H3.4: el ciclo de vida de foco por fase quedó sin consumidores y fue eliminado");
  }

  console.log("All step6-p1-fixes unit tests passed successfully!");
}

run().catch((err) => {
  console.error("Test failure in step6-p1-fixes.test.ts:", err);
  process.exitCode = 1;
});
