import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running unit tests for dev-server-isolation.test.ts...");

const workspaceRoot = path.resolve(__dirname, "../..");
const readWorkspaceFile = (relativePath: string) =>
  fs.readFileSync(path.join(workspaceRoot, relativePath), "utf-8");

export function runDevServerIsolationTests() {
  const nextConfig = readWorkspaceFile("next.config.ts");
  const packageJson = JSON.parse(readWorkspaceFile("package.json")) as { scripts?: Record<string, string> };
  const firebaseEnvironmentRunner = readWorkspaceFile("scripts/run-firebase-environment.mjs");

  // El precalentado de rutas se enciende desde el RUNNER, no desde el
  // supervisor: `npm run dev` importa `superviseNextDevelopment`, asi que la
  // comprobacion de "me han ejecutado directamente" de dev-watch.mjs no se
  // cumple por ese camino y el precalentado quedaba apagado en el uso real.
  assert.match(
    firebaseEnvironmentRunner,
    /superviseNextDevelopment\(\{[\s\S]*warmOnStart: true/,
    "el runner debe encender el precalentado de rutas",
  );
  const devWatch = readWorkspaceFile("scripts/dev-watch.mjs");

  // ORQ-041 / DEC-081: con un solo ambiente quedan dos artefactos —desarrollo y
  // build—, y ninguno puede volver a ser el `.next` por defecto.
  assert.match(
    nextConfig,
    /NODE_ENV\s*===\s*["']development["'][\s\S]*["']\.next-qa-dev["'][\s\S]*["']\.next-qa["']/,
    "next.config.ts debe separar desarrollo y build sin usar .next legacy"
  );
  assert.doesNotMatch(
    nextConfig,
    /\.next-dev|\.next-emulator|NEXT_PUBLIC_FIREBASE_RUNTIME/,
    "next.config.ts no debe conservar artefactos ni runtime del modo emulador"
  );
  assert.equal(
    packageJson.scripts?.dev,
    "node scripts/run-firebase-environment.mjs watch",
    "npm run dev debe validar el ambiente real antes de iniciar el supervisor"
  );
  assert.match(
    firebaseEnvironmentRunner,
    /target === "watch"[\s\S]*superviseNextDevelopment/,
    "el lanzador Firebase debe ejecutar el supervisor watch en el mismo proceso"
  );
  assert.match(
    devWatch,
    /export function superviseNextDevelopment[\s\S]*spawnProcess\(processRef\.execPath[\s\S]*child\.once\("close"/,
    "dev-watch debe supervisar Next local directamente y esperar close"
  );

  console.log("  ? Desarrollo y build usan cach?s separados y npm run dev usa el supervisor");
}

runDevServerIsolationTests();
