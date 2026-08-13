import assert from "node:assert/strict";
import {
  createFirebaseChildEnvironment,
  parseEnvFile,
  validateQaValues,
} from "../../scripts/firebase-environment-core.mjs";
import { REGISTERED_FIREBASE_WEB_APP } from "../../src/lib/firebase/registered-web-app.mjs";

const qaConfig = {
  NEXT_PUBLIC_FIREBASE_API_KEY: REGISTERED_FIREBASE_WEB_APP.apiKey,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: REGISTERED_FIREBASE_WEB_APP.authDomain,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: REGISTERED_FIREBASE_WEB_APP.projectId,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: REGISTERED_FIREBASE_WEB_APP.storageBucket,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    REGISTERED_FIREBASE_WEB_APP.messagingSenderId,
  NEXT_PUBLIC_FIREBASE_APP_ID: REGISTERED_FIREBASE_WEB_APP.appId,
};

assert.deepEqual(
  parseEnvFile(" A = one \nB='two'\nC=\"three\"\n"),
  { A: "one", B: "two", C: "three" },
);
assert.deepEqual(validateQaValues(qaConfig), qaConfig);

for (const invalid of [
  { ...qaConfig, NEXT_PUBLIC_FIREBASE_API_KEY: "wrong" },
  { ...qaConfig, NEXT_PUBLIC_FIREBASE_APP_ID: "1:608498270578:web:wrong" },
  { ...qaConfig, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m" },
  { ...qaConfig, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "finanzas-m.firebaseapp.com" },
  { ...qaConfig, NEXT_PUBLIC_FIREBASE_API_KEY: ` ${qaConfig.NEXT_PUBLIC_FIREBASE_API_KEY}` },
]) {
  assert.throws(() => validateQaValues(invalid), /finanzas-m-plus|invalida/);
}

const inherited = {
  KEEP_ME: "yes",
  ...qaConfig,
  NEXT_PUBLIC_FIREBASE_RUNTIME: "QA_REAL",
};
const emulator = createFirebaseChildEnvironment("EMULATOR", inherited);
assert.equal(emulator.KEEP_ME, "yes");
assert.equal(emulator.NEXT_PUBLIC_FIREBASE_RUNTIME, "EMULATOR");
for (const key of Object.keys(qaConfig)) assert.equal(emulator[key], undefined);

const qa = createFirebaseChildEnvironment("QA_REAL", { KEEP_ME: "yes" }, qaConfig);
assert.equal(qa.KEEP_ME, "yes");
assert.equal(qa.NEXT_PUBLIC_FIREBASE_RUNTIME, "QA_REAL");
assert.deepEqual(
  Object.fromEntries(Object.keys(qaConfig).map((key) => [key, qa[key]])),
  qaConfig,
);

console.log("OK firebase-runner-core");
