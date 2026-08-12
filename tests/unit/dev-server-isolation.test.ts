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
    /distDir:\s*process\.env\.NODE_ENV\s*===\s*["']development["']\s*\?\s*["']\.next-dev["']\s*:\s*["']\.next["']/,
    "next.config.ts debe separar .next-dev para desarrollo de .next para build"
  );
  assert.equal(
    packageJson.scripts?.dev,
    "node scripts/run-firebase-environment.mjs EMULATOR watch",
    "npm run dev debe aislar Firebase en EMULATOR antes de iniciar el supervisor"
  );
  assert.match(
    firebaseEnvironmentRunner,
    /target === "watch"[\s\S]*path\.resolve\("scripts\/dev-watch\.mjs"\)/,
    "el lanzador Firebase debe conservar dev-watch como supervisor estable"
  );
  assert.match(
    devWatch,
    /path\.join\(process\.cwd\(\),\s*["']\.next-dev["']\)/,
    "dev-watch debe limpiar exclusivamente el cach? de desarrollo"
  );

  console.log("  ? Desarrollo y build usan cach?s separados y npm run dev usa el supervisor");
}

runDevServerIsolationTests();
