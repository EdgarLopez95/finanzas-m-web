import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  QA_TOOLS_ENV_FLAG,
  QA_TOOLS_ENV_FLAG_ON,
  resolveQaToolsEnabled,
} from "../../src/lib/qa/qa-tools";

/**
 * Depuración de Ajustes Web.
 *
 * Cubre las tres garantías que el producto necesita y que antes nadie vigilaba:
 *
 * 1. Las preferencias retiradas no vuelven por ninguna puerta (estado, claves
 *    de `localStorage`, acciones, UI ni consumidores).
 * 2. Ajustes queda con el alcance de la especificación §19: perfil, Hogar,
 *    categorías, cuentas y cierre de sesión.
 * 3. El diagnóstico y el reinicio son EXCLUSIVOS de desarrollo/QA (§19.4,
 *    §20.3): en producción sin bandera no se renderizan NI entran al bundle.
 */

console.log("Running unit tests for settings-legacy-and-qa-surface.test.ts...");

const repoRoot = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.resolve(repoRoot, rel), "utf-8");
const exists = (rel: string) => fs.existsSync(path.resolve(repoRoot, rel));
const relOf = (file: string) => path.relative(repoRoot, file).split(path.sep).join("/");

/** Todos los `.ts`/`.tsx` bajo `src/`. */
const sourceFiles = (): string[] => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  walk(path.resolve(repoRoot, "src"));
  return out;
};

// ─── 1. Preferencias legacy: ni estado, ni claves, ni UI ─────────────────────

// Los stores completos desaparecen: al retirar sus campos no quedaba nada dentro.
assert.equal(
  exists("src/stores/ui-preferences-store.ts"),
  false,
  "el store de preferencias legacy no puede seguir existiendo",
);
assert.equal(
  exists("src/stores/household-ui-preferences-store.ts"),
  false,
  "el store del tablero configurable de Hogar tampoco: el Inicio tiene composición fija",
);

const retiredSymbols = [
  "balancesHidden",
  "notificationsEnabled",
  "isEditingBoard",
  "boardOrder",
  "hiddenCards",
  "isEditingHouseholdBoard",
  "householdBoardOrder",
  "householdHiddenCards",
  "toggleBalancesHidden",
  "toggleNotifications",
  "setEditingBoard",
  "resetBoard",
  "useUiPreferencesStore",
  "useHouseholdUiPreferencesStore",
];

/** Claves de `localStorage` que solo existían para esas preferencias. */
const retiredStorageKeys = [
  "fm-hide-balances",
  "fm-notifications-enabled",
  "fm-board-order",
  "fm-board-hidden",
  "fm-hh-board-order",
  "fm-hh-board-hidden",
];

for (const file of sourceFiles()) {
  const source = fs.readFileSync(file, "utf-8");
  const rel = relOf(file);

  for (const symbol of retiredSymbols) {
    assert.equal(
      source.includes(symbol),
      false,
      `${rel} todavía referencia el símbolo retirado ${symbol}`,
    );
  }
  for (const storageKey of retiredStorageKeys) {
    assert.equal(
      source.includes(storageKey),
      false,
      `${rel} todavía escribe la clave retirada ${storageKey}`,
    );
  }
  // La prop `masked` era el vehículo de "Ocultar saldos": sin la preferencia,
  // una prop que nunca puede ser true es código muerto.
  assert.equal(source.includes("masked"), false, `${rel} conserva la prop retirada masked`);
  assert.equal(
    source.includes("Ocultar saldos"),
    false,
    `${rel} conserva copy de la preferencia retirada`,
  );
}

// ─── 2. El encabezado Personal conserva lo suyo y pierde el ojo ──────────────

const shell = read("src/components/layout/dashboard-shell.tsx");
assert.equal(shell.includes("Mostrar saldos"), false, "no puede quedar el botón del ojo");
assert.equal(shell.includes("EyeOff"), false, "no puede quedar el icono del ojo");
assert.ok(shell.includes("openPeriodPicker"), "el selector de período se conserva");
assert.ok(shell.includes("createItems"), "el menú Nuevo se conserva");

// ─── 3. Ajustes: alcance de la especificación §19 ────────────────────────────

const blocks = read("src/components/finance/settings-blocks.tsx");

