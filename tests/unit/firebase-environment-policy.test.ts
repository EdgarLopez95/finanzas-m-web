import assert from "node:assert/strict";
import {
  BLOCKED_LEGACY_PROJECT_ID,
  FIREBASE_RUNTIME,
  resolveFirebaseEnvironment,
} from "../../src/lib/firebase/environment";
import { REGISTERED_FIREBASE_WEB_APP } from "../../src/lib/firebase/registered-web-app.mjs";

/**
 * Politica de ambiente Firebase tras ORQ-041 / DEC-081: un solo entorno, el
 * proyecto real `finanzas-m-plus`. No hay modo emulador, ni proyecto `demo-*`,
 * ni fallback silencioso.
 */

const validEnvironment = {
  NEXT_PUBLIC_FIREBASE_API_KEY: REGISTERED_FIREBASE_WEB_APP.apiKey,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: REGISTERED_FIREBASE_WEB_APP.authDomain,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: REGISTERED_FIREBASE_WEB_APP.projectId,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: REGISTERED_FIREBASE_WEB_APP.storageBucket,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    REGISTERED_FIREBASE_WEB_APP.messagingSenderId,
  NEXT_PUBLIC_FIREBASE_APP_ID: REGISTERED_FIREBASE_WEB_APP.appId,
};

// --- el unico ambiente valido ---
{
  const resolved = resolveFirebaseEnvironment(validEnvironment);
  assert.equal(resolved.runtime, FIREBASE_RUNTIME);
  assert.equal(resolved.runtime, "QA_REAL");
  assert.equal(resolved.config.projectId, "finanzas-m-plus");
  assert.equal("useEmulators" in resolved, false, "ya no existe la nocion de emulador");
}

// --- ya no hay ambiente por defecto: sin configuracion, se bloquea ---
assert.throws(() => resolveFirebaseEnvironment({}), /incompleta/);
assert.throws(
  () => resolveFirebaseEnvironment({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m" }),
  /incompleta/,
  "una configuracion parcial no puede caer a ningun ambiente de respaldo",
);

// --- el proyecto de la app anterior se bloquea por nombre ---
assert.equal(BLOCKED_LEGACY_PROJECT_ID, "finanzas-m");
assert.throws(
  () =>
    resolveFirebaseEnvironment({
      NEXT_PUBLIC_FIREBASE_API_KEY: "public-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "finanzas-m.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "finanzas-m.firebasestorage.app",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "826697479572",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:826697479572:web:test",
    }),
  /nunca opera sobre el proyecto finanzas-m/,
);

// --- un runtime heredado del modo emulador falla de forma ruidosa ---
for (const runtime of ["EMULATOR", "PROD", ""]) {
  assert.throws(
    () =>
      resolveFirebaseEnvironment({
        ...validEnvironment,
        NEXT_PUBLIC_FIREBASE_RUNTIME: runtime,
      }),
    /ya no existe/,
    `NEXT_PUBLIC_FIREBASE_RUNTIME='${runtime}' debe bloquear, no ignorarse`,
  );
}
// Un archivo de ambiente que todavia declara QA_REAL sigue siendo valido.
assert.equal(
  resolveFirebaseEnvironment({
    ...validEnvironment,
    NEXT_PUBLIC_FIREBASE_RUNTIME: "QA_REAL",
  }).runtime,
  "QA_REAL",
);

// --- cualquier desviacion de la app Web registrada se rechaza ---
for (const [key, value] of [
  ["NEXT_PUBLIC_FIREBASE_API_KEY", "other-public-key"],
  ["NEXT_PUBLIC_FIREBASE_APP_ID", "1:608498270578:web:otro-cliente"],
  ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "otro-proyecto.firebaseapp.com"],
  ["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "otro-proyecto.firebasestorage.app"],
  ["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "123456789"],
  ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", "finanzas-m-plus-staging"],
] as const) {
  assert.throws(
    () => resolveFirebaseEnvironment({ ...validEnvironment, [key]: value }),
    /finanzas-m-plus/,
    `${key} ajeno debe rechazarse`,
  );
}

// Un valor obligatorio con solo espacios cuenta como ausente.
assert.throws(
  () =>
    resolveFirebaseEnvironment({
      ...validEnvironment,
      NEXT_PUBLIC_FIREBASE_API_KEY: "   ",
    }),
  /incompleta/,
);

// --- nada del ambiente retirado sobrevive en el modulo ---
{
  const source = require("node:fs").readFileSync(
    "src/lib/firebase/environment.ts",
    "utf8",
  ) as string;
  assert.doesNotMatch(source, /demo-finanzas|demo-key|demo-sender/);
  assert.doesNotMatch(source, /useEmulators/);
  assert.doesNotMatch(source, /127\.0\.0\.1|10\.0\.2\.2/);
}

console.log("OK firebase-environment-policy");
