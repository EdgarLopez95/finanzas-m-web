import assert from "node:assert/strict";
import { resolveFirebaseEnvironment } from "../../src/lib/firebase/environment";

const registeredApiKey = "AIzaSyALPXlIPg8w7p0l5a8qHH05Qv_DTUs7dpk";

const qaEnvironment = {
  NEXT_PUBLIC_FIREBASE_RUNTIME: "QA_REAL",
  NEXT_PUBLIC_FIREBASE_API_KEY: registeredApiKey,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "finanzas-m-plus.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m-plus",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "finanzas-m-plus.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "608498270578",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:608498270578:web:test",
};

const emulator = resolveFirebaseEnvironment({
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m",
});
assert.equal(emulator.runtime, "EMULATOR");
assert.equal(emulator.useEmulators, true);
assert.equal(emulator.config.projectId, "demo-finanzas-m-plus");

const qa = resolveFirebaseEnvironment(qaEnvironment);
assert.equal(qa.runtime, "QA_REAL");
assert.equal(qa.useEmulators, false);
assert.equal(qa.config.projectId, "finanzas-m-plus");

assert.throws(
  () =>
    resolveFirebaseEnvironment({
      NEXT_PUBLIC_FIREBASE_RUNTIME: "QA_REAL",
      NEXT_PUBLIC_FIREBASE_API_KEY: registeredApiKey,
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

const explicitEmulator = resolveFirebaseEnvironment({
  NEXT_PUBLIC_FIREBASE_RUNTIME: "EMULATOR",
  NEXT_PUBLIC_FIREBASE_API_KEY: "legacy-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "finanzas-m.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "finanzas-m.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "826697479572",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:826697479572:web:legacy",
});
assert.deepEqual(explicitEmulator.config, {
  apiKey: "demo-key",
  authDomain: "demo-finanzas-m-plus.firebaseapp.com",
  projectId: "demo-finanzas-m-plus",
  storageBucket: "demo-finanzas-m-plus.appspot.com",
  messagingSenderId: "demo-sender",
  appId: "demo-finanzas-m-plus-web",
});

const regressionFailures: string[] = [];
const recordRegression = (name: string, assertion: () => void) => {
  try {
    assertion();
  } catch {
    regressionFailures.push(name);
  }
};

recordRegression("QA_REAL rechaza una API key ajena", () => {
  assert.throws(
    () =>
      resolveFirebaseEnvironment({
        ...qaEnvironment,
        NEXT_PUBLIC_FIREBASE_API_KEY: "other-public-key",
      }),
    /finanzas-m-plus/,
  );
});

recordRegression("QA_REAL rechaza valores obligatorios con solo espacios", () => {
  assert.throws(
    () =>
      resolveFirebaseEnvironment({
        ...qaEnvironment,
        NEXT_PUBLIC_FIREBASE_API_KEY: "   ",
      }),
    /incompleta/,
  );
});

recordRegression("EMULATOR entrega configuraciones independientes", () => {
  const first = resolveFirebaseEnvironment({
    NEXT_PUBLIC_FIREBASE_RUNTIME: "EMULATOR",
  });
  (first.config as { projectId: string }).projectId = "mutated-project";
  const second = resolveFirebaseEnvironment({
    NEXT_PUBLIC_FIREBASE_RUNTIME: "EMULATOR",
  });

  assert.notEqual(first.config, second.config);
  assert.equal(second.config.projectId, "demo-finanzas-m-plus");
});

assert.deepEqual(
  regressionFailures,
  [],
  `Regresiones Firebase pendientes: ${regressionFailures.join(", ")}`,
);

console.log("OK firebase-environment-policy");
