import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { CANONICAL_ARTIFACTS, inspectCanonicalArtifacts } from "../../scripts/canonical-backend.mjs";

/**
 * Backend compartido (contrato §27.1): `android/firestore.rules` y
 * `android/firestore.indexes.json` son la fuente canonica. La Web no mantiene
 * una variante funcional independiente; solo copias verificables.
 *
 * Esta prueba es la deteccion temprana de "copia desactualizada": falla en
 * `npm test`, antes de levantar el emulador, si las copias locales derivaron.
 */

const missingSource = inspectCanonicalArtifacts().filter((a) => a.status === "missing-source");

if (missingSource.length > 0) {
  console.warn(
    "AVISO mplus-canonical-backend: repo Android no disponible; no se pudo verificar la fuente canonica.",
  );
  console.log("OK mplus-canonical-backend (omitido)");
} else {
  const results = inspectCanonicalArtifacts();

  for (const result of results) {
    assert.notEqual(
      result.status,
      "missing-target",
      `Falta la copia Web de ${result.name}. Ejecuta: npm run sync:backend`,
    );
    assert.equal(
      result.status,
      "ok",
      `La copia Web de ${result.name} esta desactualizada respecto de Android. Ejecuta: npm run sync:backend`,
    );
  }

  // El manifiesto de indices debe declarar los tres indices compuestos del
  // contrato §20 y ninguno de colecciones retiradas.
  const indexesArtifact = CANONICAL_ARTIFACTS.find((a) => a.name === "firestore.indexes.json");
  assert.ok(indexesArtifact, "no se declaro el artefacto de indices");
  const manifest = JSON.parse(readFileSync(indexesArtifact.target, "utf8")) as {
    indexes: { collectionGroup: string; fields: { fieldPath: string; order: string }[] }[];
  };

  const signature = (fields: { fieldPath: string; order: string }[]) =>
    fields.map((f) => `${f.fieldPath}:${f.order}`).join(",");

  const declared = new Set(
    manifest.indexes.map((index) => `${index.collectionGroup}|${signature(index.fields)}`),
  );

  for (const expected of [
    "movements|ownerId:ASCENDING,lifecycleState:ASCENDING,occurredAt:DESCENDING",
    "movements|ownerId:ASCENDING,lifecycleState:ASCENDING,purgeAfter:ASCENDING",
    "movements|householdId:ASCENDING,lifecycleState:ASCENDING,occurredAt:DESCENDING",
  ]) {
    assert.equal(declared.has(expected), true, `falta el indice compuesto del contrato §20: ${expected}`);
  }

  const legacyCollections = [
    "household_review_items",
    "third_party_fund_entries",
    "third_party_fund_consumptions",
    "household_income_entries",
    "household_debts",
    "household_events",
    "pockets",
  ];
  for (const collectionGroup of manifest.indexes.map((index) => index.collectionGroup)) {
    assert.equal(
      legacyCollections.includes(collectionGroup),
      false,
      `el manifiesto de indices declara una coleccion retirada: ${collectionGroup}`,
    );
  }

  // `firebase.json` debe apuntar a las copias canonicas, no a un manifiesto propio.
  const firebaseJsonPath = resolve(process.cwd(), "firebase.json");
  assert.equal(existsSync(firebaseJsonPath), true);
  const firebaseJson = JSON.parse(readFileSync(firebaseJsonPath, "utf8")) as {
    firestore: { rules: string; indexes: string };
  };
  assert.equal(firebaseJson.firestore.rules, "tests/emulator/firestore.rules");
  assert.equal(firebaseJson.firestore.indexes, "tests/emulator/firestore.indexes.json");

  console.log("OK mplus-canonical-backend");
}