assert.equal(
  blocks.includes("SettingsPreferencesCard"),
  false,
  "la card Preferencias quedó vacía al retirar sus filas y debe desaparecer",
);
assert.equal(blocks.includes("Cards de Inicio"), false, "el Inicio ya no es configurable");
assert.equal(
  blocks.includes("Sincronización en vivo"),
  false,
  "§19.4: no se muestran diagnósticos técnicos al usuario final",
);
assert.equal(
  blocks.includes("Notificaciones"),
  false,
  "§26: las notificaciones no son requisito funcional",
);

// El título "Organización" desapareció; se reemplaza por 2 cards hermanas independientes.
assert.equal(
  blocks.includes('title="Organización"'),
  false,
  "la card contenedora con título 'Organización' debe desaparecer",
);

// Card 1: Categorías
assert.ok(blocks.includes("Administrar categorías"), "conserva Administrar categorías");
assert.ok(
  blocks.includes("Crea, edita y archiva tus categorías personales."),
  "conserva descripción de categorías",
);
assert.ok(blocks.includes('router.push("/categories")'), "categorías navega a /categories");

// Card 2: Cuentas
assert.ok(blocks.includes("Administrar cuentas"), "conserva Administrar cuentas");
assert.ok(
  blocks.includes("Crea, edita y archiva tus cuentas personales informativas."),
  "conserva descripción de cuentas",
);
assert.ok(blocks.includes('router.push("/accounts")'), "cuentas navega a /accounts");

// Responsive: 2 columnas en desktop con fallback de 1 columna
assert.ok(
  blocks.includes("md:grid-cols-2") || blocks.includes("lg:grid-cols-2"),
  "la composición debe usar grid de 2 columnas en desktop",
);

// Perfil, Hogar y cierre de sesión con confirmación siguen en pie.
const settingsView = read("src/features/settings/components/mplus-settings-view.tsx");
assert.ok(settingsView.includes("ProfileAvatar"), "el perfil de Google informativo se conserva");
assert.ok(
  settingsView.includes("MplusHouseholdLifecycleCard"),
  "la card de ciclo de vida del Hogar se conserva en Ajustes Personal",
);
assert.ok(blocks.includes("Cerrar sesión"), "el cierre de sesión se conserva");
assert.ok(blocks.includes("logoutConfirmOpen"), "el cierre de sesión conserva su confirmación");

// ─── 4. La puerta de QA ──────────────────────────────────────────────────────

assert.equal(
  resolveQaToolsEnabled({ nodeEnv: "production", qaFlag: undefined }),
  false,
  "producción sin bandera: herramientas de QA apagadas",
);
assert.equal(
  resolveQaToolsEnabled({ nodeEnv: "production", qaFlag: "0" }),
  false,
  "una bandera con cualquier otro valor no enciende nada",
);
assert.equal(
  resolveQaToolsEnabled({ nodeEnv: "production", qaFlag: "true" }),
  false,
  "solo el valor exacto enciende la bandera",
);
assert.equal(
  resolveQaToolsEnabled({ nodeEnv: "production", qaFlag: QA_TOOLS_ENV_FLAG_ON }),
  true,
  "build de QA explícito: encendido",
);
assert.equal(
  resolveQaToolsEnabled({ nodeEnv: "development", qaFlag: undefined }),
  true,
  "desarrollo: encendido",
);
assert.equal(QA_TOOLS_ENV_FLAG, "NEXT_PUBLIC_MPLUS_QA_TOOLS");

// ─── 5. Diagnóstico QA: solo detrás de la puerta; Reinicio: producto ────────

// La condición de QA se escribe INLINE y a nivel de módulo, no como llamada a otro
// módulo: comprobado contra el bundle real, esa otra forma no se pliega.
assert.ok(
  settingsView.includes('process.env.NODE_ENV !== "production"'),
  "Ajustes decide con una condición que el build puede resolver",
);
assert.ok(
  settingsView.includes("QA_TOOLS_ENABLED ? <QaDiagnosticsCard /> : null"),
  "el panel de diagnóstico se monta solo con la puerta abierta",
);
assert.ok(
  settingsView.includes("MplusResetConfirmDialog"),
  "el reinicio de cuenta es producto y usa MplusResetConfirmDialog",
);
assert.ok(
  settingsView.includes('from "@/features/qa-reset"'),
  "Ajustes alcanza las herramientas de QA solo por el barril",
);

