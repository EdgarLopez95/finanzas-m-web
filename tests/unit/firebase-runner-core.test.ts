import assert from "node:assert/strict";
import {
  FIREBASE_KEYS,
  createFirebaseChildEnvironment,
  parseEnvFile,
  validateFirebaseValues,
} from "../../scripts/firebase-environment-core.mjs";
import { REGISTERED_FIREBASE_WEB_APP } from "../../src/lib/firebase/registered-web-app.mjs";

/**
 * Nucleo de ambiente de los comandos npm (ORQ-041 / DEC-081): un solo entorno,
 * validado contra la app Web registrada de `finanzas-m-plus`.
 */

const config = {
  NEXT_PUBLIC_FIREBASE_API_KEY: REGISTERED_FIREBASE_WEB_APP.apiKey,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: REGISTERED_FIREBASE_WEB_APP.authDomain,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: REGISTERED_FIREBASE_WEB_APP.projectId,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: REGISTERED_FIREBASE_WEB_APP.storageBucket,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    REGISTERED_FIREBASE_WEB_APP.messagingSenderId,
  NEXT_PUBLIC_FIREBASE_APP_ID: REGISTERED_FIREBASE_WEB_APP.appId,
};

assert.deepEqual(
  parseEnvFile(" A = one \nB='two'\nC=\"three\"\n# comentario\n"),
  { A: "one", B: "two", C: "three" },
);

assert.deepEqual(validateFirebaseValues(config), config);

// El proyecto de la app anterior se bloquea por nombre, antes que cualquier
// otra comparacion: es el error mas caro posible.
assert.throws(
  () =>
    validateFirebaseValues({
      ...config,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m",
    }),
  /nunca opera sobre el proyecto finanzas-m/,
);

for (const invalid of [
  { ...config, NEXT_PUBLIC_FIREBASE_API_KEY: "wrong" },
  { ...config, NEXT_PUBLIC_FIREBASE_APP_ID: "1:608498270578:web:wrong" },
  { ...config, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "finanzas-m.firebaseapp.com" },
  { ...config, NEXT_PUBLIC_FIREBASE_API_KEY: ` ${config.NEXT_PUBLIC_FIREBASE_API_KEY}` },
]) {
  assert.throws(() => validateFirebaseValues(invalid), /finanzas-m-plus|invalida/);
}

for (const key of FIREBASE_KEYS) {
  const incomplete = { ...config };
  delete (incomplete as Record<string, string>)[key];
  assert.throws(() => validateFirebaseValues(incomplete), /incompleta/);
}

// El ambiente hijo conserva lo ajeno, impone la configuracion validada y
// descarta cualquier credencial o runtime heredado del shell.
const child = createFirebaseChildEnvironment(
  {
    KEEP_ME: "yes",
    NEXT_PUBLIC_FIREBASE_RUNTIME: "EMULATOR",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m",
    NEXT_PUBLIC_FIREBASE_API_KEY: "clave-del-shell",
  },
  config,
);
assert.equal(child.KEEP_ME, "yes");
assert.equal(
  child.NEXT_PUBLIC_FIREBASE_RUNTIME,
  undefined,
  "un runtime heredado del modo emulador no puede llegar al proceso hijo",
);
assert.deepEqual(
  Object.fromEntries(FIREBASE_KEYS.map((key) => [key, child[key]])),
  config,
);

assert.throws(() => createFirebaseChildEnvironment({}, {}), /incompleta/);
assert.throws(() => createFirebaseChildEnvironment({}), /incompleta/);

console.log("OK firebase-runner-core");
