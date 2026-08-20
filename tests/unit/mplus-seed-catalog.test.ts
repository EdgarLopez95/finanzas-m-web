import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { isValidCategoryIcon } from "../../src/lib/mplus/catalogs";
import {
  categoryMappingId,
  closureApprovalId,
  expenseSeedCategoryId,
  householdMemberId,
  incomeSeedCategoryId,
  memberAccountLabelId,
  memberCategoryLabelId,
} from "../../src/lib/mplus/ids";
import {
  HOUSEHOLD_EXPENSE_SEED,
  PERSONAL_EXPENSE_SEED,
  PERSONAL_INCOME_SEED,
  PERSONAL_SEED,
  householdSeedCategoryId,
  personalSeedCategoryId,
} from "../../src/lib/mplus/seeds";

/**
 * Seed Personal v1 (contrato §8.3) y seed de Hogar v1 (§13.1) + IDs
 * deterministas (§4.2). El catalogo Web se contrasta contra el archivo
 * canonico de Android para que una divergencia de nombre, icono, color u
 * orden se detecte aqui y no en QA cruzado.
 */

// --- forma del catalogo ---
assert.equal(PERSONAL_EXPENSE_SEED.length, 16);
assert.equal(PERSONAL_INCOME_SEED.length, 6);
assert.equal(PERSONAL_SEED.length, 22);
assert.equal(HOUSEHOLD_EXPENSE_SEED.length, 16);

// --- IDs deterministas ---
assert.equal(expenseSeedCategoryId("groceries"), "seed_expense_groceries");
assert.equal(incomeSeedCategoryId("salary"), "seed_income_salary");
assert.equal(categoryMappingId("uid-1", "seed_expense_groceries"), "uid-1__seed_expense_groceries");
assert.equal(memberCategoryLabelId("uid-1", "cat-1"), "uid-1__cat-1");
assert.equal(memberAccountLabelId("uid-1", "acc-1"), "uid-1__acc-1");
assert.equal(householdMemberId("h-1", "uid-1"), "h-1__uid-1");
assert.equal(closureApprovalId("h-1", "uid-1"), "h-1__uid-1");

// --- invariantes del seed ---
{
  const ids = new Set<string>();
  for (const seed of PERSONAL_SEED) {
    const id = personalSeedCategoryId(seed);
    assert.equal(ids.has(id), false, `ID de seed duplicado: ${id}`);
    ids.add(id);
    assert.equal(
      isValidCategoryIcon(seed.type, seed.iconKey),
      true,
      `icono fuera del catalogo §24: ${seed.iconKey}`,
    );
    assert.match(seed.color, /^#[0-9A-F]{6}$/i, `color invalido en ${seed.seedKey}`);
    assert.equal(seed.sortOrder >= 0, true);
  }
  assert.equal(ids.size, 22);
}

// El seed de Hogar reutiliza los MISMOS IDs de gasto (contrato §13.1).
HOUSEHOLD_EXPENSE_SEED.forEach((seed, index) => {
  const personal = PERSONAL_EXPENSE_SEED[index];
  assert.equal(householdSeedCategoryId(seed), personalSeedCategoryId(personal));
  assert.equal(seed.seedKey, personal.seedKey);
  assert.equal(seed.iconKey, personal.iconKey);
  assert.equal(seed.color, personal.color);
  assert.equal(seed.sortOrder, personal.sortOrder);
});

// --- paridad contra el catalogo canonico de Android ---
type AndroidSeed = { seedKey: string; name: string; iconKey: string; color: string; sortOrder: number };

const parseAndroidSeed = (source: string, blockName: string): AndroidSeed[] => {
  const start = source.indexOf(blockName);
  assert.notEqual(start, -1, `no se encontro el bloque '${blockName}' en el seed canonico`);
  const slice = source.slice(start);
  const end = slice.indexOf("\n    )");
  const body = slice.slice(0, end === -1 ? undefined : end);

  const entries: AndroidSeed[] = [];
  const pattern =
    /SeedCategory\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*(?:MovementType\.[A-Z]+\s*,\s*)?(\d+)\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    entries.push({
      seedKey: match[1],
      name: match[2],
      iconKey: match[3],
      color: match[4],
      sortOrder: Number(match[5]),
    });
  }
  return entries;
};

const compareSeed = (
  label: string,
  web: readonly { seedKey: string; name: string; iconKey: string; color: string; sortOrder: number }[],
  android: readonly AndroidSeed[],
) => {
  assert.equal(android.length, web.length, `${label}: cantidad distinta de categorias seed`);
  android.forEach((entry, index) => {
    assert.deepEqual(
      {
        seedKey: web[index].seedKey,
        name: web[index].name,
        iconKey: web[index].iconKey,
        color: web[index].color,
        sortOrder: web[index].sortOrder,
      },
      entry,
      `${label}: la categoria #${index} difiere del catalogo canonico de Android`,
    );
  });
};

const ANDROID_MPLUS_DOMAIN = resolve(
  process.cwd(),
  "../../android/app/src/main/java/com/finanzasm/app/domain/mplus",
);

let personalSource: string | null = null;
let householdSource: string | null = null;
try {
  personalSource = readFileSync(resolve(ANDROID_MPLUS_DOMAIN, "MplusPersonalSeed.kt"), "utf8");
  householdSource = readFileSync(resolve(ANDROID_MPLUS_DOMAIN, "MplusHouseholdSeed.kt"), "utf8");
} catch {
  personalSource = null;
  householdSource = null;
}

if (personalSource && householdSource) {
  compareSeed(
    "seed Personal de gasto",
    PERSONAL_EXPENSE_SEED,
    parseAndroidSeed(personalSource, "val expenseCategories"),
  );
  compareSeed(
    "seed Personal de ingreso",
    PERSONAL_INCOME_SEED,
    parseAndroidSeed(personalSource, "val incomeCategories"),
  );
  compareSeed(
    "seed de Hogar",
    HOUSEHOLD_EXPENSE_SEED,
    parseAndroidSeed(householdSource, "val categories"),
  );
  console.log("OK mplus-seed-catalog (contrastado con el catalogo canonico de Android)");
} else {
  console.warn(
    "AVISO mplus-seed-catalog: repo Android no disponible; la paridad de catalogos NO se verifico.",
  );
  console.log("OK mplus-seed-catalog (solo invariantes locales)");
}