// El barril y el stub de QA exponen exactamente la misma superficie.
const barrel = read("src/features/qa-reset/index.tsx");
const stub = read("src/features/qa-reset/production-stub.tsx");
for (const exported of [
  "QaDiagnosticsCard",
  "QA_TOOLS_AVAILABLE",
]) {
  assert.ok(barrel.includes(exported), `el barril de QA debe exportar ${exported}`);
  assert.ok(stub.includes(exported), `el stub de producción debe exportar ${exported}`);
}
assert.ok(
  stub.includes("QA_TOOLS_AVAILABLE = false"),
  "el stub declara la superficie apagada",
);

// El corte real lo hace el build, no el minificador.
const config = read("next.config.ts");
assert.ok(
  config.includes("NormalModuleReplacementPlugin"),
  "el build sustituye el módulo de QA por el stub en producción",
);
assert.ok(
  config.includes("qa-reset") && config.includes("production-stub.tsx"),
  "la sustitución apunta al stub de producción",
);
assert.ok(
  config.includes("!dev && !qaToolsRequested"),
  "la sustitución solo se salta en un build de QA pedido explícitamente",
);
assert.ok(
  config.includes("NEXT_PUBLIC_MPLUS_QA_TOOLS: qaToolsRequested"),
  "la bandera se declara en el config para que el bundle la vea como literal",
);

// El barril es el único punto de acceso: nadie importa los módulos QA directo,
// porque una importación profunda se saltaría la sustitución del build.
const deepImportPattern = /from "@\/features\/qa-reset\/[^"]+"/;
const qaDeepImporters = sourceFiles().filter((file) => {
  if (relOf(file).startsWith("src/features/qa-reset/")) return false;
  return deepImportPattern.test(fs.readFileSync(file, "utf-8"));
});
assert.deepEqual(
  qaDeepImporters.map(relOf),
  [],
  "nadie puede saltarse el barril importando un módulo QA directamente",
);

// ─── 6. El diagnóstico muestra evidencia real, no texto decorativo ───────────

const diagnostics = read("src/features/qa-reset/components/qa-diagnostics-card.tsx");

for (const [needle, why] of [
  ["useMplusPersonalStore((state) => state.status)", "estado de carga de Personal"],
  ["useMplusPersonalStore((state) => state.error)", "error de Personal"],
  ["useMplusHouseholdStore((state) => state.status)", "estado de carga de Hogar"],
  ["useMplusHouseholdStore((state) => state.error)", "error de Hogar"],
  ["state.generation", "contador de recargas que el store ya expone"],
  ["window.navigator.onLine", "conectividad real del navegador"],
  ["activeContext", "contexto activo"],
] as const) {
  assert.ok(diagnostics.includes(needle), `el panel debe mostrar ${why}`);
}

assert.ok(diagnostics.includes("shortenUid"), "el UID se muestra abreviado, no completo");

// No es un botón de sincronizar, no finge modo offline ni cola manual.
assert.equal(
  diagnostics.includes("Sincronizar"),
  false,
  "§21.4: Web no ofrece sincronización manual",
);
assert.ok(diagnostics.includes("Recargar lecturas"), "la acción se llama Recargar lecturas");
assert.ok(
  diagnostics.includes("refreshPersonal()") && diagnostics.includes("refreshHousehold()"),
  "debe re-ejecutar los loaders reales, no una simulación",
);
assert.ok(
  diagnostics.includes("useMplusPersonalStore.getState()"),
  "el resultado se comprueba contra el estado real de los stores, no contra la promesa",
);

// ─── 7. Listeners centralizados: onSnapshot solo en servicios autorizados ────

