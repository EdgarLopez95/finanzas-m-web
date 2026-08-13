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
  const devWatch = readWorkspaceFile("scripts/dev-watch.mjs");

  assert.match(
    nextConfig,
    /NEXT_PUBLIC_FIREBASE_RUNTIME\s*===\s*["']QA_REAL["'][\s\S]*NODE_ENV\s*===\s*["']development["'][\s\S]*["']\.next-qa-dev["'][\s\S]*["']\.next-qa["'][\s\S]*["']\.next-dev["'][\s\S]*["']\.next-emulator["']/,
    "next.config.ts debe separar cuatro artefactos sin usar .next legacy"
  );
  assert.equal(
    packageJson.scripts?.dev,
    "node scripts/run-firebase-environment.mjs EMULATOR watch",
    "npm run dev debe aislar Firebase en EMULATOR antes de iniciar el supervisor"
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
