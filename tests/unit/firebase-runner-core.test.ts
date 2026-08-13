import assert from "node:assert/strict";
import {
  createFirebaseChildEnvironment,
  parseEnvFile,
  validateQaValues,
} from "../../scripts/firebase-environment-core.mjs";

const qaConfig = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyALPXlIPg8w7p0l5a8qHH05Qv_DTUs7dpk",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "finanzas-m-plus.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m-plus",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "finanzas-m-plus.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "608498270578",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:608498270578:web:e97ccea7ffa7ed72871deb",
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
