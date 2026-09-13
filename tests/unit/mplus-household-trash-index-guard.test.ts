import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for mplus-household-trash-index-guard.test.ts (ORQ-053)...");

const repoRoot = path.resolve(__dirname, "../..");
const candidates = [
  path.resolve(repoRoot, "../../android/firestore.indexes.json"),
  path.resolve(repoRoot, "../android/firestore.indexes.json"),
  path.resolve(process.cwd(), "../../android/firestore.indexes.json"),
];
const androidIndexesPath = candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
const readHouseholdExpensesPath = path.resolve(
  repoRoot,
  "src/features/household/services/read-household-expenses.ts",
);

export function runHouseholdTrashIndexGuardTests() {
  let passed = 0;

  // 1. android/firestore.indexes.json existe y es JSON válido
  assert.ok(
    fs.existsSync(androidIndexesPath),
    `No se encontró el archivo canónico de índices en: ${androidIndexesPath}`,
  );
  const rawIndexes = fs.readFileSync(androidIndexesPath, "utf8");
  let indexesData: { indexes: Array<{ collectionGroup: string; queryScope: string; fields: Array<{ fieldPath: string; order: string }> }> };
  try {
    indexesData = JSON.parse(rawIndexes);
  } catch (err) {
    assert.fail(`android/firestore.indexes.json no es un JSON válido: ${err}`);
  }
  assert.ok(Array.isArray(indexesData.indexes), "Debe contener una propiedad 'indexes' tipo array");
  passed++;
  console.log("  ✓ [ORQ-053-01] android/firestore.indexes.json existe y es JSON válido");

  // 2. Índice compuesto canónico para la papelera de expenses
  // collectionGroup: expenses, queryScope: COLLECTION, fields: [lifecycleState ASCENDING, purgeAfter ASCENDING]
  const trashIndex = indexesData.indexes.find((idx) => {
    if (idx.collectionGroup !== "expenses") return false;
    if (idx.queryScope !== "COLLECTION") return false;
    if (!Array.isArray(idx.fields) || idx.fields.length !== 2) return false;
    return (
      idx.fields[0].fieldPath === "lifecycleState" &&
      idx.fields[0].order === "ASCENDING" &&
      idx.fields[1].fieldPath === "purgeAfter" &&
      idx.fields[1].order === "ASCENDING"
    );
  });

  assert.ok(
    trashIndex,
    "GUARDRAIL: firestore.indexes.json DEBE contener el índice compuesto para 'expenses' con [lifecycleState ASCENDING, purgeAfter ASCENDING]",
  );
  passed++;
  console.log("  ✓ [ORQ-053-02] Índice compuesto de papelera (expenses: lifecycleState ASC + purgeAfter ASC) presente en firestore.indexes.json");

  // 3. Índice compuesto canónico para la consulta mensual de expenses activa
  // collectionGroup: expenses, queryScope: COLLECTION, fields: [lifecycleState ASCENDING, occurredAt DESCENDING]
  const monthlyIndex = indexesData.indexes.find((idx) => {
    if (idx.collectionGroup !== "expenses") return false;
    if (idx.queryScope !== "COLLECTION") return false;
    if (!Array.isArray(idx.fields) || idx.fields.length !== 2) return false;
    return (
      idx.fields[0].fieldPath === "lifecycleState" &&
      idx.fields[0].order === "ASCENDING" &&
      idx.fields[1].fieldPath === "occurredAt" &&
      idx.fields[1].order === "DESCENDING"
    );
  });

  assert.ok(
    monthlyIndex,
    "GUARDRAIL: firestore.indexes.json DEBE conservar el índice compuesto para 'expenses' con [lifecycleState ASCENDING, occurredAt DESCENDING]",
  );
  passed++;
  console.log("  ✓ [ORQ-053-03] Índice compuesto mensual activo (expenses: lifecycleState ASC + occurredAt DESC) conservado");

  // 4. Código de consulta Web en read-household-expenses.ts coincide exactamente con el índice
  const serviceSource = fs.readFileSync(readHouseholdExpensesPath, "utf8");

  // readHouseholdTrashedExpenses
  assert.ok(
    serviceSource.includes('where("lifecycleState", "==", "trashed")'),
    "La consulta de papelera de Hogar debe filtrar por lifecycleState == 'trashed'",
  );
  assert.ok(
    serviceSource.includes('orderBy("purgeAfter", "asc")'),
    "La consulta de papelera de Hogar debe ordenar por purgeAfter asc",
  );
  assert.ok(
    serviceSource.includes("readHouseholdTrashedExpenses"),
    "Debe exportar readHouseholdTrashedExpenses",
  );
  assert.ok(
    serviceSource.includes("subscribeHouseholdTrashedExpenses"),
    "Debe exportar subscribeHouseholdTrashedExpenses",
  );
  passed++;
  console.log("  ✓ [ORQ-053-04] Consultas readHouseholdTrashedExpenses y subscribeHouseholdTrashedExpenses alineadas con el índice compuesto");

  console.log(`\nTests for mplus-household-trash-index-guard: ${passed} passed, 0 failed\n`);
}

runHouseholdTrashIndexGuardTests();
