import assert from "node:assert/strict";
import fs from "node:fs";

/**
 * Artefactos de ejecucion tras ORQ-041 / DEC-081. Con un solo ambiente, la
 * separacion que queda es desarrollo vs. build; ninguno usa `.next` legacy y
 * ninguno menciona el emulador.
 */

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};
const nextConfig = fs.readFileSync("next.config.ts", "utf8");
const gitignore = fs.readFileSync(".gitignore", "utf8");
const tsconfig = fs.readFileSync("tsconfig.json", "utf8");
const devWatch = fs.readFileSync("scripts/dev-watch.mjs", "utf8");
const readme = fs.readFileSync("README.md", "utf8");
const authService = fs.readFileSync("src/features/auth/auth-service.ts", "utf8");
const envExample = fs.readFileSync(".env.local.example", "utf8");

assert.equal(pkg.scripts.start, "node scripts/run-firebase-environment.mjs next start");
assert.equal(pkg.scripts.build, "node scripts/run-firebase-environment.mjs next build");

// Dos artefactos vivos, declarados en los tres sitios que deben conocerlos.
for (const directory of [".next-qa-dev", ".next-qa"]) {
  const escaped = directory.replace(".", "\\.");
  assert.match(nextConfig, new RegExp(`"${escaped}"`));
  assert.match(gitignore, new RegExp(`/${escaped}/`));
  assert.match(tsconfig, new RegExp(`${escaped}/types/\\*\\*/\\*\\.ts`));
}

// Artefactos retirados con el modo emulador.
for (const directory of [".next-dev", ".next-emulator"]) {
  const escaped = directory.replace(".", "\\.");
  assert.doesNotMatch(nextConfig, new RegExp(`"${escaped}"`));
  assert.doesNotMatch(gitignore, new RegExp(`/${escaped}/`));
  assert.doesNotMatch(tsconfig, new RegExp(escaped));
  assert.equal(fs.existsSync(directory), false, `${directory} debio eliminarse`);
}

assert.doesNotMatch(nextConfig, /["']\.next["']/);
assert.doesNotMatch(tsconfig, /["']\.next\/types/);
assert.doesNotMatch(nextConfig, /NEXT_PUBLIC_FIREBASE_RUNTIME|QA_REAL|EMULATOR/);
assert.match(nextConfig, /isDevelopment \? "\.next-qa-dev" : "\.next-qa"/);

// El supervisor de desarrollo no cambia con esta retirada.
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

// Documentacion y mensajes al usuario apuntan al unico ambiente.
assert.match(readme, /\.env\.qa-real\.local/);
assert.match(readme, /No existe modo emulador/);
assert.doesNotMatch(
  readme,
  /dev:qa|build:qa|start:qa|usan el emulador/,
  "el README no puede seguir documentando comandos retirados",
);
assert.match(authService, /\.env\.qa-real\.local/);
assert.doesNotMatch(authService, /dev:qa/);

assert.match(envExample, /finanzas-m-plus/);
assert.doesNotMatch(envExample, /NEXT_PUBLIC_FIREBASE_RUNTIME/);

console.log("OK firebase-runtime-artifacts");
