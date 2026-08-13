import assert from "node:assert/strict";
import fs from "node:fs";

const harnessFiles = fs
  .readdirSync("tests/emulator")
  .filter((name) => /^run-.*\.ts$/.test(name));

for (const file of harnessFiles) {
  const source = fs.readFileSync(`tests/emulator/${file}`, "utf8");
  const firstImport = source.match(/^import\s+[^;]+;/m)?.[0] ?? "";
  assert.match(
    firstImport,
    /firebase-emulator-environment/,
    `${file} debe cargar el bootstrap antes de cualquier otro import ESM`,
  );
  assert.doesNotMatch(
    source,
    /process\.env\.NEXT_PUBLIC_FIREBASE_[A-Z_]+\s*\|\|=/,
    `${file} no debe conservar asignaciones tardias con ||=`,
  );
}

const bootstrap = fs.readFileSync(
  "tests/emulator/firebase-emulator-environment.ts",
  "utf8",
);
for (const key of [
  "NEXT_PUBLIC_FIREBASE_RUNTIME",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
]) {
  assert.match(bootstrap, new RegExp(`process\\.env\\.${key}\\s*=`));
}
assert.doesNotMatch(bootstrap, /\|\|=/);

process.env.NEXT_PUBLIC_FIREBASE_RUNTIME = "QA_REAL";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "finanzas-m";
require("../../tests/emulator/firebase-emulator-environment");
assert.equal(process.env.NEXT_PUBLIC_FIREBASE_RUNTIME, "EMULATOR");
assert.equal(
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  "demo-finanzas-m-plus",
);

console.log("OK firebase-emulator-harness-order");
