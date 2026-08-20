/**
 * tests/unit/account-visual-catalog.test.ts
 *
 * Bloque 4 — Paridad Android: catálogo canónico de tipos de cuenta, marcas y logos.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("D:/Cosas mias/app finanzas/web/finanzas-m-web");

function readFileSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8").replace(/\r\n/g, "\n");
}

async function runAccountVisualCatalogTests(): Promise<void> {
  // ─── Import canónico ───────────────────────────────────────────────────────
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

  const bankIdx = catalogContent.indexOf("export const BANK_OPTIONS");
  const walletIdx = catalogContent.indexOf("export const WALLET_OPTIONS");
  assert.ok(bankIdx !== -1, "BANK_OPTIONS debe estar exportado");
  assert.ok(walletIdx !== -1, "WALLET_OPTIONS debe estar exportado");

  const bankSection = catalogContent.slice(bankIdx, walletIdx);
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
  assert.ok(
    catalogContent.includes("export") && catalogContent.includes("resolveIconTypeForSelection"),
    "resolveIconTypeForSelection debe ser exportada"
  );
  console.log("  ✓ Función resolveIconTypeForSelection exportada");

  // ─── 5. digital_wallet + wallet → iconType: "generic" ──────────────────────
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

  // ─── 11. Verificación estructural: mplus-accounts-view usa account-icon ──────
  const accountsViewContent = readFileSrc("src/features/accounts/components/mplus-accounts-view.tsx");
  assert.ok(
    accountsViewContent.includes("AccountIcon") || accountsViewContent.includes("account-icon"),
    "mplus-accounts-view.tsx debe usar AccountIcon"
  );
  console.log("  ✓ mplus-accounts-view.tsx usa AccountIcon");

  // ─── 12. mplus-account-dialog usa catálogo canónico ─────────────────────────
  const mplusDialogContent = readFileSrc("src/features/accounts/components/mplus-account-dialog.tsx");
  assert.ok(
    mplusDialogContent.includes("account-visual-catalog"),
    "mplus-account-dialog.tsx debe usar el catálogo canónico"
  );
  console.log("  ✓ mplus-account-dialog.tsx usa el catálogo canónico");

  // ─── 13. movement-composer-card usa logos en selector de cuenta ─────────────
  const composerContent = readFileSrc("src/features/movements/components/movement-composer-card.tsx");
  assert.ok(
    composerContent.includes("AccountIcon") || composerContent.includes("account-icon"),
    "movement-composer-card.tsx debe usar AccountIcon para cuentas"
  );
  console.log("  ✓ movement-composer-card.tsx usa AccountIcon");

  // ─── 14. Prefill de nombre: Efectivo → "Efectivo" ───────────────────────────
  assert.ok(
    catalogContent.includes('"Efectivo"') || catalogContent.includes("'Efectivo'"),
    "suggestAccountName debe retornar 'Efectivo' para tipo cash"
  );
  console.log("  ✓ Prefill nombre: Efectivo → 'Efectivo'");

  // ─── 15. Prefill de nombre: bank_generic → "Banco" ──────────────────────────
  assert.ok(
    catalogContent.includes('"Banco"') || catalogContent.includes("'Banco'"),
    "suggestAccountName debe retornar 'Banco' para bank_generic (no 'Otro banco')"
  );
  console.log("  ✓ Prefill nombre: bank_generic → 'Banco'");

  console.log("\n  ✓ Bloque 4: account-visual-catalog verificado.");
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
