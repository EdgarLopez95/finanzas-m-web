import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Timestamp } from "firebase/firestore";

import {
  householdInviteToFirestore,
  householdToFirestore,
  movementToFirestore,
  personalAccountToFirestore,
  personalCategoryToFirestore,
  userProfileToFirestore,
} from "../../src/lib/mplus/converters";
import {
  fixtureAccount,
  fixtureCategory,
  fixtureHousehold,
  fixtureHouseholdInvite,
  fixtureMovement,
  fixtureTrashedMovement,
  fixtureUser,
} from "../../src/lib/mplus/fixtures";

/**
 * Paridad de serializacion Web <-> Android (W1).
 *
 * Lee la prueba de fixtures CANONICA de Android
 * (`MplusFirestoreMapperFixtureTest.kt`) y contrasta, campo por campo, los
 * mapas Firestore que ella afirma contra los que produce la Web para el mismo
 * documento logico.
 *
 * Es la deteccion de "copia desactualizada" aplicada al contrato de datos: si
 * Android agrega, quita, renombra o cambia el tipo de un campo, esta prueba
 * falla en Web aunque nadie avise.
 */

const ANDROID_FIXTURE_TEST = resolve(
  process.cwd(),
  "../../android/app/src/test/java/com/finanzasm/app/data/remote/mplus/mapper/MplusFirestoreMapperFixtureTest.kt",
);

type NormalizedValue =
  | { kind: "null" }
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "timestamp"; seconds: number; nanos: number };

const parseKotlinLiteral = (raw: string): NormalizedValue => {
  const value = raw.trim().replace(/,$/, "").trim();

  if (value === "null") return { kind: "null" };

  const quoted = /^"(.*)"$/.exec(value);
  if (quoted) return { kind: "string", value: quoted[1] };

  const timestamp = /^Timestamp\(\s*([0-9_]+)L?\s*,\s*([0-9_]+)\s*\)$/.exec(value);
  if (timestamp) {
    return {
      kind: "timestamp",
      seconds: Number(timestamp[1].replace(/_/g, "")),
      nanos: Number(timestamp[2].replace(/_/g, "")),
    };
  }

  const numeric = /^-?[0-9_]+L?$/.exec(value);
  if (numeric) {
    return { kind: "number", value: Number(value.replace(/_/g, "").replace(/L$/, "")) };
  }

  throw new Error(`Literal Kotlin no soportado en el fixture canonico: ${value}`);
};

/** Extrae `{ nombreDeTest: { clave: valor } }` de los bloques `val fixture = mapOf(...)`. */
const parseAndroidFixtures = (source: string): Record<string, Record<string, NormalizedValue>> => {
  const fixtures: Record<string, Record<string, NormalizedValue>> = {};
  const lines = source.split(/\r?\n/);

  let currentTest: string | null = null;
  let inFixture = false;
  let current: Record<string, NormalizedValue> = {};

  for (const line of lines) {
    const testName = /^\s*fun\s+`([^`]+)`\s*\(\)/.exec(line);
    if (testName) {
      currentTest = testName[1];
      continue;
    }

    if (!inFixture && /^\s*val fixture = mapOf\(/.test(line)) {
      inFixture = true;
      current = {};
      continue;
    }

    if (inFixture) {
      if (/^\s*\)\s*$/.test(line)) {
        if (currentTest) fixtures[currentTest] = current;
        inFixture = false;
        continue;
      }
      const pair = /^\s*"([^"]+)"\s+to\s+(.+?)\s*,?\s*$/.exec(line);
      if (pair) {
        current[pair[1]] = parseKotlinLiteral(pair[2]);
      }
    }
  }

  return fixtures;
};

const normalizeWebValue = (value: unknown): NormalizedValue => {
  if (value === null || value === undefined) return { kind: "null" };
  if (value instanceof Timestamp) {
    return { kind: "timestamp", seconds: value.seconds, nanos: value.nanoseconds };
  }
  if (typeof value === "string") return { kind: "string", value };
  if (typeof value === "number") return { kind: "number", value };
  throw new Error(`Valor Web no soportado en la comparacion: ${String(value)}`);
};

const normalizeWebMap = (map: Record<string, unknown>): Record<string, NormalizedValue> =>
  Object.fromEntries(Object.entries(map).map(([key, value]) => [key, normalizeWebValue(value)]));

/** Nombre del test Kotlin (fragmento distintivo) -> mapa Firestore de la Web. */
const PAIRS: ReadonlyArray<{ androidTest: string; web: Record<string, unknown> }> = [
  { androidTest: "user fixture", web: userProfileToFirestore(fixtureUser) },
  { androidTest: "account fixture", web: personalAccountToFirestore(fixtureAccount) },
  { androidTest: "category fixture", web: personalCategoryToFirestore(fixtureCategory) },
  { androidTest: "movement fixture", web: movementToFirestore(fixtureMovement) },
  { androidTest: "trashed movement fixture", web: movementToFirestore(fixtureTrashedMovement) },
  { androidTest: "household fixture", web: householdToFirestore(fixtureHousehold) },
  { androidTest: "household invite fixture", web: householdInviteToFirestore(fixtureHouseholdInvite) },
];

if (!existsSync(ANDROID_FIXTURE_TEST)) {
  // El repo Android es la fuente canonica y vive fuera de este repo. Si no
  // esta disponible (checkout suelto de la Web), la paridad no se puede
  // verificar: se avisa en voz alta en vez de dar por buena la serializacion.
  console.warn(
    `AVISO mplus-android-fixture-parity: no se encontro la fuente canonica de fixtures en ${ANDROID_FIXTURE_TEST}. ` +
      "La paridad de serializacion Web<->Android NO se verifico en esta corrida.",
  );
} else {
  const androidFixtures = parseAndroidFixtures(readFileSync(ANDROID_FIXTURE_TEST, "utf8"));
  const androidTestNames = Object.keys(androidFixtures);

  assert.equal(
    androidTestNames.length,
    PAIRS.length,
    `Android declara ${androidTestNames.length} fixtures y la Web solo cubre ${PAIRS.length}. ` +
      `Fixtures Android: ${androidTestNames.join(" | ")}`,
  );

  for (const pair of PAIRS) {
    const matches = androidTestNames.filter((name) => name.startsWith(pair.androidTest));
    assert.equal(
      matches.length,
      1,
      `No se pudo ubicar un unico fixture Android para "${pair.androidTest}" (encontrados: ${matches.length})`,
    );

    const android = androidFixtures[matches[0]];
    const web = normalizeWebMap(pair.web);

    assert.deepEqual(
      Object.keys(web).slice().sort(),
      Object.keys(android).slice().sort(),
      `Claves distintas entre Web y Android para "${pair.androidTest}"`,
    );
    assert.deepEqual(web, android, `Valores distintos entre Web y Android para "${pair.androidTest}"`);
  }

  console.log(`OK mplus-android-fixture-parity (${PAIRS.length} fixtures contrastados)`);
}
