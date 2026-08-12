import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/lib/firebase/client.ts", "utf8");

assert.match(source, /resolveFirebaseEnvironment/);
assert.match(source, /process\.env\.NEXT_PUBLIC_FIREBASE_RUNTIME/);
assert.match(source, /process\.env\.NEXT_PUBLIC_FIREBASE_API_KEY/);
assert.match(source, /process\.env\.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN/);
assert.match(source, /process\.env\.NEXT_PUBLIC_FIREBASE_PROJECT_ID/);
assert.match(source, /process\.env\.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET/);
assert.match(source, /process\.env\.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID/);
assert.match(source, /process\.env\.NEXT_PUBLIC_FIREBASE_APP_ID/);
assert.match(source, /finanzas-m-plus-web/);
assert.match(source, /existingApp\.options\.projectId/);
assert.match(source, /connectAuthEmulator/);
assert.match(source, /http:\/\/127\.0\.0\.1:9099/);
assert.match(source, /connectFirestoreEmulator/);
assert.match(source, /"127\.0\.0\.1", 8080/);
assert.match(source, /getFirestore\(app\)/);
assert.match(source, /getFirebaseRuntime/);
assert.doesNotMatch(
  source,
  /persistentLocalCache|persistentMultipleTabManager|initializeFirestore/,
);

console.log("OK firebase-client-safety-contract");
