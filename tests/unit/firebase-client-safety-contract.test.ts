import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/lib/firebase/client.ts", "utf8");

// El cliente sigue leyendo su configuracion del ambiente publico y validandola
// con la politica unica antes de crear la app.
assert.match(source, /resolveFirebaseEnvironment/);
assert.match(source, /process\.env\.NEXT_PUBLIC_FIREBASE_API_KEY/);
assert.match(source, /process\.env\.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN/);
assert.match(source, /process\.env\.NEXT_PUBLIC_FIREBASE_PROJECT_ID/);
assert.match(source, /process\.env\.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET/);
assert.match(source, /process\.env\.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID/);
assert.match(source, /process\.env\.NEXT_PUBLIC_FIREBASE_APP_ID/);
assert.match(source, /finanzas-m-plus-web/);
assert.match(source, /existingApp\.options\.projectId/);
assert.match(source, /getFirestore\(getAppInstance\(\)\)/);
assert.match(source, /getFirebaseRuntime/);

// ORQ-041 / DEC-081: ni una linea de emulador puede volver al cliente.
assert.doesNotMatch(source, /connectAuthEmulator|connectFirestoreEmulator/);
assert.doesNotMatch(source, /127\.0\.0\.1|10\.0\.2\.2|localhost/);
assert.doesNotMatch(source, /9099|8080/);
assert.doesNotMatch(source, /useEmulators|EMULATOR|demo-finanzas/);

// Web es online-only (contrato §22): sigue prohibida la cache persistente.
assert.doesNotMatch(
  source,
  /persistentLocalCache|persistentMultipleTabManager|initializeFirestore/,
);

// La resolucion es perezosa: el bloqueo por ambiente invalido ocurre antes de
// crear la app (y por tanto antes de cualquier lectura o escritura), pero
// importar el modulo no exige credenciales.
assert.match(source, /const getEnvironment = \(\)/);
assert.match(source, /const environment = getEnvironment\(\);/);
assert.doesNotMatch(
  source,
  /^const environment = resolveFirebaseEnvironment/m,
  "la configuracion no debe resolverse en el ambito del modulo",
);

console.log("OK firebase-client-safety-contract");