const listenerUsers = sourceFiles().filter((file) =>
  /\bonSnapshot\s*\(/.test(fs.readFileSync(file, "utf-8")),
);
const allowedListenerFiles = new Set([
  "src/lib/mplus/user-bootstrap.ts",
  "src/features/accounts/services/mplus-account-service.ts",
  "src/features/categories/services/mplus-category-service.ts",
  "src/features/movements/services/read-personal-movements.ts",
  "src/features/household/services/mplus-household-service.ts",
  "src/features/household/services/mplus-household-categories-service.ts",
  "src/features/household/services/read-household-movements.ts",
]);
const unauthorizedListenerFiles = listenerUsers
  .map(relOf)
  .filter((rel) => !allowedListenerFiles.has(rel));

assert.deepEqual(
  unauthorizedListenerFiles,
  [],
  "onSnapshot solo debe invocarse en los servicios autorizados; las páginas y componentes no crean listeners propios",
);

// Ambos stores gestionan listeners centralizados con subscriptionRegistry y descartan respuestas obsoletas por generation.
for (const storeRel of [
  "src/stores/mplus-personal-store.ts",
  "src/stores/mplus-household-store.ts",
]) {
  const source = read(storeRel);
  assert.ok(
    source.includes("subscriptionRegistry"),
    `${storeRel} debe gestionar sus suscripciones con subscriptionRegistry`,
  );
  assert.ok(
    /generation\s*!==/.test(source),
    `${storeRel} debe descartar respuestas obsoletas por generación`,
  );
  assert.ok(source.includes("force: true"), `${storeRel}.refresh debe forzar la relectura`);
}

// ─── 8. Cierre del reinicio: fuera de la sesión, no al dashboard ─────────────

const resetDialog = read("src/features/settings/components/mplus-reset-confirm-dialog.tsx");
assert.ok(resetDialog.includes("signOutUser()"), "tras reiniciar se cierra sesión en Firebase Auth");

// La vuelta al acceso inicial es una navegación DURA, y esto no es un detalle:
// `signOutUser()` limpia la sesión del store y Ajustes desmonta este diálogo en
// cuanto no hay `uid`, así que un `router.replace` lanzado después del `await`
// sale del closure de un componente ya desmontado y NO navega — la pestaña se
// quedaba en /settings en blanco. `window.location` no depende de React, y de
// paso arranca stores y efectos de cero, que es lo que corresponde después de
// borrar todos los datos de la cuenta.
assert.ok(
  resetDialog.includes('window.location.assign("/")'),
  "se vuelve al acceso inicial con una navegación dura",
);
// Se comprueba la dependencia real (`useRouter`), no el texto: el comentario de
// arriba explica por qué NO se usa `router.replace` y nombrarlo ahí no puede
// hacer fallar la prueba.
assert.equal(
  resetDialog.includes("useRouter"),
  false,
  "no puede depender del router de React: el diálogo ya está desmontado cuando termina el cierre de sesión",
);
assert.equal(
  resetDialog.includes('assign("/dashboard")'),
  false,
  "no puede volver al dashboard autenticado",
);
assert.equal(
  resetDialog.includes("Tu inicio de sesión de Google se conserva"),
  false,
  "no puede afirmar que la sesión se conserva dentro de la app",
);
// §20.3: advertencia explícita de que no hay Papelera ni recuperación.
assert.ok(resetDialog.includes("Papelera"), "la confirmación advierte que no pasa por Papelera");
assert.ok(resetDialog.includes("recuperar"), "la confirmación advierte que no hay recuperación");

// ─── 9. Desvinculación del compañero: contrato §16.3 ─────────────────────────

const resetService = read(
  "src/features/settings/services/mplus-account-reset-service.ts",
);
assert.equal(
  /userDocPath\(\s*otherUid/.test(resetService) || resetService.includes("otherUserRef"),
  false,
  "el reinicio no puede tocar el perfil del compañero: Rules solo permiten el propio",
);

const householdService = read("src/features/household/services/mplus-household-service.ts");
assert.ok(
  householdService.includes("reconcileOrphanHouseholdLink"),
  "debe existir la auto-reparación del vínculo huérfano (contrato §16.3)",
);
const householdHook = read("src/features/household/hooks/use-mplus-household.ts");
assert.ok(
  householdHook.includes("useMplusOrphanHouseholdReconciler"),
  "la auto-reparación debe tener un driver montado",
);
assert.ok(
  shell.includes("useMplusOrphanHouseholdReconciler(authenticated)"),
  "el driver de auto-reparación se monta en el shell",
);

console.log("settings-legacy-and-qa-surface.test.ts: OK");

