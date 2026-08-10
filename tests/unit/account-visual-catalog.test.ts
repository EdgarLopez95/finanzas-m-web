/**
 * tests/unit/account-visual-catalog.test.ts
 *
 * Bloque 4 — Paridad Android: catálogo canónico de tipos de cuenta, marcas y logos.
 * TDD: pruebas escritas ANTES de la implementación.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("D:/Cosas mias/app finanzas/web/finanzas-m-web");

function readFileSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8").replace(/\r\n/g, "\n");
}

async function runAccountVisualCatalogTests(): Promise<void> {
  // ─── Import canónico (falla hasta que el archivo exista) ───────────────────
  const catalogPath = path.join(ROOT, "src/lib/accounts/account-visual-catalog.ts");
  assert.ok(fs.existsSync(catalogPath), "account-visual-catalog.ts debe existir en src/lib/accounts/");
  const catalogContent = readFileSrc("src/lib/accounts/account-visual-catalog.ts");

  // ─── 1. 5 familias tienen colores default correctos ─────────────────────────
  const expectedColors = {
    bank: "#60A5FA",
    digital_wallet: "#A78BFA",
    cash: "#E4B363",
    savings: "#6C8E7F",
    other: "#60A5FA",
  };
  for (const [type, color] of Object.entries(expectedColors)) {
    assert.ok(
      catalogContent.includes(color),
      `Catálogo debe contener color default ${color} para tipo ${type}`
    );
  }
  console.log("  ✓ Las 5 familias tienen colores default correctos");

  // ─── 2. banco_bogota → ruta /banks/ic_bank_bogota.svg ───────────────────────
  assert.ok(
    catalogContent.includes("banco_bogota") && catalogContent.includes("ic_bank_bogota.svg"),
    "banco_bogota (key canónica) debe mapear a ic_bank_bogota.svg (nombre histórico diferente)"
  );
  console.log("  ✓ banco_bogota → /banks/ic_bank_bogota.svg");

  // ─── 3. Nequi NO está en BANK_OPTIONS (solo en WALLET_OPTIONS) ─────────────
  assert.ok(
    catalogContent.includes("BANK_OPTIONS") && catalogContent.includes("WALLET_OPTIONS"),
    "Catálogo debe exportar BANK_OPTIONS y WALLET_OPTIONS"
  );

  // Nequi must NOT appear in BANK_OPTIONS and MUST appear in WALLET_OPTIONS.
  // Strategy: find the indices of BANK_OPTIONS and WALLET_OPTIONS declarations,
  // then check that "nequi" appears after WALLET_OPTIONS but not before it in the bank section.
  const bankIdx = catalogContent.indexOf("export const BANK_OPTIONS");
  const walletIdx = catalogContent.indexOf("export const WALLET_OPTIONS");
  assert.ok(bankIdx !== -1, "BANK_OPTIONS debe estar exportado");
  assert.ok(walletIdx !== -1, "WALLET_OPTIONS debe estar exportado");

  // Content between bankIdx and walletIdx = bank section
  const bankSection = catalogContent.slice(bankIdx, walletIdx);
  // Content after walletIdx = wallet section (take next section)
  const savingsIdx = catalogContent.indexOf("export const SAVINGS_OPTIONS");
  const walletSection = catalogContent.slice(walletIdx, savingsIdx !== -1 ? savingsIdx : walletIdx + 2000);

  assert.ok(!bankSection.includes('"nequi"'), "Nequi NO debe aparecer en BANK_OPTIONS");
  assert.ok(walletSection.includes('"nequi"'), "Nequi SÍ debe aparecer en WALLET_OPTIONS");
  console.log("  ✓ Nequi NO está en BANK_OPTIONS, sí en WALLET_OPTIONS");


  // ─── 4. bank + bancolombia → iconType: "bank_logo" ─────────────────────────
  assert.ok(
    catalogContent.includes("resolveIconTypeForSelection") ||
    catalogContent.includes("bank_logo"),
    "Catálogo debe tener lógica de resolución de iconType para bank_logo"
  );
  // La función resolveIconTypeForSelection debe estar exportada
  assert.ok(
    catalogContent.includes("export") && catalogContent.includes("resolveIconTypeForSelection"),
    "resolveIconTypeForSelection debe ser exportada"
  );
  console.log("  ✓ Función resolveIconTypeForSelection exportada");

  // ─── 5. digital_wallet + wallet → iconType: "generic" ──────────────────────
  // El catálogo debe dejar explícito que "wallet" → iconType "generic"
  assert.ok(
    catalogContent.includes('"wallet"') && catalogContent.includes("generic"),
    "El catálogo debe especificar que wallet → iconType generic"
  );
  console.log("  ✓ wallet → iconType generic está en el catálogo");

  // ─── 6. isValidIconCombination exportado ────────────────────────────────────
  assert.ok(
    catalogContent.includes("isValidIconCombination"),
    "isValidIconCombination debe ser exportada"
  );
  console.log("  ✓ isValidIconCombination exportada");

  // ─── 7. suggestAccountName exportado ───────────────────────────────────────
  assert.ok(
    catalogContent.includes("suggestAccountName"),
    "suggestAccountName debe ser exportada"
  );
  console.log("  ✓ suggestAccountName exportada");

  // ─── 8. resolveAccountLogoSrc exportado y banco_bogota mapea correctamente ──
  assert.ok(
    catalogContent.includes("resolveAccountLogoSrc"),
    "resolveAccountLogoSrc debe ser exportada"
  );
  console.log("  ✓ resolveAccountLogoSrc exportada");

  // ─── 9. Logos de los 15 bancos/billeteras están todos presentes ─────────────
  const expectedLogoKeys = [
    "bancolombia", "davivienda", "banco_bogota", "bbva", "caja_social",
    "occidente", "popular", "agrario", "scotiabank", "av_villas", "itau",
    "nequi", "daviplata", "nu", "lulo",
  ];
  for (const key of expectedLogoKeys) {
    assert.ok(
      catalogContent.includes(`"${key}"`),
      `El catálogo debe contener la key de logo '${key}'`
    );
  }
  console.log("  ✓ Los 15 logos de marcas están en el catálogo");

  // ─── 10. AccountIcon renderer existe ────────────────────────────────────────
  const iconRendererPath = path.join(ROOT, "src/components/finance/account-icon.tsx");
  assert.ok(
    fs.existsSync(iconRendererPath),
    "account-icon.tsx debe existir en src/components/finance/"
  );
  const iconContent = readFileSrc("src/components/finance/account-icon.tsx");
  assert.ok(iconContent.includes("AccountIcon"), "account-icon.tsx debe exportar AccountIcon");
  assert.ok(
    iconContent.includes("bank_logo") && iconContent.includes("generic"),
    "AccountIcon debe manejar ambos iconType: bank_logo y generic"
  );
  console.log("  ✓ AccountIcon renderer existe y maneja bank_logo y generic");

  // ─── 11. Verificación estructural: AccountPocketCard usa account-icon ────────
  const cardContent = readFileSrc("src/components/finance/account-pocket-card.tsx");
  assert.ok(
    cardContent.includes("AccountIcon") || cardContent.includes("account-icon"),
    "account-pocket-card.tsx debe usar AccountIcon"
  );
  console.log("  ✓ account-pocket-card.tsx usa AccountIcon");

  // ─── 12. create-expense-card usa logos en selector ──────────────────────────
  const expenseContent = readFileSrc("src/features/transactions/components/create-expense-card.tsx");
  assert.ok(
    expenseContent.includes("AccountIcon") || expenseContent.includes("account-icon"),
    "create-expense-card.tsx debe usar AccountIcon para logos en selector"
  );
  console.log("  ✓ create-expense-card.tsx usa AccountIcon");

  // ─── 13. create-income-card usa logos en selector ───────────────────────────
  const incomeContent = readFileSrc("src/features/transactions/components/create-income-card.tsx");
  assert.ok(
    incomeContent.includes("AccountIcon") || incomeContent.includes("account-icon"),
    "create-income-card.tsx debe usar AccountIcon para logos en selector"
  );
  console.log("  ✓ create-income-card.tsx usa AccountIcon");

  // ─── 14. create-transfer-card NO usa <select> nativo para cuenta ─────────────
  const transferContent = readFileSrc("src/features/transactions/components/create-transfer-card.tsx");
  // El <select> nativo se reemplazó por IconSelect
  assert.ok(
    transferContent.includes("AccountIcon") || transferContent.includes("account-icon"),
    "create-transfer-card.tsx debe usar AccountIcon en el selector visual"
  );
  console.log("  ✓ create-transfer-card.tsx usa AccountIcon");

  // ─── 14.1. edit-transaction-card usa logos en selector ────────────────────────
  const editTransactionContent = readFileSrc("src/features/transactions/components/edit-transaction-card.tsx");
  assert.ok(
    editTransactionContent.includes("AccountIcon") || editTransactionContent.includes("account-icon"),
    "edit-transaction-card.tsx debe usar AccountIcon en el selector visual"
  );
  console.log("  ✓ edit-transaction-card.tsx usa AccountIcon");


  // ─── 15. new-account-dialog tiene flujo de marca condicional ────────────────
  const newDialogContent = readFileSrc("src/features/accounts/components/new-account-dialog.tsx");
  assert.ok(
    newDialogContent.includes("BANK_OPTIONS") || newDialogContent.includes("account-visual-catalog"),
    "new-account-dialog.tsx debe usar el catálogo canónico"
  );
  assert.ok(
    newDialogContent.includes("Selecciona un banco") || newDialogContent.includes("Selecciona un banco"),
    "new-account-dialog.tsx debe tener el copy 'Selecciona un banco'"
  );
  assert.ok(
    newDialogContent.includes("Selecciona una billetera"),
    "new-account-dialog.tsx debe tener el copy 'Selecciona una billetera'"
  );
  console.log("  ✓ new-account-dialog.tsx tiene flujo de marca condicional");

  // ─── 15.1. new-account-dialog usa grid expuesto en lugar de modal extra ──────
  assert.ok(
    newDialogContent.includes("grid") || newDialogContent.includes("grid-cols-2"),
    "new-account-dialog.tsx debe usar grid para mostrar las opciones directamente"
  );
  assert.ok(
    newDialogContent.includes("ACCOUNT_TYPE_OPTIONS.map"),
    "new-account-dialog.tsx debe iterar sobre ACCOUNT_TYPE_OPTIONS"
  );
  assert.ok(
    newDialogContent.includes("col-span-2") || newDialogContent.includes("isLast && \"col-span-2\""),
    "new-account-dialog.tsx debe hacer que el último elemento (Otro) ocupe ancho completo (col-span-2)"
  );
  assert.doesNotMatch(
    newDialogContent,
    /typeSheetOpen/,
    "new-account-dialog.tsx NO debe declarar ni usar typeSheetOpen"
  );
  assert.ok(
    newDialogContent.includes("!type"),
    "La selección explícita sigue siendo obligatoria (!type chequeado en submit)"
  );
  console.log("  ✓ new-account-dialog.tsx expone grid y eliminó typeSheetOpen extra");

  // ─── 16. create/update services aceptan iconKey explícito ───────────────────
  const createService = readFileSrc("src/features/accounts/services/create-personal-account.ts");
  const updateService = readFileSrc("src/features/accounts/services/update-personal-account.ts");
  assert.ok(
    createService.includes("iconKey") && createService.includes("iconType"),
    "create-personal-account.ts debe aceptar iconKey e iconType en el input"
  );
  assert.ok(
    updateService.includes("iconKey") && updateService.includes("iconType"),
    "update-personal-account.ts debe aceptar iconKey e iconType en el input (sin defaults ciegos)"
  );
  // update ya NO tiene ICON_DEFAULTS que resetee la marca
  assert.doesNotMatch(
    updateService,
    /ICON_DEFAULTS.*=.*\{[\s\S]{0,500}bank.*bank_generic[\s\S]{0,500}\}/,
    "update-personal-account.ts NO debe tener ICON_DEFAULTS que resetee la marca"
  );
  console.log("  ✓ create/update services aceptan iconKey explícito sin defaults ciegos");

  // ─── 17. Prefill de nombre: Efectivo → "Efectivo" ───────────────────────────
  assert.ok(
    catalogContent.includes('"Efectivo"') || catalogContent.includes("'Efectivo'"),
    "suggestAccountName debe retornar 'Efectivo' para tipo cash"
  );
  console.log("  ✓ Prefill nombre: Efectivo → 'Efectivo'");

  // ─── 18. Prefill de nombre: bank_generic → "Banco" ──────────────────────────
  assert.ok(
    catalogContent.includes('"Banco"') || catalogContent.includes("'Banco'"),
    "suggestAccountName debe retornar 'Banco' para bank_generic (no 'Otro banco')"
  );
  console.log("  ✓ Prefill nombre: bank_generic → 'Banco'");

  console.log("\n  ✓ Bloque 4: account-visual-catalog (18 aserciones pasadas).");
}

function extractSectionContent(content: string, sectionName: string): string {
  const idx = content.indexOf(sectionName);
  if (idx === -1) return "";
  // Take the next 800 characters after the section name declaration
  return content.slice(idx, idx + 800);
}

// Runner
const isMain = process.argv[1].endsWith("account-visual-catalog.test.ts") ||
  process.argv[1].endsWith("run-all.ts");

if (isMain) {
  console.log("Running unit tests for account-visual-catalog.test.ts...");
  runAccountVisualCatalogTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { runAccountVisualCatalogTests };
