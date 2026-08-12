import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [runtime, target, ...targetArgs] = process.argv.slice(2);
const allowedRuntimes = new Set(["EMULATOR", "QA_REAL"]);
const allowedTargets = new Set(["watch", "next"]);
const firebaseKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

if (!allowedRuntimes.has(runtime) || !allowedTargets.has(target)) {
  console.error(
    "Uso: run-firebase-environment.mjs EMULATOR|QA_REAL watch|next [...args]",
  );
  process.exit(1);
}

const parseEnvFile = (contents) => {
  const values = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) {
      throw new Error("Linea invalida en el archivo de ambiente QA.");
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
};

const validateQaValues = (qaValues) => {
  const missing = firebaseKeys.filter((key) => !qaValues[key]);
  if (missing.length > 0) {
    throw new Error(`Configuracion QA_REAL incompleta: ${missing.join(", ")}`);
  }

  const belongsToMPlus =
    qaValues.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "finanzas-m-plus" &&
    qaValues.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ===
      "finanzas-m-plus.firebaseapp.com" &&
    qaValues.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ===
      "finanzas-m-plus.firebasestorage.app" &&
    qaValues.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID === "608498270578" &&
    qaValues.NEXT_PUBLIC_FIREBASE_APP_ID.startsWith("1:608498270578:web:");

  if (!belongsToMPlus) {
    throw new Error("QA_REAL solo admite el proyecto finanzas-m-plus.");
  }
};

const childEnv = { ...process.env, NEXT_PUBLIC_FIREBASE_RUNTIME: runtime };
if (runtime === "EMULATOR") {
  for (const key of firebaseKeys) delete childEnv[key];
} else {
  const qaPath = path.resolve(".env.qa-real.local");
  if (!fs.existsSync(qaPath)) {
    throw new Error("Falta .env.qa-real.local para ejecutar QA_REAL.");
  }

  const qaValues = parseEnvFile(fs.readFileSync(qaPath, "utf8"));
  validateQaValues(qaValues);
  for (const key of firebaseKeys) childEnv[key] = qaValues[key];
}

const script =
  target === "watch"
    ? path.resolve("scripts/dev-watch.mjs")
    : path.resolve("node_modules/next/dist/bin/next");
if (!fs.existsSync(script)) {
  throw new Error("No se encontro el ejecutable local solicitado.");
}

const args = target === "watch" ? [script] : [script, ...targetArgs];
const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: childEnv,
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}

child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
