import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  createFirebaseChildEnvironment,
  FIREBASE_KEYS,
  parseEnvFile,
} from "./firebase-environment-core.mjs";
import { superviseNextDevelopment } from "./dev-watch.mjs";

/**
 * Lanzador de Next con el ambiente Firebase validado (ORQ-041 / DEC-081).
 *
 * Ya no recibe un runtime: la Web solo opera contra el proyecto real
 * `finanzas-m-plus`. Uso:
 *
 *   node scripts/run-firebase-environment.mjs watch
 *   node scripts/run-firebase-environment.mjs next build
 */

const allowedTargets = new Set(["watch", "next"]);

export const ENVIRONMENT_FILE = ".env.qa-real.local";

export const runFirebaseEnvironment = (argv, inheritedEnvironment) => {
  const [target, ...targetArgs] = argv;
  if (!allowedTargets.has(target)) {
    throw new Error("Uso: run-firebase-environment.mjs watch|next [...args]");
  }

  const environmentPath = path.resolve(ENVIRONMENT_FILE);
  let values;
  if (fs.existsSync(environmentPath)) {
    values = parseEnvFile(fs.readFileSync(environmentPath, "utf8"));
  } else {
    // Entornos CI / Vercel / Cloud: las variables se inyectan en process.env
    values = {};
    for (const key of FIREBASE_KEYS) {
      if (inheritedEnvironment && inheritedEnvironment[key]) {
        values[key] = inheritedEnvironment[key];
      }
    }
    const hasAny = Object.keys(values).length > 0;
    if (!hasAny) {
      throw new Error(
        `Falta ${ENVIRONMENT_FILE} y no se encontraron variables de entorno en el sistema. Copia .env.local.example con los valores de finanzas-m-plus.`,
      );
    }
  }

  const childEnvironment = createFirebaseChildEnvironment(
    inheritedEnvironment,
    values,
  );
  if (target === "watch") {
    // `warmOnStart` se pasa AQUI porque este es el punto de entrada real de
    // `npm run dev`: importa el supervisor, asi que su comprobacion de "me han
    // ejecutado directamente" nunca se cumple por este camino.
    return superviseNextDevelopment({
      environment: childEnvironment,
      warmOnStart: true,
    });
  }

  const script = path.resolve("node_modules/next/dist/bin/next");
  if (!fs.existsSync(script)) {
    throw new Error("No se encontro el ejecutable local solicitado.");
  }

  const child = spawn(process.execPath, [script, ...targetArgs], {
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
