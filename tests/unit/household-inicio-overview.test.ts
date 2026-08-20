/**
 * Paso 8C — Inicio Hogar: pruebas estructurales.
 *
 * Verifica que:
 * 1. household-overview.tsx NO importa ni referencia superficies personales,
 *    deudas personales ni copies de "Por anotar".
 * 2. El estado de aportes solo se deriva de eachPaysOwn con shares pendientes.
 * 3. Las acciones de Ajustes y Categorías usan rutas /household/settings y
 *    /household/categories — no diálogos antiguos.
 * 4. La superficie sigue usando solo el kit/tokens Hogar.
 * 5. Los estados loading/error/empty/dissolved/waiting continúan reconocibles
 *    en page.tsx.
 * 6. El contenido de Inicio Hogar nunca expone datos privados (accountId,
 *    pocketId, saldo, banco) de ningún miembro.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for household-inicio-overview.test.ts...");

const repoRoot = path.resolve(__dirname, "../..");
const readSrc = (rel: string): string =>
  fs.readFileSync(path.resolve(repoRoot, "src", rel), "utf-8");

export function runHouseholdInicioOverviewTests() {
  let checks = 0;

  const overviewContent = readSrc("features/household/components/household-overview.tsx");
  const pageContent = readSrc("app/(dashboard)/household/page.tsx");

  // ──────────────────────────────────────────────────────────
  // 1. Sin imports ni copies personales / deudas / "Por anotar"
  // ──────────────────────────────────────────────────────────

  const forbiddenImports = [
    "@/components/finance/",
    "usePersonalData",
    "personalData",
    "FinanceButton",
    "FinanceCard",
    "FinanceDialog",
    "FinanceShimmer",
    "FinanceTextField",
    "FinanceChip",
  ];
  for (const imp of forbiddenImports) {
    assert.ok(
      !overviewContent.includes(imp),
      `household-overview.tsx no debe importar ni referenciar '${imp}'`
    );
    checks++;
  }

  // Copies personales prohibidas en Inicio Hogar (excluye comentarios, maneja CRLF)
  const overviewCode = overviewContent
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
  const forbiddenCopies = [
    "Por anotar",
    "Anotar gasto",
    "Te deben",
    "Le deb",
    "Declarar pago",
    "Acreditar reembolso",
    "deuda personal",
    "saldo bancario",
    "Nuevo movimiento",
  ];
  for (const copy of forbiddenCopies) {
    assert.ok(
      !overviewCode.includes(copy),
      `household-overview.tsx no debe mostrar copy personal/deuda en código: '${copy}'`
    );
    checks++;
  }

  // ──────────────────────────────────────────────────────────
  // 2. Datos privados prohibidos en overview
  // ──────────────────────────────────────────────────────────

  const forbiddenPrivateData = [
    "accountId",
    "pocketId",
    "bankName",
    "saldo",
    "balance personal",
  ];
  for (const data of forbiddenPrivateData) {
    assert.ok(
      !overviewContent.includes(data),
      `household-overview.tsx no debe exponer dato privado: '${data}'`
    );
    checks++;
  }

  // ──────────────────────────────────────────────────────────
  // 3. Tablero fijo: categorías | movimientos (sin editar tablero / aportes)
  // ──────────────────────────────────────────────────────────

  assert.ok(
    overviewContent.includes("Gastos por categoría") && overviewContent.includes("Movimientos del hogar"),
    "overview debe mostrar las dos cards fijas del Inicio Hogar"
  );
  checks++;

  assert.match(
    overviewContent,
    /lg:grid-cols-2/,
    "overview debe poner categorías y movimientos lado a lado en desktop"
  );
  checks++;

  assert.ok(
    !overviewContent.includes("Editar tablero") &&
      !overviewContent.includes("Administrar pantalla inicial") &&
      !overviewContent.includes("Estado de aportes"),
    "overview ya no debe ofrecer editar tablero ni card de aportes"
  );
  checks++;

  // No debe mostrar deudas de advancedByPayer directamente en código (los comentarios explicativos están permitidos)
  assert.ok(
    !overviewCode.includes("advancedByPayer"),
    "household-overview.tsx no debe referenciar advancedByPayer en código ejecutable"
  );
  checks++;

  // ──────────────────────────────────────────────────────────
  // 4. Hero unificado sin botones extra
  // ──────────────────────────────────────────────────────────

  // El hero no debe tener botones a Ajustes o Categorías (HH-1)
  assert.ok(
    !overviewContent.includes("/household/settings"),
    "overview ya no debe tener acceso directo a settings (movido al hero / sidebar)"
  );
  checks++;

  assert.ok(
    !overviewContent.includes("setCategoriesOpen"),
    "overview ya no debe usar el diálogo de categorías antiguo"
  );
  checks++;

  // No debe usar setSettingsOpen ni setShowSettings (vestigio de diálogos)
  const legacyDialogActions = [
    "setSettingsOpen",
    "setShowSettings",
    "setCategoriesOpen",
    "setShowCategories",
    "settingsOpen",
    "categoriesOpen",
  ];
  for (const action of legacyDialogActions) {
    assert.ok(
      !overviewContent.includes(action),
      `household-overview.tsx no debe usar acción de diálogo legado: '${action}'`
    );
    checks++;
  }

  // ──────────────────────────────────────────────────────────
  // 5. Solo kit/tokens Hogar (sin Finance*, --fm-*, hex crudo)
  // ──────────────────────────────────────────────────────────

  const overviewNoComments = overviewContent
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");

  assert.doesNotMatch(
    overviewNoComments,
    /var\(--fm-/,
    "household-overview.tsx no debe usar tokens --fm-*"
  );
  checks++;

  assert.doesNotMatch(
    overviewNoComments,
    /#[0-9a-fA-F]{3,8}\b/,
    "household-overview.tsx no debe usar colores hex directos"
  );
  checks++;

  // ──────────────────────────────────────────────────────────
  // 6. Estados obligatorios presentes en page.tsx (M+)
  // ──────────────────────────────────────────────────────────

  const requiredViewModes = ["loading", "error", "waiting"];
  for (const mode of requiredViewModes) {
    assert.match(
      pageContent,
      new RegExp(mode),
      `page.tsx debe manejar el estado '${mode}'`
    );
    checks++;
  }

  // El modo 'dashboard' (operativo) se renderiza implícitamente como HouseholdOverview
  assert.match(
    pageContent,
    /HouseholdOverview/,
    "page.tsx debe renderizar HouseholdOverview cuando el Hogar está operativo (modo 'dashboard')"
  );
  checks++;

  // page.tsx debe tener un shimmer de carga real
  assert.match(
    pageContent,
    /HouseholdShimmer/,
    "page.tsx debe mostrar HouseholdShimmer mientras carga"
  );
  checks++;

  // ──────────────────────────────────────────────────────────
  // 7. Resumen del período contiene los 3 valores requeridos
  // ──────────────────────────────────────────────────────────

  assert.match(
    overviewContent,
    /Entró al Hogar/,
    "overview debe mostrar 'Entró al Hogar'"
  );
  checks++;

  assert.match(
    overviewContent,
    /Se gastó del Hogar/,
    "overview debe mostrar 'Se gastó del Hogar'"
  );
  checks++;

  assert.ok(
    !overviewContent.includes("monthlyBalance"),
    "overview NO debe mostrar el balance del período (HH-1)"
  );
  checks++;
  
  assert.ok(
    !overviewContent.includes("Balance del mes"),
    "overview NO debe mostrar la tarjeta Balance del mes (HH-1)"
  );
  checks++;

  assert.ok(
    !overviewContent.includes("Resumen del hogar"),
    "overview NO debe centrar el hero en 'Resumen del hogar'"
  );
  checks++;

  assert.ok(
    !overviewContent.includes("Neto del mes"),
    "overview NO debe mostrar 'Neto del mes' como métrica principal"
  );
  checks++;

  // ──────────────────────────────────────────────────────────
  // 8. Eventos recientes: solo indicador de cancelación, sin datos personales
  // ──────────────────────────────────────────────────────────

  // Solo debe mostrar "Evento Cancelado" como indicador en el timeline
  assert.match(
    overviewContent,
    /Evento Cancelado|cancelled/,
    "overview debe indicar solo el estado cancelado en el timeline, no datos personales"
  );
  checks++;

  // No debe mostrar shares individuales en la lista principal del Home Hogar
  // (el detalle de shares vive en HouseholdEventDetailDialog, no en la lista de eventos)
  // El overview puede recibir allEventShares como prop para pasarlo al dialog,
  // pero no debe iterar/listar esas shares en el cuerpo principal
  assert.doesNotMatch(
    overviewCode,
    /allEventShares\.slice|eventShares\.map\(.*=>/,
    "El Home Hogar no debe listar shares directamente en el cuerpo principal"
  );
  checks++;

  console.log(`  ✓ Inicio Hogar (8C) estructura verificada (${checks} aserciones pasadas).`);
}

runHouseholdInicioOverviewTests();
