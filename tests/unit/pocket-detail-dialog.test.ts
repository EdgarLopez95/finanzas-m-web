import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for pocket-detail-dialog.test.ts...");

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

export function runPocketDetailDialogTests() {
  let checks = 0;

  const dialog = readSrc("features/pockets/components/pocket-detail-dialog.tsx");
  const card = readSrc("components/finance/account-pocket-card.tsx");
  const view = readSrc("features/dashboard/components/personal-views.tsx");

  // 1. UI web: modal centrado del sistema, NO un clon del bottom sheet Android.
  assert.match(dialog, /<FinanceDialog/, "El detalle de bolsillo debe usar FinanceDialog (modal web del producto)");
  assert.doesNotMatch(
    dialog,
    /\b(bottom-?sheet|inset-x-0\s+bottom-0|translate-y-full)\b/i,
    "El detalle de bolsillo no debe clonar el bottom sheet móvil de Android"
  );
  checks += 2;

  // 2. Contenido mínimo de paridad: saldo, cuenta padre y contexto de la cuenta.
  assert.match(dialog, /Cuenta: \$\{account\.name\}/, "Debe mostrar la cuenta padre como subtítulo");
  assert.match(dialog, /Saldo del bolsillo/, "Debe mostrar el saldo del bolsillo como monto principal");
  assert.match(dialog, /Disponible en cuenta/, "Debe mostrar el Disponible de la cuenta padre");
  assert.match(dialog, /Total en bolsillos/, "Debe mostrar el total en bolsillos de la cuenta padre");
  checks += 4;

  // 3. Mover dinero reusa el mismo path que el detalle de cuenta, con la cuenta
  // y el bolsillo preseleccionados.
  assert.match(
    dialog,
    /openCreate\("transfer",\s*account\.id,\s*pocket\.id\)/,
    "Mover dinero debe abrir una transferencia con cuenta y bolsillo preseleccionados"
  );
  checks++;

  // 4. Fail-closed: mover y eliminar comparten el gate de disponibilidad ya
  // auditado, derivado de un snapshot de propiedad de ESTA cuenta.
  assert.match(dialog, /resolveAccountActionAvailability/, "Debe derivar disponibilidad con el helper compartido");
  assert.match(dialog, /readThirdPartyLocationSnapshot/, "Debe leer el snapshot de propiedad antes de habilitar acciones");
  assert.match(
    dialog,
    /runIfAllowed\(actions\.moveThirdParty/,
    "Mover dinero debe pasar por runIfAllowed con el gate de dinero"
  );
  assert.match(
    dialog,
    /runIfAllowed\(actions\.deletePocket/,
    "Eliminar bolsillo debe pasar por runIfAllowed con el gate de dinero"
  );
  assert.match(dialog, /submitDeletePocket\(ownerId, pocket\.id, account\.id\)/, "Eliminar debe reusar el servicio existente");
  checks += 5;

  // 5. Cuenta cerrada: sin acciones mutadoras.
  assert.match(
    dialog,
    /isArchived \? \([\s\S]{0,400}Reábrela/,
    "Una cuenta cerrada debe mostrar el detalle en solo lectura, sin acciones mutadoras"
  );
  checks++;

  // 6. Cableado: el tile de bolsillo expone onPocketClick y la vista de Cuentas
  // lo conecta al modal; la edición se delega al EditPocketDialog ya existente.
  assert.match(card, /onPocketClick\?:\s*\(pocket: Pocket\) => void/, "AccountPocketCard debe exponer onPocketClick");
  assert.match(
    card,
    /const TileTag = isInteractive \? "button" : "div"/,
    "El tile debe ser un <button> real cuando es clickeable (teclado + foco)"
  );
  assert.match(card, /event\.stopPropagation\(\)/, "El click del tile no debe propagar a la card");
  assert.match(view, /<PocketDetailDialog/, "AccountsView debe montar el detalle de bolsillo");
  assert.match(
    view,
    /onPocketClick=\{\(pocket\) => setSelectedPocket\(/,
    "AccountsView debe conectar el click del tile al estado del modal"
  );
  assert.match(
    view,
    /onEdit=\{\(pocket\) => setPocketPendingEdit\(pocket\)\}/,
    "La edición debe delegarse al EditPocketDialog ya existente"
  );
  checks += 6;

  console.log(`  ✓ Detalle de bolsillo (Cuentas) verificado estructuralmente (${checks} aserciones pasadas).`);
}

runPocketDetailDialogTests();
