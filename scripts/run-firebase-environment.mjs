import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  createFirebaseChildEnvironment,
  parseEnvFile,
} from "./firebase-environment-core.mjs";

const allowedTargets = new Set(["watch", "next"]);

export const runFirebaseEnvironment = (argv, inheritedEnvironment) => {
  const [runtime, target, ...targetArgs] = argv;
  if (
    (runtime !== "EMULATOR" && runtime !== "QA_REAL") ||
    !allowedTargets.has(target)
  ) {
    throw new Error(
      "Uso: run-firebase-environment.mjs EMULATOR|QA_REAL watch|next [...args]",
    );
  }

  let qaValues;
  if (runtime === "QA_REAL") {
    const qaPath = path.resolve(".env.qa-real.local");
    if (!fs.existsSync(qaPath)) {
      throw new Error("Falta .env.qa-real.local para ejecutar QA_REAL.");
    }
    qaValues = parseEnvFile(fs.readFileSync(qaPath, "utf8"));
  }

  const childEnvironment = createFirebaseChildEnvironment(
    runtime,
    inheritedEnvironment,
    qaValues,
  );
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
    env: childEnvironment,
    shell: false,
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

  return child;
};

const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    runFirebaseEnvironment(process.argv.slice(2), process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
