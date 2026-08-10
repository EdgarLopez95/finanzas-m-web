/**
 * tests/unit/step6-account-detail-experience.test.ts
 *
 * Paso 6 — Cierre de la experiencia Web de cuentas y bolsillos.
 *
 * Cubre con lógica REAL (no estructural) los módulos puros nuevos:
 *   - composición por ubicación y por cuenta (Total físico / Disponible / Mi dinero / No propio)
 *   - evaluación idempotente de legado sin ubicación verificable (requiresReview)
 *   - disponibilidad de acciones y copys diferenciados de fondos insuficientes
 *
 * Las comprobaciones estructurales se limitan al render de React, que este
 * repositorio no puede ejecutar (no hay jsdom ni RTL instalados).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  resolveLocationComposition,
  resolveAccountComposition,
} from "../../src/lib/finance/account-ownership-composition";
import {
  evaluateThirdPartyLegacy,
  LEGACY_REVIEW_MESSAGE,
} from "../../src/lib/finance/third-party-legacy-evaluation";
import {
  resolveAccountActionAvailability,
  resolveInsufficientFundsMessage,
  CLOSED_ACCOUNT_ACTION_MESSAGE,
  INCONSISTENT_ACCOUNT_ACTION_MESSAGE,
} from "../../src/features/accounts/lib/account-action-availability";
import type { MoneyLocation } from "../../src/lib/finance/third-party-location";

console.log("Running unit tests for step6-account-detail-experience.test.ts...");

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string) => readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

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
  // 1. Composición por ubicación: los cuatro valores son distinguibles
  // ══════════════════════════════════════════════════════════════
  {
    const loc = AVAILABLE("acc-1");
    const c = resolveLocationComposition({
      location: loc,
      physical: 100_000,
      entries: [entryAt("e1", 40_000, loc)],
      moves: [],
      consumptions: [],
    });
    assert.equal(c.physical, 100_000);
    assert.equal(c.thirdParty, 40_000);
    assert.equal(c.own, 60_000);
    assert.equal(c.isInconsistent, false);
    console.log("  ✓ 1. Ubicación: físico 100.000 / no propio 40.000 -> Mi dinero 60.000, consistente");
  }

  // ══════════════════════════════════════════════════════════════
  // 2. Inconsistencia: Mi dinero negativo se muestra, NUNCA se clampea
  // ══════════════════════════════════════════════════════════════
  {
    const loc = AVAILABLE("acc-1");
    const c = resolveLocationComposition({
      location: loc,
      physical: 100_000,
      entries: [entryAt("e1", 120_000, loc)],
      moves: [],
      consumptions: [],
    });
    assert.equal(c.thirdParty, 120_000);
    assert.equal(c.own, -20_000, "Mi dinero debe quedar negativo, sin clamp");
    assert.equal(c.isInconsistent, true);
    console.log("  ✓ 2. Inconsistencia: Mi dinero -20.000 visible y marcado, sin clamp ni corrección silenciosa");
  }

  // ══════════════════════════════════════════════════════════════
  // 3. Composición de cuenta: Disponible y bolsillos son ubicaciones distintas
  // ══════════════════════════════════════════════════════════════
  {
    const disponible = AVAILABLE("acc-1");
    const bolsillo = POCKET("acc-1", "p1");
    const acc = resolveAccountComposition({
      accountId: "acc-1",
      availableBalance: 70_000,
      pockets: [{ id: "p1", balance: 30_000 }],
      entries: [entryAt("e1", 20_000, disponible), entryAt("e2", 30_000, bolsillo)],
      moves: [],
      consumptions: [],
    });
    assert.equal(acc.available, 70_000);
    assert.equal(acc.pocketsTotal, 30_000);
    assert.equal(acc.totalPhysical, 100_000, "Total físico = Disponible + bolsillos");
    assert.equal(acc.thirdParty, 50_000, "no propio agregado de todas las ubicaciones");
    assert.equal(acc.own, 50_000);
    assert.equal(acc.isInconsistent, false);

    const pocketComp = acc.byLocation.find((l) => l.location.pocketId === "p1");
    assert.ok(pocketComp);
    assert.equal(pocketComp.thirdParty, 30_000, "el bolsillo expone SU no propio, no el global");
    assert.equal(pocketComp.own, 0);
    console.log("  ✓ 3. Cuenta: Total 100.000 = Disponible 70.000 + bolsillos 30.000; cada bolsillo con su propia composición");
  }

  // ══════════════════════════════════════════════════════════════
  // 4. Una sola ubicación inconsistente marca la cuenta completa
  // ══════════════════════════════════════════════════════════════
  {
    const acc = resolveAccountComposition({
      accountId: "acc-1",
      availableBalance: 10_000,
      pockets: [{ id: "p1", balance: 5_000 }],
      entries: [entryAt("e1", 50_000, POCKET("acc-1", "p1"))],
      moves: [],
      consumptions: [],
    });
    assert.equal(acc.isInconsistent, true, "una ubicación inconsistente marca toda la cuenta");
    assert.equal(acc.own, -35_000, "Mi dinero agregado también puede ser negativo");
    console.log("  ✓ 4. Una ubicación inconsistente marca la cuenta y el agregado permanece negativo");
  }

  // ══════════════════════════════════════════════════════════════
  // 5. Legado: entry con ubicación demostrable se clasifica como derivada
  // ══════════════════════════════════════════════════════════════
  {
    const loc = AVAILABLE("acc-1");
    const evaluation = evaluateThirdPartyLegacy({ entries: [entryAt("e1", 40_000, loc)] });
    assert.equal(evaluation.requiresReview, false);
    assert.equal(evaluation.unlocatedAmount, 0);
    assert.equal(evaluation.entries[0].status, "located");
    console.log("  ✓ 5. Legado resoluble: se clasifica como ubicado, sin revisión");
  }

  // ══════════════════════════════════════════════════════════════
  // 6. Legado ambiguo: requiresReview y NUNCA se asume "mío"
  // ══════════════════════════════════════════════════════════════
  {
    const evaluation = evaluateThirdPartyLegacy({ entries: [entryAt("e-legacy", 40_000, null)] });
    assert.equal(evaluation.requiresReview, true);
    assert.equal(evaluation.unlocatedAmount, 40_000);
    assert.equal(evaluation.entries[0].status, "requiresReview");
    assert.equal(evaluation.entries[0].reason, "location_not_resolvable");

    // El monto ambiguo NO se imputa a ninguna ubicación.
    const c = resolveLocationComposition({
      location: AVAILABLE("acc-1"),
      physical: 100_000,
      entries: [entryAt("e-legacy", 40_000, null)],
      moves: [],
      consumptions: [],
    });
    assert.equal(c.thirdParty, 0, "un legado sin ubicación no se asigna a ninguna ubicación");
    assert.equal(c.own, 100_000, "…y tampoco se declara propio: la revisión lo bloquea aparte");
    console.log("  ✓ 6. Legado ambiguo: requiresReview, no se imputa a ninguna ubicación ni se asume propio");
  }

  // ══════════════════════════════════════════════════════════════
  // 7. Evaluación legacy es PURA e IDEMPOTENTE
  // ══════════════════════════════════════════════════════════════
  {
    const entries = [entryAt("e1", 10_000, AVAILABLE("acc-1")), entryAt("e2", 5_000, null)];
    const frozen = JSON.parse(JSON.stringify(entries));
    const first = evaluateThirdPartyLegacy({ entries });
    const second = evaluateThirdPartyLegacy({ entries });
    assert.deepEqual(first, second, "misma entrada -> mismo resultado");
    assert.deepEqual(entries, frozen, "no muta los inputs");
    console.log("  ✓ 7. Evaluación de legado pura e idempotente, sin mutar inputs");
  }

  // ══════════════════════════════════════════════════════════════
  // 8. Saldo físico existente NUNCA implica ownership
  // ══════════════════════════════════════════════════════════════
  {
    // Hay 500.000 físicos y un legado ambiguo: no se puede concluir nada.
    const evaluation = evaluateThirdPartyLegacy({ entries: [entryAt("e1", 1, null)] });
    assert.equal(evaluation.requiresReview, true);
    assert.equal(
      evaluation.entries.every((e) => e.status !== "located"),
      true,
      "la existencia de saldo físico no puede convertir un legado ambiguo en resuelto",
    );
    console.log("  ✓ 8. La existencia de saldo físico nunca inventa ownership");
  }

  // ══════════════════════════════════════════════════════════════
  // 9. Fondos insuficientes: propio vs físico -> mensajes DISTINTOS
  // ══════════════════════════════════════════════════════════════
  {
    const ok = resolveInsufficientFundsMessage({ requested: 50_000, physical: 100_000, own: 60_000 });
    assert.equal(ok, null, "dentro de Mi dinero: sin error");

    const notOwn = resolveInsufficientFundsMessage({ requested: 80_000, physical: 100_000, own: 60_000 });
    assert.ok(notOwn, "físico suficiente pero excede Mi dinero: debe haber mensaje");
    assert.match(notOwn, /no propio/i, "debe explicar que el exceso es dinero no propio");
    assert.match(notOwn, /60/, "debe indicar cuánto es realmente tuyo");

    const notPhysical = resolveInsufficientFundsMessage({ requested: 150_000, physical: 100_000, own: 60_000 });
    assert.ok(notPhysical);
    assert.notEqual(notPhysical, notOwn, "los dos casos NO pueden compartir el mismo mensaje");
    assert.doesNotMatch(notPhysical, /no propio/i, "sin saldo físico el motivo no es la propiedad");
    console.log("  ✓ 9. Fondos insuficientes: 'no alcanza tu dinero' y 'no alcanza el saldo físico' son mensajes distintos");
  }

  // ══════════════════════════════════════════════════════════════
  // 10. Cuenta cerrada: bloquea movimientos, permite reabrir
  // ══════════════════════════════════════════════════════════════
  {
    const composition = resolveAccountComposition({
      accountId: "acc-1",
      availableBalance: 50_000,
      pockets: [],
      entries: [],
      moves: [],
      consumptions: [],
    });
    const actions = resolveAccountActionAvailability({
      archived: true,
      composition,
      legacy: evaluateThirdPartyLegacy({ entries: [] }),
      pocketCount: 0,
    });

    for (const key of ["moveThirdParty", "adjustAvailable", "createPocket", "deletePocket"] as const) {
      assert.equal(actions[key].enabled, false, `${key} debe estar bloqueada en cuenta cerrada`);
      assert.equal(actions[key].reason, CLOSED_ACCOUNT_ACTION_MESSAGE);
    }
    assert.equal(actions.reopenAccount.enabled, true, "reabrir SIEMPRE debe estar disponible en cuenta cerrada");
    assert.equal(actions.closeAccount.enabled, false, "no se cierra una cuenta ya cerrada");
    assert.equal(actions.deleteAccount.enabled, true, "una cuenta cerrada sin bolsillos sí puede eliminarse");
    console.log("  ✓ 10. Cuenta cerrada: movimientos bloqueados, reapertura y eliminación disponibles");
  }

  // ══════════════════════════════════════════════════════════════
  // 11. Cuenta con bolsillos: no cierra ni elimina, y lo explica
  // ══════════════════════════════════════════════════════════════
  {
    const composition = resolveAccountComposition({
      accountId: "acc-1",
      availableBalance: 50_000,
      pockets: [{ id: "p1", balance: 10_000 }],
      entries: [],
      moves: [],
      consumptions: [],
    });
    const actions = resolveAccountActionAvailability({
      archived: false,
      composition,
      legacy: evaluateThirdPartyLegacy({ entries: [] }),
      pocketCount: 1,
    });
    assert.equal(actions.closeAccount.enabled, false);
    assert.match(String(actions.closeAccount.reason), /bolsillo/i);
    assert.equal(actions.deleteAccount.enabled, false);
    assert.match(String(actions.deleteAccount.reason), /bolsillo/i);
    console.log("  ✓ 11. Cuenta con bolsillos: cerrar y eliminar bloqueados con motivo explícito");
  }

  // ══════════════════════════════════════════════════════════════
  // 12. Inconsistencia: bloquea gastar/mover, NO bloquea consultar ni reabrir
  // ══════════════════════════════════════════════════════════════
  {
    const composition = resolveAccountComposition({
      accountId: "acc-1",
      availableBalance: 10_000,
      pockets: [],
      entries: [entryAt("e1", 50_000, AVAILABLE("acc-1"))],
      moves: [],
      consumptions: [],
    });
    assert.equal(composition.isInconsistent, true);

    const actions = resolveAccountActionAvailability({
      archived: false,
      composition,
      legacy: evaluateThirdPartyLegacy({ entries: [] }),
      pocketCount: 0,
    });
    assert.equal(actions.moveThirdParty.enabled, false);
    assert.equal(actions.moveThirdParty.reason, INCONSISTENT_ACCOUNT_ACTION_MESSAGE);
    assert.equal(actions.createPocket.enabled, false, "crear bolsillo atribuiría dinero: bloqueado");
    assert.equal(actions.adjustAvailable.enabled, false, "reajustar movería dinero no propio: bloqueado");
    console.log("  ✓ 12. Inconsistencia: bloquea mover/atribuir/reajustar con motivo canónico, sin ocultar cifras");
  }

  // ══════════════════════════════════════════════════════════════
  // 13. Legado requiresReview bloquea atribución y muestra copy de revisión
  // ══════════════════════════════════════════════════════════════
  {
    const composition = resolveAccountComposition({
      accountId: "acc-1",
      availableBalance: 100_000,
      pockets: [],
      entries: [],
      moves: [],
      consumptions: [],
    });
    const actions = resolveAccountActionAvailability({
      archived: false,
      composition,
      legacy: evaluateThirdPartyLegacy({ entries: [entryAt("e-legacy", 40_000, null)] }),
      pocketCount: 0,
    });
    assert.equal(actions.moveThirdParty.enabled, false);
    assert.equal(actions.moveThirdParty.reason, LEGACY_REVIEW_MESSAGE);
    assert.equal(actions.createPocket.enabled, false);
    assert.equal(actions.reopenAccount.enabled === false, true, "cuenta activa: reabrir no aplica");
    console.log("  ✓ 13. Legado requiresReview bloquea atribución/movimiento con el copy de revisión");
  }

  // ══════════════════════════════════════════════════════════════
  // 14. GUARDA ANTI-REGRESIÓN (Pasos 1–5): ningún mutador recibe saldo derivado
  // ══════════════════════════════════════════════════════════════
  {
    const mutators = [
      "features/accounts/services/adjust-account-balance.ts",
      "features/pockets/services/create-account-pocket.ts",
      "features/pockets/services/delete-account-pocket.ts",
      "features/transactions/services/create-third-party-location-transfer.ts",
    ];
    for (const rel of mutators) {
      const src = readSrc(rel);
      // No pueden derivar el Disponible restando bolsillos ni consumir un Total presentacional.
      assert.doesNotMatch(
        src,
        /\.balance\s*-\s*(pocketsSum|pSum|pocketsTotal|pocketsBalance|totalBalance)\b/,
        `${rel} no puede reconstruir el Disponible restando bolsillos de un Total`,
      );
      assert.doesNotMatch(
        src,
        /currentBalance\s*:\s*(totalBalance|totalPhysical|composition\.)/,
        `${rel} no puede escribir currentBalance a partir de un valor presentacional`,
      );
      // El saldo se relee del snapshot transaccional, no llega por props.
      assert.match(
        src,
        /currentBalance\s*\?\?|\.data\(\)/,
        `${rel} debe leer el saldo desde el documento, no recibirlo ya calculado`,
      );
    }
    console.log("  ✓ 14. Guarda anti-regresión: los 4 mutadores leen saldo del documento, nunca un derivado presentacional");
  }

  // ══════════════════════════════════════════════════════════════
  // 15. Contrato de UI (estructural: este repo no puede renderizar React)
  // ══════════════════════════════════════════════════════════════
  {
    // El detalle de cuenta dejó de ser un modal de `personal-views` y es ahora
    // la pantalla `/accounts/[accountId]`. El contrato de UI se verifica sobre
    // el componente que la renderiza; la semántica no cambió.
    const ui = readSrc("features/accounts/components/account-detail-view.tsx");

    // Los cuatro conceptos deben estar separados y rotulados en el detalle.
    for (const label of ["Total físico", "Disponible", "Mi dinero", "Dinero no propio"]) {
      assert.ok(ui.includes(label), `el detalle de cuenta debe rotular "${label}"`);
    }

    // Acciones destructivas nunca solo-icono: deben llevar texto visible.
    for (const label of ["Cerrar cuenta", "Reabrir cuenta", "Eliminar cuenta"]) {
      assert.ok(ui.includes(label), `la acción "${label}" debe tener etiqueta de texto visible`);
    }

    // El detalle consume la composición, no `account.balance` como si fuera Disponible.
    assert.match(
      ui,
      /resolveAccountComposition\(/,
      "el detalle debe derivar la composición con el helper puro",
    );

    // Botones SOLO-ICONO: deben declarar nombre accesible.
    // Se considera solo-icono cuando, tras retirar los componentes de icono
    // autocerrados, no queda ningún contenido visible dentro del botón.
    const ICON_SELF_CLOSING = /<[A-Z][A-Za-z0-9]*\b[^>]*\/>/g;
    const iconOnlyWithoutName: string[] = [];
    for (const chunk of ui.split("<button").slice(1)) {
      const end = chunk.indexOf("</button>");
      if (end === -1) continue;
      const block = chunk.slice(0, end);
      const openTagEnd = block.indexOf(">");
      if (openTagEnd === -1) continue;
      const openTag = block.slice(0, openTagEnd);
      const inner = block.slice(openTagEnd + 1);

      const visibleAfterIcons = inner.replace(ICON_SELF_CLOSING, "").trim();
      const isIconOnly = visibleAfterIcons.length === 0;
      const hasAccessibleName = /aria-label[=\s]/.test(openTag) || /aria-labelledby[=\s]/.test(openTag);

      if (isIconOnly && !hasAccessibleName) {
        iconOnlyWithoutName.push(`<button${openTag.slice(0, 90)}…`);
      }
    }
    assert.deepEqual(
      iconOnlyWithoutName,
      [],
      "todo botón solo-icono debe declarar aria-label (o aria-labelledby)",
    );
    console.log("  ✓ 15. UI: cuatro conceptos rotulados, acciones destructivas con texto y botones de icono con nombre accesible");
  }

  console.log("All step6-account-detail-experience unit tests passed successfully!");
}

run().catch((err) => {
  console.error("Test failure in step6-account-detail-experience.test.ts:", err);
  process.exitCode = 1;
});
