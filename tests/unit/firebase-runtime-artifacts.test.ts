import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const nextConfig = fs.readFileSync("next.config.ts", "utf8");
const gitignore = fs.readFileSync(".gitignore", "utf8");
const tsconfig = fs.readFileSync("tsconfig.json", "utf8");
const devWatch = fs.readFileSync("scripts/dev-watch.mjs", "utf8");
const readme = fs.readFileSync("README.md", "utf8");
const authService = fs.readFileSync("src/features/auth/auth-service.ts", "utf8");

assert.equal(
  pkg.scripts.start,
  "node scripts/run-firebase-environment.mjs EMULATOR next start",
);
assert.equal(
  pkg.scripts["start:qa"],
  "node scripts/run-firebase-environment.mjs QA_REAL next start",
);
assert.match(pkg.scripts.build, /EMULATOR/);
assert.match(pkg.scripts["build:qa"], /QA_REAL/);
for (const directory of [
  ".next-dev",
  ".next-emulator",
  ".next-qa-dev",
  ".next-qa",
]) {
  assert.match(nextConfig, new RegExp(`"${directory.replace(".", "\\.")}"`));
  assert.match(gitignore, new RegExp(`/${directory.replace(".", "\\.")}/`));
  assert.match(
    tsconfig,
    new RegExp(`${directory.replace(".", "\\.")}/types/\\*\\*/\\*\\.ts`),
  );
}
assert.doesNotMatch(nextConfig, /["']\.next["']/);
assert.doesNotMatch(tsconfig, /["']\.next\/types/);
assert.match(nextConfig, /QA_REAL[\s\S]*development[\s\S]*\.next-qa-dev[\s\S]*\.next-qa/);
assert.match(nextConfig, /development[\s\S]*\.next-dev[\s\S]*\.next-emulator/);
assert.match(gitignore, /\/\.next-qa\//);

assert.match(devWatch, /node_modules\/next\/dist\/bin\/next/);
assert.match(devWatch, /processRef\.execPath/);
assert.match(devWatch, /shell:\s*false/);
assert.doesNotMatch(devWatch, /npx|cmd\.exe|shell:\s*true/);
assert.doesNotMatch(devWatch, /taskkill|process\.exit\(0\)/);
assert.match(devWatch, /export function superviseNextDevelopment/);
assert.match(devWatch, /child\.once\("close"/);

const runner = fs.readFileSync("scripts/run-firebase-environment.mjs", "utf8");
assert.match(runner, /import \{ superviseNextDevelopment \}/);
assert.match(runner, /target === "watch"[\s\S]*superviseNextDevelopment/);
assert.doesNotMatch(runner, /path\.resolve\("scripts\/dev-watch\.mjs"\)/);

assert.match(readme, /\.env\.qa-real\.local/);
assert.match(readme, /dev:qa/);
assert.match(readme, /build:qa/);
assert.doesNotMatch(readme, /Crea `\.env\.local`/);
assert.match(authService, /\.env\.qa-real\.local/);
assert.doesNotMatch(authService, /Configura \.env\.local/);

console.log("OK firebase-runtime-artifacts");
