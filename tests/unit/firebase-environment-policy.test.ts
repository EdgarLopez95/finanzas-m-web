import assert from "node:assert/strict";
import { resolveFirebaseEnvironment } from "../../src/lib/firebase/environment";

const emulator = resolveFirebaseEnvironment({
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m",
});
assert.equal(emulator.runtime, "EMULATOR");
assert.equal(emulator.useEmulators, true);
assert.equal(emulator.config.projectId, "demo-finanzas-m-plus");

const qa = resolveFirebaseEnvironment({
  NEXT_PUBLIC_FIREBASE_RUNTIME: "QA_REAL",
  NEXT_PUBLIC_FIREBASE_API_KEY: "public-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "finanzas-m-plus.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m-plus",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "finanzas-m-plus.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "608498270578",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:608498270578:web:test",
});
assert.equal(qa.runtime, "QA_REAL");
assert.equal(qa.useEmulators, false);
assert.equal(qa.config.projectId, "finanzas-m-plus");

assert.throws(
  () =>
    resolveFirebaseEnvironment({
      NEXT_PUBLIC_FIREBASE_RUNTIME: "QA_REAL",
      NEXT_PUBLIC_FIREBASE_API_KEY: "public-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "finanzas-m-plus.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m-plus",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "otro-proyecto.firebasestorage.app",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "608498270578",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:608498270578:web:test",
    }),
  /finanzas-m-plus/,
);

assert.throws(
  () =>
    resolveFirebaseEnvironment({
      NEXT_PUBLIC_FIREBASE_RUNTIME: "QA_REAL",
      NEXT_PUBLIC_FIREBASE_API_KEY: "public-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "finanzas-m.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "finanzas-m.firebasestorage.app",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "826697479572",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:826697479572:web:test",
    }),
  /finanzas-m-plus/,
);

assert.throws(
  () =>
    resolveFirebaseEnvironment({ NEXT_PUBLIC_FIREBASE_RUNTIME: "QA_REAL" }),
  /incompleta/,
);

assert.throws(
  () =>
    resolveFirebaseEnvironment({ NEXT_PUBLIC_FIREBASE_RUNTIME: "PROD" }),
  /EMULATOR.*QA_REAL/,
);

console.log("OK firebase-environment-policy");
